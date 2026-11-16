// Checks every language file against English.   Run with:  node tests/i18n.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = path.join(__dirname, '..', 'src');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(src, 'i18n.js'), 'utf8') + '\nthis.LANGUAGES = LANGUAGES; this.I18N = I18N;', ctx);
const { LANGUAGES, I18N } = ctx;

// every listed language has a file that is loaded by index.html
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
for (const l of LANGUAGES) {
  const file = path.join(src, 'lang', l.code + '.js');
  assert(fs.existsSync(file), 'missing file ' + file);
  assert(html.includes('src="lang/' + l.code + '.js"'), 'index.html does not load lang/' + l.code + '.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  assert(I18N[l.code], l.code + ' did not register itself');
  assert(['ltr', 'rtl'].includes(l.dir), l.code + ': bad dir');
  assert(typeof l.name === 'string' && l.name.length > 0);
  new Intl.DateTimeFormat(l.locale); // throws for an invalid locale
}
// no language file without an entry in LANGUAGES
for (const f of fs.readdirSync(path.join(src, 'lang'))) {
  assert(LANGUAGES.some((l) => l.code + '.js' === f), f + ' is not listed in LANGUAGES');
}

const placeholders = (s) => new Set([...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1]));
const forms = (v) => (typeof v === 'string' ? [v] : Object.values(v));

const en = I18N.en;
let problems = [];
for (const l of LANGUAGES) {
  const tr = I18N[l.code];
  const rules = new Intl.PluralRules(l.locale);
  // categories that can really occur for the numbers the app shows (days: 0..1000);
  // newer ICU versions also list "many" for large numbers such as a million, which never appear here
  const cats = [...new Set(Array.from({ length: 1001 }, (_, n) => rules.select(n)))];
  const known = rules.resolvedOptions().pluralCategories;

  for (const k of Object.keys(en)) if (!(k in tr)) problems.push(`${l.code}: missing key ${k}`);
  for (const k of Object.keys(tr)) if (!(k in en)) problems.push(`${l.code}: unknown key ${k}`);

  for (const k of Object.keys(en)) {
    const v = tr[k];
    if (v === undefined) continue;
    const allowed = new Set(forms(en[k]).flatMap((s) => [...placeholders(s)]));
    // plural keys are objects in every language that needs several forms
    if (typeof v === 'object') {
      for (const c of cats) if (!(c in v)) problems.push(`${l.code}: ${k} lacks the plural form "${c}"`);
      for (const c of Object.keys(v)) if (!known.includes(c)) problems.push(`${l.code}: ${k} has the unknown plural form "${c}"`);
    }
    for (const s of forms(v)) {
      if (typeof s !== 'string' || s.trim() === '') problems.push(`${l.code}: ${k} is empty`);
      for (const p of placeholders(s)) if (!allowed.has(p)) problems.push(`${l.code}: ${k} uses {${p}} which English does not`);
    }
    // the placeholders of a text must all be present in at least one form, and in a plain text in all of it
    if (typeof v === 'string') {
      const need = placeholders(typeof en[k] === 'string' ? en[k] : en[k].other);
      for (const p of need) if (!placeholders(v).has(p)) problems.push(`${l.code}: ${k} lacks {${p}}`);
    }
  }
}
assert.deepStrictEqual(problems, [], '\n' + problems.join('\n'));

// every key used by the code and the HTML exists
const used = new Set();
for (const f of ['main.js', 'index.html', 'logic.js']) {
  const text = fs.readFileSync(path.join(src, f), 'utf8');
  for (const m of text.matchAll(/\bt\('([A-Za-z_]+)'/g)) used.add(m[1]);
  for (const m of text.matchAll(/data-i18n(?:-ph)?="([A-Za-z_]+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/error: '([A-Za-z]+)'/g)) used.add(m[1]);
}
for (const kind of ['birthday', 'nameday', 'wedding', 'other']) { used.add('kind_' + kind); used.add('hint_' + kind); }
for (const k of ['event_easter', 'event_christmaseve', 'event_christmas', 'event_newyear']) used.add(k);
used.delete('kind_'); used.delete('hint_'); used.delete('event_');
for (const k of used) assert(k in en, 'the code uses an unknown text key: ' + k);
assert(!('suffixDays' in en), 'suffixDays was replaced by daysUnit');
assert(!('importDone' in en), 'importDone was replaced by importResult');

console.log(`i18n tests: ${LANGUAGES.length} languages x ${Object.keys(en).length} texts, all consistent`);
