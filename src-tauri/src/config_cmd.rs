use std::{collections::HashMap, fs, path::Path, sync::Mutex};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

const CONFIG_FILE_NAME: &str = "config.json";
static CONFIG_WRITE_LOCK: Mutex<()> = Mutex::new(());

const POSES: &[&str] = &[
    "wave",
    "thumbs",
    "hearts",
    "idea",
    "think",
    "run",
    "celebrate",
    "explore",
    "magic",
    "garden",
    "music",
    "paint",
    "party",
    "hug",
    "hero",
    "night",
];

/// Known built-in ids: `freeos`, `openxyos`, `xyai-studio`, `grokbot`.
/// Stored as a string so later XYAIStudio backends can be added without a
/// Rust enum rewrite (register the plugin on the frontend, persist options here).
pub fn normalize_provider_id(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        "freeos".into()
    } else {
        trimmed.to_string()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NestedUrlUser {
    pub base_url: String,
    pub username: String,
}

impl Default for NestedUrlUser {
    fn default() -> Self {
        Self {
            base_url: "http://127.0.0.1:8088".into(),
            username: String::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NestedUrlEmail {
    pub base_url: String,
    pub email: String,
}

impl Default for NestedUrlEmail {
    fn default() -> Self {
        Self {
            base_url: "http://127.0.0.1:3000".into(),
            email: String::new(),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NestedUrl {
    pub base_url: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct GrokBotConfig {
    pub base_url: String,
    pub gateway_json_path: String,
}

impl Default for GrokBotConfig {
    fn default() -> Self {
        Self {
            base_url: "http://127.0.0.1:1340".into(),
            gateway_json_path: String::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppConfig {
    pub provider_id: String,
    pub freeos: NestedUrlUser,
    pub openxyos: NestedUrlEmail,
    pub xyai_studio: NestedUrl,
    pub grokbot: GrokBotConfig,
    /// Opaque per-provider JSON for backends added later without dedicated structs.
    pub provider_options: HashMap<String, Value>,
    pub mascot_id: String,
    pub auto_expression: bool,
    pub lock_pose: bool,
    pub last_agent_id: Option<String>,
    pub thread_id_by_agent: HashMap<String, String>,
    pub pet_x: Option<f64>,
    pub pet_y: Option<f64>,
    pub pet_size: f64,
    pub shortcut_open_pet: String,
    pub shortcut_open_home: String,
    pub keep_windows_visible: bool,
    pub activity_aware: bool,
    pub idle_threshold_sec: u32,
    pub long_idle_threshold_sec: u32,
    pub foreground_hints: bool,
    pub time_of_day_poses: bool,
    pub pet_opacity: f64,
    pub always_on_top: bool,
    pub click_through: bool,
    pub edge_snap: bool,
    pub pet_position_by_monitor: HashMap<String, MonitorPos>,
    pub autostart: bool,
    pub sound_enabled: bool,
    pub sfx_enabled: bool,
    pub music_enabled: bool,
    pub sound_volume: u32,
    pub quiet_hours_enabled: bool,
    pub quiet_hours_start: String,
    pub quiet_hours_end: String,
    pub pomodoro_focus_min: u32,
    pub pomodoro_break_min: u32,
    pub pomodoro_long_break_min: u32,
    pub mood_meter_enabled: bool,
    pub mood_energy: u32,
    pub companion_bubbles: bool,
    pub screen_understanding: bool,
    pub shortcut_open_chat: String,
    pub shortcut_toggle_click_through: String,
    pub shortcut_pomodoro: String,
    pub shortcut_pat: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct MonitorPos {
    pub x: f64,
    pub y: f64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            provider_id: "freeos".into(),
            freeos: NestedUrlUser::default(),
            openxyos: NestedUrlEmail::default(),
            xyai_studio: NestedUrl::default(),
            grokbot: GrokBotConfig::default(),
            provider_options: HashMap::new(),
            mascot_id: "wave".into(),
            auto_expression: true,
            lock_pose: false,
            last_agent_id: None,
            thread_id_by_agent: HashMap::new(),
            pet_x: None,
            pet_y: None,
            pet_size: 180.0,
            shortcut_open_pet: "CmdOrCtrl+Shift+Y".into(),
            shortcut_open_home: "CmdOrCtrl+Shift+H".into(),
            keep_windows_visible: true,
            activity_aware: true,
            idle_threshold_sec: 50,
            long_idle_threshold_sec: 420,
            foreground_hints: false,
            time_of_day_poses: true,
            pet_opacity: 100.0,
            always_on_top: true,
            click_through: false,
            edge_snap: true,
            pet_position_by_monitor: HashMap::new(),
            autostart: false,
            sound_enabled: false,
            sfx_enabled: true,
            music_enabled: false,
            sound_volume: 40,
            quiet_hours_enabled: false,
            quiet_hours_start: "22:00".into(),
            quiet_hours_end: "07:00".into(),
            pomodoro_focus_min: 25,
            pomodoro_break_min: 5,
            pomodoro_long_break_min: 15,
            mood_meter_enabled: true,
            mood_energy: 64,
            companion_bubbles: true,
            screen_understanding: false,
            shortcut_open_chat: "CmdOrCtrl+Shift+C".into(),
            shortcut_toggle_click_through: "CmdOrCtrl+Shift+T".into(),
            shortcut_pomodoro: "CmdOrCtrl+Shift+P".into(),
            shortcut_pat: "CmdOrCtrl+Shift+K".into(),
        }
    }
}

fn clamp_u32(value: u32, min: u32, max: u32) -> u32 {
    value.clamp(min, max)
}

fn valid_hhmm(value: &str) -> bool {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let Ok(hour) = parts[0].parse::<u32>() else {
        return false;
    };
    let Ok(minute) = parts[1].parse::<u32>() else {
        return false;
    };
    hour <= 23 && minute <= 59 && parts[1].len() == 2
}

pub fn supported_poses() -> &'static [&'static str] {
    POSES
}

pub fn select_mascot(cfg: &mut AppConfig, mascot_id: &str) -> Result<(), String> {
    if POSES.contains(&mascot_id) {
        cfg.mascot_id = mascot_id.to_string();
        Ok(())
    } else {
        Err(format!("unsupported pose: {mascot_id}"))
    }
}

pub fn home_url_for(cfg: &AppConfig) -> String {
    let fallback = match cfg.provider_id.as_str() {
        "openxyos" => "http://127.0.0.1:3000",
        "xyai-studio" => "",
        "grokbot" => "http://127.0.0.1:1340",
        _ => "http://127.0.0.1:8088",
    };
    let chosen = match cfg.provider_id.as_str() {
        "openxyos" => cfg.openxyos.base_url.trim(),
        "xyai-studio" => cfg.xyai_studio.base_url.trim(),
        "grokbot" => cfg.grokbot.base_url.trim(),
        _ => cfg.freeos.base_url.trim(),
    };
    if chosen.is_empty() {
        fallback.to_string()
    } else {
        chosen.trim_end_matches('/').to_string()
    }
}

pub fn load_from_path(path: &Path) -> Result<AppConfig, String> {
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let json = fs::read_to_string(path)
        .map_err(|error| format!("failed to read config {}: {error}", path.display()))?;
    serde_json::from_str(&json)
        .map_err(|error| format!("failed to parse config {}: {error}", path.display()))
}

pub fn save_to_path(path: &Path, cfg: &AppConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create config directory {}: {error}",
                parent.display()
            )
        })?;
    }
    let json = serde_json::to_string_pretty(cfg)
        .map_err(|error| format!("failed to serialize config: {error}"))?;
    fs::write(path, json)
        .map_err(|error| format!("failed to write config {}: {error}", path.display()))
}

fn patch_field<T: DeserializeOwned>(key: &str, value: Value) -> Result<T, String> {
    serde_json::from_value(value).map_err(|error| format!("invalid config field {key}: {error}"))
}

fn merge_patch(cfg: &mut AppConfig, patch: Value) -> Result<(), String> {
    let fields = patch
        .as_object()
        .ok_or_else(|| "config patch must be an object".to_string())?;
    for (key, value) in fields {
        match key.as_str() {
            "providerId" => {
                let id: String = patch_field(key, value.clone())?;
                cfg.provider_id = normalize_provider_id(&id);
            }
            "freeos" => cfg.freeos = patch_field(key, value.clone())?,
            "openxyos" => cfg.openxyos = patch_field(key, value.clone())?,
            "xyaiStudio" => cfg.xyai_studio = patch_field(key, value.clone())?,
            "grokbot" => cfg.grokbot = patch_field(key, value.clone())?,
            "providerOptions" => cfg.provider_options = patch_field(key, value.clone())?,
            "mascotId" => cfg.mascot_id = patch_field(key, value.clone())?,
            "autoExpression" => cfg.auto_expression = patch_field(key, value.clone())?,
            "lockPose" => cfg.lock_pose = patch_field(key, value.clone())?,
            "lastAgentId" => cfg.last_agent_id = patch_field(key, value.clone())?,
            "threadIdByAgent" => cfg.thread_id_by_agent = patch_field(key, value.clone())?,
            "petX" => cfg.pet_x = patch_field(key, value.clone())?,
            "petY" => cfg.pet_y = patch_field(key, value.clone())?,
            "petSize" => {
                let size: f64 = patch_field(key, value.clone())?;
                if !(80.0..=224.0).contains(&size) {
                    return Err("petSize must be between 80 and 224".into());
                }
                cfg.pet_size = size;
            }
            "shortcutOpenPet" => cfg.shortcut_open_pet = patch_field(key, value.clone())?,
            "shortcutOpenHome" => cfg.shortcut_open_home = patch_field(key, value.clone())?,
            "keepWindowsVisible" => cfg.keep_windows_visible = patch_field(key, value.clone())?,
            "activityAware" => cfg.activity_aware = patch_field(key, value.clone())?,
            "idleThresholdSec" => {
                let n: u32 = patch_field(key, value.clone())?;
                cfg.idle_threshold_sec = clamp_u32(n, 10, 600);
            }
            "longIdleThresholdSec" => {
                let n: u32 = patch_field(key, value.clone())?;
                cfg.long_idle_threshold_sec = clamp_u32(n, 60, 3600);
            }
            "foregroundHints" => cfg.foreground_hints = patch_field(key, value.clone())?,
            "timeOfDayPoses" => cfg.time_of_day_poses = patch_field(key, value.clone())?,
            "petOpacity" => {
                let n: f64 = patch_field(key, value.clone())?;
                if !(40.0..=100.0).contains(&n) {
                    return Err("petOpacity must be between 40 and 100".into());
                }
                cfg.pet_opacity = n;
            }
            "alwaysOnTop" => cfg.always_on_top = patch_field(key, value.clone())?,
            "clickThrough" => cfg.click_through = patch_field(key, value.clone())?,
            "edgeSnap" => cfg.edge_snap = patch_field(key, value.clone())?,
            "petPositionByMonitor" => {
                cfg.pet_position_by_monitor = patch_field(key, value.clone())?
            }
            "autostart" => cfg.autostart = patch_field(key, value.clone())?,
            "soundEnabled" => cfg.sound_enabled = patch_field(key, value.clone())?,
            "sfxEnabled" => cfg.sfx_enabled = patch_field(key, value.clone())?,
            "musicEnabled" => cfg.music_enabled = patch_field(key, value.clone())?,
            "soundVolume" => {
                let n: u32 = patch_field(key, value.clone())?;
                cfg.sound_volume = clamp_u32(n, 0, 100);
            }
            "quietHoursEnabled" => cfg.quiet_hours_enabled = patch_field(key, value.clone())?,
            "quietHoursStart" => {
                let spec: String = patch_field(key, value.clone())?;
                if !valid_hhmm(&spec) {
                    return Err("quietHoursStart must be HH:MM".into());
                }
                cfg.quiet_hours_start = spec;
            }
            "quietHoursEnd" => {
                let spec: String = patch_field(key, value.clone())?;
                if !valid_hhmm(&spec) {
                    return Err("quietHoursEnd must be HH:MM".into());
                }
                cfg.quiet_hours_end = spec;
            }
            "pomodoroFocusMin" => {
                let n: u32 = patch_field(key, value.clone())?;
                cfg.pomodoro_focus_min = clamp_u32(n, 1, 120);
            }
            "pomodoroBreakMin" => {
                let n: u32 = patch_field(key, value.clone())?;
                cfg.pomodoro_break_min = clamp_u32(n, 1, 120);
            }
            "pomodoroLongBreakMin" => {
                let n: u32 = patch_field(key, value.clone())?;
                cfg.pomodoro_long_break_min = clamp_u32(n, 1, 120);
            }
            "moodMeterEnabled" => cfg.mood_meter_enabled = patch_field(key, value.clone())?,
            "moodEnergy" => {
                let n: u32 = patch_field(key, value.clone())?;
                cfg.mood_energy = clamp_u32(n, 0, 100);
            }
            "companionBubbles" => cfg.companion_bubbles = patch_field(key, value.clone())?,
            "screenUnderstanding" => cfg.screen_understanding = patch_field(key, value.clone())?,
            "shortcutOpenChat" => cfg.shortcut_open_chat = patch_field(key, value.clone())?,
            "shortcutToggleClickThrough" => {
                cfg.shortcut_toggle_click_through = patch_field(key, value.clone())?
            }
            "shortcutPomodoro" => cfg.shortcut_pomodoro = patch_field(key, value.clone())?,
            "shortcutPat" => cfg.shortcut_pat = patch_field(key, value.clone())?,
            _ => return Err(format!("unsupported config field: {key}")),
        }
    }
    Ok(())
}

pub fn patch_at_path(path: &Path, patch: Value) -> Result<AppConfig, String> {
    let _guard = CONFIG_WRITE_LOCK
        .lock()
        .map_err(|_| "config write lock is poisoned".to_string())?;
    let mut cfg = load_from_path(path)?;
    merge_patch(&mut cfg, patch)?;
    save_to_path(path, &cfg)?;
    Ok(cfg)
}

fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|path| path.join(CONFIG_FILE_NAME))
        .map_err(|error| format!("failed to resolve app config directory: {error}"))
}

#[tauri::command]
pub fn load_config(app: AppHandle) -> Result<AppConfig, String> {
    load_from_path(&config_path(&app)?)
}

#[tauri::command]
pub fn save_config(app: AppHandle, cfg: AppConfig) -> Result<(), String> {
    let _guard = CONFIG_WRITE_LOCK
        .lock()
        .map_err(|_| "config write lock is poisoned".to_string())?;
    save_to_path(&config_path(&app)?, &cfg)
}

#[tauri::command]
pub fn patch_config(app: AppHandle, patch: Value) -> Result<(), String> {
    patch_at_path(&config_path(&app)?, patch).map(|_| ())
}
