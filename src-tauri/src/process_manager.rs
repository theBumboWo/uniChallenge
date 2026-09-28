/// Process manager — Req 8–11 (CLI provider subprocess management)
///
/// Handles spawning, communicating with, and killing provider subprocesses
/// (codex, claude, opencode serve, kiro-cli acp).
///
/// Uses tauri-plugin-shell for safe subprocess management with kill_children: true
/// to prevent orphaned processes on Windows crash (Risk #2 in design.md §10).
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Runtime};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BinaryInfo {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpawnResult {
    pub process_id: u32,
}

/// Check whether a named binary is available in PATH (used for provider discovery).
/// Returns found=false rather than erroring if not found (Req 7.3–7.4).
#[tauri::command]
pub async fn check_binary(name: String) -> BinaryInfo {
    // Use `where` on Windows or `which` equivalent
    let output = std::process::Command::new("where")
        .arg(&name)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let path = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();

            // Try to get version
            let version = get_version(&name);

            BinaryInfo {
                found: !path.is_empty(),
                path: if path.is_empty() { None } else { Some(path) },
                version,
            }
        }
        _ => BinaryInfo {
            found: false,
            path: None,
            version: None,
        },
    }
}

fn get_version(binary: &str) -> Option<String> {
    // Common version flags — try --version first, then -V
    for flag in &["--version", "-V", "version"] {
        if let Ok(out) = std::process::Command::new(binary).arg(flag).output() {
            if out.status.success() {
                let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !v.is_empty() {
                    return Some(v.lines().next().unwrap_or("").to_string());
                }
            }
        }
    }
    None
}

// ─── Process registry ─────────────────────────────────────────────────────────
// Phase 3 will add a proper async process registry.
// For Phase 0 we just expose the command stubs so the IPC contract is in place.

/// Spawn a provider subprocess (codex, claude, opencode, kiro-cli).
/// Phase 3 will implement the full subprocess management with stdout relay
/// to Tauri events (execution-event, process-stdout, process-exited).
#[tauri::command]
pub async fn spawn_provider_process<R: Runtime>(
    _app: tauri::AppHandle<R>,
    provider: String,
    args: Vec<String>,
    _env: HashMap<String, String>,
) -> Result<SpawnResult, String> {
    // Phase 0 stub — returns a placeholder process ID.
    // Phase 3 implementation will:
    // 1. Spawn the binary with tauri-plugin-shell (kill_children: true)
    // 2. Register stdout/stderr readers that emit "process-stdout" and "process-stderr" events
    // 3. Watch for process exit and emit "process-exited"
    log::info!("spawn_provider_process stub: provider={provider} args={args:?}");
    Ok(SpawnResult { process_id: 0 })
}

/// Send data to a subprocess's stdin (for ACP JSON-RPC communication with kiro-cli).
#[tauri::command]
pub async fn send_process_stdin(
    process_id: u32,
    data: String,
) -> Result<(), String> {
    // Phase 0 stub
    log::info!("send_process_stdin stub: pid={process_id} data_len={}", data.len());
    Ok(())
}

/// Kill a running provider subprocess (SIGTERM then SIGKILL after 3s for codex).
#[tauri::command]
pub async fn kill_provider_process(
    process_id: u32,
    signal: String,
) -> Result<(), String> {
    // Phase 0 stub — Phase 3 will implement real kill logic
    log::info!("kill_provider_process stub: pid={process_id} signal={signal}");
    Ok(())
}
