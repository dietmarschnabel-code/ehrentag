<div align="center">

<img src="app-icon.png" width="128" alt="Ehrentag-Manager icon">

# Ehrentag-Manager

**Birthdays, name days and other dates worth remembering – always in view. With MARTIN.**

[![Release](https://img.shields.io/github/v/release/dietmarschnabel-code/ehrentag?color=%23a855f7)](https://github.com/dietmarschnabel-code/ehrentag/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Tauri 2](https://img.shields.io/badge/Tauri-2-24c8db)

</div>

<!-- Tip: save a screenshot as docs/screenshot.png and enable the next line
![Screenshot](docs/screenshot.png)
-->

Ehrentag-Manager shows you the **next dates you shouldn't forget** and lets you add new entries in a built-in editor.
It is the modern successor of a small Pascal program and runs on **Windows**, **macOS**, **Linux** and **Android** from a single
code base ([Tauri 2](https://tauri.app/): a Rust backend with a small HTML/CSS/JavaScript interface).
The user interface is available in **12 languages**: English, German, Spanish, French, Italian, Portuguese, Russian,
Turkish, Arabic, Hindi, Chinese (simplified) and Japanese.

> *Ehrentag* is German for a person's special day, such as a birthday or name day.

## Features

- **Upcoming dates** with weekday, countdown ("in 4 days", "tomorrow", "TODAY!") and age or anniversary count –
  how many are shown (default 3) and how far ahead is configurable
- **Four kinds of dates:** birthday, name day, wedding anniversary and other special day
- **Editor:** add, change and delete entries (with a confirmation before deleting)
- **Settings:** a separate screen for display, language, special days, banner, reminders, import/export and an
  *About* dialog (version, website, license) – kept apart from entering and managing dates
- **Warning colour:** dates that are closer than a configurable number of days turn **yellow**
- **Special days of many traditions:** pick the traditions you celebrate – Western and Orthodox Christian, Islamic, Jewish,
  Hindu, East Asian, Persian and general days – and count down to them or see the next ones in the list (41 days, from
  Easter and Eid al-Fitr to Diwali and Lunar New Year)
- **Reminders on Android:** a notification a configurable number of days before, at a time of your choice
- **12 languages** – follows your system language; can be changed in the settings (Arabic is shown right-to-left).
  The app name is translated too ("Special Days Manager", "Gestor de días especiales", …).
- **MARTIN** – bouncing rainbow pixel letters with confetti. On **11 November** it celebrates, and at **11:11** the confetti
  goes wild. The banner text and the message below it are configurable (see below).
- **Calendar export and import (.ics):** take your dates into Google Calendar, Apple Calendar, Outlook and others, or
  import birthdays from them
- **Simple JSON data file** (`events.json`) and an automatic one-time conversion of the old `gebdatei.dat` of the
  original Pascal program
- Phone-friendly layout with large touch targets

## Installation

All packages are available on the [**Releases**](https://github.com/dietmarschnabel-code/ehrentag/releases/latest) page.

### Windows

Download and run the `…-setup.exe` installer. It creates Start menu shortcuts and can be removed again via
"Apps & features". The installer offers English and German.

> The installer is not code-signed, so Windows SmartScreen may show a warning – click "More info" → "Run anyway".
> Windows 10/11 already include the WebView2 runtime the app needs.

### macOS

Download the `…_universal.dmg` (one file for Apple Silicon and Intel Macs), open it and drag **Ehrentag-Manager** into
*Applications*.

> The app is not notarized by Apple, so on the first start macOS may say it cannot verify the developer.
> Right-click (or Control-click) the app → **Open** → **Open**. If macOS reports the app as "damaged" after the
> download, run `xattr -dr com.apple.quarantine /Applications/Ehrentag-Manager.app` once in the Terminal.

### Debian, Ubuntu, Linux Mint

```bash
sudo apt install ./Ehrentag-Manager_*_amd64.deb
```

### Fedora, openSUSE, RHEL and friends

```bash
sudo dnf install ./Ehrentag-Manager-*.x86_64.rpm                       # Fedora
sudo zypper --no-gpg-checks install ./Ehrentag-Manager-*.x86_64.rpm    # openSUSE (the package is unsigned)
```

The packages pull in WebKitGTK as a dependency. Afterwards you will find "Ehrentag-Manager" in your application menu.

### Android

Download the `…_android.apk` file on your phone and open it. Android will ask you to allow installing apps from your
browser or file manager once ("unknown sources"). Android 7.0 or newer is required.

### Checksums

Every release includes a `SHA256SUMS.txt`:

```bash
sha256sum -c --ignore-missing SHA256SUMS.txt
```

## Usage

1. The **overview** shows today's date and the upcoming dates.
2. Tap **"Manage / add dates"** to open the editor.
3. Enter name, type and date, then tap **Add**. That's it – everything is saved immediately.
4. Everything else (number of dates, language, traditions, banner, reminders, import/export) is under **Settings**.

| Type | Year | Shown as |
|---|---|---|
| Birthday | required | "42nd birthday" |
| Name day | not needed | first name in CAPITALS, "Name day" |
| Wedding anniversary | required | "25th wedding anniversary" |
| Other special day | optional | "Special day" or "10th anniversary" |

A date on 29 February is shown on 28 February in non-leap years.

### Display and language

- **Number of dates** (1–30): how many upcoming dates the overview shows
- **Only the next … days** (0–366): only show dates within this period; `0` means no limit
- **Highlight dates closer than** (0–60 days): such dates are shown in **yellow** instead of white; `0` turns the
  highlighting off. Today's dates additionally pulse.
- **Language:** automatic (your system language, the default) or any of the 12 languages.

### Banner and message

- **Banner text:** the big animated text, `MARTIN` by default. Up to 16 characters: Latin letters (including Ä Ö Ü), digits,
  spaces and `! ? . , : - + / & ' ♥`. Other characters (Cyrillic, Arabic, Chinese …) are shown as `?`. Longer texts are
  shrunk automatically so they always fit.
- **Message below the banner:** choose between a countdown to carnival season (the default, 11 Nov at 11:11), a
  countdown to any of the special days below, the **next special day of your traditions**, your own fixed text, or no
  message at all.

### Special days of my traditions

Tick the traditions whose special days you want to see in the **Settings**: *General*, *Western Christian*, *Orthodox
Christian*, *Islamic*, *Jewish*, *Hindu*, *East Asian* and *Persian / Nowruz*. Nothing is chosen by default, and the
choice is never guessed from the language. With **Also show them in the overview** the next special days of
your traditions appear in the list, in blue, between your personal dates. The list always contains the **next day of
every tradition you chose** (so none is missing), and is then filled with the nearest of the others up to the
**number of special days** you set (default 6, up to 20). If you choose more traditions than that number, the list is
as long as the number of traditions. The message below the banner can count down to one special day or always show the
next one.

| Tradition | Special days |
|---|---|
| General | New Year's Day, Valentine's Day, International Women's Day, Halloween, New Year's Eve |
| Western Christian | Epiphany, Shrove Tuesday (Mardi Gras), Ash Wednesday, Good Friday, Easter, Ascension Day, Pentecost, All Saints' Day, St. Nicholas' Day, Christmas Eve, Christmas |
| Orthodox Christian | Orthodox Christmas (7 Jan), Old New Year (14 Jan), Orthodox Epiphany (19 Jan), Orthodox Easter |
| Islamic | Start of Ramadan, Eid al-Fitr, Eid al-Adha, Islamic New Year, Mawlid |
| Jewish | Rosh Hashanah, Yom Kippur, Hanukkah, Passover |
| Hindu | Diwali, Holi, Raksha Bandhan, Dussehra |
| East Asian | Lunar New Year, Lantern Festival, Qingming, Dragon Boat Festival, Mid-Autumn Festival (Chuseok), Obon, Songkran |
| Persian / Nowruz | Nowruz |

Every special day has its own name in all 12 languages (for example *Zuckerfest*, *Opferfest*, *Ramazan Bayramı*,
*Старый Новый год*). Please tell us about wrong or unnatural wording.

#### How accurate are the dates?

- **Exact:** fixed dates, Easter and everything counted from it, Orthodox Easter, the Jewish holidays and Nowruz.
- **Lunar festivals of East Asia** (Lunar New Year, Lantern Festival, Dragon Boat, Mid-Autumn) come from the Chinese
  calendar of your system, which is a day off in rare cases when the new moon falls minutes before midnight in China. The
  known cases (2027, 2030) are corrected, and the tests check every year to 2040 against an independent calculation.
- **Islamic holidays** depend on sighting the moon. The app uses the Umm al-Qura calendar of Saudi Arabia; your country
  can differ by a day or two. They are marked *approx.*
- **Hindu festivals** follow a lunisolar calendar that no system provides, so the dates come from a table (Drik Panchang)
  and are marked *approx.*: regions can differ by a day, and where sources disagreed (for example Holi 2028) the main
  day by Drik Panchang is used. **The table ends in 2028.** After that no Hindu festivals are shown until it is extended
  (see below). Janmashtami, Ganesh Chaturthi and Makar Sankranti are not included because the published dates
  disagreed too much to be reliable.
- Jewish and Islamic holidays begin the evening before; the date shown is the day itself.

### Reminders

Switch on **Send reminders** in the **Settings** and choose the time of day and how many days before the date you want to
be reminded (`0` = on the day itself). The app asks for the notification permission the first time.

- Reminders are delivered as notifications on **Android**; they are not active on desktop.
- The app schedules the next occurrence of every entry each time it is opened or changed, so open it now and then
  (at least once a year) to keep the reminders coming.
- Some phone makers restrict background activity aggressively; if reminders arrive late, exclude the app from
  battery optimisation in the system settings.

## Where is my data?

Your dates are stored in a small JSON file, `events.json`:

| System | Data file |
|---|---|
| Android | the app's private storage (not visible to other apps) |
| Windows | `%APPDATA%\ehrentag-manager\events.json` |
| macOS | `~/Library/Application Support/ehrentag-manager/events.json` |
| Linux | `~/.local/share/ehrentag-manager/events.json` |

On desktop you can override this: the environment variable `EHRENTAG_FILE` (full path of the file) wins, and an
`events.json` in the current directory is used if present. The settings are stored next to it as `settings.json`.
The settings show the current path. Uninstalling keeps your data.

### The old gebdatei.dat is converted automatically

Earlier versions (and the original Pascal program) used a text file called `gebdatei.dat`. When the app starts and
there is **no `events.json` yet** but a `gebdatei.dat` next to it, in the current directory or at the path in
`EHRENTAG_DATEI`, the dates are converted to `events.json` **once**. The old file is renamed to `gebdatei.dat.bak` (or
`.bak2`, … if that name is taken), is not used any more, and a note on the overview tells you what happened. An existing
`events.json` is never overwritten.

You can also import an old file by hand later (see below).

### File format

```json
{
  "version": 1,
  "events": [
    { "id": "5d9c…", "kind": "birthday", "name": "Maria Muster", "month": 12, "day": 24, "year": 1980 },
    { "id": "a41f…", "kind": "nameday",  "name": "Martin",       "month": 11, "day": 11, "year": 0 }
  ]
}
```

- `kind` is `birthday`, `nameday`, `wedding` (wedding anniversary) or `other` (any other special day)
- `year` is `0` when it is not given (name days never have one)
- every date repeats every year; `id` identifies an entry (it is the UID in calendar files)
- the file is written as UTF-8 and replaced atomically; a file that cannot be read is kept as `events.json.corrupt.bak`
  instead of being overwritten

## Calendar files (.ics) and backups

Both are in the **Settings**, under **Export** and **Import**.

**Export** creates either a calendar file (`ehrentag.ics`) or a backup (`events.json`). On desktop a "Save as" dialog
opens; on a phone the share sheet is used where available; otherwise the text is shown so that you can copy it into a
file. In the calendar file every date is an all-day event that **repeats every year** (`RRULE:FREQ=YEARLY`), titled with
its type and name, for example "Birthday: Maria Muster". A 29 February repeats on the last day of February. Where the
year is unknown the current year is used as the start and the entry is marked, so that importing it again restores it.

**Import** takes a calendar file (`.ics`), an `events.json` backup or an old `gebdatei.dat`. The format is recognised
from the content. Imported dates are added to your existing ones; dates that are already there (same entry, or same
content) are skipped, so importing the same file twice does nothing. Tick *Replace existing entries* to start from the
imported file instead.

- From other calendars only events that **repeat every year** are taken over (birthdays, anniversaries …). Meetings and
  other one-off or differently repeating events are skipped and counted in the result.
- The type is guessed from the categories and the title (for example "Birthday", "Geburtstag", "Cumpleaños",
  "Hochzeitstag"); anything else becomes *Other special day*. Dates exported by this app keep their exact type.
- A year of 1604 or earlier (used by Apple for "year unknown") is read as "no year".

## Building from source

Requirements: [Rust](https://rustup.rs/) (stable), [Node.js](https://nodejs.org/) (only for the Tauri command line tool),
on macOS the Xcode command line tools (`xcode-select --install`), and on Linux the WebKitGTK development packages:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

```bash
git clone https://github.com/dietmarschnabel-code/ehrentag.git
cd ehrentag
npm install
npm run tauri dev          # run with live reload
npm run tauri build        # build the installers for your system
```

The interface (`src/`) is plain HTML, CSS and JavaScript – there is no frontend build step. You can also open
`src/index.html` in any browser for a quick design preview; a small in-memory mock replaces the Rust backend there.

### The app icon on Linux

On Wayland (and in GNOME and KDE in general) a program cannot set the icon of its window. The desktop takes the
program's name (`app_id`) and looks for an installed `.desktop` file with that name, and the icon comes from there.
So the name of the program must be the same as the name of the `.desktop` file that the packages install. The
packages name that file after `productName`, so **`name` in `src-tauri/Cargo.toml`, `name` in `package.json` and
`productName` in `src-tauri/tauri.conf.json` are all `Ehrentag-Manager`**. If one of them differs, the window shows a
generic icon (an orange letter in some desktops). `node scripts/bump-version.js --check` verifies this.

The installed `.deb` / `.rpm` packages then show the icon everywhere. A build run from the source tree
(`npm run tauri dev`) has no installed `.desktop` file. To give your development build its icon:

```bash
scripts/install-dev-desktop-entry.sh            # then restart the app (use "release" for a release build)
scripts/install-dev-desktop-entry.sh remove     # undo
```

To see which name a window announces (its `app_id`), use your desktop's window inspector: GNOME "Looking Glass"
(Alt+F2, `lg`, tab *Windows*), `hyprctl clients` on Hyprland, `swaymsg -t get_tree` on sway, or the *Detect Window
Properties* button in the KDE window rules. It has to match the name of the installed `.desktop` file
(`Ehrentag-Manager.desktop`).

### Android

Additional requirements: a JDK 17, the Android SDK and NDK (e.g. via Android Studio), `ANDROID_HOME` and `NDK_HOME`
set, and the Rust Android targets:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

If the build stops with `gradlew ... exited with code 1`, the cause is often the Java version: Gradle needs a
JDK 17-style runtime, and a much newer (or missing) system Java fails. Point `JAVA_HOME` at the JDK bundled with
Android Studio (the `jbr` folder in its installation directory) and add the line to your shell profile:

```bash
export JAVA_HOME=/path/to/android-studio/jbr
```

The application id of the Android app is `com.dietmarsl.code.ehrentag` (`identifier` in `tauri.conf.json`). It is built
into the Android project, so after changing it delete `src-tauri/gen/android` and run `android init` again.

```bash
npm run tauri android init                    # once: creates src-tauri/gen/android (commit it)
npm run tauri icon app-icon.png               # app icons for all platforms
npm run tauri android dev                     # run on a connected phone or emulator
npm run tauri android build -- --apk          # release APK (unsigned, see below)
```

### Tests

```bash
node tests/logic.test.js                          # date logic and form validation
node tests/i18n.test.js                           # all translations are complete and consistent
node tests/exchange.test.js                       # events.json, calendar file export/import and merging
node tests/holidays.test.js                       # special days: known dates, Hindu table, astronomical cross-checks
cargo test --manifest-path src-tauri/Cargo.toml   # data file, conversion of the old file, settings
```

## Languages and translations

Every language has its own file in `src/lang/` (`de.js`, `en.js`, `es.js`, …). Weekday and month names come from the
browser's `Intl` support, so they need no translation. Some texts have **plural forms** (for example "1 day / 2 days",
which Russian and Arabic need several forms for); the tests check that each language provides every form it needs.

The translations are not professionally reviewed – corrections by native speakers are very welcome.

### Adding a language

1. Copy `src/lang/en.js` to `src/lang/<code>.js` (e.g. `nl.js`), rename `I18N.en` to `I18N.<code>` and translate the values.
2. Add `<script src="lang/<code>.js"></script>` to `src/index.html`.
3. Add an entry to `LANGUAGES` in `src/i18n.js`: code, the language's own name, a date locale (e.g. `nl-NL`) and the
   writing direction (`ltr` or `rtl`).
4. Add a case to `ordinal()` in `src/logic.js` if "46th birthday" is written differently in that language.
5. Run `node tests/i18n.test.js`: it reports missing texts, missing plural forms and wrong placeholders.

The Windows installer itself currently offers English and German, and the product name that Windows, the Start menu and
the Linux package managers show stays "Ehrentag-Manager" (the name inside the app is translated).
## Adding or changing special days

All special days are listed in [`src/holidays.js`](src/holidays.js), grouped by tradition.

- **A new day:** add a line to `DEFINITIONS` (an id, the tradition, and a rule: `fixed(month, day)`, `fromEaster(offset)`
  or a calendar), then add an `event_<id>` text to **every** file in `src/lang/`. `node tests/i18n.test.js` lists what is
  missing. Dates that move with the moon need a check: see the astronomical tests in `tests/holidays.test.js`.
- **A new tradition:** add its id to `TRADITIONS`, a `trad_<id>` text to every language and the events to `DEFINITIONS`.
- **Extending the Hindu table (once a year):** add the next year's dates to `HINDU` in `src/holidays.js` and raise
  `HINDU_DATA_THROUGH`. Take the dates from a published panchang (for example Drik Panchang) and check them against a
  second source; `tests/holidays.test.js` fails if a festival is missing for a year inside the table.
- **If the Chinese calendar of a system is a day off** for a year after 2040, add the month start to `LUNAR_FIX`
  (the test to 2040 prints which ones); `scripts/astro.js` contains the independent calculation.

## Publishing a release

GitHub Actions does the work ([`.github/workflows/release.yml`](.github/workflows/release.yml)):

```bash
# 1. Set the version in package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json at once
node scripts/bump-version.js 1.0.2
# 2. Update CHANGELOG.md, commit, create and push a tag
git commit -am "Release 1.0.2"
git tag v1.0.2
git push origin main v1.0.2
```

The workflow refuses a tag that does not match the version in the files.

The workflow runs the tests, builds the Windows installer, the macOS `.dmg` (universal), the `.deb` and `.rpm` and the Android APK, creates the
checksums and publishes everything as a GitHub release.

### Google Play

Google Play does not accept APK files, only signed Android App Bundles (`.aab`). The workflow builds one, and
`scripts/build-android-release.sh` builds the same on your computer. The complete guide – upload key, required checks,
store listing, privacy policy, test tracks – is in [docs/PLAY_STORE.md](docs/PLAY_STORE.md). The listing texts,
graphics and screenshots are in [`store/`](store/), the privacy policy is [PRIVACY.md](PRIVACY.md).

### Signing the Android APK (one-time setup)

Android only installs signed APKs. Create a key once and keep it safe – you need the same key for every future update:

```bash
keytool -genkeypair -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias ehrentag
base64 -w0 release.jks      # copy the output
```

Use the same password for the keystore and the key. Then add three **repository secrets** in GitHub
(Settings → Secrets and variables → Actions): `ANDROID_KEYSTORE_BASE64` (the base64 output),
`ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS` (`ehrentag`). Without them the workflow skips publishing the APK.

## Project layout

```
src/                 user interface: index.html, style.css, main.js, logic.js, exchange.js, holidays.js, banner.js, i18n.js
src/lang/            one translation file per language
store/               Google Play listing texts, icon, feature graphic and screenshots
docs/PLAY_STORE.md   step-by-step guide for publishing on Google Play
PRIVACY.md           privacy policy (link it in Play Console)
CHANGELOG.md         what changed in each version
scripts/             version helper, release build, store graphics, astronomy checks, dev desktop entry (Linux)
src-tauri/src/lib.rs Rust backend: data file (events.json), conversion of the old file, settings
src-tauri/           Tauri configuration, icons, capabilities
tests/               JavaScript unit tests
```

## Why "MARTIN"?

The first PC was bought on 11 November at around 11:11 – St. Martin's Day and, in Austria, the start of carnival season.
That was too good to lose. 🎉

## Author

**Dietmar Schnabel** · [GitHub: @dietmarschnabel-code](https://github.com/dietmarschnabel-code) · dschnabel64<at>gmail.com

## License

[MIT](LICENSE) © 2026 Dietmar Schnabel
