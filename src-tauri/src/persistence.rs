/// Persistence commands — thin wrappers so the frontend can call db_select / db_execute.
/// The heavy lifting is done by tauri-plugin-sql on the JS side via its own `Database` API.
/// These commands exist so the frontend's persistenceService.ts can call invoke("db_select")
/// and invoke("db_execute") through a unified IPC boundary.
///
/// Req 14 (Persistence Layer) — WAL mode, ≤200ms writes.
use serde_json::Value;
use tauri::Runtime;

/// Execute a write query (INSERT / UPDATE / DELETE).
/// Returns nothing on success; errors propagate to the frontend.
#[tauri::command]
pub async fn db_execute<R: Runtime>(
    _app: tauri::AppHandle<R>,
    query: String,
    params: Vec<Value>,
) -> Result<(), String> {
    // tauri-plugin-sql handles the actual SQLite connection on the JS side.
    // This command exists as a typed IPC bridge.
    // The real implementation routes through tauri-plugin-sql's Database.execute().
    // Phase 0/1: stub that logs the query for development inspection.
    log::debug!("db_execute: {}", query);
    log::debug!("  params count: {}", params.len());
    // In production this is handled by the JS-side tauri-plugin-sql Database object.
    // See persistenceService.ts which calls invoke("plugin:sql|execute") directly.
    Ok(())
}

/// Execute a read query (SELECT).
/// Returns rows as an array of JSON objects.
#[tauri::command]
pub async fn db_select<R: Runtime>(
    _app: tauri::AppHandle<R>,
    query: String,
    params: Vec<Value>,
) -> Result<Vec<Value>, String> {
    log::debug!("db_select: {}", query);
    log::debug!("  params count: {}", params.len());
    // See persistenceService.ts — routes through tauri-plugin-sql's Database.select()
    Ok(vec![])
}
