use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use crate::window_cmd;

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let open_pet = MenuItem::with_id(app, "open_pet", "打开小元", true, None::<&str>)?;
    let open_chat = MenuItem::with_id(app, "open_chat", "打开对话", true, None::<&str>)?;
    let open_home = MenuItem::with_id(app, "open_home", "打开主页", true, None::<&str>)?;
    let pomodoro = MenuItem::with_id(app, "pomodoro", "番茄钟：开始/暂停", true, None::<&str>)?;
    let skip_pomo =
        MenuItem::with_id(app, "pomodoro_skip", "番茄钟：下一阶段", true, None::<&str>)?;
    let pat = MenuItem::with_id(app, "pat", "拍一拍", true, None::<&str>)?;
    let feed = MenuItem::with_id(app, "feed", "喂食", true, None::<&str>)?;
    let click_through =
        MenuItem::with_id(app, "click_through", "切换点击穿透", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
    let check_updates = MenuItem::with_id(app, "check_updates", "检查更新", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open_pet,
            &open_chat,
            &open_home,
            &pomodoro,
            &skip_pomo,
            &pat,
            &feed,
            &click_through,
            &settings,
            &check_updates,
            &quit,
        ],
    )?;

    let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
        Image::from_bytes(include_bytes!("../icons/tray.png")).expect("tray icon")
    });

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("XYAI精灵小元")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_pet" => {
                let _ = window_cmd::show_pet(app.clone());
            }
            "open_chat" => {
                let _ = window_cmd::show_chat_near_pet(app.clone());
            }
            "open_home" => {
                let _ = window_cmd::open_home(app.clone(), None);
            }
            "pomodoro" => {
                let _ = app.emit("pomodoro-toggle", ());
            }
            "pomodoro_skip" => {
                let _ = app.emit("pomodoro-skip", ());
            }
            "pat" => {
                let _ = app.emit("companion-action", "pat");
            }
            "feed" => {
                let _ = app.emit("companion-action", "feed");
            }
            "click_through" => {
                let _ = window_cmd::toggle_click_through(app.clone());
            }
            "settings" => {
                let _ = window_cmd::show_settings(app.clone());
            }
            "check_updates" => {
                let _ = window_cmd::show_settings(app.clone());
                let _ = app.emit("check-updates", ());
            }
            "quit" => window_cmd::quit_app(app.clone()),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(pet) = app.get_webview_window("pet") {
                    if pet.is_visible().unwrap_or(false) {
                        let _ = window_cmd::show_chat_near_pet(app.clone());
                    } else {
                        let _ = window_cmd::show_pet(app.clone());
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}
