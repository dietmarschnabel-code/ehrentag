'use strict';

// Special days of many traditions (holidays, festivals), grouped by tradition.
// Pure functions without DOM access, tested with Node (tests/holidays.test.js).
//
// Where the dates come from:
//   * fixed dates, and the Easter family (Ash Wednesday ... Pentecost) by their rules - exact
//   * Orthodox Easter by the Julian computus - exact
//   * Jewish holidays with the Hebrew calendar of the browser (arithmetic) - exact
//   * Islamic holidays with the Umm al-Qura calendar of the browser. They depend on the sighting of the
//     moon, so a country can differ by a day or two ("approx.")
//   * Chinese festivals with the Chinese calendar of the browser, corrected where its astronomy is a day
//     off (LUNAR_FIX, found by tests/holidays.test.js with an independent calculation)
//   * Nowruz with the Persian calendar of the browser (checked against the equinox for 2026-2040)
//   * Qingming by the standard formula for 2001-2099
//   * Hindu festivals follow a lunisolar calendar that no browser has: they come from a table of dates
//     published by Drik Panchang ("approx.": regions can differ by a day). The table ends at
//     HINDU_DATA_THROUGH, later years show no Hindu festivals until the table is extended.

const Holidays = (() => {
  const easter = typeof module !== 'undefined' && module.exports ? require('./logic.js').easterDate : globalThis.easterDate;

  const TRADITIONS = ['general', 'western', 'orthodox', 'islamic', 'jewish', 'hindu', 'eastasian', 'persian'];

  // Hindu festivals: Gregorian date of the main day, from Drik Panchang (see the header).
  const HINDU_DATA_THROUGH = 2028;
  const HINDU = {
    diwali: { 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17' }, // Lakshmi Puja
    holi: { 2026: '2026-03-04', 2027: '2027-03-22', 2028: '2028-03-10' }, // Rangwali Holi (Dhulandi)
    rakshabandhan: { 2026: '2026-08-28', 2027: '2027-08-17', 2028: '2028-08-05' },
    dussehra: { 2026: '2026-10-20', 2027: '2027-10-09', 2028: '2028-09-27' }, // Vijayadashami
  };

  // The browser's Chinese calendar puts the start of a lunar month on the wrong day when the new moon
  // is only minutes from midnight in China. ICU start date -> true start date.
  const LUNAR_FIX = {
    '2027-02-07': '2027-02-06', // new moon 23:56 China time on 6 Feb 2027
    '2030-02-02': '2030-02-03', // new moon 00:08 China time on 3 Feb 2030
  };

  // ───────────── date helpers (local dates at midnight) ─────────────
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseIso = (s) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

  // ───────────── calendars of the browser ─────────────
  const indexCache = new Map();

  /**
   * Maps "month/day" of a calendar (Chinese, Persian, Islamic Umm al-Qura, Hebrew) to the Gregorian
   * dates of the year on which it falls. The days are looked at as UTC noon, so that the result does not
   * depend on the time zone of the device. A calendar the system does not have gives an empty map.
   */
  function calendarIndex(calendar, year) {
    const key = calendar + ':' + year;
    if (indexCache.has(key)) return indexCache.get(key);
    const map = new Map();
    try {
      const format = new Intl.DateTimeFormat('en-u-ca-' + calendar + '-nu-latn', {
        month: calendar === 'hebrew' ? 'long' : 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      });
      for (let d = new Date(Date.UTC(year, 0, 1, 12)); d.getUTCFullYear() === year; d = new Date(d.getTime() + 86400000)) {
        let month = '';
        let day = '';
        for (const p of format.formatToParts(d)) {
          if (p.type === 'month') month = p.value;
          else if (p.type === 'day') day = p.value;
        }
        const k = month + '/' + Number(day);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
    } catch (e) {
      map.clear();
    }
    indexCache.set(key, map);
    return map;
  }

  const inCalendar = (calendar, month, day) => (year) => calendarIndex(calendar, year).get(month + '/' + day) || [];

  /** First day of a Chinese lunar month in the given year (corrected), or null. */
  function chineseMonthStart(year, month) {
    const start = (calendarIndex('chinese', year).get(month + '/1') || [])[0];
    if (!start) return null;
    const fixed = LUNAR_FIX[iso(start)];
    return fixed ? parseIso(fixed) : start;
  }

  const chinese = (month, day) => (year) => {
    const start = chineseMonthStart(year, month);
    return start ? [addDays(start, day - 1)] : [];
  };

  // ───────────── the rules ─────────────
  const fixed = (month, day) => (year) => [new Date(year, month - 1, day)];
  const fromEaster = (offset) => (year) => [addDays(easter(year), offset)];

  /** Orthodox Easter: Julian computus (Meeus), then +13 days to the Gregorian calendar (valid 1900-2099). */
  function orthodoxEasterDate(year) {
    const a = year % 4;
    const b = year % 7;
    const c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31);
    const day = ((d + e + 114) % 31) + 1;
    return new Date(year, month - 1, day + 13);
  }

  /** Qingming: the day of April on which the sun reaches 15 degrees (standard formula, 2001-2099). */
  const qingming = (year) => (year > 2000 && year < 2100 ? [new Date(year, 3, Math.floor((year % 100) * 0.2422 + 4.81) - Math.floor((year % 100) / 4))] : []);

  const hindu = (id) => (year) => (HINDU[id][year] ? [parseIso(HINDU[id][year])] : []);

  // [id, tradition, rule, approximate?]  - the order is the order in the editor
  const DEFINITIONS = [
    ['newyear', 'general', fixed(1, 1)],
    ['valentine', 'general', fixed(2, 14)],
    ['womensday', 'general', fixed(3, 8)],
    ['halloween', 'general', fixed(10, 31)],
    ['newyearseve', 'general', fixed(12, 31)],

    ['epiphany', 'western', fixed(1, 6)],
    ['mardigras', 'western', fromEaster(-47)],
    ['ashwednesday', 'western', fromEaster(-46)],
    ['goodfriday', 'western', fromEaster(-2)],
    ['easter', 'western', fromEaster(0)],
    ['ascension', 'western', fromEaster(39)],
    ['pentecost', 'western', fromEaster(49)],
    ['allsaints', 'western', fixed(11, 1)],
    ['stnicholas', 'western', fixed(12, 6)],
    ['christmaseve', 'western', fixed(12, 24)],
    ['christmas', 'western', fixed(12, 25)],

    ['orthodoxchristmas', 'orthodox', fixed(1, 7)],
    ['oldnewyear', 'orthodox', fixed(1, 14)],
    ['orthodoxepiphany', 'orthodox', fixed(1, 19)],
    ['orthodoxeaster', 'orthodox', (year) => [orthodoxEasterDate(year)]],

    ['ramadan', 'islamic', inCalendar('islamic-umalqura', 9, 1), true],
    ['eidalfitr', 'islamic', inCalendar('islamic-umalqura', 10, 1), true],
    ['eidaladha', 'islamic', inCalendar('islamic-umalqura', 12, 10), true],
    ['islamicnewyear', 'islamic', inCalendar('islamic-umalqura', 1, 1), true],
    ['mawlid', 'islamic', inCalendar('islamic-umalqura', 3, 12), true],

    ['roshhashanah', 'jewish', inCalendar('hebrew', 'Tishri', 1)],
    ['yomkippur', 'jewish', inCalendar('hebrew', 'Tishri', 10)],
    ['hanukkah', 'jewish', inCalendar('hebrew', 'Kislev', 25)],
    ['passover', 'jewish', inCalendar('hebrew', 'Nisan', 15)],

    ['diwali', 'hindu', hindu('diwali'), true],
    ['holi', 'hindu', hindu('holi'), true],
    ['rakshabandhan', 'hindu', hindu('rakshabandhan'), true],
    ['dussehra', 'hindu', hindu('dussehra'), true],

    ['lunarnewyear', 'eastasian', chinese(1, 1)],
    ['lanternfestival', 'eastasian', chinese(1, 15)],
    ['qingming', 'eastasian', qingming],
    ['dragonboat', 'eastasian', chinese(5, 5)],
    ['midautumn', 'eastasian', chinese(8, 15)],
    ['obon', 'eastasian', fixed(8, 13)],
    ['songkran', 'eastasian', fixed(4, 13)],

    ['nowruz', 'persian', inCalendar('persian', 1, 1)],
  ];

  const EVENTS = DEFINITIONS.map(([id, tradition, dates, approx]) => ({ id, tradition, dates, approx: !!approx }));
  const byId = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

  /** All dates of the event in a Gregorian year (Islamic events can fall twice in one year). */
  function occurrences(id, year) {
    const ev = byId[id];
    if (!ev) return [];
    try {
      return ev.dates(year).slice().sort((a, b) => a - b);
    } catch (e) {
      return [];
    }
  }

  /** The next date of the event on or after `today` (local midnight), or null (e.g. Hindu table ended). */
  function next(id, today) {
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      for (const d of occurrences(id, year)) if (d >= today) return d;
    }
    return null;
  }

  /** The next `limit` special days of the given traditions: [{ id, date, event }] in date order. */
  function upcoming(traditions, today, limit) {
    const list = [];
    for (const ev of EVENTS) {
      if (!traditions.includes(ev.tradition)) continue;
      const date = next(ev.id, today);
      if (date) list.push({ id: ev.id, date, event: ev });
    }
    list.sort((a, b) => a.date - b.date);
    return list.slice(0, limit);
  }

  /**
   * The list for the overview: the next special day of EVERY chosen tradition (so that none is missing),
   * then the nearest of the others up to `count`, in date order. With more traditions than `count`
   * the list is as long as the number of traditions.
   */
  function upcomingBalanced(traditions, today, count) {
    const all = upcoming(traditions, today, Infinity); // in date order
    const chosen = [];
    const seen = new Set();
    for (const x of all) {
      if (!seen.has(x.event.tradition)) {
        seen.add(x.event.tradition);
        chosen.push(x);
      }
    }
    const limit = Math.max(count, chosen.length);
    for (const x of all) {
      if (chosen.length >= limit) break;
      if (!chosen.includes(x)) chosen.push(x);
    }
    return chosen.sort((a, b) => a.date - b.date);
  }

  return { TRADITIONS, EVENTS, byId, occurrences, next, upcoming, upcomingBalanced, chineseMonthStart, orthodoxEasterDate, HINDU_DATA_THROUGH, HINDU, LUNAR_FIX };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Holidays;
}
