// Whimsical Agent Village — Tauri backend library root
//
// Module structure matches design.md §3 component breakdown.
// Each module exposes Tauri commands invoked via invoke() from the frontend.

pub mod credentials;
pub mod persistence;
pub mod process_manager;
pub mod window;
pub mod paths;
pub mod notifications;

use tauri::Manager;

/// Registers all Tauri commands and plugins, then runs the app.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:whimsical-agent-village.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "initial_schema",
                        sql: include_str!("../migrations/001_initial_schema.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .setup(|app| {
            // Restore saved window position on startup (Req 1.9)
            window::restore_position(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Emit visibility change to frontend so rAF loop can pause (Req 1.3)
            tauri::WindowEvent::Focused(focused) => {
                let _ = window.emit("window-visibility-changed", *focused);
            }
            // Close to tray (Req 1.7) — Phase 1: always hide; Phase 1 full reads preference
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap_or(());
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            // Window (Req 1)
            window::set_always_on_top,
            window::minimize_to_tray,
            window::restore_window,
            window::get_window_position,
            // Credentials (Req 13) — keyring crate, never SQLite
            credentials::save_credential,
            credentials::get_credential,
            credentials::delete_credential,
            // Process management (Req 8–11)
            process_manager::check_binary,
            process_manager::spawn_provider_process,
            process_manager::kill_provider_process,
            process_manager::send_process_stdin,
            // Paths & dialogs
            paths::get_app_data_dir,
            // Notifications (Req 1.10)
            notifications::send_os_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
