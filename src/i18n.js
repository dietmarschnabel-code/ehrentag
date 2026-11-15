'use strict';

// Languages and translations.
//
// Every language lives in its own file, src/lang/<code>.js, which fills I18N.<code>.
// To add a language: copy src/lang/en.js, translate the values, add the file to index.html
// and add an entry to LANGUAGES below (tests/i18n.test.js checks that nothing is missing).
//
// Placeholders {0}, {1}, ... are filled in by t(). A value may also be an object with plural
// forms ({ one: ..., other: ... }; the categories of Intl.PluralRules), chosen by the first
// argument, which must then be the number.
//
// Each language is listed with its own name, its date locale and its writing direction.

const LANGUAGES = [
  { code: 'de', name: 'Deutsch', locale: 'de-AT', dir: 'ltr' },
  { code: 'en', name: 'English', locale: 'en-GB', dir: 'ltr' },
  { code: 'es', name: 'Español', locale: 'es-ES', dir: 'ltr' },
  { code: 'fr', name: 'Français', locale: 'fr-FR', dir: 'ltr' },
  { code: 'it', name: 'Italiano', locale: 'it-IT', dir: 'ltr' },
  { code: 'pt', name: 'Português', locale: 'pt-BR', dir: 'ltr' },
  { code: 'ru', name: 'Русский', locale: 'ru-RU', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', locale: 'tr-TR', dir: 'ltr' },
  { code: 'ar', name: 'العربية', locale: 'ar-u-nu-latn', dir: 'rtl' }, // Latin digits, as in the rest of the app
  { code: 'hi', name: 'हिन्दी', locale: 'hi-IN', dir: 'ltr' },
  { code: 'zh', name: '中文', locale: 'zh-CN', dir: 'ltr' }, // simplified Chinese
  { code: 'ja', name: '日本語', locale: 'ja-JP', dir: 'ltr' },
];

const I18N = {};
