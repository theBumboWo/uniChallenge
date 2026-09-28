/// Path utilities — provides app data directory to the frontend.
use tauri::{Manager, Runtime};

/// Return the platform app data directory path.
/// Frontend uses this to construct the SQLite DB path for display/export.
#[tauri::command]
pub async fn get_app_data_dir<R: Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}
