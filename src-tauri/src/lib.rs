// Ehrentag-Manager - Rust backend (storage, settings, import).
// (c) 2026 Dietmar Schnabel - MIT License
//
// The user interface lives in ../src (plain HTML/CSS/JS). This crate only
// stores the data and exposes a few commands to it.
//
// Data file format (compatible with the original Pascal program "ehrentag.pas"):
// five lines per entry: day, month, year, name, kind
//   kind: G = birthday, N = name day, H = wedding anniversary, S = other special day
//
// Where the data file lives:
//   Android / iOS: the app's private data directory
//   Desktop (first match wins):
//     1. environment variable EHRENTAG_FILE (or EHRENTAG_DATEI)
//     2. ./gebdatei.dat in the current directory (legacy behaviour)
//     3. Windows: %APPDATA%\ehrentag-manager\gebdatei.dat
//        Linux:   ~/.local/share/ehrentag-manager/gebdatei.dat
//
// Settings are stored next to the data file in "settings.json".

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "gebdatei.dat";
const SETTINGS_FILE: &str = "settings.json";

// ───────────────────────────── Data model ─────────────────────────────

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
struct Entry {
    day: u32,
    month: u32,
    year: i32, // 0 = not given
    name: String,
    kind: String, // "G", "N", "H" or "S"
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
}

const DEFAULT_BANNER: &str = "MARTIN";
const BANNER_MAX_CHARS: usize = 16;
const SUBTITLE_TEXT_MAX_CHARS: usize = 80;
const SUBTITLE_MODES: [&str; 7] = [
    "carnival",
    "easter",
    "christmaseve",
    "christmas",
    "newyear",
    "custom",
    "none",
];

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
        }
    }
}

impl Settings {
    fn sanitized(mut self) -> Self {
        self.count = self.count.clamp(1, 30);
        self.days_ahead = self.days_ahead.min(366);
        self.remind_hour = self.remind_hour.min(23);
        self.remind_days_before = self.remind_days_before.min(30);
        self.warn_days = self.warn_days.min(366);
        let banner: String = self.banner_text.trim().chars().take(BANNER_MAX_CHARS).collect();
        self.banner_text = if banner.is_empty() {
            DEFAULT_BANNER.to_string()
        } else {
            banner
        };
        if !SUBTITLE_MODES.contains(&self.subtitle_mode.as_str()) {
            self.subtitle_mode = "carnival".to_string();
        }
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
struct AppState {
    entries: Vec<Entry>,
    settings: Settings,
    data_path: String,
}

/// 29 Feb is valid (the day is checked without a year).
fn valid_date(month: u32, day: u32) -> bool {
    const DAYS: [u32; 12] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    (1..=12).contains(&month) && day >= 1 && day <= DAYS[(month - 1) as usize]
}

fn valid_kind(k: &str) -> bool {
    matches!(k, "G" | "N" | "H" | "S")
}

fn sort_entries(list: &mut [Entry]) {
    list.sort_by_key(|e| (e.month, e.day, e.name.to_lowercase()));
}

// ───────────────────────────── Files ─────────────────────────────

fn data_file(app: &AppHandle) -> PathBuf {
    if cfg!(any(target_os = "android", target_os = "ios")) {
        let dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        return dir.join(DATA_FILE);
    }
    for var in ["EHRENTAG_FILE", "EHRENTAG_DATEI"] {
        if let Some(p) = std::env::var_os(var) {
            return PathBuf::from(p);
        }
    }
    let local = PathBuf::from(DATA_FILE);
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
        Some(b) => b.join("ehrentag-manager").join(DATA_FILE),
        None => local,
    }
}

fn settings_file(data: &Path) -> PathBuf {
    data.with_file_name(SETTINGS_FILE)
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

fn parse_entries(text: &str) -> Vec<Entry> {
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
        let kind = match c[4].chars().next() {
            Some(ch) => ch.to_ascii_uppercase().to_string(),
            None => continue,
        };
        if !valid_kind(&kind) || !valid_date(month, day) || c[3].is_empty() {
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

fn load_entries(path: &Path) -> Vec<Entry> {
    match fs::read(path) {
        Ok(bytes) => parse_entries(&decode(bytes)),
        Err(_) => Vec::new(),
    }
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn write_entries(path: &Path, list: &[Entry]) -> Result<(), String> {
    ensure_parent_dir(path)?;
    // One-time backup of an existing file (e.g. the one from the Pascal version)
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
            e.day, e.month, e.year, e.name, e.kind
        ));
    }
    fs::write(path, s).map_err(|e| e.to_string())
}

fn load_settings(path: &Path) -> Settings {
    fs::read_to_string(path)
        .ok()
        .and_then(|t| serde_json::from_str::<Settings>(&t).ok())
        .unwrap_or_default()
        .sanitized()
}

/// Checks and normalises a list coming from the user interface.
fn clean_entries(entries: Vec<Entry>) -> Result<Vec<Entry>, String> {
    let mut list = Vec::with_capacity(entries.len());
    for mut e in entries {
        e.name = e.name.trim().to_string();
        e.kind = e.kind.to_ascii_uppercase();
        if e.name.is_empty()
            || e.name.contains('\n')
            || e.name.contains('\r')
            || !valid_date(e.month, e.day)
            || !valid_kind(&e.kind)
        {
            return Err("invalid_entry".to_string());
        }
        if e.kind == "N" {
            e.year = 0;
        }
        list.push(e);
    }
    sort_entries(&mut list);
    Ok(list)
}

// ───────────────────────────── Commands ─────────────────────────────

#[tauri::command]
fn get_state(app: AppHandle) -> AppState {
    let path = data_file(&app);
    AppState {
        entries: load_entries(&path),
        settings: load_settings(&settings_file(&path)),
        data_path: path.display().to_string(),
    }
}

#[tauri::command]
fn save_entries(app: AppHandle, entries: Vec<Entry>) -> Result<Vec<Entry>, String> {
    let list = clean_entries(entries)?;
    write_entries(&data_file(&app), &list)?;
    Ok(list)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Settings) -> Result<Settings, String> {
    let settings = settings.sanitized();
    let path = settings_file(&data_file(&app));
    ensure_parent_dir(&path)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(settings)
}

/// Import the bytes of a "gebdatei.dat" file (e.g. from the Pascal version).
#[tauri::command]
fn import_bytes(app: AppHandle, bytes: Vec<u8>, replace: bool) -> Result<Vec<Entry>, String> {
    let imported = parse_entries(&decode(bytes));
    if imported.is_empty() {
        return Err("no_entries".to_string());
    }
    let path = data_file(&app);
    let mut list = if replace {
        Vec::new()
    } else {
        load_entries(&path)
    };
    for e in imported {
        if !list.contains(&e) {
            list.push(e);
        }
    }
    sort_entries(&mut list);
    write_entries(&path, &list)?;
    Ok(list)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_state,
            save_entries,
            save_settings,
            import_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ehrentag-Manager");
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn parses_pascal_file() {
        let text = "24\n12\n1980\nMaria Muster\nG\n11\n11\n0\nMartin Beispiel\nn\n31\n4\n2000\nBroken\nG\n";
        let list = parse_entries(text);
        assert_eq!(list.len(), 2); // 31 April is skipped
        assert_eq!(list[0].name, "Martin Beispiel"); // sorted by month, day
        assert_eq!(list[0].kind, "N");
        assert_eq!(list[1].year, 1980);
    }

    #[test]
    fn decodes_dos_umlauts() {
        assert_eq!(decode(vec![b'M', 0x81, b'l', b'l', b'e', b'r']), "Müller");
    }

    #[test]
    fn rejects_bad_entries() {
        let bad = Entry {
            day: 31,
            month: 2,
            year: 2000,
            name: "X".into(),
            kind: "G".into(),
        };
        assert!(clean_entries(vec![bad]).is_err());
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
        }
        .sanitized();
        assert_eq!((s.count, s.days_ahead, s.remind_hour, s.remind_days_before), (30, 366, 23, 30));
        assert_eq!(s.warn_days, 366);
        assert_eq!(s.language, "");
        assert_eq!(s.banner_text, "MARTIN");
        assert_eq!(s.subtitle_mode, "carnival");
        assert_eq!(s.subtitle_text.chars().count(), 80);
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
    }
}
