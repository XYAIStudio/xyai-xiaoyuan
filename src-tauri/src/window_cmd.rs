use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_opener::OpenerExt;

use crate::config_cmd::{self, AppConfig, MonitorPos};

/// Place the chat window beside the pet, preferring the left side, clamped to
/// the monitor work area. Coordinates are physical pixels.
#[allow(clippy::too_many_arguments)]
pub fn chat_position(
    pet_x: i32,
    pet_y: i32,
    pet_w: u32,
    pet_h: u32,
    chat_w: u32,
    chat_h: u32,
    work_x: i32,
    work_y: i32,
    work_w: u32,
    work_h: u32,
) -> (i32, i32) {
    let gap = 8_i32;
    let work_right = work_x.saturating_add_unsigned(work_w);
    let work_bottom = work_y.saturating_add_unsigned(work_h);
    let left_x = pet_x - chat_w as i32 - gap;
    let right_x = pet_x + pet_w as i32 + gap;
    let mut x = if left_x >= work_x { left_x } else { right_x };
    if x + chat_w as i32 > work_right {
        x = work_right - chat_w as i32;
    }
    if x < work_x {
        x = work_x;
    }
    let mut y = pet_y + (pet_h as i32 / 2) - (chat_h as i32 / 2);
    if y + chat_h as i32 > work_bottom {
        y = work_bottom - chat_h as i32;
    }
    if y < work_y {
        y = work_y;
    }
    (x, y)
}

/// Keep the pet inside the monitor work area; optionally snap to edges.
#[allow(clippy::too_many_arguments)]
pub fn clamp_pet_position(
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    work_x: i32,
    work_y: i32,
    work_w: u32,
    work_h: u32,
    snap: bool,
) -> (i32, i32) {
    let work_right = work_x.saturating_add_unsigned(work_w);
    let work_bottom = work_y.saturating_add_unsigned(work_h);
    let max_x = work_right.saturating_sub(w as i32);
    let max_y = work_bottom.saturating_sub(h as i32);
    let mut nx = x.clamp(work_x.min(max_x), max_x.max(work_x));
    let mut ny = y.clamp(work_y.min(max_y), max_y.max(work_y));
    if snap {
        const EDGE: i32 = 28;
        if (nx - work_x).abs() <= EDGE {
            nx = work_x;
        }
        if (max_x - nx).abs() <= EDGE {
            nx = max_x;
        }
        if (ny - work_y).abs() <= EDGE {
            ny = work_y;
        }
        if (max_y - ny).abs() <= EDGE {
            ny = max_y;
        }
    }
    (nx, ny)
}

fn monitor_key(work_x: i32, work_y: i32, work_w: u32, work_h: u32) -> String {
    format!("{work_w}x{work_h}+{work_x}+{work_y}")
}

fn work_area_of(window: &WebviewWindow) -> (i32, i32, u32, u32) {
    match window.current_monitor() {
        Ok(Some(monitor)) => {
            let pos = monitor.position();
            let size = monitor.size();
            (pos.x, pos.y, size.width, size.height)
        }
        _ => (0, 0, 1920, 1080),
    }
}

pub fn is_http_url(url: &str) -> bool {
    let trimmed = url.trim();
    trimmed.starts_with("http://") || trimmed.starts_with("https://")
}

fn window_of(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("window `{label}` not found"))
}

pub fn install_close_to_hide(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        let handle = app.clone();
        let label_owned = label.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Some(target) = handle.get_webview_window(&label_owned) {
                    let _ = target.hide();
                }
            }
        });
    }
}

pub fn restore_pet_position(app: &AppHandle) {
    let Ok(cfg) = config_cmd::load_config(app.clone()) else {
        return;
    };
    let Some(pet) = app.get_webview_window("pet") else {
        return;
    };
    let size = cfg.pet_size.clamp(80.0, 224.0) as u32;
    let _ = pet.set_size(PhysicalSize::new(size, size));
    let (work_x, work_y, work_w, work_h) = work_area_of(&pet);
    let key = monitor_key(work_x, work_y, work_w, work_h);
    let saved = cfg
        .pet_position_by_monitor
        .get(&key)
        .map(|pos| (pos.x, pos.y))
        .or(match (cfg.pet_x, cfg.pet_y) {
            (Some(x), Some(y)) => Some((x, y)),
            _ => None,
        });
    if let Some((x, y)) = saved {
        let (nx, ny) = clamp_pet_position(
            x as i32,
            y as i32,
            size,
            size,
            work_x,
            work_y,
            work_w,
            work_h,
            cfg.edge_snap,
        );
        let _ = pet.set_position(PhysicalPosition::new(nx, ny));
    }
    let _ = pet.set_always_on_top(cfg.always_on_top);
    let _ = pet.set_ignore_cursor_events(cfg.click_through);
}

fn persist_pet_geometry(app: &AppHandle) {
    let Some(pet) = app.get_webview_window("pet") else {
        return;
    };
    let Ok(position) = pet.outer_position() else {
        return;
    };
    let (work_x, work_y, work_w, work_h) = work_area_of(&pet);
    let key = monitor_key(work_x, work_y, work_w, work_h);
    let mut map = config_cmd::load_config(app.clone())
        .map(|cfg| cfg.pet_position_by_monitor)
        .unwrap_or_default();
    map.insert(
        key,
        MonitorPos {
            x: position.x as f64,
            y: position.y as f64,
        },
    );
    let _ = config_cmd::patch_config(
        app.clone(),
        json!({
            "petX": position.x as f64,
            "petY": position.y as f64,
            "petPositionByMonitor": map,
        }),
    );
}

#[tauri::command]
pub fn open_home(app: AppHandle, base_url: Option<String>) -> Result<(), String> {
    let cfg = config_cmd::load_config(app.clone()).unwrap_or_default();
    let url = base_url
        .filter(|value| is_http_url(value))
        .unwrap_or_else(|| config_cmd::home_url_for(&cfg));
    if !is_http_url(&url) {
        return Err("当前后端没有可打开的主页地址".into());
    }
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|error| format!("无法打开主页: {error}"))
}

#[tauri::command]
pub fn show_chat_near_pet(app: AppHandle) -> Result<(), String> {
    persist_pet_geometry(&app);
    let pet = window_of(&app, "pet")?;
    let chat = window_of(&app, "chat")?;
    let pet_pos = pet
        .outer_position()
        .map_err(|error| format!("pet position: {error}"))?;
    let pet_size = pet
        .outer_size()
        .map_err(|error| format!("pet size: {error}"))?;
    let chat_size = chat
        .outer_size()
        .map_err(|error| format!("chat size: {error}"))?;
    let (work_x, work_y, work_w, work_h) = work_area_of(&pet);
    let (x, y) = chat_position(
        pet_pos.x,
        pet_pos.y,
        pet_size.width,
        pet_size.height,
        chat_size.width,
        chat_size.height,
        work_x,
        work_y,
        work_w,
        work_h,
    );
    chat.set_position(PhysicalPosition::new(x, y))
        .map_err(|error| format!("chat position: {error}"))?;
    chat.show().map_err(|error| format!("show chat: {error}"))?;
    let _ = chat.set_focus();
    let _ = app.emit("chat-shown", ());
    Ok(())
}

#[tauri::command]
pub fn hide_chat(app: AppHandle) -> Result<(), String> {
    window_of(&app, "chat")?
        .hide()
        .map_err(|error| format!("hide chat: {error}"))
}

#[tauri::command]
pub fn hide_pet(app: AppHandle) -> Result<(), String> {
    persist_pet_geometry(&app);
    window_of(&app, "pet")?
        .hide()
        .map_err(|error| format!("hide pet: {error}"))
}

#[tauri::command]
pub fn show_settings(app: AppHandle) -> Result<(), String> {
    let settings = window_of(&app, "settings")?;
    settings
        .show()
        .map_err(|error| format!("show settings: {error}"))?;
    let _ = settings.set_focus();
    Ok(())
}

#[tauri::command]
pub fn show_pet(app: AppHandle) -> Result<(), String> {
    let pet = window_of(&app, "pet")?;
    pet.show().map_err(|error| format!("show pet: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    persist_pet_geometry(&app);
    app.exit(0);
}

#[tauri::command]
pub fn reload_hotkeys(app: AppHandle) -> Result<(), String> {
    let cfg = config_cmd::load_config(app.clone()).unwrap_or_else(|_| AppConfig::default());
    let _ = app.global_shortcut().unregister_all();
    let pet_shortcut = cfg.shortcut_open_pet.clone();
    if !pet_shortcut.trim().is_empty() {
        let handle = app.clone();
        app.global_shortcut()
            .on_shortcut(pet_shortcut.as_str(), move |_, _, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = show_pet(handle.clone());
                }
            })
            .map_err(|error| format!("注册「打开小元」快捷键失败: {error}"))?;
    }
    let home_shortcut = cfg.shortcut_open_home.clone();
    if !home_shortcut.trim().is_empty() {
        let handle = app.clone();
        app.global_shortcut()
            .on_shortcut(home_shortcut.as_str(), move |_, _, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = open_home(handle.clone(), None);
                }
            })
            .map_err(|error| format!("注册「打开主页」快捷键失败: {error}"))?;
    }
    let chat_shortcut = cfg.shortcut_open_chat.clone();
    if !chat_shortcut.trim().is_empty() {
        let handle = app.clone();
        app.global_shortcut()
            .on_shortcut(chat_shortcut.as_str(), move |_, _, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = show_chat_near_pet(handle.clone());
                }
            })
            .map_err(|error| format!("注册「打开对话」快捷键失败: {error}"))?;
    }
    let click_shortcut = cfg.shortcut_toggle_click_through.clone();
    if !click_shortcut.trim().is_empty() {
        let handle = app.clone();
        app.global_shortcut()
            .on_shortcut(click_shortcut.as_str(), move |_, _, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = toggle_click_through(handle.clone());
                }
            })
            .map_err(|error| format!("注册「点击穿透」快捷键失败: {error}"))?;
    }
    let pomo_shortcut = cfg.shortcut_pomodoro.clone();
    if !pomo_shortcut.trim().is_empty() {
        let handle = app.clone();
        app.global_shortcut()
            .on_shortcut(pomo_shortcut.as_str(), move |_, _, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = handle.emit("pomodoro-toggle", ());
                }
            })
            .map_err(|error| format!("注册「番茄钟」快捷键失败: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn apply_pet_window(app: AppHandle) -> Result<(), String> {
    restore_pet_position(&app);
    Ok(())
}

#[tauri::command]
pub fn clamp_pet_to_work_area(app: AppHandle, snap: Option<bool>) -> Result<(), String> {
    let pet = window_of(&app, "pet")?;
    let pos = pet
        .outer_position()
        .map_err(|error| format!("pet position: {error}"))?;
    let size = pet
        .outer_size()
        .map_err(|error| format!("pet size: {error}"))?;
    let (work_x, work_y, work_w, work_h) = work_area_of(&pet);
    let cfg = config_cmd::load_config(app.clone()).unwrap_or_default();
    let do_snap = snap.unwrap_or(cfg.edge_snap);
    let (x, y) = clamp_pet_position(
        pos.x,
        pos.y,
        size.width,
        size.height,
        work_x,
        work_y,
        work_w,
        work_h,
        do_snap,
    );
    pet.set_position(PhysicalPosition::new(x, y))
        .map_err(|error| format!("clamp pet: {error}"))?;
    persist_pet_geometry(&app);
    Ok(())
}

#[tauri::command]
pub fn is_chat_visible(app: AppHandle) -> Result<bool, String> {
    window_of(&app, "chat")?
        .is_visible()
        .map_err(|error| format!("chat visible: {error}"))
}

#[tauri::command]
pub fn focus_chat(app: AppHandle) -> Result<(), String> {
    let chat = window_of(&app, "chat")?;
    if chat.is_visible().unwrap_or(false) {
        let _ = chat.set_focus();
        return Ok(());
    }
    show_chat_near_pet(app)
}

#[tauri::command]
pub fn set_pet_click_through(app: AppHandle, enabled: bool) -> Result<(), String> {
    let pet = window_of(&app, "pet")?;
    pet.set_ignore_cursor_events(enabled)
        .map_err(|error| format!("click-through: {error}"))?;
    let _ = config_cmd::patch_config(app.clone(), json!({ "clickThrough": enabled }));
    let _ = app.emit("config-updated", ());
    Ok(())
}

#[tauri::command]
pub fn toggle_click_through(app: AppHandle) -> Result<bool, String> {
    let cfg = config_cmd::load_config(app.clone()).unwrap_or_default();
    let next = !cfg.click_through;
    set_pet_click_through(app.clone(), next)?;
    let text = if next {
        "已开启点击穿透，可用快捷键或托盘关闭"
    } else {
        "已关闭点击穿透"
    };
    let _ = app.emit("pet-toast", json!({ "text": text, "tone": "info" }));
    Ok(next)
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    if enabled {
        launcher
            .enable()
            .map_err(|error| format!("无法开启开机启动: {error}"))?;
    } else {
        launcher
            .disable()
            .map_err(|error| format!("无法关闭开机启动: {error}"))?;
    }
    let _ = config_cmd::patch_config(app.clone(), json!({ "autostart": enabled }));
    launcher
        .is_enabled()
        .map_err(|error| format!("读取开机启动状态失败: {error}"))
}

#[tauri::command]
pub fn is_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| format!("读取开机启动状态失败: {error}"))
}
