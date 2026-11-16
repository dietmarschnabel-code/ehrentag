'use strict';

// Import and export of the dates: events.json, calendar files (.ics) and merging.
// Pure functions without any DOM access, so they can be tested with Node (tests/exchange.test.js).
//
// Entries look like { id, kind, name, month, day, year }:
//   kind  "birthday" | "nameday" | "wedding" | "other"
//   year  0 = not given
// Every entry repeats every year.

const Exchange = (() => {
  const KINDS = ['birthday', 'nameday', 'wedding', 'other'];
  const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const FORMAT_VERSION = 1;

  const pad = (n, width = 2) => String(n).padStart(width, '0');
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const validDate = (m, d) => Number.isInteger(m) && Number.isInteger(d) && m >= 1 && m <= 12 && d >= 1 && d <= MONTH_DAYS[m - 1];

  /** A new unique id (used as the UID in calendar files). */
  function newId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    let s = '';
    for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  /** Checks and cleans an entry from outside; returns null if it is unusable. */
  function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const kind = String(raw.kind || raw.type || '').toLowerCase();
    if (!KINDS.includes(kind)) return null;
    const name = typeof raw.name === 'string' ? raw.name.replace(/[\r\n]+/g, ' ').trim() : '';
    const day = Number(raw.day);
    const month = Number(raw.month);
    let year = raw.year === undefined || raw.year === null || raw.year === '' ? 0 : Number(raw.year);
    if (!name || !validDate(month, day) || !Number.isInteger(year)) return null;
    if (year < 0 || year > 9999 || kind === 'nameday') year = 0;
    const id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]+$/.test(raw.id) ? raw.id : '';
    return { id, kind, name, month, day, year };
  }

  const entryKey = (e) => [e.kind, e.name.toLowerCase(), e.month, e.day, e.year].join('|');

  /**
   * Adds `incoming` to `existing` (or replaces it) without duplicates: same id or same
   * content counts as a duplicate. Returns { entries, added, skipped }.
   */
  function mergeEntries(existing, incoming, replace) {
    const entries = replace ? [] : existing.slice();
    const ids = new Set(entries.map((e) => e.id).filter(Boolean));
    const keys = new Set(entries.map(entryKey));
    let added = 0;
    let skipped = 0;
    for (const e of incoming) {
      const key = entryKey(e);
      if ((e.id && ids.has(e.id)) || keys.has(key)) {
        skipped++;
        continue;
      }
      entries.push(e);
      keys.add(key);
      if (e.id) ids.add(e.id);
      added++;
    }
    return { entries, added, skipped };
  }

  // ───────────── events.json ─────────────

  function toJson(entries) {
    const events = entries.map((e) => ({ id: e.id, kind: e.kind, name: e.name, month: e.month, day: e.day, year: e.year }));
    return JSON.stringify({ version: FORMAT_VERSION, events }, null, 2) + '\n';
  }

  /** Accepts { "events": [...] } as well as a plain array. Throws for anything else. */
  function parseJson(text) {
    const data = JSON.parse(text.replace(/^\uFEFF/, ''));
    const list = Array.isArray(data) ? data : data && Array.isArray(data.events) ? data.events : null;
    if (!list) throw new Error('bad_format');
    const events = [];
    let skipped = 0;
    for (const raw of list) {
      const e = normalizeEntry(raw);
      if (e) events.push(e);
      else skipped++;
    }
    return { events, skipped };
  }

  // ───────────── calendar files (.ics, RFC 5545) ─────────────

  const ICS_CATEGORY = { birthday: 'BIRTHDAY', nameday: 'NAME DAY', wedding: 'WEDDING ANNIVERSARY', other: 'SPECIAL DAY' };
  const ENGLISH_LABELS = { birthday: 'Birthday', nameday: 'Name day', wedding: 'Wedding anniversary', other: 'Special day' };

  function icsEscape(s) {
    return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  /** Lines are limited to 75 octets; longer ones continue on the next line after a space. */
  function foldLine(line) {
    const encoder = new TextEncoder();
    const parts = [];
    let current = '';
    let bytes = 0;
    for (const ch of line) {
      const size = encoder.encode(ch).length;
      const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
      if (bytes + size > limit) {
        parts.push(current);
        current = '';
        bytes = 0;
      }
      current += ch;
      bytes += size;
    }
    parts.push(current);
    return parts.join('\r\n ');
  }

  const ymd = (y, m, d) => pad(y, 4) + pad(m) + pad(d);

  function dayAfter(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d + 1));
    return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  /** First occurrence written into the file. 29 Feb needs a leap year to be a valid date. */
  function startDate(e, currentYear) {
    let y = e.year > 0 ? e.year : currentYear;
    const m = e.month;
    let d = e.day;
    if (m === 2 && d === 29) {
      if (e.year <= 0) {
        while (!isLeap(y)) y++;
      } else if (!isLeap(y)) {
        d = 28;
      }
    }
    return { y, m, d };
  }

  /**
   * Calendar file with one yearly repeating all-day event per entry.
   * opts: { now: Date, year: number, labels: { birthday: 'Birthday', ... }, calendarName }
   */
  function toIcs(entries, opts = {}) {
    const now = opts.now || new Date();
    const currentYear = opts.year || now.getFullYear();
    const labels = { ...ENGLISH_LABELS, ...(opts.labels || {}) };
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Dietmar Schnabel//Ehrentag-Manager//EN',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:' + icsEscape(opts.calendarName || 'Ehrentag-Manager'),
    ];
    for (const e of entries) {
      const s = startDate(e, currentYear);
      const leapDay = e.month === 2 && e.day === 29;
      lines.push(
        'BEGIN:VEVENT',
        'UID:' + (e.id || newId()) + '@ehrentag',
        'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + ymd(s.y, s.m, s.d),
        'DTEND;VALUE=DATE:' + dayAfter(s.y, s.m, s.d),
        // 29 Feb: "last day of February", i.e. 28 Feb in years that are not leap years
        'RRULE:' + (leapDay ? 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'FREQ=YEARLY'),
        'SUMMARY:' + icsEscape(labels[e.kind] + ': ' + e.name),
        'CATEGORIES:' + ICS_CATEGORY[e.kind],
        'TRANSP:TRANSPARENT',
        'X-EHRENTAG-KIND:' + e.kind,
        'X-EHRENTAG-NAME:' + icsEscape(e.name)
      );
      if (e.year <= 0) lines.push('X-EHRENTAG-NOYEAR:TRUE');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  const WEDDING_RE = /wedding|hochzeit|boda|mariage|matrimonio|casamento|свадьб|evlilik|结婚|結婚|زواج|शादी/i;
  const NAMEDAY_RE = /name[ -]?day|namenstag|onom[aá]stic|именин|isim günü|fête du prénom|圣名日|霊名|يوم الاسم|नाम दिवस/i;
  const BIRTHDAY_RE = /birthday|b-?day|geburtstag|cumplea|anniversaire|compleanno|aniversário|день рождения|doğum|生日|誕生日|ميلاد|जन्मदिन|\bborn\b/i;

  /** Guesses the kind of an event from foreign calendar files (categories and title). */
  function guessKind(text) {
    if (WEDDING_RE.test(text)) return 'wedding';
    if (NAMEDAY_RE.test(text)) return 'nameday';
    if (BIRTHDAY_RE.test(text)) return 'birthday';
    return 'other';
  }

  function unfold(text) {
    return text.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  }

  function unescapeText(s) {
    return s.replace(/\\([nN,;\\])/g, (m, c) => (c === 'n' || c === 'N' ? ' ' : c));
  }

  /** "NAME;PARAM=x:value" -> { name, params, value } (a colon inside quotes does not count). */
  function splitProperty(line) {
    let inQuotes = false;
    let colon = -1;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ':' && !inQuotes) {
        colon = i;
        break;
      }
    }
    if (colon < 0) return null;
    const parts = line.slice(0, colon).split(';');
    return { name: parts[0].trim().toUpperCase(), params: parts.slice(1), value: line.slice(colon + 1) };
  }

  const first = (v, name) => (v[name] && v[name][0]) || null;

  /** One VEVENT -> entry, or null if it is not a date that repeats every year. */
  function eventFromVevent(v) {
    const dtstart = first(v, 'DTSTART');
    const rrule = first(v, 'RRULE');
    if (!dtstart || !rrule) return null;
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(dtstart.value.trim());
    if (!m) return null;
    let year = Number(m[1]);
    const month = Number(m[2]);
    let day = Number(m[3]);

    const rule = {};
    for (const part of rrule.value.split(';')) {
      const [k, ...rest] = part.split('=');
      rule[k.trim().toUpperCase()] = rest.join('=').trim();
    }
    if (rule.FREQ !== 'YEARLY' || (rule.INTERVAL && rule.INTERVAL !== '1')) return null;
    if (rule.BYMONTH === '2' && rule.BYMONTHDAY === '-1' && month === 2 && (day === 28 || day === 29)) day = 29;
    if (!validDate(month, day)) return null;

    const nameProp = first(v, 'X-EHRENTAG-NAME') || first(v, 'SUMMARY');
    const name = nameProp ? unescapeText(nameProp.value).replace(/\s+/g, ' ').trim() : '';
    if (!name) return null;

    const kindProp = first(v, 'X-EHRENTAG-KIND');
    const ownKind = kindProp ? kindProp.value.trim().toLowerCase() : '';
    const ours = KINDS.includes(ownKind);
    const kind = ours ? ownKind : guessKind((v.CATEGORIES || []).map((c) => c.value).join(' ') + ' ' + name);

    const noYear = first(v, 'X-EHRENTAG-NOYEAR');
    // Calendars use 1604 (Apple) or similar placeholder years when the year is unknown.
    // For events of other programs only birthdays and weddings keep the start year.
    if (kind === 'nameday' || year < 1700 || (noYear && /true/i.test(noYear.value)) || (!ours && kind === 'other')) year = 0;

    const uid = first(v, 'UID');
    const uidMatch = uid ? /^([A-Za-z0-9_-]+)@ehrentag$/.exec(uid.value.trim()) : null;
    return { id: uidMatch ? uidMatch[1] : '', kind, name, month, day, year };
  }

  /**
   * Reads a calendar file. Only events that repeat every year are taken over; all
   * others (meetings and so on) are counted as skipped. Returns { events, skipped }.
   */
  function parseIcs(text) {
    const vevents = [];
    let current = null;
    let depth = 0;
    for (const line of unfold(text)) {
      if (!line.trim()) continue;
      const p = splitProperty(line);
      if (!p) continue;
      if (p.name === 'BEGIN') {
        if (p.value.trim().toUpperCase() === 'VEVENT' && depth === 0) {
          current = {};
          depth = 1;
        } else if (current) {
          depth++; // e.g. a VALARM inside the event: its properties are ignored
        }
      } else if (p.name === 'END') {
        if (current) {
          depth--;
          if (depth === 0) {
            vevents.push(current);
            current = null;
          }
        }
      } else if (current && depth === 1) {
        (current[p.name] = current[p.name] || []).push(p);
      }
    }
    const events = [];
    let skipped = 0;
    for (const v of vevents) {
      const e = eventFromVevent(v);
      if (e) events.push(e);
      else skipped++;
    }
    return { events, skipped };
  }

  /** "ics", "json" or "legacy" (the old five-line gebdatei.dat). */
  function detectFormat(text) {
    const t = text.replace(/^\uFEFF/, '').trimStart();
    if (/^BEGIN:VCALENDAR/i.test(t)) return 'ics';
    if (t.startsWith('{') || t.startsWith('[')) return 'json';
    return 'legacy';
  }

  return { KINDS, newId, normalizeEntry, entryKey, mergeEntries, toJson, parseJson, toIcs, parseIcs, guessKind, detectFormat };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Exchange;
}
