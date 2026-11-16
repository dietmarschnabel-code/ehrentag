'use strict';

// Pure helper functions without any DOM access, so they can be unit-tested with Node
// (see tests/logic.test.js).

const DAY_MS = 86400000;
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 29 Feb is valid

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Whole days from a to b (calendar days, DST-safe). */
function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

function validDate(month, day) {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= MONTH_DAYS[month - 1];
}

/** Date in year y; 29 Feb falls back to 28 Feb in non-leap years. */
function makeDate(y, m, d) {
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? dt : new Date(y, 1, 28);
}

/** Next occurrence of the entry, today included. `today` must be at local midnight. */
function nextOccurrence(e, today) {
  let y = today.getFullYear();
  for (;;) {
    const d = makeDate(y, e.month, e.day);
    if (d >= today) return d;
    y++;
  }
}

/** First name in capitals (as in the original Pascal program). */
function firstNameUpper(name) {
  const i = name.indexOf(' ');
  return i < 0 ? name.toUpperCase() : name.slice(0, i).toUpperCase() + name.slice(i);
}

/**
 * Ordinal number as it is written in the language: 45 -> "45." (de, tr), "45th" (en), "45.º" (es),
 * "45º" (pt, it), "45e" (fr). For languages whose ordinal depends on the noun (ru, hi) or that
 * need none (ar, zh, ja) only the number is returned; the suffix is part of the translated text.
 */
function ordinal(lang, n) {
  switch (lang) {
    case 'de':
    case 'tr':
      return n + '.';
    case 'en': {
      const r100 = n % 100;
      const r10 = n % 10;
      let suffix = 'th';
      if (r100 < 11 || r100 > 13) {
        if (r10 === 1) suffix = 'st';
        else if (r10 === 2) suffix = 'nd';
        else if (r10 === 3) suffix = 'rd';
      }
      return n + suffix;
    }
    case 'es':
      return n + '.º';
    case 'pt':
    case 'it':
      return n + 'º';
    case 'fr':
      return n === 1 ? '1er' : n + 'e';
    default:
      return String(n);
  }
}

/** Easter Sunday of the given year (Gregorian calendar, "anonymous" algorithm). */
function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Special days that can be counted down to below the banner. To add one, add it here, a
 * "event_<id>" text in i18n.js, an option in index.html and the id to SUBTITLE_MODES in lib.rs.
 */
const EVENTS = {
  easter: (y) => easterDate(y),
  christmaseve: (y) => new Date(y, 11, 24),
  christmas: (y) => new Date(y, 11, 25),
  newyear: (y) => new Date(y, 0, 1),
};

/** Next date of the event (today included). `today` must be at local midnight. */
function nextEventDate(id, today) {
  const dateIn = EVENTS[id];
  let d = dateIn(today.getFullYear());
  if (d < today) d = dateIn(today.getFullYear() + 1);
  return d;
}

/**
 * When to remind about the next occurrence of an entry: `daysBefore` days earlier
 * at `hour`:00. If that moment has already passed, the following year's occurrence
 * is used. Returns { date, fire } or null.
 */
function nextReminder(e, today, now, daysBefore, hour) {
  let from = today;
  for (let i = 0; i < 3; i++) {
    const date = nextOccurrence(e, from);
    const fire = addDays(date, -daysBefore);
    fire.setHours(hour, 0, 0, 0);
    if (fire > now) return { date, fire };
    from = addDays(date, 1);
  }
  return null;
}

/**
 * Validates the form values. Returns { error: <message key> } or { entry }.
 * f = { name, kind, day, month, year } (all strings)
 */
function validateForm(f, currentYear) {
  const name = f.name.trim();
  if (!name) return { error: 'errName' };

  const day = /^\d+$/.test(f.day.trim()) ? parseInt(f.day, 10) : NaN;
  if (Number.isNaN(day)) return { error: 'errDay' };
  const month = /^\d+$/.test(f.month.trim()) ? parseInt(f.month, 10) : NaN;
  if (Number.isNaN(month)) return { error: 'errMonth' };
  if (!validDate(month, day)) return { error: 'errDate' };

  let year = 0;
  const y = f.year.trim();
  if (f.kind === 'nameday') {
    year = 0;
  } else if (y === '') {
    if (f.kind !== 'other') return { error: 'errYearMissing' };
  } else {
    if (!/^\d{4}$/.test(y)) return { error: 'errYearFormat' };
    year = parseInt(y, 10);
    if (year < 1000) return { error: 'errYearFormat' };
  }
  if (year > currentYear && f.kind !== 'other') return { error: 'errYearFuture' };

  return { entry: { day, month, year, name, kind: f.kind } };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startOfDay,
    addDays,
    daysBetween,
    validDate,
    makeDate,
    nextOccurrence,
    easterDate,
    EVENTS,
    nextEventDate,
    firstNameUpper,
    ordinal,
    nextReminder,
    validateForm,
  };
}
