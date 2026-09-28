/// Window management commands — Req 1 (desktop runtime and application shell)
///
/// Handles: always-on-top, close-to-tray, multi-monitor position restore.
/// Phase 1 will flesh out the full persistence of window position.
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, Window};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
    pub monitor: Option<String>,
}

/// Toggle always-on-top for the main window (Req 1.5).
#[tauri::command]
pub async fn set_always_on_top<R: Runtime>(
    window: Window<R>,
    enabled: bool,
) -> Result<(), String> {
    window
        .set_always_on_top(enabled)
        .map_err(|e| format!("Failed to set always-on-top: {e}"))
}

/// Hide the window to the system tray (Req 1.7).
#[tauri::command]
pub async fn minimize_to_tray<R: Runtime>(window: Window<R>) -> Result<(), String> {
    window.hide().map_err(|e| format!("Failed to hide window: {e}"))
}

/// Show/restore the main window from tray.
#[tauri::command]
pub async fn restore_window<R: Runtime>(window: Window<R>) -> Result<(), String> {
    window.show().map_err(|e| format!("Failed to show window: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus window: {e}"))
}

/// Return current window position (for persistence on close).
#[tauri::command]
pub async fn get_window_position<R: Runtime>(
    window: Window<R>,
) -> Result<WindowPosition, String> {
    let pos = window
        .outer_position()
        .map_err(|e| format!("Failed to get window position: {e}"))?;
    Ok(WindowPosition {
        x: pos.x,
        y: pos.y,
        monitor: None, // Phase 1: resolve monitor identifier
    })
}

/// Called during app setup to restore the saved window position (Req 1.9).
/// Phase 1 will read position from SQLite UserPreferences.
pub fn restore_position<R: Runtime>(app: &mut tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Phase 1 implementation: query DB for saved window position and apply it.
    // For Phase 0 the window opens at its default position.
    let _ = app; // suppress unused warning
    Ok(())
}
