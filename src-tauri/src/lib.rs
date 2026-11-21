// Ehrentag-Manager - Rust backend (storage and settings).
// (c) 2026 Dietmar Schnabel - MIT License
//
// The user interface lives in ../src (plain HTML/CSS/JavaScript). This crate stores the data
// and exposes a few commands to it. Import and export of calendar files (.ics) and the
// merging of imported dates are done in the interface (src/exchange.js), where they are tested.
//
// Data file: events.json
//   {
//     "version": 1,
//     "events": [
//       { "id": "...", "kind": "birthday", "name": "Maria Muster", "month": 12, "day": 24, "year": 1980 }
//     ]
//   }
//   kind: "birthday" | "nameday" | "wedding" | "other";  year: 0 = not given
//
// Where it lives:
//   Android / iOS: the app's private data directory
//   Desktop (first match wins):
//     1. environment variable EHRENTAG_FILE (full path of events.json)
//     2. ./events.json in the current directory
//     3. Windows: %APPDATA%\ehrentag-manager\events.json
//        Linux:   ~/.local/share/ehrentag-manager/events.json
//
// Older versions stored a five-line text file "gebdatei.dat" (the format of the original Pascal
// program ehrentag.pas). If events.json does not exist yet and such a file is found next to it,
// in the current directory or at EHRENTAG_DATEI, it is converted to events.json once and the
// original is renamed to gebdatei.dat.bak (it is not used any more).
//
// Settings are stored next to the data file in "settings.json".

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const EVENTS_FILE: &str = "events.json";
const LEGACY_FILE: &str = "gebdatei.dat";
const SETTINGS_FILE: &str = "settings.json";
const FORMAT_VERSION: u32 = 1;

// ───────────────────────────── Data model ─────────────────────────────

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
enum Kind {
    Birthday,
    Nameday,
    Wedding,
    Other,
}

impl Kind {
    /// The one-letter codes of the old gebdatei.dat.
    fn from_legacy(c: char) -> Option<Kind> {
        match c.to_ascii_uppercase() {
            'G' => Some(Kind::Birthday),
            'N' => Some(Kind::Nameday),
            'H' => Some(Kind::Wedding),
            'S' => Some(Kind::Other),
            _ => None,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
struct Entry {
    #[serde(default)]
    id: String,
    kind: Kind,
    name: String,
    month: u32,
    day: u32,
    #[serde(default)]
    year: i32, // 0 = not given
}

#[derive(Serialize, Deserialize)]
struct EventsFile {
    #[serde(default)]
    version: u32,
    events: Vec<Entry>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(default)]
struct Settings {
    count: u32,              // how many dates the overview shows (1..=30)
    days_ahead: u32,         // 0 = unlimited, otherwise only dates within this many days
    language: String,        // a language code such as "de", or "" (= follow the system language)
    remind: bool,            // send reminders (Android)
    remind_hour: u32,        // hour of day, 0..=23
    remind_days_before: u32, // 0 = on the day itself
    warn_days: u32,          // dates closer than this many days are highlighted (0 = off)
    banner_text: String,     // the big pixel text, default "MARTIN" (max. 16 characters)
    subtitle_mode: String,   // what is shown below the banner, see SUBTITLE_MODES
    subtitle_text: String,   // used when subtitle_mode is "custom"
    traditions: Vec<String>, // chosen traditions whose special days are shown (ids from src/holidays.js)
    show_holidays: bool,     // also show the next special days in the overview list
    holiday_count: u32,      // how many special days the list shows (1..=20)
}

const DEFAULT_BANNER: &str = "MARTIN";
const BANNER_MAX_CHARS: usize = 16;
const SUBTITLE_TEXT_MAX_CHARS: usize = 80;
/// What can be shown below the banner: these names, or "event:<id>" for a countdown to one special day.
/// ("easter", "christmaseve", "christmas" and "newyear" are the names of earlier versions; the
/// interface turns them into "event:easter" and so on.)
const SUBTITLE_MODES: [&str; 8] = [
    "carnival",
    "custom",
    "none",
    "next",
    "easter",
    "christmaseve",
    "christmas",
    "newyear",
];
const TRADITIONS_MAX: usize = 16;

/// Only the shape of an id is checked here; which ids exist is decided by the interface (src/holidays.js).
fn valid_id_shape(id: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&id.len()) && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

fn valid_subtitle_mode(mode: &str) -> bool {
    SUBTITLE_MODES.contains(&mode)
        || mode
            .strip_prefix("event:")
            .map_or(false, |id| valid_id_shape(id, 1, 30))
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            count: 3,
            days_ahead: 0,
            language: String::new(),
            remind: false,
            remind_hour: 9,
            remind_days_before: 1,
            warn_days: 7,
            banner_text: DEFAULT_BANNER.to_string(),
            subtitle_mode: "carnival".to_string(),
            subtitle_text: String::new(),
            traditions: Vec::new(),
            show_holidays: false,
            holiday_count: 6,
        }
    }
}

impl Settings {
    fn sanitized(mut self) -> Self {
        self.count = self.count.clamp(1, 30);
        self.days_ahead = self.days_ahead.min(366);
        self.holiday_count = self.holiday_count.clamp(1, 20);
        self.remind_hour = self.remind_hour.min(23);
        self.remind_days_before = self.remind_days_before.min(30);
        self.warn_days = self.warn_days.min(366);
        let banner: String = self.banner_text.trim().chars().take(BANNER_MAX_CHARS).collect();
        self.banner_text = if banner.is_empty() {
            DEFAULT_BANNER.to_string()
        } else {
            banner
        };
        if !valid_subtitle_mode(&self.subtitle_mode) {
            self.subtitle_mode = "carnival".to_string();
        }
        let mut seen: Vec<String> = Vec::new();
        for t in self.traditions.drain(..) {
            if valid_id_shape(&t, 2, 20) && !seen.contains(&t) && seen.len() < TRADITIONS_MAX {
                seen.push(t);
            }
        }
        self.traditions = seen;
        self.subtitle_text = self
            .subtitle_text
            .trim()
            .chars()
            .take(SUBTITLE_TEXT_MAX_CHARS)
            .collect();
        // Which codes exist is decided by the interface (src/i18n.js); only the shape is checked here.
        let l = &self.language;
        if !(l.is_empty() || ((2..=3).contains(&l.len()) && l.chars().all(|c| c.is_ascii_lowercase()))) {
            self.language = String::new();
        }
        self
    }
}

#[derive(Serialize)]
struct Migration {
    from_name: String,   // e.g. "gebdatei.dat"
    backup_name: String, // e.g. "gebdatei.dat.bak"
}

#[derive(Serialize)]
struct AppState {
    entries: Vec<Entry>,
    settings: Settings,
    data_path: String,
    migration: Option<Migration>, // set only in the session in which the old file was converted
}

/// 29 Feb is valid (the day is checked without a year).
fn valid_date(month: u32, day: u32) -> bool {
    const DAYS: [u32; 12] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    (1..=12).contains(&month) && day >= 1 && day <= DAYS[(month - 1) as usize]
}

fn sort_entries(list: &mut [Entry]) {
    list.sort_by_key(|e| (e.month, e.day, e.name.to_lowercase()));
}

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/// A new unique id (hex digits only, so it is safe as the UID of a calendar entry).
fn new_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let n = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{:x}{:03x}", nanos, n & 0xfff)
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Checks one entry; None if it is unusable.
fn clean_one(mut e: Entry) -> Option<Entry> {
    e.name = e.name.trim().to_string();
    e.id = e.id.trim().to_string();
    if e.name.is_empty()
        || e.name.contains('\n')
        || e.name.contains('\r')
        || !valid_date(e.month, e.day)
    {
        return None;
    }
    if e.kind == Kind::Nameday {
        e.year = 0;
    }
    Some(e)
}

/// Gives every entry a unique valid id and sorts the list.
fn finish(mut list: Vec<Entry>) -> Vec<Entry> {
    let mut seen: HashSet<String> = HashSet::new();
    for e in list.iter_mut() {
        if !valid_id(&e.id) || seen.contains(&e.id) {
            e.id = new_id();
        }
        seen.insert(e.id.clone());
    }
    sort_entries(&mut list);
    list
}

/// For a list coming from the user interface: everything must be valid.
fn clean_entries(entries: Vec<Entry>) -> Result<Vec<Entry>, String> {
    let mut list = Vec::with_capacity(entries.len());
    for e in entries {
        list.push(clean_one(e).ok_or_else(|| "invalid_entry".to_string())?);
    }
    Ok(finish(list))
}

// ───────────────────────────── Files ─────────────────────────────

fn events_file(app: &AppHandle) -> PathBuf {
    if cfg!(any(target_os = "android", target_os = "ios")) {
        let dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        return dir.join(EVENTS_FILE);
    }
    if let Some(p) = std::env::var_os("EHRENTAG_FILE") {
        return PathBuf::from(p);
    }
    let local = PathBuf::from(EVENTS_FILE);
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
        Some(b) => b.join("ehrentag-manager").join(EVENTS_FILE),
        None => local,
    }
}

fn settings_file(events: &Path) -> PathBuf {
    events.with_file_name(SETTINGS_FILE)
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Adds a suffix to a file name: "events.json" + ".bak" -> "events.json.bak".
fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(suffix);
    PathBuf::from(name)
}

/// "x.bak", or "x.bak2", "x.bak3", ... if that name is already taken.
fn unique_backup(path: &Path) -> PathBuf {
    let mut candidate = with_suffix(path, ".bak");
    let mut n = 2;
    while candidate.exists() {
        candidate = with_suffix(path, &format!(".bak{}", n));
        n += 1;
    }
    candidate
}

/// Reads the entries of an events.json text (an object with "events", or a plain array).
/// Entries of an unknown shape or kind are skipped.
fn parse_events_json(text: &str) -> Option<Vec<Entry>> {
    let value: serde_json::Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()?;
    let items: Vec<serde_json::Value> = match &value {
        serde_json::Value::Array(a) => a.clone(),
        serde_json::Value::Object(o) => o.get("events")?.as_array()?.clone(),
        _ => return None,
    };
    Some(
        items
            .into_iter()
            .filter_map(|v| serde_json::from_value::<Entry>(v).ok())
            .collect(),
    )
}

fn read_events(path: &Path) -> Vec<Entry> {
    let Ok(text) = fs::read_to_string(path) else {
        return Vec::new();
    };
    match parse_events_json(&text) {
        Some(list) => finish(list.into_iter().filter_map(clean_one).collect()),
        None => {
            // Not readable: keep a copy so that the next save does not destroy it.
            if !text.trim().is_empty() {
                let _ = fs::copy(path, unique_backup(&with_suffix(path, ".corrupt")));
            }
            Vec::new()
        }
    }
}

fn write_events(path: &Path, list: &[Entry]) -> Result<(), String> {
    ensure_parent_dir(path)?;
    let file = EventsFile {
        version: FORMAT_VERSION,
        events: list.to_vec(),
    };
    let json = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    // write to a temporary file first, so that a crash cannot leave half a file behind
    let tmp = with_suffix(path, ".tmp");
    fs::write(&tmp, json + "\n").map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn load_settings(path: &Path) -> Settings {
    fs::read_to_string(path)
        .ok()
        .and_then(|t| serde_json::from_str::<Settings>(&t).ok())
        .unwrap_or_default()
        .sanitized()
}

// ───────────────────────────── The old gebdatei.dat ─────────────────────────────

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

/// Five lines per entry: day, month, year, name, kind letter (G, N, H or S).
fn parse_legacy_text(text: &str) -> Vec<Entry> {
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
        let Some(kind) = c[4].chars().next().and_then(Kind::from_legacy) else {
            continue;
        };
        if let Some(e) = clean_one(Entry {
            id: String::new(),
            kind,
            name: c[3].to_string(),
            month,
            day,
            year,
        }) {
            list.push(e);
        }
    }
    finish(list)
}

/// Where an old gebdatei.dat might be, most likely first.
fn legacy_candidates(events: &Path) -> Vec<PathBuf> {
    let mut v = vec![events.with_file_name(LEGACY_FILE)];
    if !cfg!(any(target_os = "android", target_os = "ios")) {
        v.push(PathBuf::from(LEGACY_FILE));
        if let Some(p) = std::env::var_os("EHRENTAG_DATEI") {
            v.push(PathBuf::from(p));
        }
    }
    v
}

/// Converts an old gebdatei.dat to events.json, once. Does nothing if events.json exists.
fn migrate_legacy(events: &Path) -> Option<Migration> {
    if events.exists() {
        return None;
    }
    for candidate in legacy_candidates(events) {
        if !candidate.is_file() {
            continue;
        }
        let Ok(bytes) = fs::read(&candidate) else {
            continue;
        };
        let list = parse_legacy_text(&decode(bytes));
        if write_events(events, &list).is_err() {
            return None;
        }
        // The old file is not used any more: keep it under another name.
        let backup = unique_backup(&candidate);
        let backup_name = if fs::rename(&candidate, &backup).is_ok() {
            file_name(&backup)
        } else {
            file_name(&candidate)
        };
        return Some(Migration {
            from_name: file_name(&candidate),
            backup_name,
        });
    }
    None
}

// ───────────────────────────── Commands ─────────────────────────────

#[tauri::command]
fn get_state(app: AppHandle) -> AppState {
    let path = events_file(&app);
    let migration = migrate_legacy(&path);
    AppState {
        entries: read_events(&path),
        settings: load_settings(&settings_file(&path)),
        data_path: path.display().to_string(),
        migration,
    }
}

#[tauri::command]
fn save_entries(app: AppHandle, entries: Vec<Entry>) -> Result<Vec<Entry>, String> {
    let list = clean_entries(entries)?;
    write_events(&events_file(&app), &list)?;
    Ok(list)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Settings) -> Result<Settings, String> {
    let settings = settings.sanitized();
    let path = settings_file(&events_file(&app));
    ensure_parent_dir(&path)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(settings)
}

/// Reads the bytes of an old gebdatei.dat (for the import in the editor).
#[tauri::command]
fn parse_legacy(bytes: Vec<u8>) -> Vec<Entry> {
    parse_legacy_text(&decode(bytes))
}

/// Writes an exported file to the place the user picked in the save dialog.
#[tauri::command]
fn write_text_file(path: String, text: String) -> Result<(), String> {
    fs::write(&path, text).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_state,
            save_entries,
            save_settings,
            parse_legacy,
            write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ehrentag-Manager");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ehrentag-test-{}", new_id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn entry(kind: Kind, name: &str, month: u32, day: u32, year: i32) -> Entry {
        Entry {
            id: String::new(),
            kind,
            name: name.to_string(),
            month,
            day,
            year,
        }
    }

    #[test]
    fn dates() {
        assert!(valid_date(2, 29));
        assert!(!valid_date(2, 30));
        assert!(!valid_date(4, 31));
        assert!(valid_date(12, 31));
        assert!(!valid_date(13, 1));
        assert!(!valid_date(1, 0));
    }

    #[test]
    fn parses_the_old_pascal_file() {
        let text = "24\n12\n1980\nMaria Muster\nG\n11\n11\n0\nMartin Beispiel\nn\n31\n4\n2000\nBroken\nG\n";
        let list = parse_legacy_text(text);
        assert_eq!(list.len(), 2); // 31 April is skipped
        assert_eq!(list[0].name, "Martin Beispiel"); // sorted by month, day
        assert_eq!(list[0].kind, Kind::Nameday);
        assert_eq!(list[1].year, 1980);
        assert_eq!(list[1].kind, Kind::Birthday);
        assert!(valid_id(&list[0].id) && valid_id(&list[1].id));
        assert_ne!(list[0].id, list[1].id);
    }

    #[test]
    fn decodes_dos_umlauts() {
        assert_eq!(decode(vec![b'M', 0x81, b'l', b'l', b'e', b'r']), "Müller");
    }

    #[test]
    fn json_uses_readable_names() {
        let e = Entry {
            id: "abc".into(),
            ..entry(Kind::Wedding, "Anna & Paul", 6, 3, 2001)
        };
        let json = serde_json::to_string(&EventsFile {
            version: 1,
            events: vec![e],
        })
        .unwrap();
        assert!(json.contains(r#""kind":"wedding""#));
        assert!(json.contains(r#""version":1"#));
    }

    #[test]
    fn json_is_read_leniently() {
        let text = r#"{"version":1,"events":[
            {"kind":"birthday","name":"A","month":1,"day":2,"year":1990},
            {"kind":"alien","name":"B","month":1,"day":2},
            {"kind":"other","name":"C","month":2,"day":30}]}"#;
        let list = parse_events_json(text).unwrap();
        assert_eq!(list.len(), 2); // the unknown kind is dropped while reading
        let cleaned = finish(list.into_iter().filter_map(clean_one).collect());
        assert_eq!(cleaned.len(), 1); // 30 Feb is invalid
        assert_eq!(cleaned[0].name, "A");
        assert!(valid_id(&cleaned[0].id));
        // a plain array works too, anything else does not
        assert_eq!(
            parse_events_json(r#"[{"kind":"other","name":"X","month":1,"day":1}]"#)
                .unwrap()
                .len(),
            1
        );
        assert!(parse_events_json("not json").is_none());
        assert!(parse_events_json(r#"{"foo":1}"#).is_none());
    }

    #[test]
    fn ids_are_made_unique() {
        let mut a = entry(Kind::Other, "A", 1, 1, 0);
        let mut b = entry(Kind::Other, "B", 1, 2, 0);
        a.id = "same".into();
        b.id = "same".into();
        let list = finish(vec![a, b]);
        assert_ne!(list[0].id, list[1].id);
        assert!(list.iter().any(|e| e.id == "same"));
    }

    #[test]
    fn rejects_bad_entries() {
        assert!(clean_entries(vec![entry(Kind::Birthday, "X", 2, 31, 2000)]).is_err());
        assert!(clean_entries(vec![entry(Kind::Birthday, "  ", 2, 1, 2000)]).is_err());
        let list = clean_entries(vec![entry(Kind::Nameday, " Martin ", 11, 11, 1999)]).unwrap();
        assert_eq!(list[0].name, "Martin");
        assert_eq!(list[0].year, 0); // name days have no year
    }

    #[test]
    fn writes_and_reads_events_json() {
        let dir = temp_dir();
        let path = dir.join(EVENTS_FILE);
        let list = clean_entries(vec![
            entry(Kind::Birthday, "Maria Muster", 12, 24, 1980),
            entry(Kind::Other, "Erster PC", 11, 11, 1995),
        ])
        .unwrap();
        write_events(&path, &list).unwrap();
        assert!(!with_suffix(&path, ".tmp").exists());
        assert_eq!(read_events(&path), list);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn an_unreadable_file_is_kept() {
        let dir = temp_dir();
        let path = dir.join(EVENTS_FILE);
        fs::write(&path, "{ this is not json").unwrap();
        assert!(read_events(&path).is_empty());
        assert!(with_suffix(&path, ".corrupt.bak").exists() || with_suffix(&path, ".corrupt").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn converts_the_old_file_once() {
        let dir = temp_dir();
        let legacy = dir.join(LEGACY_FILE);
        fs::write(&legacy, "24\n12\n1980\nMaria Muster\nG\n").unwrap();
        // an older version of the program left a backup behind
        fs::write(dir.join("gebdatei.dat.bak"), "x").unwrap();
        let events = dir.join(EVENTS_FILE);

        let m = migrate_legacy(&events).expect("converted");
        assert_eq!(m.from_name, "gebdatei.dat");
        assert_eq!(m.backup_name, "gebdatei.dat.bak2");
        assert!(!legacy.exists(), "the old file is no longer used");
        assert!(dir.join("gebdatei.dat.bak2").exists());

        let list = read_events(&events);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].kind, Kind::Birthday);
        assert_eq!(list[0].year, 1980);

        // second start: nothing to do
        assert!(migrate_legacy(&events).is_none());
        // an existing events.json is never overwritten
        fs::write(&legacy, "1\n1\n2000\nNew\nG\n").unwrap();
        assert!(migrate_legacy(&events).is_none());
        assert_eq!(read_events(&events).len(), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn settings_are_clamped() {
        let s = Settings {
            count: 500,
            days_ahead: 9999,
            language: "Fr!".into(),
            remind: true,
            remind_hour: 40,
            remind_days_before: 99,
            warn_days: 9999,
            banner_text: "   ".into(),
            subtitle_mode: "bogus".into(),
            subtitle_text: "x".repeat(200),
            traditions: vec![
                "Islamic".into(),
                "islamic".into(),
                "islamic".into(),
                "x".into(),
                "western".into(),
            ],
            show_holidays: true,
            holiday_count: 999,
        }
        .sanitized();
        assert_eq!((s.count, s.days_ahead, s.remind_hour, s.remind_days_before), (30, 366, 23, 30));
        assert_eq!(s.warn_days, 366);
        assert_eq!(s.language, "");
        assert_eq!(s.banner_text, "MARTIN");
        assert_eq!(s.subtitle_mode, "carnival");
        assert_eq!(s.subtitle_text.chars().count(), 80);
        // wrong shape and duplicates are dropped, the order is kept
        assert_eq!(s.traditions, vec!["islamic".to_string(), "western".to_string()]);
        assert!(s.show_holidays);
        assert_eq!(s.holiday_count, 20);
    }

    #[test]
    fn subtitle_modes() {
        for ok in ["carnival", "custom", "none", "next", "easter", "event:eidalfitr", "event:diwali"] {
            assert!(valid_subtitle_mode(ok), "{ok} should be valid");
        }
        for bad in ["bogus", "event:", "event:BAD", "event:x y", "event", "EVENT:easter", ""] {
            assert!(!valid_subtitle_mode(bad), "{bad:?} should be invalid");
        }
        let s = Settings {
            subtitle_mode: "event:Bad Id".into(),
            ..Settings::default()
        }
        .sanitized();
        assert_eq!(s.subtitle_mode, "carnival");
    }

    #[test]
    fn old_settings_keep_a_countdown_choice() {
        let s: Settings = serde_json::from_str(r#"{"subtitle_mode": "easter"}"#).unwrap();
        assert_eq!(s.sanitized().subtitle_mode, "easter"); // the interface turns it into "event:easter"
    }

    #[test]
    fn language_codes_are_kept() {
        for code in ["", "de", "en", "fr", "zh", "ja"] {
            let s = Settings {
                language: code.into(),
                ..Settings::default()
            }
            .sanitized();
            assert_eq!(s.language, code);
        }
    }

    #[test]
    fn banner_text_is_trimmed_and_limited() {
        let s = Settings {
            banner_text: "  Happy Birthday to everybody  ".into(),
            ..Settings::default()
        }
        .sanitized();
        assert_eq!(s.banner_text.chars().count(), 16);
        assert!(s.banner_text.starts_with("Happy Birthday"));
    }

    #[test]
    fn old_settings_file_gets_defaults_for_new_fields() {
        let s: Settings = serde_json::from_str(r#"{"count": 5, "language": "de"}"#).unwrap();
        let s = s.sanitized();
        assert_eq!(s.count, 5);
        assert_eq!(s.warn_days, 7);
        assert_eq!(s.banner_text, "MARTIN");
        assert_eq!(s.subtitle_mode, "carnival");
        assert_eq!(s.holiday_count, 6);
        assert!(s.traditions.is_empty() && !s.show_holidays);
    }
}
