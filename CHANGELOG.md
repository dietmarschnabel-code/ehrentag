# Changelog

All notable changes to this project. The version number is also the Android `versionCode` basis
(major × 1,000,000 + minor × 1,000 + patch), so every release must have a higher version than the one before.

## 1.0.3 – 2026-11-23

### Changed
- **Separate settings screen** (button *Settings* in the overview): number of dates, language, warning colour, special
  days of the traditions, banner and message, reminders, **import and export** and the data file path moved here from
  the editor. The editor now only contains entering, changing and deleting dates.
- Android back button: from the settings it returns to the overview, like in the editor.
- Fix Android build on github.

### Added
- **macOS build:** the release workflow now builds a universal `.dmg` (Apple Silicon + Intel) on a GitHub macOS runner
  and attaches it to the release. Optional signing/notarization is described in `docs/MACOS.md`.
- **About dialog** in the settings: version, link to the website (GitHub), and the license (MIT) with a link to the
  license text. Links open in the system browser (`tauri-plugin-opener`).

## 1.0.2 – 2026-11-21

- **Special days of many traditions** (41 days: Western and Orthodox Christian, Islamic, Jewish, Hindu, East Asian,
  Persian and general): choose your traditions, count down to any day, show "the next special day of my traditions" below
  the banner, and show the next ones in the overview list. All names are translated into the 12 languages. Hindu
  festival dates are included up to 2028 (Diwali, Holi, Raksha Bandhan, Dussehra).

### Fixed
- **Android back button:** in the editor it now returns to the overview, exactly like the *Back* button at the top; in
  the overview it still closes the app.
- **Special days of several traditions:** the list showed only the nearest three days, so with *General* and *Western
  Christian* chosen, New Year's Eve and New Year's Day were missing. The list now always includes the next day of every
  chosen tradition, and the number of days shown can be set (default 6).
- **Settings changed in quick succession** (for example two traditions ticked one after the other) are saved one after
  the other, always the newest state; before, a slower older save could overwrite a newer one.
### Changed
- The countdown choices below the banner (Easter, Christmas Eve, Christmas, New Year) became part of the special days;
  earlier choices are converted automatically.

## 1.0.1 – 2026-11-15

### Added
- **Calendar export and import (.ics):** every date becomes a yearly repeating all-day event; birthdays and other
  yearly events can be imported from Google Calendar, Apple Calendar, Outlook and others.
- **Data file `events.json`** (JSON, readable names for the kinds of dates) replaces the old five-line `gebdatei.dat`.
  An existing `gebdatei.dat` is converted automatically, once; the original is kept as `gebdatei.dat.bak`.
- **12 languages** (English, German, Spanish, French, Italian, Portuguese, Russian, Turkish, Arabic, Hindi, Chinese,
  Japanese), including a translated app name and right-to-left layout for Arabic.
- **Yellow highlighting** of dates that are closer than a configurable number of days.
- **Configurable banner text** and a choice of message below it (countdown to carnival season, Easter, Christmas Eve,
  Christmas, New Year, your own text, or none).
- Reminders as notifications on Android.
- Google Play preparation: signed Android App Bundle (`.aab`) build, store listing texts, graphics, privacy policy.

### Changed
- The language switch moved from the overview into the editor; the system language is the default.
- **Application id** (Android) is now `com.dietmarsl.code.ehrentag`.
- **Program name** is now `Ehrentag-Manager` in `Cargo.toml`, `package.json` and `tauri.conf.json`, so that the window
  of the Linux app matches the `Ehrentag-Manager.desktop` file of the packages and shows its icon on Wayland. The Linux
  program is therefore called `Ehrentag-Manager` instead of `ehrentag`.

## 1.0.0

- First release of the Tauri version: overview with the next dates, editor, animated MARTIN banner.
