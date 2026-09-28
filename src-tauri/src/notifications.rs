/// Desktop notifications — Req 1.10
///
/// Emits OS-level notifications when a Task transitions to
/// Completed, Failed, or Waiting_For_Approval.
use tauri::Runtime;

/// Send an OS notification. Only called when the user has enabled
/// desktop notifications in preferences (Req 1.10).
#[tauri::command]
pub async fn send_os_notification<R: Runtime>(
    app: tauri::AppHandle<R>,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("Failed to send notification: {e}"))
}
