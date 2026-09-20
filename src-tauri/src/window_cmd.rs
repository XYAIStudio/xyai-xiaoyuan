use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_opener::OpenerExt;

use crate::config_cmd::{self, AppConfig};

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
        let _ = window.on_window_event(move |event| {
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
    if let (Some(x), Some(y)) = (cfg.pet_x, cfg.pet_y) {
        let _ = pet.set_position(PhysicalPosition::new(x as i32, y as i32));
    }
    let size = cfg.pet_size.clamp(80.0, 224.0) as u32;
    let _ = pet.set_size(PhysicalSize::new(size, size));
}

fn persist_pet_geometry(app: &AppHandle) {
    let Some(pet) = app.get_webview_window("pet") else {
        return;
    };
    let Ok(position) = pet.outer_position() else {
        return;
    };
    let _ = config_cmd::patch_config(
        app.clone(),
        serde_json::json!({
            "petX": position.x as f64,
            "petY": position.y as f64,
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
    let (work_x, work_y, work_w, work_h) = match pet.current_monitor() {
        Ok(Some(monitor)) => {
            let pos = monitor.position();
            let size = monitor.size();
            (pos.x, pos.y, size.width, size.height)
        }
        _ => (0, 0, 1920, 1080),
    };
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
    Ok(())
}
