use tauri::{
  menu::{Menu, MenuItem},
  tray::{TrayIconBuilder, TrayIconEvent},
  Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec!["--minimized"]),
    ))
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if let Some(icon) = app.default_window_icon() {
        let show = MenuItem::with_id(app, "tray-show", "Show Study Dashboard", true, None::<&str>)?;
        let pause = MenuItem::with_id(app, "tray-pause", "Pause timer", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "tray-quit", "Quit", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show, &pause, &quit])?;

        let _tray = TrayIconBuilder::with_id("study-tray")
          .icon(icon.clone())
          .tooltip("Study Dashboard")
          .menu(&menu)
          .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-show" => {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
              }
            }
            "tray-pause" => {
              let _ = app.emit("desktop-timer-toggle", ());
            }
            "tray-quit" => {
              app.exit(0);
            }
            _ => {}
          })
          .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { .. } = event {
              let app = tray.app_handle();
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
          })
          .build(app)?;
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
