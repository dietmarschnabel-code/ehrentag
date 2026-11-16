'use strict';

// Ehrentag-Manager user interface.
// Depends on i18n.js (texts), logic.js (pure date/validation helpers) and banner.js.
// The backend (src-tauri/src/lib.rs) stores the data; this file talks to it via invoke().

const KINDS = Exchange.KINDS; // 'birthday', 'nameday', 'wedding', 'other'
const isAndroid = /android/i.test(navigator.userAgent);

function defaultSettings() {
  return {
    count: 3,
    days_ahead: 0,
    language: '',
    remind: false,
    remind_hour: 9,
    remind_days_before: 1,
    warn_days: 7,
    banner_text: 'MARTIN',
    subtitle_mode: 'carnival',
    subtitle_text: '',
  };
}

const state = {
  entries: [],
  settings: defaultSettings(),
  dataPath: '',
  editing: null, // index of the entry being edited
  confirmDelete: null, // index waiting for "Really delete"
  formMessage: null, // { error, text }
  migration: null, // set when the old gebdatei.dat was converted to events.json at this start
  exportText: '', // the exported text while it is shown for copying (keeps the CRLF line breaks)
};

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

// ───────────────────────────── Backend ─────────────────────────────

// Outside of Tauri (e.g. when index.html is opened in a normal browser for a quick
// design preview) a small in-memory mock stands in for the Rust backend.
const mock = {
  entries: [
    { id: 'demo-1', day: 24, month: 12, year: 1980, name: 'Maria Muster', kind: 'birthday' },
    { id: 'demo-2', day: 11, month: 11, year: 0, name: 'Martin Beispiel', kind: 'nameday' },
    { id: 'demo-3', day: 3, month: 6, year: 2001, name: 'Anna & Paul', kind: 'wedding' },
  ],
  settings: defaultSettings(),
};

async function backend(cmd, args) {
  if (window.__TAURI__ && window.__TAURI__.core) {
    return window.__TAURI__.core.invoke(cmd, args);
  }
  switch (cmd) {
    case 'get_state':
      return { entries: mock.entries, settings: mock.settings, data_path: '(browser preview)/events.json', migration: null };
    case 'save_entries':
      mock.entries = args.entries.map((e) => ({ ...e, id: e.id || Exchange.newId() })).sort((a, b) => a.month - b.month || a.day - b.day);
      return mock.entries;
    case 'save_settings':
      mock.settings = args.settings;
      return args.settings;
    case 'parse_legacy':
      return [];
    default:
      throw 'not available in the browser preview';
  }
}

// ───────────────────────────── Language ─────────────────────────────

const isSupportedLanguage = (code) => LANGUAGES.some((l) => l.code === code);

/** First of the browser's / phone's preferred languages that the app supports, else English. */
function detectLanguage() {
  const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  for (const p of prefs) {
    const code = String(p).toLowerCase().split('-')[0];
    if (isSupportedLanguage(code)) return code;
  }
  return 'en';
}

/** Code of the language in use: the chosen one, or the system language if set to automatic. */
function lang() {
  const l = state.settings.language;
  return isSupportedLanguage(l) ? l : detectLanguage();
}

function langInfo() {
  const code = lang();
  return LANGUAGES.find((l) => l.code === code);
}

/** Translated text; {0}, {1}, ... are replaced by the arguments (plural forms are picked by args[0]). */
function t(key, args = []) {
  const info = langInfo();
  let s = I18N[info.code][key];
  if (s === undefined) s = I18N.en[key];
  if (s === undefined) return key;
  if (typeof s === 'object') {
    const category = new Intl.PluralRules(info.locale).select(Number(args[0]));
    s = s[category] !== undefined ? s[category] : s.other;
  }
  args.forEach((a, i) => {
    s = s.split('{' + i + '}').join(String(a));
  });
  return s;
}

function fmtDate(d) {
  return new Intl.DateTimeFormat(langInfo().locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** Fills the language selector in the editor (own names, so everyone finds theirs). */
function buildLanguageSelect() {
  const sel = $('set-language');
  sel.replaceChildren();
  const auto = el('option', null);
  auto.value = '';
  auto.dataset.i18n = 'langAuto';
  sel.append(auto);
  LANGUAGES.forEach((l) => {
    const o = el('option', null, l.name);
    o.value = l.code;
    sel.append(o);
  });
}

/** The window title of the desktop app (there is no title bar on Android). */
function setWindowTitle(title) {
  try {
    const w = window.__TAURI__ && window.__TAURI__.window;
    if (w && w.getCurrentWindow) w.getCurrentWindow().setTitle(title).catch(() => {});
  } catch (e) {
    /* not available: keep the title from tauri.conf.json */
  }
}

function applyI18n() {
  const info = langInfo();
  document.documentElement.lang = info.code;
  document.documentElement.dir = info.dir; // right-to-left for Arabic
  document.title = t('appTitle');
  setWindowTitle(t('appTitle'));
  document.querySelectorAll('[data-i18n]').forEach((n) => {
    n.textContent = t(n.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => {
    n.placeholder = t(n.dataset.i18nPh);
  });
}

// ───────────────────────────── Texts for entries ─────────────────────────────

const kindLabel = (k) => t('kind_' + k);
const pad = (n) => String(n).padStart(2, '0');

function kindText(e, years) {
  const ord = ordinal(lang(), years);
  switch (e.kind) {
    case 'birthday':
      return e.year > 0 ? t('birthdayN', [ord]) : t('birthday');
    case 'nameday':
      return t('nameDay');
    case 'wedding':
      return e.year > 0 ? t('weddingN', [ord]) : t('kind_wedding');
    default:
      return e.year > 0 ? t('otherN', [ord]) : t('otherPlain');
  }
}

function whenText(days) {
  if (days === 0) return t('whenToday');
  if (days === 1) return t('whenTomorrow');
  return t('whenInDays', [days]);
}

function displayName(e) {
  return e.kind === 'nameday' ? firstNameUpper(e.name) : e.name;
}

// ───────────────────────────── Overview ─────────────────────────────

function makeCard(date, e, today) {
  const days = daysBetween(today, date);
  const years = e.year > 0 ? date.getFullYear() - e.year : 0;
  const warn = state.settings.warn_days;
  const card = el('div', 'card kind-' + e.kind + (days === 0 ? ' is-today' : '') + (warn > 0 && days <= warn ? ' is-warn' : ''));
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', displayName(e)), el('span', 'card-when', whenText(days)));
  card.append(top, el('div', 'card-line', fmtDate(date) + ' · ' + kindText(e, years)));
  return card;
}

/** The line below the banner, depending on the chosen message. */
function subtitleText(today, carnivalDay, moment) {
  const s = state.settings;
  switch (s.subtitle_mode) {
    case 'none':
      return '';
    case 'custom':
      return s.subtitle_text;
    case 'easter':
    case 'christmaseve':
    case 'christmas':
    case 'newyear': {
      const days = daysBetween(today, nextEventDate(s.subtitle_mode, today));
      const name = t('event_' + s.subtitle_mode);
      if (days === 0) return t('eventToday', [name]);
      if (days === 1) return t('eventTomorrow', [name]);
      return t('eventDays', [days, name]);
    }
    default: {
      // carnival season starts on 11 Nov at 11:11
      if (moment) return t('subMoment');
      if (carnivalDay) return t('subParty');
      let next = new Date(today.getFullYear(), 10, 11);
      if (next < today) next = new Date(today.getFullYear() + 1, 10, 11);
      const days = daysBetween(today, next);
      return t('subCountdown', [days === 1 ? t('daysOne') : t('daysMany', [days])]);
    }
  }
}

function renderOverview() {
  const now = new Date();
  const today = startOfDay(now);
  const carnivalDay = now.getMonth() === 10 && now.getDate() === 11;
  const moment = carnivalDay && now.getHours() === 11 && now.getMinutes() === 11;
  Banner.setConfetti(moment ? 400 : carnivalDay ? 200 : 90);

  const migrated = $('migrated-note');
  migrated.hidden = !state.migration;
  if (state.migration) migrated.textContent = t('migratedNote', [state.migration.from_name, state.migration.backup_name]);

  Banner.setText(state.settings.banner_text);
  const sub = subtitleText(today, carnivalDay, moment);
  $('subtitle').textContent = sub;
  $('subtitle').hidden = sub === '';
  $('today').textContent = t('todayIs', [fmtDate(now)]);

  const within = state.settings.days_ahead;
  let upcoming = state.entries.map((e) => ({ e, date: nextOccurrence(e, today) }));
  upcoming.sort((a, b) => a.date - b.date);
  if (within > 0) upcoming = upcoming.filter((x) => daysBetween(today, x.date) <= within);
  upcoming = upcoming.slice(0, state.settings.count);

  const cards = $('cards');
  cards.replaceChildren(...upcoming.map((x) => makeCard(x.date, x.e, today)));

  const heading = $('upcoming-heading');
  const note = $('overview-note');
  heading.hidden = upcoming.length === 0;
  heading.textContent = t('upcoming');
  note.hidden = upcoming.length > 0;
  if (state.entries.length === 0) note.textContent = t('noEntries');
  else if (upcoming.length === 0) note.textContent = t('noneInWindow', [within]);
}

// ───────────────────────────── Manage view ─────────────────────────────

function setFormMessage(error, text) {
  state.formMessage = text ? { error, text } : null;
  renderFormMessage();
}

function renderFormMessage() {
  const m = $('form-message');
  if (!state.formMessage) {
    m.hidden = true;
    return;
  }
  m.hidden = false;
  m.textContent = state.formMessage.text;
  m.className = 'message' + (state.formMessage.error ? ' error' : '');
}

function updateYearHint() {
  const kind = $('f-kind').value || 'birthday';
  $('year-hint').textContent = t('yearLine', [t('hint_' + kind)]);
  const year = $('f-year');
  year.disabled = kind === 'nameday';
  if (kind === 'nameday') year.value = '';
}

function clearForm() {
  $('f-name').value = '';
  $('f-day').value = '';
  $('f-month').value = '';
  $('f-year').value = '';
  $('f-kind').value = 'birthday';
  state.editing = null;
  updateYearHint();
}

function renderList() {
  const ul = $('entry-list');
  ul.replaceChildren();
  state.entries.forEach((e, i) => {
    const li = el('li');
    const main = el('div', 'entry-main');
    main.append(
      el('div', 'entry-name', e.name),
      el('div', 'entry-meta', pad(e.day) + '.' + pad(e.month) + '.' + (e.year > 0 ? e.year : '----') + ' · ' + kindLabel(e.kind))
    );

    const actions = el('div', 'entry-actions');
    const bEdit = el('button', null, t('btnEdit'));
    bEdit.type = 'button';
    bEdit.addEventListener('click', () => startEdit(i));
    actions.append(bEdit);

    if (state.confirmDelete === i) {
      const bYes = el('button', 'danger', t('btnReallyDelete'));
      bYes.type = 'button';
      bYes.addEventListener('click', () => doDelete(i));
      const bNo = el('button', null, t('btnNo'));
      bNo.type = 'button';
      bNo.addEventListener('click', () => {
        state.confirmDelete = null;
        renderList();
      });
      actions.append(bYes, bNo);
    } else {
      const bDel = el('button', null, t('btnDelete'));
      bDel.type = 'button';
      bDel.addEventListener('click', () => {
        state.confirmDelete = i;
        renderList();
      });
      actions.append(bDel);
    }

    li.append(main, actions);
    ul.append(li);
  });
}

function renderManage() {
  $('file-label').textContent = t('fileLabel', [state.dataPath]);

  const editing = state.editing !== null;
  $('form-title').textContent = t(editing ? 'formEdit' : 'formNew');
  $('btn-save').textContent = t(editing ? 'btnSave' : 'btnAdd');
  $('btn-cancel').hidden = !editing;

  const sel = $('f-kind');
  const current = sel.value || 'birthday';
  sel.replaceChildren(
    ...KINDS.map((k) => {
      const o = el('option', null, kindLabel(k));
      o.value = k;
      return o;
    })
  );
  sel.value = current;
  updateYearHint();
  renderFormMessage();

  const s = state.settings;
  $('set-count').value = s.count;
  $('set-count-out').textContent = s.count;
  $('set-days').value = s.days_ahead;
  $('set-days-out').textContent = t('daysUnit', [s.days_ahead]);
  $('set-language').value = s.language;
  $('set-remind').checked = s.remind;
  const hour = $('set-hour');
  if (hour.options.length === 0) {
    for (let h = 0; h < 24; h++) {
      const o = el('option', null, pad(h) + ':00');
      o.value = String(h);
      hour.append(o);
    }
  }
  hour.value = String(s.remind_hour);
  $('set-before').value = s.remind_days_before;
  $('set-warn').value = s.warn_days;
  $('set-warn-out').textContent = t('daysUnit', [s.warn_days]);
  $('set-banner').value = s.banner_text;
  $('set-subtitle').value = s.subtitle_mode;
  $('set-subtext').value = s.subtitle_text;
  $('subtext-field').hidden = s.subtitle_mode !== 'custom';

  $('list-title').textContent = t('allEntries', [state.entries.length]);
  renderList();
}

function startEdit(i) {
  const e = state.entries[i];
  state.editing = i;
  state.confirmDelete = null;
  state.formMessage = null;
  $('f-name').value = e.name;
  $('f-kind').value = e.kind;
  $('f-day').value = String(e.day);
  $('f-month').value = String(e.month);
  $('f-year').value = e.year > 0 ? String(e.year) : '';
  renderManage();
  $('entry-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('f-name').focus();
}

async function doDelete(i) {
  const list = state.entries.filter((_, idx) => idx !== i);
  state.confirmDelete = null;
  try {
    state.entries = await backend('save_entries', { entries: list });
    clearForm();
    state.formMessage = { error: false, text: t('okDeleted') };
    scheduleReminders();
  } catch (e) {
    state.formMessage = { error: true, text: t('errSave', [String(e)]) };
  }
  renderManage();
}

async function submitForm(ev) {
  ev.preventDefault();
  const res = validateForm(
    {
      name: $('f-name').value,
      kind: $('f-kind').value,
      day: $('f-day').value,
      month: $('f-month').value,
      year: $('f-year').value,
    },
    new Date().getFullYear()
  );
  if (res.error) {
    setFormMessage(true, t(res.error));
    return;
  }

  const list = state.entries.slice();
  const wasEdit = state.editing !== null && state.editing < list.length;
  if (wasEdit) list[state.editing] = { ...res.entry, id: list[state.editing].id };
  else list.push({ ...res.entry, id: Exchange.newId() });

  try {
    state.entries = await backend('save_entries', { entries: list });
    state.confirmDelete = null;
    clearForm();
    state.formMessage = { error: false, text: t(wasEdit ? 'okChanged' : 'okAdded') };
    scheduleReminders();
  } catch (e) {
    state.formMessage = { error: true, text: t('errSave', [String(e)]) };
  }
  renderManage();
}

// ───────────────────────────── Settings ─────────────────────────────

async function persistSettings() {
  try {
    const saved = await backend('save_settings', { settings: state.settings });
    state.settings = { ...state.settings, ...saved };
  } catch (e) {
    console.error('save_settings', e);
  }
  scheduleReminders();
}

function setLanguage(l) {
  state.settings.language = l;
  state.formMessage = null;
  applyI18n();
  renderOverview();
  if (!$('view-manage').hidden) renderManage();
  persistSettings();
}

// ───────────────────────────── Reminders (Android) ─────────────────────────────

function notificationApi() {
  return window.__TAURI__ && window.__TAURI__.notification ? window.__TAURI__.notification : null;
}

async function ensureNotificationPermission() {
  const n = notificationApi();
  if (!n) return false;
  try {
    if (await n.isPermissionGranted()) return true;
    return (await n.requestPermission()) === 'granted';
  } catch (e) {
    console.error('notification permission', e);
    return false;
  }
}

/** Re-creates all scheduled reminders. Runs at start and after every change. */
async function scheduleReminders() {
  const n = notificationApi();
  if (!isAndroid || !n) return;
  const s = state.settings;
  try {
    // remove everything scheduled earlier (entries may have changed or been deleted)
    if (typeof n.cancelAll === 'function') {
      await n.cancelAll();
    } else if (typeof n.pending === 'function' && typeof n.cancel === 'function') {
      const ids = (await n.pending()).map((p) => p.id);
      if (ids.length) await n.cancel(ids);
    }
    if (!s.remind) return;
    if (!(await n.isPermissionGranted())) return;

    const now = new Date();
    const today = startOfDay(now);
    for (let i = 0; i < state.entries.length; i++) {
      const e = state.entries[i];
      const r = nextReminder(e, today, now, s.remind_days_before, s.remind_hour);
      if (!r) continue;
      const years = e.year > 0 ? r.date.getFullYear() - e.year : 0;
      await n.sendNotification({
        id: 1000 + i,
        title: t('reminderTitle', [displayName(e)]),
        body: kindText(e, years) + ' · ' + whenText(s.remind_days_before),
        schedule: n.Schedule.at(r.fire, false, false),
      });
    }
  } catch (err) {
    console.error('reminders', err);
  }
}

// ───────────────────────────── Import and export ─────────────────────────────

function setImportMessage(error, text) {
  const m = $('import-message');
  m.hidden = !text;
  m.textContent = text || '';
  m.className = 'message' + (error ? ' error' : '');
}

/**
 * Imports a calendar file (.ics), an events.json backup or an old gebdatei.dat.
 * The format is recognised from the content, not from the file name.
 */
async function importFile(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = null;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      text = null; // not UTF-8: only the old DOS file can look like that
    }
    const format = text === null ? 'legacy' : Exchange.detectFormat(text);

    let incoming;
    let skipped = 0;
    if (format === 'ics') ({ events: incoming, skipped } = Exchange.parseIcs(text));
    else if (format === 'json') ({ events: incoming, skipped } = Exchange.parseJson(text));
    else incoming = await backend('parse_legacy', { bytes: Array.from(bytes) });
    if (incoming.length === 0) throw 'no_entries';

    const merged = Exchange.mergeEntries(state.entries, incoming, $('import-replace').checked);
    state.entries = await backend('save_entries', { entries: merged.entries });
    setImportMessage(false, t('importResult', [merged.added, skipped + merged.skipped]));
    scheduleReminders();
    renderManage();
  } catch (e) {
    const unreadable = e === 'no_entries' || e instanceof SyntaxError || (e && e.message === 'bad_format');
    setImportMessage(true, unreadable ? t('importNone') : t('errSave', [String(e)]));
  }
  ev.target.value = '';
}

function setExportMessage(error, text) {
  const m = $('export-message');
  m.hidden = !text;
  m.textContent = text || '';
  m.className = 'message' + (error ? ' error' : '');
}

/**
 * Saves a text file: with the native "save as" dialog on desktop, through the share sheet on
 * phones, otherwise the text is handed back so that it can be copied.
 * Returns { status: 'saved' | 'shared' | 'cancelled' | 'text', where? }.
 */
async function saveTextFile(filename, mime, text) {
  const dialog = window.__TAURI__ && window.__TAURI__.dialog;
  if (dialog && typeof dialog.save === 'function') {
    try {
      const ext = filename.split('.').pop();
      const path = await dialog.save({ defaultPath: filename, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if (!path) return { status: 'cancelled' };
      await backend('write_text_file', { path, text });
      return { status: 'saved', where: path };
    } catch (e) {
      console.error('save dialog', e); // e.g. not supported on this system: try the next way
    }
  }
  try {
    const file = new File([text], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return { status: 'shared' };
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return { status: 'cancelled' };
    console.error('share', e);
  }
  return { status: 'text' };
}

async function exportAs(format) {
  $('export-text').hidden = true;
  if (state.entries.length === 0) {
    setExportMessage(true, t('exportEmpty'));
    return;
  }
  const labels = {};
  KINDS.forEach((k) => {
    labels[k] = kindLabel(k);
  });
  const isIcs = format === 'ics';
  const text = isIcs ? Exchange.toIcs(state.entries, { labels, calendarName: t('appTitle') }) : Exchange.toJson(state.entries);
  const filename = isIcs ? 'ehrentag.ics' : 'events.json';

  const res = await saveTextFile(filename, isIcs ? 'text/calendar' : 'application/json', text);
  if (res.status === 'saved') {
    setExportMessage(false, t('exportDone', [res.where]));
  } else if (res.status === 'shared') {
    setExportMessage(false, t('exportShared'));
  } else if (res.status === 'text') {
    setExportMessage(false, '');
    $('export-copy-hint').textContent = t('exportCopyHint', [filename]);
    state.exportText = text;
    $('export-area').value = text;
    $('export-text').hidden = false;
  } else {
    setExportMessage(false, '');
  }
}

async function copyExportText() {
  const area = $('export-area');
  try {
    await navigator.clipboard.writeText(state.exportText || area.value);
  } catch (e) {
    area.focus();
    area.select();
    document.execCommand('copy');
  }
  setExportMessage(false, t('exportCopied'));
}

// ───────────────────────────── Navigation and start ─────────────────────────────

function show(view) {
  $('view-overview').hidden = view !== 'overview';
  $('view-manage').hidden = view !== 'manage';
  if (view === 'overview') {
    renderOverview();
    requestAnimationFrame(() => Banner.resize());
  } else {
    state.formMessage = null;
    setImportMessage(false, '');
    setExportMessage(false, '');
    $('export-text').hidden = true;
    renderManage();
  }
  window.scrollTo(0, 0);
}

function bindEvents() {
  $('btn-manage').addEventListener('click', () => show('manage'));
  $('btn-back').addEventListener('click', () => {
    clearForm();
    state.confirmDelete = null;
    show('overview');
  });
  $('btn-cancel').addEventListener('click', () => {
    clearForm();
    state.formMessage = null;
    renderManage();
  });
  $('entry-form').addEventListener('submit', submitForm);
  $('f-kind').addEventListener('change', updateYearHint);

  $('set-language').addEventListener('change', (ev) => setLanguage(ev.target.value));

  $('set-count').addEventListener('input', (ev) => {
    $('set-count-out').textContent = ev.target.value;
  });
  $('set-count').addEventListener('change', (ev) => {
    state.settings.count = parseInt(ev.target.value, 10);
    persistSettings();
  });
  $('set-days').addEventListener('input', (ev) => {
    $('set-days-out').textContent = t('daysUnit', [parseInt(ev.target.value, 10)]);
  });
  $('set-days').addEventListener('change', (ev) => {
    state.settings.days_ahead = parseInt(ev.target.value, 10);
    persistSettings();
  });

  $('set-warn').addEventListener('input', (ev) => {
    $('set-warn-out').textContent = t('daysUnit', [parseInt(ev.target.value, 10)]);
  });
  $('set-warn').addEventListener('change', (ev) => {
    state.settings.warn_days = parseInt(ev.target.value, 10);
    persistSettings();
  });

  $('set-banner').addEventListener('input', (ev) => Banner.setText(ev.target.value)); // live preview
  $('set-banner').addEventListener('change', (ev) => {
    state.settings.banner_text = ev.target.value.trim() || 'MARTIN';
    ev.target.value = state.settings.banner_text;
    persistSettings();
  });
  $('set-subtitle').addEventListener('change', (ev) => {
    state.settings.subtitle_mode = ev.target.value;
    $('subtext-field').hidden = ev.target.value !== 'custom';
    persistSettings();
  });
  $('set-subtext').addEventListener('change', (ev) => {
    state.settings.subtitle_text = ev.target.value.trim();
    persistSettings();
  });

  $('set-remind').addEventListener('change', async (ev) => {
    const box = ev.target;
    $('remind-message').hidden = true;
    state.settings.remind = box.checked;
    if (box.checked && isAndroid && !(await ensureNotificationPermission())) {
      box.checked = false;
      state.settings.remind = false;
      const m = $('remind-message');
      m.textContent = t('remindDenied');
      m.hidden = false;
    }
    persistSettings();
  });
  $('set-hour').addEventListener('change', (ev) => {
    state.settings.remind_hour = parseInt(ev.target.value, 10);
    persistSettings();
  });
  $('set-before').addEventListener('change', (ev) => {
    const n = parseInt(ev.target.value, 10);
    state.settings.remind_days_before = Number.isNaN(n) ? 1 : Math.min(30, Math.max(0, n));
    ev.target.value = String(state.settings.remind_days_before);
    persistSettings();
  });

  $('import-file').addEventListener('change', importFile);
  $('btn-export-ics').addEventListener('click', () => exportAs('ics'));
  $('btn-export-json').addEventListener('click', () => exportAs('json'));
  $('btn-export-copy').addEventListener('click', copyExportText);
  $('migrated-note').addEventListener('click', () => {
    state.migration = null;
    $('migrated-note').hidden = true;
  });

  // keep the overview fresh (day change, 11:11 moment)
  const refresh = () => {
    if (!document.hidden && !$('view-overview').hidden) renderOverview();
  };
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', refresh);
}

async function init() {
  buildLanguageSelect();
  bindEvents();
  try {
    const s = await backend('get_state');
    state.entries = s.entries;
    state.settings = { ...defaultSettings(), ...s.settings };
    if (!isSupportedLanguage(state.settings.language)) state.settings.language = '';
    state.dataPath = s.data_path;
    state.migration = s.migration || null;
  } catch (e) {
    console.error('get_state', e);
  }
  applyI18n();
  show('overview');
  scheduleReminders();
}

init();
