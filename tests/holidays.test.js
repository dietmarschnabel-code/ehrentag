// Run with:  node tests/holidays.test.js      (also in other time zones: TZ=Pacific/Auckland node ...)
'use strict';
const assert = require('assert');
const H = require('../src/holidays.js');
const A = require('../scripts/astro.js');

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dates = (id, y) => H.occurrences(id, y).map(iso);
const d = (y, m, day) => new Date(y, m - 1, day);

// ───────── the list itself ─────────
const ids = H.EVENTS.map((e) => e.id);
assert.strictEqual(new Set(ids).size, ids.length, 'event ids are unique');
for (const e of H.EVENTS) assert(H.TRADITIONS.includes(e.tradition), e.id + ': unknown tradition');
for (const t of H.TRADITIONS) assert(H.EVENTS.some((e) => e.tradition === t), t + ' has no events');
assert.strictEqual(H.EVENTS.length, 41);

// ───────── known dates (checked against published calendars) ─────────
const KNOWN = {
  // Western Christian: Easter and everything derived from it
  easter: { 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16' },
  mardigras: { 2027: '2027-02-09', 2028: '2028-02-29' },
  ashwednesday: { 2026: '2026-02-18', 2027: '2027-02-10', 2028: '2028-03-01' },
  goodfriday: { 2026: '2026-04-03', 2028: '2028-04-14' },
  ascension: { 2026: '2026-05-14', 2027: '2027-05-06' },
  pentecost: { 2026: '2026-05-24', 2027: '2027-05-16' },
  // Orthodox
  orthodoxeaster: { 2026: '2026-04-12', 2027: '2027-05-02', 2028: '2028-04-16' },
  orthodoxchristmas: { 2027: '2027-01-07' },
  // Jewish (the day itself; they begin the evening before)
  roshhashanah: { 2026: '2026-09-12', 2027: '2027-10-02', 2028: '2028-09-21' },
  yomkippur: { 2026: '2026-09-21', 2027: '2027-10-11' },
  hanukkah: { 2026: '2026-12-05', 2027: '2027-12-25', 2028: '2028-12-13' },
  passover: { 2026: '2026-04-02', 2027: '2027-04-22', 2028: '2028-04-11' },
  // Islamic (Umm al-Qura; other countries can differ by a day or two)
  ramadan: { 2026: '2026-02-18', 2027: '2027-02-08', 2028: '2028-01-28' },
  eidalfitr: { 2026: '2026-03-20', 2028: '2028-02-26' },
  eidaladha: { 2026: '2026-05-27', 2027: '2027-05-16' },
  islamicnewyear: { 2026: '2026-06-16' },
  // Chinese
  lunarnewyear: { 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2030: '2030-02-03' },
  lanternfestival: { 2027: '2027-02-20' },
  dragonboat: { 2026: '2026-06-19', 2027: '2027-06-09' },
  midautumn: { 2026: '2026-09-25', 2027: '2027-09-15' },
  qingming: { 2024: '2024-04-04', 2025: '2025-04-04', 2026: '2026-04-05', 2027: '2027-04-05', 2028: '2028-04-04', 2030: '2030-04-05' },
  // Persian
  nowruz: { 2026: '2026-03-21', 2027: '2027-03-21', 2028: '2028-03-20' },
  // Hindu (table)
  diwali: { 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17' },
  holi: { 2027: '2027-03-22' },
  rakshabandhan: { 2026: '2026-08-28', 2027: '2027-08-17', 2028: '2028-08-05' },
  dussehra: { 2026: '2026-10-20', 2027: '2027-10-09', 2028: '2028-09-27' },
};
for (const [id, years] of Object.entries(KNOWN)) {
  for (const [y, expected] of Object.entries(years)) assert.deepStrictEqual(dates(id, Number(y)), [expected], `${id} ${y}`);
}

// ───────── Islamic holidays can fall twice in one Gregorian year ─────────
assert.deepStrictEqual(dates('islamicnewyear', 2008), ['2008-01-10', '2008-12-29']);
assert.deepStrictEqual(H.next('islamicnewyear', d(2008, 1, 11)), d(2008, 12, 29));

// ───────── next / upcoming ─────────
const today = d(2026, 11, 18);
assert.deepStrictEqual(H.next('christmas', today), d(2026, 12, 25));
assert.deepStrictEqual(H.next('easter', today), d(2027, 3, 28));
assert.deepStrictEqual(H.next('diwali', today), d(2027, 10, 29)); // this year's was on 8 Nov
assert.deepStrictEqual(H.next('newyear', d(2026, 1, 1)), d(2026, 1, 1), 'today counts');
assert.strictEqual(H.next('unknown', today), null);
const up = H.upcoming(['western', 'islamic'], today, 4);
assert.deepStrictEqual(up.map(iso_of), up.map(iso_of).slice().sort());
assert(up.length === 4 && up.every((x) => ['western', 'islamic'].includes(x.event.tradition)));
function iso_of(x) { return iso(x.date); }
assert.strictEqual(H.upcoming([], today, 5).length, 0);
assert.deepStrictEqual(H.upcoming(['general'], today, 1).map((x) => x.id), ['newyearseve']);

// ───────── the overview list: the next day of EVERY chosen tradition is always in it ─────────
const ids3 = (list) => list.map((x) => x.id);
// General + Western Christian: with the plain "nearest three" New Year's Eve and New Year were missing
assert.deepStrictEqual(ids3(H.upcoming(['general', 'western'], today, 3)), ['stnicholas', 'christmaseve', 'christmas']);
const bal3 = H.upcomingBalanced(['general', 'western'], today, 3);
assert.deepStrictEqual(ids3(bal3), ['stnicholas', 'christmaseve', 'newyearseve'], 'one per tradition first, then the nearest');
const bal6 = H.upcomingBalanced(['general', 'western'], today, 6);
assert.deepStrictEqual(ids3(bal6), ['stnicholas', 'christmaseve', 'christmas', 'newyearseve', 'newyear', 'epiphany']);
assert(bal6.some((x) => x.id === 'newyear'), "New Year's Day is shown");
// more traditions than places: every tradition still has its next day
const everything = H.upcomingBalanced(H.TRADITIONS, today, 3);
assert.strictEqual(everything.length, H.TRADITIONS.length);
assert.deepStrictEqual([...new Set(everything.map((x) => x.event.tradition))].sort(), H.TRADITIONS.slice().sort());
assert.deepStrictEqual(everything.map(iso_of), everything.map(iso_of).slice().sort(), 'in date order');
// a tradition without any date left (Hindu table ended) adds nothing and takes no place
assert.deepStrictEqual(ids3(H.upcomingBalanced(['general', 'hindu'], d(2029, 1, 1), 2)), ids3(H.upcoming(['general'], d(2029, 1, 1), 2)));
assert.strictEqual(H.upcomingBalanced([], today, 5).length, 0);
// the same choice twice gives the same result and does not change the input
const chosen = ['western', 'general'];
H.upcomingBalanced(chosen, today, 4);
assert.deepStrictEqual(chosen, ['western', 'general']);

// ───────── Hindu festivals end with the table ─────────
assert.strictEqual(H.HINDU_DATA_THROUGH, 2028);
assert.strictEqual(H.next('diwali', d(2028, 10, 18)), null);
assert.deepStrictEqual(dates('diwali', 2029), []);
assert.strictEqual(H.upcoming(['hindu'], d(2029, 1, 1), 5).length, 0);
for (const [id, table] of Object.entries(H.HINDU)) {
  for (let y = 2026; y <= H.HINDU_DATA_THROUGH; y++) assert(table[y], `${id} ${y} is missing in the table`);
  for (const [y, s] of Object.entries(table)) assert(s.startsWith(y + '-'), `${id}: ${s} is not in ${y}`);
}

// ───────── independent astronomical checks, 2026-2040 ─────────
// 1. Chinese lunar months 1, 5 and 8 start on the day (China time) of the new moon
for (let y = 2026; y <= 2040; y++) {
  const moons = A.newMoonsAround(y);
  for (const month of [1, 5, 8]) {
    const start = H.chineseMonthStart(y, month);
    assert(start, `no start of month ${month} in ${y}`);
    const nearest = moons.slice().sort((a, b) => Math.abs(a - start) - Math.abs(b - start))[0];
    assert.strictEqual(iso(start), A.dayIn(nearest, 8), `lunar month ${month} of ${y} starts on ${iso(start)}, the new moon is on ${A.dayIn(nearest, 8)} (China time)`);
  }
}
// 2. Nowruz is the day of the March equinox if that happens before noon in Tehran, else the next day
for (let y = 2026; y <= 2040; y++) {
  const tehran = new Date(A.marchEquinox(y).getTime() + 3.5 * 3600000);
  const day = new Date(Date.UTC(tehran.getUTCFullYear(), tehran.getUTCMonth(), tehran.getUTCDate() + (tehran.getUTCHours() < 12 ? 0 : 1)));
  assert.deepStrictEqual(dates('nowruz', y), [day.toISOString().slice(0, 10)], 'Nowruz ' + y);
}
// 3. the equinox helper itself against published times
assert.strictEqual(A.marchEquinox(2028).toISOString().slice(0, 13), '2028-03-20T02');
assert.strictEqual(A.marchEquinox(2027).toISOString().slice(0, 13), '2027-03-20T20');

console.log(`holidays tests: ${H.EVENTS.length} events in ${H.TRADITIONS.length} traditions, all passed`);
