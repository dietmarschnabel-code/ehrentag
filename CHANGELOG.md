# Changelog

All notable changes to this project. The version number is also the Android `versionCode` basis
(major × 1,000,000 + minor × 1,000 + patch), so every release must have a higher version than the one before.

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
