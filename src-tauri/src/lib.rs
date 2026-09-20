mod tray;
pub mod window_cmd;

pub mod activity_cmd;
pub mod config_cmd;
pub mod secrets_cmd;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            config_cmd::load_config,
            config_cmd::save_config,
            config_cmd::patch_config,
            secrets_cmd::get_secret,
            secrets_cmd::set_secret,
            secrets_cmd::delete_secret,
            secrets_cmd::import_gateway_json,
            window_cmd::open_home,
            window_cmd::show_chat_near_pet,
            window_cmd::hide_chat,
            window_cmd::hide_pet,
            window_cmd::show_settings,
            window_cmd::show_pet,
            window_cmd::quit_app,
            window_cmd::reload_hotkeys,
            window_cmd::apply_pet_window,
            window_cmd::clamp_pet_to_work_area,
            window_cmd::is_chat_visible,
            window_cmd::focus_chat,
            window_cmd::set_pet_click_through,
            window_cmd::toggle_click_through,
            window_cmd::set_autostart,
            window_cmd::is_autostart,
            activity_cmd::get_activity_snapshot,
        ])
        .setup(|app| {
            tray::setup(app.handle())?;
            window_cmd::restore_pet_position(app.handle());
            window_cmd::install_close_to_hide(app.handle());
            if let Err(error) = window_cmd::reload_hotkeys(app.handle().clone()) {
                eprintln!("[xyai-xiaoyuan] hotkeys: {error}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running XYAI精灵小元");
}
