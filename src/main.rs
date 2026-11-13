// Ehrentag-Manager - a small desktop app that keeps track of birthdays,
// name days and other dates worth remembering.
// (c) 2026 Dietmar Schnabel <dschnabel64<at>gmail.com> - MIT License
//
// Data file format (compatible with the original Pascal program "ehrentag.pas"):
// five lines per entry: day, month, year, name, kind
//   kind: G = birthday, N = name day, H = wedding anniversary, S = other special day
//
// Where the data file lives (first match wins):
//   1. environment variable EHRENTAG_FILE (or EHRENTAG_DATEI)
//   2. ./gebdatei.dat in the current directory (legacy behaviour)
//   3. per-user data directory:
//        Windows: %APPDATA%\ehrentag-manager\gebdatei.dat
//        Linux:   ~/.local/share/ehrentag-manager/gebdatei.dat
//
// Settings (display options, language) are stored next to it in "ehrentag.cfg".

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Datelike, Local, NaiveDate, Timelike, Weekday};
use eframe::egui::{self, pos2, vec2, Color32, Rect, RichText, Sense};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

// ───────────────────────────── Languages ─────────────────────────────
//
// To add a language: add a variant to `Lang`, a text function like `de()`/`en()`
// (the compiler checks that every key is translated), and the weekday/month names.

#[derive(Clone, Copy, PartialEq, Eq)]
enum Lang {
    De,
    En,
}

impl Lang {
    const ALL: [Lang; 2] = [Lang::De, Lang::En];

    fn code(self) -> &'static str {
        match self {
            Lang::De => "de",
            Lang::En => "en",
        }
    }

    fn from_code(s: &str) -> Option<Lang> {
        let s = s.trim().to_ascii_lowercase();
        if s.starts_with("de") {
            Some(Lang::De)
        } else if s.starts_with("en") {
            Some(Lang::En)
        } else {
            None
        }
    }

    /// Each language is always shown under its own name.
    fn native_name(self) -> &'static str {
        match self {
            Lang::De => "Deutsch",
            Lang::En => "English",
        }
    }
}

#[cfg(windows)]
fn os_locale() -> Option<String> {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetUserDefaultLocaleName(name: *mut u16, len: i32) -> i32;
    }
    let mut buf = [0u16; 85];
    let n = unsafe { GetUserDefaultLocaleName(buf.as_mut_ptr(), buf.len() as i32) };
    if n > 1 {
        Some(String::from_utf16_lossy(&buf[..(n as usize - 1)]))
    } else {
        None
    }
}

#[cfg(not(windows))]
fn os_locale() -> Option<String> {
    None
}

/// Language of the operating system; English if it is not supported.
fn detect_language() -> Lang {
    if let Some(l) = os_locale().as_deref().and_then(Lang::from_code) {
        return l;
    }
    for var in ["LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"] {
        if let Some(v) = std::env::var_os(var) {
            if let Some(l) = Lang::from_code(&v.to_string_lossy()) {
                return l;
            }
        }
    }
    Lang::En
}

#[derive(Clone, Copy)]
enum K {
    // overview
    TodayIs,
    Upcoming,
    NoEntries,
    NoneInWindow,
    ManageBtn,
    SubMoment,
    SubParty,
    SubCountdown,
    DaysOne,
    DaysMany,
    WhenToday,
    WhenTomorrow,
    WhenInDays,
    // card texts
    Birthday,
    BirthdayN,
    NameDay,
    WeddingN,
    OtherPlain,
    OtherN,
    // kind labels (editor)
    KindBirthday,
    KindNameDay,
    KindWedding,
    KindOther,
    HintBirthday,
    HintNameDay,
    HintWedding,
    HintOther,
    // editor
    ManageTitle,
    Back,
    FileLabel,
    FormNew,
    FormEdit,
    LabelName,
    NameHint,
    LabelKind,
    LabelDate,
    PhDay,
    PhMonth,
    PhYear,
    YearLine,
    BtnAdd,
    BtnSave,
    BtnCancel,
    // messages
    ErrName,
    ErrDay,
    ErrMonth,
    ErrDate,
    ErrYearMissing,
    ErrYearFormat,
    ErrYearFuture,
    OkAdded,
    OkChanged,
    OkDeleted,
    ErrSave,
    // settings
    SettingsTitle,
    LabelCount,
    LabelWithin,
    SuffixDays,
    SettingsHint,
    LabelLanguage,
    // list
    AllEntries,
    BtnEdit,
    BtnDelete,
    BtnReallyDelete,
    BtnNo,
}

fn tr(lang: Lang, k: K) -> &'static str {
    match lang {
        Lang::De => de(k),
        Lang::En => en(k),
    }
}

/// Translate and fill in the placeholders {0}, {1}, ...
fn trf(lang: Lang, k: K, args: &[&str]) -> String {
    let mut s = tr(lang, k).to_string();
    for (i, a) in args.iter().enumerate() {
        s = s.replace(&format!("{{{}}}", i), a);
    }
    s
}

fn de(k: K) -> &'static str {
    use K::*;
    match k {
        TodayIs => "Heute ist {0}, der {1}.",
        Upcoming => "Folgende Termine bitte nicht vergessen!!",
        NoEntries => "Noch keine Einträge – klick unten auf „Ehrentage verwalten“.",
        NoneInWindow => "Keine Termine in den nächsten {0} Tagen.",
        ManageBtn => "Ehrentage verwalten / hinzufügen",
        SubMoment => "HELAU! Es ist 11:11 – der Fasching beginnt JETZT!",
        SubParty => "Heute ist der 11.11. – Martinstag und Faschingsbeginn! Um 11:11 Uhr geht’s los!",
        SubCountdown => "Seit dem ersten PC am 11.11. um 11:11 Uhr dabei – {0} bis zum nächsten Faschingsbeginn",
        DaysOne => "nur noch 1 Tag",
        DaysMany => "noch {0} Tage",
        WhenToday => "HEUTE!",
        WhenTomorrow => "morgen",
        WhenInDays => "in {0} Tagen",
        Birthday => "Geburtstag",
        BirthdayN => "{0} Geburtstag",
        NameDay => "Namenstag",
        WeddingN => "{0} Hochzeitstag",
        OtherPlain => "Gedenktag",
        OtherN => "{0} Jahrestag",
        KindBirthday => "Geburtstag",
        KindNameDay => "Namenstag",
        KindWedding => "Hochzeitstag",
        KindOther => "Sonstiger Gedenktag",
        HintBirthday => "Geburtsjahr, 4-stellig (Pflicht)",
        HintNameDay => "entfällt",
        HintWedding => "Hochzeitsjahr, 4-stellig (Pflicht)",
        HintOther => "optional – dann wird „N Jahre“ angezeigt",
        ManageTitle => "Ehrentage verwalten",
        Back => "← Zurück zur Übersicht",
        FileLabel => "Datei: {0}",
        FormNew => "Neuer Eintrag",
        FormEdit => "Eintrag ändern",
        LabelName => "Name:",
        NameHint => "z. B. Maria Muster",
        LabelKind => "Art:",
        LabelDate => "Datum:",
        PhDay => "TT",
        PhMonth => "MM",
        PhYear => "JJJJ",
        YearLine => "Jahr: {0}",
        BtnAdd => "Hinzufügen",
        BtnSave => "Änderung speichern",
        BtnCancel => "Abbrechen",
        ErrName => "Bitte einen Namen eingeben.",
        ErrDay => "Der Tag muss eine Zahl sein.",
        ErrMonth => "Der Monat muss eine Zahl sein.",
        ErrDate => "Dieses Datum gibt es nicht.",
        ErrYearMissing => "Bitte das Jahr (4-stellig) eingeben.",
        ErrYearFormat => "Das Jahr bitte 4-stellig eingeben (z. B. 1985).",
        ErrYearFuture => "Das Jahr liegt in der Zukunft.",
        OkAdded => "Eintrag hinzugefügt.",
        OkChanged => "Änderung gespeichert.",
        OkDeleted => "Eintrag gelöscht.",
        ErrSave => "Speichern fehlgeschlagen: {0}",
        SettingsTitle => "Anzeige und Sprache",
        LabelCount => "Anzahl Termine:",
        LabelWithin => "Nur die nächsten:",
        SuffixDays => " Tage",
        SettingsHint => "0 Tage = keine zeitliche Begrenzung, es zählt nur die Anzahl.",
        LabelLanguage => "Sprache:",
        AllEntries => "Alle Einträge ({0})",
        BtnEdit => "Ändern",
        BtnDelete => "Löschen",
        BtnReallyDelete => "Wirklich löschen",
        BtnNo => "Nein",
    }
}

fn en(k: K) -> &'static str {
    use K::*;
    match k {
        TodayIs => "Today is {0}, {1}.",
        Upcoming => "Don’t forget these upcoming dates!",
        NoEntries => "No entries yet – click “Manage / add dates” below.",
        NoneInWindow => "No dates in the next {0} days.",
        ManageBtn => "Manage / add dates",
        SubMoment => "HELAU! It’s 11:11 – carnival season starts NOW!",
        SubParty => "Today is 11 November – St. Martin’s Day and the start of carnival season! It all kicks off at 11:11!",
        SubCountdown => "Ever since the first PC, bought on 11 Nov at 11:11 – {0} until carnival season starts again",
        DaysOne => "only 1 day",
        DaysMany => "{0} days",
        WhenToday => "TODAY!",
        WhenTomorrow => "tomorrow",
        WhenInDays => "in {0} days",
        Birthday => "Birthday",
        BirthdayN => "{0} birthday",
        NameDay => "Name day",
        WeddingN => "{0} wedding anniversary",
        OtherPlain => "Special day",
        OtherN => "{0} anniversary",
        KindBirthday => "Birthday",
        KindNameDay => "Name day",
        KindWedding => "Wedding anniversary",
        KindOther => "Other special day",
        HintBirthday => "birth year, 4 digits (required)",
        HintNameDay => "not needed",
        HintWedding => "wedding year, 4 digits (required)",
        HintOther => "optional – shows “N years” if given",
        ManageTitle => "Manage dates",
        Back => "← Back to overview",
        FileLabel => "File: {0}",
        FormNew => "New entry",
        FormEdit => "Edit entry",
        LabelName => "Name:",
        NameHint => "e.g. Maria Muster",
        LabelKind => "Type:",
        LabelDate => "Date:",
        PhDay => "DD",
        PhMonth => "MM",
        PhYear => "YYYY",
        YearLine => "Year: {0}",
        BtnAdd => "Add",
        BtnSave => "Save changes",
        BtnCancel => "Cancel",
        ErrName => "Please enter a name.",
        ErrDay => "The day must be a number.",
        ErrMonth => "The month must be a number.",
        ErrDate => "That date doesn’t exist.",
        ErrYearMissing => "Please enter the year (4 digits).",
        ErrYearFormat => "Please enter a 4-digit year (e.g. 1985).",
        ErrYearFuture => "The year is in the future.",
        OkAdded => "Entry added.",
        OkChanged => "Changes saved.",
        OkDeleted => "Entry deleted.",
        ErrSave => "Saving failed: {0}",
        SettingsTitle => "Display and language",
        LabelCount => "Number of dates:",
        LabelWithin => "Only the next:",
        SuffixDays => " days",
        SettingsHint => "0 days = no time limit, only the number of dates counts.",
        LabelLanguage => "Language:",
        AllEntries => "All entries ({0})",
        BtnEdit => "Edit",
        BtnDelete => "Delete",
        BtnReallyDelete => "Really delete",
        BtnNo => "No",
    }
}

const WEEKDAYS_DE: [&str; 7] = [
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
];
const WEEKDAYS_EN: [&str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];
const MONTHS_DE: [&str; 12] = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
];
const MONTHS_EN: [&str; 12] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

fn weekday_name(lang: Lang, w: Weekday) -> &'static str {
    let i = w.num_days_from_monday() as usize;
    match lang {
        Lang::De => WEEKDAYS_DE[i],
        Lang::En => WEEKDAYS_EN[i],
    }
}

fn format_date(lang: Lang, d: NaiveDate) -> String {
    let m = (d.month() - 1) as usize;
    match lang {
        Lang::De => format!("{}. {} {}", d.day(), MONTHS_DE[m], d.year()),
        Lang::En => format!("{} {} {}", d.day(), MONTHS_EN[m], d.year()),
    }
}

/// 45 -> "45." (German) / "45th" (English)
fn ordinal(lang: Lang, n: i32) -> String {
    match lang {
        Lang::De => format!("{}.", n),
        Lang::En => {
            let suffix = match (n % 100, n % 10) {
                (11..=13, _) => "th",
                (_, 1) => "st",
                (_, 2) => "nd",
                (_, 3) => "rd",
                _ => "th",
            };
            format!("{}{}", n, suffix)
        }
    }
}

// ───────────────────────────── Data model ─────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Birthday,
    NameDay,
    Wedding,
    Other,
}

impl Kind {
    const ALL: [Kind; 4] = [Kind::Birthday, Kind::NameDay, Kind::Wedding, Kind::Other];

    fn code(self) -> char {
        match self {
            Kind::Birthday => 'G',
            Kind::NameDay => 'N',
            Kind::Wedding => 'H',
            Kind::Other => 'S',
        }
    }

    fn from_code(c: char) -> Option<Kind> {
        match c.to_ascii_uppercase() {
            'G' => Some(Kind::Birthday),
            'N' => Some(Kind::NameDay),
            'H' => Some(Kind::Wedding),
            'S' => Some(Kind::Other),
            _ => None,
        }
    }

    fn label(self, lang: Lang) -> &'static str {
        tr(
            lang,
            match self {
                Kind::Birthday => K::KindBirthday,
                Kind::NameDay => K::KindNameDay,
                Kind::Wedding => K::KindWedding,
                Kind::Other => K::KindOther,
            },
        )
    }

    fn year_hint(self, lang: Lang) -> &'static str {
        tr(
            lang,
            match self {
                Kind::Birthday => K::HintBirthday,
                Kind::NameDay => K::HintNameDay,
                Kind::Wedding => K::HintWedding,
                Kind::Other => K::HintOther,
            },
        )
    }
}

#[derive(Clone)]
struct Entry {
    day: u32,
    month: u32,
    year: i32, // 0 = not given
    name: String,
    kind: Kind,
}

fn sort_entries(list: &mut [Entry]) {
    list.sort_by_key(|e| (e.month, e.day, e.name.to_lowercase()));
}

// ───────────────────────────── Reading / writing the data file ─────────────────────────────

/// Where the data file lives (see the header comment).
fn data_path() -> PathBuf {
    for var in ["EHRENTAG_FILE", "EHRENTAG_DATEI"] {
        if let Some(p) = std::env::var_os(var) {
            return PathBuf::from(p);
        }
    }
    let local = PathBuf::from("gebdatei.dat");
    if local.exists() {
        return local;
    }
    let base: Option<PathBuf> = if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/Application Support"))
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")))
    };
    match base {
        Some(b) => b.join("ehrentag-manager").join("gebdatei.dat"),
        None => local,
    }
}

/// UTF-8 preferred; old DOS files (CP437/850) get their umlauts recognised.
fn decode(bytes: Vec<u8>) -> String {
    match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(e) => e
            .into_bytes()
            .into_iter()
            .map(|b| match b {
                0x84 => 'ä',
                0x8E => 'Ä',
                0x94 => 'ö',
                0x99 => 'Ö',
                0x81 => 'ü',
                0x9A => 'Ü',
                0xE1 => 'ß',
                _ => b as char, // Latin-1
            })
            .collect(),
    }
}

fn load_entries(path: &Path) -> Vec<Entry> {
    let Ok(bytes) = fs::read(path) else {
        return Vec::new();
    };
    let text = decode(bytes);
    let text = text.trim_start_matches('\u{feff}');
    let mut lines: Vec<&str> = text.lines().map(|l| l.trim()).collect();
    while lines.last().map_or(false, |l| l.is_empty()) {
        lines.pop();
    }

    let mut list = Vec::new();
    for c in lines.chunks(5) {
        if c.len() < 5 {
            break;
        }
        let (Ok(day), Ok(month), Ok(year)) = (
            c[0].parse::<u32>(),
            c[1].parse::<u32>(),
            c[2].parse::<i32>(),
        ) else {
            continue;
        };
        let Some(kind) = c[4].chars().next().and_then(Kind::from_code) else {
            continue;
        };
        // 2024 is a leap year, so 29 Feb stays valid
        if NaiveDate::from_ymd_opt(2024, month, day).is_none() {
            continue;
        }
        list.push(Entry {
            day,
            month,
            year,
            name: c[3].to_string(),
            kind,
        });
    }
    sort_entries(&mut list);
    list
}

fn ensure_parent_dir(path: &Path) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() {
            fs::create_dir_all(dir)?;
        }
    }
    Ok(())
}

fn save_entries(path: &Path, list: &[Entry]) -> std::io::Result<()> {
    ensure_parent_dir(path)?;
    // One-time backup of the original file
    let mut bak_name = path.as_os_str().to_owned();
    bak_name.push(".bak");
    let bak = PathBuf::from(bak_name);
    if path.exists() && !bak.exists() {
        let _ = fs::copy(path, &bak);
    }
    let mut s = String::new();
    for e in list {
        s.push_str(&format!(
            "{}\n{}\n{}\n{}\n{}\n",
            e.day,
            e.month,
            e.year,
            e.name,
            e.kind.code()
        ));
    }
    fs::write(path, s)
}

// ───────────────────────────── Settings ─────────────────────────────

/// Stored as "ehrentag.cfg" next to the data file (the data file itself stays unchanged).
#[derive(Clone, Copy, PartialEq)]
struct Settings {
    count: usize,    // how many dates the overview shows (1..=30)
    days_ahead: u32, // 0 = unlimited, otherwise only dates within this many days
    lang: Lang,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            count: 3,
            days_ahead: 0,
            lang: detect_language(),
        }
    }
}

fn settings_path(data: &Path) -> PathBuf {
    data.with_file_name("ehrentag.cfg")
}

fn load_settings(path: &Path) -> Settings {
    let mut s = Settings::default();
    let Ok(text) = fs::read_to_string(path) else {
        return s;
    };
    for line in text.lines() {
        let Some((k, v)) = line.split_once('=') else {
            continue;
        };
        let (k, v) = (k.trim(), v.trim());
        match k {
            "count" => {
                if let Ok(n) = v.parse::<usize>() {
                    s.count = n.clamp(1, 30);
                }
            }
            "days_ahead" => {
                if let Ok(n) = v.parse::<u32>() {
                    s.days_ahead = n.min(366);
                }
            }
            "language" => {
                if let Some(l) = Lang::from_code(v) {
                    s.lang = l;
                }
            }
            _ => {}
        }
    }
    s
}

fn save_settings(path: &Path, s: &Settings) -> std::io::Result<()> {
    ensure_parent_dir(path)?;
    fs::write(
        path,
        format!(
            "count={}\ndays_ahead={}\nlanguage={}\n",
            s.count,
            s.days_ahead,
            s.lang.code()
        ),
    )
}

// ───────────────────────────── Date logic ─────────────────────────────

/// Next occurrence (today included). 29 Feb falls back to 28 Feb in non-leap years.
fn next_occurrence(e: &Entry, today: NaiveDate) -> NaiveDate {
    let mut y = today.year();
    loop {
        let d = NaiveDate::from_ymd_opt(y, e.month, e.day)
            .or_else(|| NaiveDate::from_ymd_opt(y, 2, 28));
        if let Some(d) = d {
            if d >= today {
                return d;
            }
        }
        y += 1;
    }
}

fn next_carnival_start(today: NaiveDate) -> NaiveDate {
    let d = NaiveDate::from_ymd_opt(today.year(), 11, 11).unwrap();
    if d >= today {
        d
    } else {
        NaiveDate::from_ymd_opt(today.year() + 1, 11, 11).unwrap()
    }
}

/// First name in capitals (as in the original Pascal program).
fn first_name_upper(name: &str) -> String {
    match name.split_once(' ') {
        Some((first, rest)) => format!("{} {}", first.to_uppercase(), rest),
        None => name.to_uppercase(),
    }
}

// ───────────────────────────── Visuals: colours, confetti, MARTIN ─────────────────────────────

fn hsv(h: f32, s: f32, v: f32) -> Color32 {
    let h = h.rem_euclid(1.0) * 6.0;
    let i = h.floor() as i32;
    let f = h - i as f32;
    let p = v * (1.0 - s);
    let q = v * (1.0 - s * f);
    let t = v * (1.0 - s * (1.0 - f));
    let (r, g, b) = match i % 6 {
        0 => (v, t, p),
        1 => (q, v, p),
        2 => (p, v, t),
        3 => (p, q, v),
        4 => (t, p, v),
        _ => (v, p, q),
    };
    Color32::from_rgb((r * 255.0) as u8, (g * 255.0) as u8, (b * 255.0) as u8)
}

/// Deterministic pseudo-random number in 0..1 (for the confetti)
fn rnd(i: u32, k: u32) -> f32 {
    let mut x = i
        .wrapping_mul(2654435761)
        .wrapping_add(k.wrapping_mul(0x9E37_79B9));
    x ^= x >> 15;
    x = x.wrapping_mul(0x2c1b_3c6d);
    x ^= x >> 12;
    x = x.wrapping_mul(0x297a_2d39);
    x ^= x >> 15;
    (x & 0xFFFF) as f32 / 65535.0
}

fn glyph(c: char) -> [&'static str; 7] {
    match c {
        'M' => ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
        'A' => [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
        'R' => ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
        'T' => ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
        'I' => [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
        'N' => ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
        _ => ["....."; 7],
    }
}

/// The MARTIN banner: bouncing rainbow pixel letters plus confetti.
fn banner(ui: &mut egui::Ui, t: f64, confetti: u32) {
    let w = ui.available_width();
    let (rect, _) = ui.allocate_exact_size(vec2(w, 170.0), Sense::hover());
    let p = ui.painter_at(rect);
    let tf = t as f32;

    p.rect_filled(rect, 12.0, Color32::from_rgb(20, 12, 40));

    // confetti
    for i in 0..confetti {
        let x0 = rect.left() + rnd(i, 1) * rect.width();
        let speed = 25.0 + rnd(i, 2) * 60.0;
        let y = rect.top() + (tf * speed + rnd(i, 3) * rect.height()) % rect.height();
        let x = (x0 + (tf * (1.0 + rnd(i, 4) * 2.0) + rnd(i, 5) * 6.28).sin() * 12.0)
            .clamp(rect.left() + 3.0, rect.right() - 3.0);
        let color = hsv(rnd(i, 6), 0.8, 1.0);
        let sz = 2.5 + rnd(i, 7) * 3.5;
        if rnd(i, 8) > 0.5 {
            p.circle_filled(pos2(x, y), sz * 0.7, color);
        } else {
            p.rect_filled(
                Rect::from_center_size(pos2(x, y), vec2(sz * 1.6, sz)),
                1.0,
                color,
            );
        }
    }

    // MARTIN
    let px = 11.0_f32;
    let gap = 2.0_f32;
    let cell = px + gap;
    let lw = 5.0 * cell;
    let lgap = 16.0_f32;
    let word = "MARTIN";
    let total = 6.0 * lw + 5.0 * lgap - gap;
    let start_x = rect.center().x - total / 2.0;
    let base_y = rect.center().y - 7.0 * cell / 2.0;

    for (li, ch) in word.chars().enumerate() {
        let bounce = (tf * 3.0 + li as f32 * 0.7).sin() * 7.0;
        let lx = start_x + li as f32 * (lw + lgap);
        for (row, line) in glyph(ch).iter().enumerate() {
            for (col, c) in line.chars().enumerate() {
                if c != '#' {
                    continue;
                }
                let hue = tf * 0.25 + (li * 5 + col) as f32 * 0.035 + row as f32 * 0.02;
                let r = Rect::from_min_size(
                    pos2(lx + col as f32 * cell, base_y + row as f32 * cell + bounce),
                    vec2(px, px),
                );
                p.rect_filled(r.translate(vec2(2.0, 2.0)), 2.0, Color32::from_black_alpha(120));
                p.rect_filled(r, 2.0, hsv(hue, 0.85, 1.0));
            }
        }
    }
}

fn card(ui: &mut egui::Ui, lang: Lang, date: NaiveDate, e: &Entry, today: NaiveDate, t: f64) {
    let days = (date - today).num_days();
    let years = if e.year > 0 { date.year() - e.year } else { 0 };
    let ord = ordinal(lang, years);

    let (color, kind_text) = match e.kind {
        Kind::Birthday => (
            Color32::from_rgb(240, 240, 240),
            if e.year > 0 {
                trf(lang, K::BirthdayN, &[ord.as_str()])
            } else {
                tr(lang, K::Birthday).to_string()
            },
        ),
        Kind::NameDay => (
            Color32::from_rgb(240, 240, 240),
            tr(lang, K::NameDay).to_string(),
        ),
        Kind::Wedding => (
            Color32::from_rgb(90, 220, 240),
            if e.year > 0 {
                trf(lang, K::WeddingN, &[ord.as_str()])
            } else {
                tr(lang, K::KindWedding).to_string()
            },
        ),
        Kind::Other => (
            Color32::from_rgb(255, 210, 90),
            if e.year > 0 {
                trf(lang, K::OtherN, &[ord.as_str()])
            } else {
                tr(lang, K::OtherPlain).to_string()
            },
        ),
    };

    let name = if e.kind == Kind::NameDay {
        first_name_upper(&e.name)
    } else {
        e.name.clone()
    };

    let when = match days {
        0 => tr(lang, K::WhenToday).to_string(),
        1 => tr(lang, K::WhenTomorrow).to_string(),
        n => trf(lang, K::WhenInDays, &[n.to_string().as_str()]),
    };

    // Today's dates pulse (replaces the blink attribute of the DOS program)
    let fill = if days == 0 {
        let s = ((t * 5.0).sin() * 0.5 + 0.5) as f32;
        Color32::from_rgb(90 + (70.0 * s) as u8, 40, 20)
    } else {
        Color32::from_rgb(32, 30, 48)
    };

    egui::Frame::group(ui.style()).fill(fill).show(ui, |ui| {
        ui.set_min_width(ui.available_width());
        ui.horizontal(|ui| {
            ui.label(RichText::new(name).size(22.0).strong().color(color));
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    RichText::new(when)
                        .size(20.0)
                        .strong()
                        .color(Color32::from_rgb(255, 190, 80)),
                );
            });
        });
        ui.label(format!(
            "{}, {}   ·   {}",
            weekday_name(lang, date.weekday()),
            format_date(lang, date),
            kind_text
        ));
    });
    ui.add_space(6.0);
}

// ───────────────────────────── Application ─────────────────────────────

#[derive(PartialEq)]
enum Mode {
    Overview,
    Manage,
}

enum Action {
    Edit(usize),
    AskDelete(usize),
    ConfirmDelete(usize),
    CancelDelete,
}

struct App {
    path: PathBuf,
    settings: Settings,
    settings_dirty: bool,
    entries: Vec<Entry>,
    mode: Mode,
    // form
    form_name: String,
    form_kind: Kind,
    form_day: String,
    form_month: String,
    form_year: String,
    editing: Option<usize>,
    confirm_delete: Option<usize>,
    message: Option<(bool, String)>, // (is_error, text)
}

impl App {
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
        cc.egui_ctx.set_visuals(egui::Visuals::dark());
        let path = data_path();
        let settings = load_settings(&settings_path(&path));
        Self {
            entries: load_entries(&path),
            path,
            settings,
            settings_dirty: false,
            mode: Mode::Overview,
            form_name: String::new(),
            form_kind: Kind::Birthday,
            form_day: String::new(),
            form_month: String::new(),
            form_year: String::new(),
            editing: None,
            confirm_delete: None,
            message: None,
        }
    }

    fn error(&mut self, k: K) {
        self.message = Some((true, tr(self.settings.lang, k).to_string()));
    }

    fn clear_form(&mut self) {
        self.form_name.clear();
        self.form_day.clear();
        self.form_month.clear();
        self.form_year.clear();
        self.form_kind = Kind::Birthday;
        self.editing = None;
    }

    fn save_and_report(&mut self, ok: K) {
        let lang = self.settings.lang;
        self.message = match save_entries(&self.path, &self.entries) {
            Ok(()) => Some((false, tr(lang, ok).to_string())),
            Err(e) => Some((true, trf(lang, K::ErrSave, &[e.to_string().as_str()]))),
        };
    }

    fn form_save(&mut self) {
        let name = self.form_name.trim().to_string();
        if name.is_empty() {
            self.error(K::ErrName);
            return;
        }
        let Ok(day) = self.form_day.trim().parse::<u32>() else {
            self.error(K::ErrDay);
            return;
        };
        let Ok(month) = self.form_month.trim().parse::<u32>() else {
            self.error(K::ErrMonth);
            return;
        };
        if NaiveDate::from_ymd_opt(2024, month, day).is_none() {
            self.error(K::ErrDate);
            return;
        }

        let year_text = self.form_year.trim().to_string();
        let year: i32 = if self.form_kind == Kind::NameDay {
            0
        } else if year_text.is_empty() {
            if self.form_kind == Kind::Other {
                0
            } else {
                self.error(K::ErrYearMissing);
                return;
            }
        } else {
            match year_text.parse::<i32>() {
                Ok(y) if (1000..=9999).contains(&y) => y,
                _ => {
                    self.error(K::ErrYearFormat);
                    return;
                }
            }
        };
        if year > Local::now().year() && self.form_kind != Kind::Other {
            self.error(K::ErrYearFuture);
            return;
        }

        let entry = Entry {
            day,
            month,
            year,
            name,
            kind: self.form_kind,
        };
        let was_edit = self.editing.is_some();
        match self.editing {
            Some(i) if i < self.entries.len() => self.entries[i] = entry,
            _ => self.entries.push(entry),
        }
        sort_entries(&mut self.entries);
        self.confirm_delete = None;
        self.clear_form();
        self.save_and_report(if was_edit { K::OkChanged } else { K::OkAdded });
    }

    // ───── Overview ─────

    fn ui_overview(&mut self, ui: &mut egui::Ui, t: f64) {
        let lang = self.settings.lang;
        let now = Local::now();
        let today = now.date_naive();
        let carnival_day = today.month() == 11 && today.day() == 11;
        let moment = carnival_day && now.hour() == 11 && now.minute() == 11;
        let confetti = if moment {
            400
        } else if carnival_day {
            200
        } else {
            90
        };

        // language switch (top right)
        let mut lang_changed = false;
        ui.horizontal(|ui| {
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                for l in Lang::ALL.iter().rev() {
                    lang_changed |= ui
                        .selectable_value(&mut self.settings.lang, *l, l.native_name())
                        .changed();
                }
            });
        });
        if lang_changed {
            self.settings_dirty = true;
            self.message = None;
        }

        banner(ui, t, confetti);
        ui.add_space(6.0);

        ui.vertical_centered(|ui| {
            ui.label(
                RichText::new("Ehrentag-Manager")
                    .size(30.0)
                    .strong()
                    .color(hsv((t * 0.1) as f32, 0.45, 1.0)),
            );
            let subtitle = if moment {
                tr(lang, K::SubMoment).to_string()
            } else if carnival_day {
                tr(lang, K::SubParty).to_string()
            } else {
                let days = (next_carnival_start(today) - today).num_days();
                let rest = if days == 1 {
                    tr(lang, K::DaysOne).to_string()
                } else {
                    trf(lang, K::DaysMany, &[days.to_string().as_str()])
                };
                trf(lang, K::SubCountdown, &[rest.as_str()])
            };
            ui.label(
                RichText::new(subtitle)
                    .italics()
                    .color(Color32::from_rgb(200, 190, 230)),
            );
        });

        ui.add_space(12.0);
        ui.label(
            RichText::new(trf(
                lang,
                K::TodayIs,
                &[
                    weekday_name(lang, today.weekday()),
                    format_date(lang, today).as_str(),
                ],
            ))
            .size(16.0),
        );
        ui.add_space(4.0);

        if self.entries.is_empty() {
            ui.label(tr(lang, K::NoEntries));
        } else {
            let count = self.settings.count;
            let within = self.settings.days_ahead as i64;

            let mut upcoming: Vec<(NaiveDate, &Entry)> = self
                .entries
                .iter()
                .map(|e| (next_occurrence(e, today), e))
                .collect();
            upcoming.sort_by(|a, b| a.0.cmp(&b.0));
            if within > 0 {
                upcoming.retain(|(d, _)| (*d - today).num_days() <= within);
            }
            upcoming.truncate(count);

            if upcoming.is_empty() {
                ui.label(trf(lang, K::NoneInWindow, &[within.to_string().as_str()]));
            } else {
                ui.label(RichText::new(tr(lang, K::Upcoming)).strong());
                ui.add_space(6.0);
                for (date, e) in upcoming {
                    card(ui, lang, date, e, today, t);
                }
            }
        }

        ui.add_space(10.0);
        let mut go_manage = false;
        ui.vertical_centered(|ui| {
            if ui
                .add_sized([260.0, 36.0], egui::Button::new(tr(lang, K::ManageBtn)))
                .clicked()
            {
                go_manage = true;
            }
        });
        if go_manage {
            self.message = None;
            self.mode = Mode::Manage;
        }
    }

    // ───── Manage / editor ─────

    fn ui_manage(&mut self, ui: &mut egui::Ui) {
        let lang = self.settings.lang;

        ui.horizontal(|ui| {
            ui.heading(tr(lang, K::ManageTitle));
            if ui.button(tr(lang, K::Back)).clicked() {
                self.clear_form();
                self.confirm_delete = None;
                self.mode = Mode::Overview;
            }
        });
        ui.label(
            RichText::new(trf(lang, K::FileLabel, &[self.path.display().to_string().as_str()]))
                .weak()
                .small(),
        );
        ui.add_space(8.0);

        let title = if self.editing.is_some() {
            tr(lang, K::FormEdit)
        } else {
            tr(lang, K::FormNew)
        };

        egui::Frame::group(ui.style()).show(ui, |ui| {
            ui.label(RichText::new(title).strong().size(16.0));
            ui.add_space(4.0);

            egui::Grid::new("form")
                .num_columns(2)
                .spacing([12.0, 8.0])
                .show(ui, |ui| {
                    ui.label(tr(lang, K::LabelName));
                    ui.add(
                        egui::TextEdit::singleline(&mut self.form_name)
                            .desired_width(280.0)
                            .hint_text(tr(lang, K::NameHint)),
                    );
                    ui.end_row();

                    ui.label(tr(lang, K::LabelKind));
                    ui.horizontal(|ui| {
                        for k in Kind::ALL {
                            ui.selectable_value(&mut self.form_kind, k, k.label(lang));
                        }
                    });
                    ui.end_row();

                    ui.label(tr(lang, K::LabelDate));
                    ui.horizontal(|ui| {
                        ui.add(
                            egui::TextEdit::singleline(&mut self.form_day)
                                .desired_width(36.0)
                                .hint_text(tr(lang, K::PhDay)),
                        );
                        ui.label(".");
                        ui.add(
                            egui::TextEdit::singleline(&mut self.form_month)
                                .desired_width(36.0)
                                .hint_text(tr(lang, K::PhMonth)),
                        );
                        ui.label(".");
                        ui.add(
                            egui::TextEdit::singleline(&mut self.form_year)
                                .desired_width(64.0)
                                .hint_text(tr(lang, K::PhYear)),
                        );
                    });
                    ui.end_row();

                    ui.label("");
                    ui.label(
                        RichText::new(trf(lang, K::YearLine, &[self.form_kind.year_hint(lang)]))
                            .weak()
                            .small(),
                    );
                    ui.end_row();
                });

            ui.add_space(6.0);
            ui.horizontal(|ui| {
                let label = if self.editing.is_some() {
                    tr(lang, K::BtnSave)
                } else {
                    tr(lang, K::BtnAdd)
                };
                if ui.button(label).clicked() {
                    self.form_save();
                }
                if self.editing.is_some() && ui.button(tr(lang, K::BtnCancel)).clicked() {
                    self.clear_form();
                }
            });
        });

        if let Some((is_error, text)) = &self.message {
            ui.add_space(6.0);
            let color = if *is_error {
                Color32::from_rgb(255, 110, 110)
            } else {
                Color32::from_rgb(120, 220, 120)
            };
            ui.colored_label(color, text.as_str());
        }

        // display + language settings
        ui.add_space(10.0);
        egui::Frame::group(ui.style()).show(ui, |ui| {
            ui.label(RichText::new(tr(lang, K::SettingsTitle)).strong().size(16.0));
            ui.add_space(4.0);
            let mut changed = false;
            let mut lang_changed = false;
            egui::Grid::new("settings")
                .num_columns(2)
                .spacing([12.0, 8.0])
                .show(ui, |ui| {
                    ui.label(tr(lang, K::LabelCount));
                    changed |= ui
                        .add(egui::Slider::new(&mut self.settings.count, 1..=30))
                        .changed();
                    ui.end_row();

                    ui.label(tr(lang, K::LabelWithin));
                    changed |= ui
                        .add(
                            egui::Slider::new(&mut self.settings.days_ahead, 0..=366)
                                .suffix(tr(lang, K::SuffixDays)),
                        )
                        .changed();
                    ui.end_row();

                    ui.label(tr(lang, K::LabelLanguage));
                    ui.horizontal(|ui| {
                        for l in Lang::ALL {
                            lang_changed |= ui
                                .selectable_value(&mut self.settings.lang, l, l.native_name())
                                .changed();
                        }
                    });
                    ui.end_row();
                });
            ui.label(RichText::new(tr(lang, K::SettingsHint)).weak().small());
            if changed || lang_changed {
                self.settings_dirty = true;
            }
            if lang_changed {
                self.message = None;
            }
        });

        ui.add_space(10.0);
        ui.separator();
        ui.label(
            RichText::new(trf(
                lang,
                K::AllEntries,
                &[self.entries.len().to_string().as_str()],
            ))
            .strong(),
        );
        ui.add_space(4.0);

        let mut action: Option<Action> = None;
        let asking = self.confirm_delete;
        let entries = &self.entries;

        egui::ScrollArea::vertical().show(ui, |ui| {
            egui::Grid::new("list")
                .striped(true)
                .num_columns(4)
                .spacing([16.0, 6.0])
                .show(ui, |ui| {
                    for (i, e) in entries.iter().enumerate() {
                        let year = if e.year > 0 {
                            e.year.to_string()
                        } else {
                            "----".to_string()
                        };
                        ui.label(format!("{:02}.{:02}.{}", e.day, e.month, year));
                        ui.label(&e.name);
                        ui.label(e.kind.label(lang));
                        ui.horizontal(|ui| {
                            if ui.button(tr(lang, K::BtnEdit)).clicked() {
                                action = Some(Action::Edit(i));
                            }
                            if asking == Some(i) {
                                if ui
                                    .button(
                                        RichText::new(tr(lang, K::BtnReallyDelete))
                                            .color(Color32::from_rgb(255, 110, 110)),
                                    )
                                    .clicked()
                                {
                                    action = Some(Action::ConfirmDelete(i));
                                }
                                if ui.button(tr(lang, K::BtnNo)).clicked() {
                                    action = Some(Action::CancelDelete);
                                }
                            } else if ui.button(tr(lang, K::BtnDelete)).clicked() {
                                action = Some(Action::AskDelete(i));
                            }
                        });
                        ui.end_row();
                    }
                });
        });

        match action {
            Some(Action::Edit(i)) => {
                let e = self.entries[i].clone();
                self.form_name = e.name;
                self.form_kind = e.kind;
                self.form_day = e.day.to_string();
                self.form_month = e.month.to_string();
                self.form_year = if e.year > 0 {
                    e.year.to_string()
                } else {
                    String::new()
                };
                self.editing = Some(i);
                self.confirm_delete = None;
                self.message = None;
            }
            Some(Action::AskDelete(i)) => self.confirm_delete = Some(i),
            Some(Action::CancelDelete) => self.confirm_delete = None,
            Some(Action::ConfirmDelete(i)) => {
                if i < self.entries.len() {
                    self.entries.remove(i);
                }
                self.confirm_delete = None;
                self.clear_form();
                self.save_and_report(K::OkDeleted);
            }
            None => {}
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let t = ctx.input(|i| i.time);
        egui::CentralPanel::default().show(ctx, |ui| match self.mode {
            Mode::Overview => {
                egui::ScrollArea::vertical().show(ui, |ui| self.ui_overview(ui, t));
            }
            Mode::Manage => self.ui_manage(ui),
        });
        // Save settings once the slider has been released
        if self.settings_dirty && !ctx.input(|i| i.pointer.any_down()) {
            self.settings_dirty = false;
            let _ = save_settings(&settings_path(&self.path), &self.settings);
        }
        if self.mode == Mode::Overview {
            // keeps the confetti and the rainbow animated
            ctx.request_repaint_after(Duration::from_millis(33));
        }
    }
}

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([780.0, 740.0])
            .with_min_inner_size([620.0, 500.0])
            .with_title("Ehrentag-Manager")
            .with_app_id("ehrentag"),
        ..Default::default()
    };
    eframe::run_native(
        "Ehrentag-Manager",
        options,
        Box::new(|cc| Ok(Box::new(App::new(cc)))),
    )
}
