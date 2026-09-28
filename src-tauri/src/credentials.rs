/// Credential management — Req 13 (security rules, absolute)
///
/// ALL credentials are stored EXCLUSIVELY in Windows Credential Manager
/// via the `keyring` crate. They are NEVER written to SQLite, disk files,
/// or environment variables. They are NEVER logged.
///
/// Credential values are passed to the frontend as in-memory strings
/// through Tauri IPC only — never serialised to disk as part of the call.
use tauri::Runtime;

/// Service name prefix used for all keyring entries.
const SERVICE_PREFIX: &str = "whimsical-agent-village";

fn service_name(provider: &str) -> String {
    format!("{SERVICE_PREFIX}/{provider}")
}

/// Save a credential to Windows Credential Manager (Req 13.1, 13.7).
///
/// The frontend must show a confirmation modal BEFORE calling this command.
/// If the keychain write fails, returns an error — no fallback storage (Req 13.8).
///
/// SECURITY: The `value` parameter MUST NOT be logged anywhere in this function.
#[tauri::command]
pub async fn save_credential<R: Runtime>(
    _app: tauri::AppHandle<R>,
    provider: String,
    value: String,
) -> Result<(), String> {
    let entry = keyring::Entry::new(&service_name(&provider), &provider)
        .map_err(|e| format!("Keyring init error for provider {provider}: {e}"))?;

    entry
        .set_password(&value)
        .map_err(|_e| {
            // SECURITY: do NOT include the credential value or raw error details
            // that might contain it in the message returned to the frontend.
            format!("Failed to save credential for provider '{provider}' to OS keychain. [REDACTED]")
        })?;

    log::info!("Credential saved for provider '{provider}' (value: [REDACTED])");
    Ok(())
}

/// Retrieve a credential from Windows Credential Manager (Req 13.4).
///
/// Returns the raw string value in-memory — frontend must handle it securely
/// and MUST NOT log it.
#[tauri::command]
pub async fn get_credential<R: Runtime>(
    _app: tauri::AppHandle<R>,
    provider: String,
) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(&service_name(&provider), &provider)
        .map_err(|e| format!("Keyring init error for provider {provider}: {e}"))?;

    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_e) => {
            log::warn!("Failed to retrieve credential for provider '{provider}' (value: [REDACTED])");
            Ok(None)
        }
    }
}

/// Delete a credential from Windows Credential Manager.
#[tauri::command]
pub async fn delete_credential<R: Runtime>(
    _app: tauri::AppHandle<R>,
    provider: String,
) -> Result<(), String> {
    let entry = keyring::Entry::new(&service_name(&provider), &provider)
        .map_err(|e| format!("Keyring init error for provider {provider}: {e}"))?;

    match entry.delete_credential() {
        Ok(()) => {
            log::info!("Credential deleted for provider '{provider}'");
            Ok(())
        }
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone — not an error
        Err(e) => Err(format!("Failed to delete credential for provider '{provider}': {e}")),
    }
}
