#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    net::TcpStream,
    path::Path,
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;
#[cfg(not(debug_assertions))]
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

// the repo this app was compiled from - the python backend runs out of it.
// if the repo ever moves, rebuilding the app re-points this
const REPO: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");

struct Backend(Mutex<Option<Child>>);

fn spawn_backend() -> Option<Child> {
    // something is already serving (dev stack or an earlier instance) - use it
    if TcpStream::connect(("127.0.0.1", 8787)).is_ok() {
        return None;
    }
    let repo = Path::new(REPO);
    let log = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(repo.join("data").join("backend.log"))
        .ok()?;
    let err = log.try_clone().ok()?;
    Command::new(repo.join("venv/bin/python"))
        .args(["-m", "uvicorn", "src.server:app", "--host", "127.0.0.1", "--port", "8787"])
        .current_dir(repo)
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(err))
        .spawn()
        .ok()
}

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
            app.manage(Backend(Mutex::new(spawn_backend())));

            // a launch-at-login entry registered by an older binary points at a
            // stale path - re-registering from the running app heals it. dev
            // builds skip this so they never hijack the entry
            #[cfg(not(debug_assertions))]
            {
                let auto = app.autolaunch();
                if auto.is_enabled().unwrap_or(false) {
                    let _ = auto.enable();
                }
            }

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
        .build(tauri::generate_context!())
        .expect("error while building AutoCal")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                // only reaps a backend this instance spawned - a shared dev
                // backend (port already bound at startup) is left alone
                if let Some(backend) = app.try_state::<Backend>() {
                    if let Some(child) = backend.0.lock().unwrap().as_mut() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
