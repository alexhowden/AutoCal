#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_opener::OpenerExt;

fn open_tab(app: &tauri::AppHandle, tab: &str) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        let _ = app.emit("navigate", tab);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let dashboard = MenuItem::with_id(app, "dashboard", "Dashboard", true, None::<&str>)?;
            let gcal = MenuItem::with_id(app, "gcal", "Open Google Calendar", true, None::<&str>)?;
            let quick_add = MenuItem::with_id(app, "quick_add", "Quick Add…", true, None::<&str>)?;
            let import = MenuItem::with_id(app, "import", "Import…", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit AutoCal", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &dashboard,
                    &gcal,
                    &PredefinedMenuItem::separator(app)?,
                    &quick_add,
                    &import,
                    &PredefinedMenuItem::separator(app)?,
                    &settings,
                    &quit,
                ],
            )?;

            TrayIconBuilder::with_id("autocal-tray")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "dashboard" => open_tab(app, "dashboard"),
                    "quick_add" => open_tab(app, "chat"),
                    "import" => open_tab(app, "import"),
                    "settings" => open_tab(app, "settings"),
                    "gcal" => {
                        let _ = app
                            .opener()
                            .open_url("https://calendar.google.com", None::<&str>);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running AutoCal");
}
