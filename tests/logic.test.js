// Run with:  node tests/logic.test.js
'use strict';
const assert = require('assert');
const L = require('../src/logic.js');

const d = (y, m, day) => new Date(y, m - 1, day);

// validDate
assert(L.validDate(2, 29));
assert(!L.validDate(2, 30));
assert(!L.validDate(4, 31));
assert(!L.validDate(13, 1));
assert(!L.validDate(1, 0));

// nextOccurrence: later this year, passed -> next year, today counts
assert.deepStrictEqual(L.nextOccurrence({ month: 12, day: 24 }, d(2026, 11, 13)), d(2026, 12, 24));
assert.deepStrictEqual(L.nextOccurrence({ month: 11, day: 11 }, d(2026, 11, 13)), d(2027, 11, 11));
assert.deepStrictEqual(L.nextOccurrence({ month: 11, day: 13 }, d(2026, 11, 13)), d(2026, 11, 13));
// 29 Feb: falls back to 28 Feb in non-leap years, stays 29 Feb in leap years
assert.deepStrictEqual(L.nextOccurrence({ month: 2, day: 29 }, d(2026, 11, 13)), d(2027, 2, 28));
assert.deepStrictEqual(L.nextOccurrence({ month: 2, day: 29 }, d(2027, 3, 1)), d(2028, 2, 29));

// daysBetween (also across the daylight-saving change)
assert.strictEqual(L.daysBetween(d(2026, 11, 13), d(2026, 11, 13)), 0);
assert.strictEqual(L.daysBetween(d(2026, 11, 13), d(2026, 11, 14)), 1);
assert.strictEqual(L.daysBetween(d(2026, 3, 20), d(2026, 4, 5)), 16);
assert.strictEqual(L.daysBetween(d(2026, 10, 20), d(2026, 11, 5)), 16);

// ordinal
assert.strictEqual(L.ordinal('de', 45), '45.');
for (const [n, s] of [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [45, '45th'], [101, '101st'], [111, '111th']]) {
  assert.strictEqual(L.ordinal('en', n), s);
}

// ordinal in the other languages (the suffix is part of the text for ru/hi/ar/zh/ja)
assert.strictEqual(L.ordinal('es', 46), '46.º');
assert.strictEqual(L.ordinal('pt', 46), '46º');
assert.strictEqual(L.ordinal('it', 46), '46º');
assert.strictEqual(L.ordinal('fr', 1), '1er');
assert.strictEqual(L.ordinal('fr', 46), '46e');
assert.strictEqual(L.ordinal('tr', 46), '46.');
for (const lang of ['ru', 'hi', 'ar', 'zh', 'ja']) assert.strictEqual(L.ordinal(lang, 46), '46');

// firstNameUpper
assert.strictEqual(L.firstNameUpper('maria Muster'), 'MARIA Muster');
assert.strictEqual(L.firstNameUpper('martin'), 'MARTIN');

// nextReminder: one day before at 09:00
let now = new Date(2026, 10, 13, 8, 0);
let r = L.nextReminder({ month: 11, day: 14 }, L.startOfDay(now), now, 1, 9);
assert.deepStrictEqual(r.fire, new Date(2026, 10, 13, 9, 0));
assert.deepStrictEqual(r.date, d(2026, 11, 14));
// moment already passed -> next year
now = new Date(2026, 10, 13, 10, 0);
r = L.nextReminder({ month: 11, day: 14 }, L.startOfDay(now), now, 1, 9);
assert.deepStrictEqual(r.fire, new Date(2027, 10, 13, 9, 0));
// on the day itself
now = new Date(2026, 10, 13, 8, 0);
r = L.nextReminder({ month: 11, day: 13 }, L.startOfDay(now), now, 0, 9);
assert.deepStrictEqual(r.fire, new Date(2026, 10, 13, 9, 0));

// validateForm
const base = { name: 'Maria', kind: 'birthday', day: '24', month: '12', year: '1980' };
assert.deepStrictEqual(L.validateForm(base, 2026).entry, { day: 24, month: 12, year: 1980, name: 'Maria', kind: 'birthday' });
assert.strictEqual(L.validateForm({ ...base, name: '  ' }, 2026).error, 'errName');
assert.strictEqual(L.validateForm({ ...base, day: 'x' }, 2026).error, 'errDay');
assert.strictEqual(L.validateForm({ ...base, month: '' }, 2026).error, 'errMonth');
assert.strictEqual(L.validateForm({ ...base, day: '31', month: '2' }, 2026).error, 'errDate');
assert.strictEqual(L.validateForm({ ...base, year: '' }, 2026).error, 'errYearMissing');
assert.strictEqual(L.validateForm({ ...base, year: '85' }, 2026).error, 'errYearFormat');
assert.strictEqual(L.validateForm({ ...base, year: '2030' }, 2026).error, 'errYearFuture');
assert.strictEqual(L.validateForm({ ...base, kind: 'nameday', year: '' }, 2026).entry.year, 0);
assert.strictEqual(L.validateForm({ ...base, kind: 'nameday', year: '1999' }, 2026).entry.year, 0); // ignored for name days
assert.strictEqual(L.validateForm({ ...base, kind: 'other', year: '' }, 2026).entry.year, 0);
assert.strictEqual(L.validateForm({ ...base, kind: 'other', year: '2030' }, 2026).entry.year, 2030);

// easterDate (known dates; the other special days are tested in holidays.test.js)
assert.deepStrictEqual(L.easterDate(2024), d(2024, 3, 31));
assert.deepStrictEqual(L.easterDate(2025), d(2025, 4, 20));
assert.deepStrictEqual(L.easterDate(2026), d(2026, 4, 5));
assert.deepStrictEqual(L.easterDate(2027), d(2027, 3, 28));
assert.deepStrictEqual(L.easterDate(2038), d(2038, 4, 25));

console.log('logic tests: all passed');
