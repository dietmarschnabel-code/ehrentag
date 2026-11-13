<div align="center">

<img src="packaging/ehrentag.png" width="128" alt="Ehrentag-Manager icon">

# Ehrentag-Manager

**Birthdays, name days and other dates worth remembering – always in view. With MARTIN.**

[![Release](https://img.shields.io/github/v/release/dietmarschnabel-code/ehrentag?color=%23a855f7)](https://github.com/dietmarschnabel-code/ehrentag/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Rust](https://img.shields.io/badge/Rust-egui-orange)

</div>

<!-- Tip: save a screenshot as docs/screenshot.png and enable the next line
![Screenshot](docs/screenshot.png)
-->

Ehrentag-Manager shows you the **next dates you shouldn't forget** and lets you add new entries in a built-in editor.
It is the modern Rust rewrite of a small Pascal program. The user interface is available in **English** and **German**.

> *Ehrentag* is German for a person's special day, such as a birthday or name day.

## Features

- **Upcoming dates** with weekday, countdown ("in 4 days", "tomorrow", "TODAY!") and age or anniversary count –
  how many are shown (default 3) and how far ahead is configurable
- **Four kinds of dates:** birthday, name day, wedding anniversary and other special day
- **Editor:** add, change and delete entries (with a confirmation before deleting)
- **English and German UI** – detected from your system language, switchable at any time
- **MARTIN** – bouncing rainbow pixel letters with confetti. On **11 November** it celebrates, and at **11:11** the confetti
  goes wild. A countdown to the next start of carnival season is included.
- **Compatible** with the `gebdatei.dat` file of the original Pascal program
- Runs on **Windows** and **Linux** as a single executable, no runtime required

## Installation

All packages are available on the [**Releases**](https://github.com/dietmarschnabel-code/ehrentag/releases/latest) page.

### Windows

Download and run `ehrentag-<version>-windows-setup.exe`. The installer creates Start menu and desktop shortcuts and can
be removed again via "Apps & features".

> The installer is not code-signed, so Windows SmartScreen may show a warning – click "More info" → "Run anyway".

### Debian, Ubuntu, Linux Mint

```bash
sudo apt install ./ehrentag_<version>-1_amd64.deb
```

### Fedora, openSUSE, RHEL and friends

```bash
sudo dnf install ./ehrentag-<version>-1.x86_64.rpm                       # Fedora
sudo zypper --no-gpg-checks install ./ehrentag-<version>-1.x86_64.rpm    # openSUSE (the package is unsigned)
```

Afterwards you will find "Ehrentag-Manager" in your application menu, or start it with `ehrentag`.

### Checksums

Every release includes a `SHA256SUMS.txt`:

```bash
sha256sum -c --ignore-missing SHA256SUMS.txt
```

## Usage

1. The **overview** shows today's date and the upcoming dates.
2. Click **"Manage / add dates"** to open the editor.
3. Enter name, type and date, then click **Add**. That's it – everything is saved immediately.

| Type | Year | Shown as |
|---|---|---|
| Birthday | required | "42nd birthday" |
| Name day | not needed | first name in CAPITALS, "Name day" |
| Wedding anniversary | required | "25th wedding anniversary" |
| Other special day | optional | "Special day" or "10th anniversary" |

A date on 29 February is shown on 28 February in non-leap years.

### Display and language

The editor has a **"Display and language"** section:

- **Number of dates** (1–30): how many upcoming dates are shown
- **Only the next … days** (0–366): only show dates within this period; `0` means no limit
- **Language:** English or German. The language can also be switched with the buttons at the top right of the overview.

Without a saved choice, the language is taken from your system settings (German if the system language is German,
English otherwise). Settings are stored in `ehrentag.cfg` next to the data file:

```
count=3
days_ahead=0
language=en
```

## Where is my data?

The data file `gebdatei.dat` is looked up in this order:

1. The environment variable `EHRENTAG_FILE` (full path; `EHRENTAG_DATEI` works too)
2. `gebdatei.dat` in the **current directory** (as with the old Pascal program)
3. The per-user data directory:
   - Windows: `%APPDATA%\ehrentag-manager\gebdatei.dat`
   - Linux: `~/.local/share/ehrentag-manager/gebdatei.dat`

The current path is shown in the editor below the heading. The first time an existing file is saved, a one-time backup
`gebdatei.dat.bak` is created. Uninstalling keeps your data.

### Migrating from the Pascal version

Copy your old `gebdatei.dat` into the data directory (see above) – or simply start the program from the folder that
contains it.

### File format

Five text lines per entry, sorted by month and day:

```
24            <- day
12            <- month
1980          <- year (0 = not given)
Maria Muster  <- name
G             <- G = birthday, N = name day, H = wedding anniversary, S = other special day
```

The file is saved as UTF-8. Old DOS files with umlauts are recognised when loading.

## Building from source

Requirement: [Rust](https://rustup.rs/) (stable).

```bash
git clone https://github.com/dietmarschnabel-code/ehrentag.git
cd ehrentag
cargo run --release
```

On Linux you may need these packages to build (Debian/Ubuntu):

```bash
sudo apt install libxcb-render0-dev libxcb-shape0-dev libxcb-xfixes0-dev libxkbcommon-dev libssl-dev
```

### Building the packages locally

```bash
cargo build --release

# Linux
cargo install cargo-deb cargo-generate-rpm
cargo deb --no-build          # -> target/debian/*.deb
cargo generate-rpm            # -> target/generate-rpm/*.rpm

# Windows (NSIS must be installed, makensis on the PATH)
makensis -DVERSION=1.0.0 installer.nsi    # -> dist\ehrentag-1.0.0-windows-setup.exe
```

## Adding a language

All texts live in `src/main.rs`. To add a language:

1. Add a variant to the `Lang` enum and handle it in `Lang::code`, `Lang::from_code` and `Lang::native_name`.
2. Write a text function like `de()` / `en()` – the compiler complains until every message key is translated.
3. Add the weekday and month names and extend `ordinal` if the language needs it.

## Publishing a release

GitHub Actions does the work ([`.github/workflows/release.yml`](.github/workflows/release.yml)):

```bash
# 1. Bump the version in Cargo.toml and commit
# 2. Create and push a tag
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds the Windows installer as well as the `.deb` and `.rpm`, creates the checksums and publishes
everything as a GitHub release.

## Why "MARTIN"?

The first PC was bought on 11 November at around 11:11 – St. Martin's Day and, in Austria, the start of carnival season.
That was too good to lose. 🎉

## Author

**Dietmar Schnabel** · [GitHub: @dietmarschnabel-code](https://github.com/dietmarschnabel-code) · dschnabel64<at>gmail.com

## License

[MIT](LICENSE) © 2026 Dietmar Schnabel
