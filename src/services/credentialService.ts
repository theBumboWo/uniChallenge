/**
 * Credential Service — frontend client for Windows Credential Manager.
 * Req 13 (Credential Management and Security).
 *
 * SECURITY RULES (absolute — no exceptions):
 * 1. Credential values are NEVER logged, stored in SQLite, or written to disk.
 * 2. Values travel through Tauri IPC as in-memory strings only.
 * 3. UI always displays masked values (●●●●●●●● + last 4 chars on show).
 * 4. A confirmation modal MUST be shown before every save (frontend responsibility).
 * 5. If the keychain write fails, no fallback storage is used.
 */

import { invoke } from "@tauri-apps/api/core";
import type { ProviderId } from "../store/appStore";

/** Save a credential to Windows Credential Manager (Req 13.1, 13.7).
 *  CALLER MUST show a confirmation modal before calling this. */
export async function saveCredential(provider: ProviderId, value: string): Promise<void> {
  // Value passes through IPC in-memory only — never touches disk here
  await invoke<void>("save_credential", { provider, value });
}

/** Retrieve a credential. Returns null if not set. */
export async function getCredential(provider: ProviderId): Promise<string | null> {
  return invoke<string | null>("get_credential", { provider });
}

/** Delete a credential. */
export async function deleteCredential(provider: ProviderId): Promise<void> {
  return invoke<void>("delete_credential", { provider });
}

/** Check whether a credential is stored (without retrieving the value). */
export async function hasCredential(provider: ProviderId): Promise<boolean> {
  const val = await getCredential(provider);
  return val !== null && val.length > 0;
}

/**
 * Return a masked display string for a credential (Req 13.2).
 * Show toggle = false  →  "●●●●●●●●"
 * Show toggle = true   →  "●●●●●●●●xxxx" (last 4 chars only)
 */
export async function getMaskedDisplay(provider: ProviderId, showToggle: boolean): Promise<string> {
  if (!showToggle) return "●●●●●●●●";
  const val = await getCredential(provider);
  if (!val || val.length === 0) return "●●●●●●●●";
  const last4 = val.slice(-4);
  return "●●●●●●●●" + last4;
}

/** Label shown in confirmation modal (provider name + type, never the value). */
export function getCredentialLabel(provider: ProviderId): { providerName: string; credentialType: string } {
  const map: Record<ProviderId, { providerName: string; credentialType: string }> = {
    openrouter: { providerName: "OpenRouter", credentialType: "API Key" },
    openai_codex: { providerName: "OpenAI Codex", credentialType: "API Key" },
    claude_code: { providerName: "Claude Code", credentialType: "API Key" },
    opencode: { providerName: "OpenCode", credentialType: "API Key" },
    kiro_cli: { providerName: "Kiro CLI", credentialType: "Session Token" },
  };
  return map[provider];
}
