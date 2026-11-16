// Run with:  node tests/exchange.test.js
'use strict';
const assert = require('assert');
const X = require('../src/exchange.js');

const entry = (kind, name, month, day, year = 0, id = '') => ({ id, kind, name, month, day, year });
const sample = [
  entry('birthday', 'Maria Muster', 12, 24, 1980, 'id-1'),
  entry('nameday', 'Martin, der "Große"; Test', 11, 11, 0, 'id-2'),
  entry('wedding', 'Anna & Paul', 6, 3, 2001, 'id-3'),
  entry('other', 'Erster PC\nzweite Zeile', 11, 11, 1995, 'id-4'),
  entry('birthday', 'Schaltjahr-Kind', 2, 29, 2000, 'id-5'),
  entry('other', 'Ohne Jahr am 29. Februar', 2, 29, 0, 'id-6'),
  entry('birthday', 'Ä'.repeat(80) + ' sehr langer Name mit Umlauten öüß', 5, 5, 1999, 'id-7'),
];
sample[3].name = 'Erster PC zweite Zeile'; // newlines are normalised on import, so compare with the cleaned text

// ───────── JSON ─────────
const json = X.toJson(sample);
assert(JSON.parse(json).version === 1);
const back = X.parseJson(json);
assert.deepStrictEqual(back.events, sample);
assert.strictEqual(back.skipped, 0);
// plain array, bad entries are skipped, unknown/missing values handled
const lenient = X.parseJson('[{"kind":"birthday","name":"A","month":1,"day":2,"year":1990},{"kind":"alien","name":"B","month":1,"day":2},{"kind":"other","name":"C","month":2,"day":30},{"kind":"nameday","name":"D","month":3,"day":4,"year":2000}]');
assert.strictEqual(lenient.events.length, 2);
assert.strictEqual(lenient.skipped, 2);
assert.strictEqual(lenient.events[1].year, 0, 'name days have no year');
assert.throws(() => X.parseJson('{"foo": 1}'));
assert.throws(() => X.parseJson('not json'));
assert.strictEqual(X.parseJson('\uFEFF{"events":[]}').events.length, 0);

// ───────── ICS: structure ─────────
const now = new Date(Date.UTC(2026, 10, 15, 10, 20, 30));
const ics = X.toIcs(sample, { now, year: 2026, labels: { birthday: 'Geburtstag', nameday: 'Namenstag', wedding: 'Hochzeitstag', other: 'Sonstiger Gedenktag' }, calendarName: 'Ehrentag-Manager' });
assert(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
assert(ics.endsWith('END:VCALENDAR\r\n'));
assert(!/[^\r]\n/.test(ics), 'all line breaks are CRLF');
for (const line of ics.split('\r\n')) assert(new TextEncoder().encode(line).length <= 75, 'line too long: ' + line);
assert(ics.includes('DTSTAMP:20261115T102030Z'));
assert(ics.includes('DTSTART;VALUE=DATE:19801224\r\nDTEND;VALUE=DATE:19801225\r\nRRULE:FREQ=YEARLY'));
assert(ics.includes('SUMMARY:Geburtstag: Maria Muster'));
assert(ics.includes('UID:id-1@ehrentag'));
assert(ics.includes('SUMMARY:Namenstag: Martin\\, der "Große"\\; Test'), 'commas and semicolons are escaped');
// 29 Feb: valid start date and "last day of February"
assert(ics.includes('DTSTART;VALUE=DATE:20000229\r\nDTEND;VALUE=DATE:20000301\r\nRRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1'));
assert(ics.includes('DTSTART;VALUE=DATE:20280229'), 'year unknown + 29 Feb starts in the next leap year (2028)');
// year unknown -> current year and a marker
assert(ics.includes('DTSTART;VALUE=DATE:20261111'));
assert(ics.split('X-EHRENTAG-NOYEAR:TRUE').length - 1 === 2, 'two entries without a year');
// year-end rollover of DTEND
const eoy = X.toIcs([entry('other', 'Silvester', 12, 31, 2020, 'a')], { now, year: 2026 });
assert(eoy.includes('DTSTART;VALUE=DATE:20201231\r\nDTEND;VALUE=DATE:20210101'));

// ───────── ICS: round trip ─────────
const rt = X.parseIcs(ics);
assert.strictEqual(rt.skipped, 0);
assert.deepStrictEqual(rt.events, sample);
// and again through merge: nothing new
const again = X.mergeEntries(sample, rt.events, false);
assert.strictEqual(again.added, 0);
assert.strictEqual(again.skipped, sample.length);

// ───────── ICS: files from other programs ─────────
const google = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:19850312', 'DTEND;VALUE=DATE:19850313', 'RRULE:FREQ=YEARLY',
  "SUMMARY:Peter Beispiel's birthday", 'UID:abc123@google.com',
  'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART:20261201T090000Z', 'SUMMARY:Team meeting', 'END:VEVENT', // one-off: skipped
  'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:16040704', 'RRULE:FREQ=YEARLY', 'SUMMARY:Geburtstag Oma', 'END:VEVENT', // Apple "year unknown"
  'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20150620', 'RRULE:FREQ=YEARLY;INTERVAL=2', 'SUMMARY:Every second year', 'END:VEVENT', // not yearly
  'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20100101', 'RRULE:FREQ=MONTHLY', 'SUMMARY:Monthly', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20000821', 'RRULE:FREQ=YEARLY', 'SUMMARY:Hochzeitstag Anna und Paul', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20120505', 'RRULE:FREQ=YEARLY', 'CATEGORIES:Holidays', 'SUMMARY:Gartenfest', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');
const g = X.parseIcs(google);
assert.strictEqual(g.skipped, 3);
assert.deepStrictEqual(g.events, [
  entry('birthday', "Peter Beispiel's birthday", 3, 12, 1985),
  entry('birthday', 'Geburtstag Oma', 7, 4, 0),
  entry('wedding', 'Hochzeitstag Anna und Paul', 8, 21, 2000),
  entry('other', 'Gartenfest', 5, 5, 0),
]);

// folded lines and LF-only files
const folded = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:19900101\nRRULE:FREQ=YEARLY\nSUMMARY:Ein sehr lan\n ger Titel\\, der umgebrochen wurde\nCATEGORIES:BIRTHDAY\nEND:VEVENT\nEND:VCALENDAR\n';
const f = X.parseIcs(folded);
assert.strictEqual(f.events[0].name, 'Ein sehr langer Titel, der umgebrochen wurde');
assert.strictEqual(f.events[0].kind, 'birthday');
// an empty or unrelated file
assert.deepStrictEqual(X.parseIcs('BEGIN:VCALENDAR\nEND:VCALENDAR'), { events: [], skipped: 0 });

// ───────── kind guessing ─────────
for (const [text, kind] of [
  ['Peter birthday', 'birthday'], ['Geburtstag von Eva', 'birthday'], ['Cumpleaños de Luis', 'birthday'], ['Compleanno Marco', 'birthday'],
  ['Hochzeitstag', 'wedding'], ['Wedding anniversary', 'wedding'], ['Aniversário de casamento', 'wedding'],
  ['Namenstag Martin', 'nameday'], ['Name day', 'nameday'], ['Onomástica', 'nameday'],
  ['Gartenfest', 'other'], ['Christmas', 'other'],
]) assert.strictEqual(X.guessKind(text), kind, text);

// ───────── format detection ─────────
assert.strictEqual(X.detectFormat('BEGIN:VCALENDAR\r\n'), 'ics');
assert.strictEqual(X.detectFormat('\uFEFF  {"events": []}'), 'json');
assert.strictEqual(X.detectFormat('[ ]'), 'json');
assert.strictEqual(X.detectFormat('24\n12\n1980\nMaria\nG\n'), 'legacy');

// ───────── merge ─────────
const base = [entry('birthday', 'A', 1, 2, 1990, 'x1')];
let m = X.mergeEntries(base, [entry('birthday', 'a', 1, 2, 1990), entry('birthday', 'B', 1, 3, 1990, 'x2'), entry('other', 'C', 4, 5, 0, 'x1')], false);
assert.strictEqual(m.added, 1, 'same content (case-insensitive) and same id are duplicates');
assert.strictEqual(m.skipped, 2);
assert.strictEqual(m.entries.length, 2);
m = X.mergeEntries(base, [entry('birthday', 'B', 1, 3, 1990)], true);
assert.deepStrictEqual(m.entries.map((e) => e.name), ['B']);
assert.strictEqual(m.added, 1);
// ids
assert.notStrictEqual(X.newId(), X.newId());
assert(/^[A-Za-z0-9_-]+$/.test(X.newId()));

console.log('exchange tests: all passed');
