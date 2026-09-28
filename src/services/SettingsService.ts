/**
 * Settings Service — loads UserPreferences from SQLite at startup,
 * provides reactive access via Zustand, and persists changes.
 * Req 17 (Settings and Configuration).
 */

import { invoke } from "@tauri-apps/api/core";
import { useAppStore, DEFAULT_PREFERENCES } from "../store/appStore";
import type { UserPreferences } from "../store/appStore";
import { getAllPreferences, saveAllPreferences, savePreference } from "./persistenceService";

/** Load all preferences from SQLite and hydrate the Zustand store.
 *  Called once at app startup (Req 17.6 — apply immediately). */
export async function loadPreferences(): Promise<void> {
  const raw = await getAllPreferences();
  const prefs: UserPreferences = { ...DEFAULT_PREFERENCES };

  // Parse stored key/value strings back to typed values
  if (raw["alwaysOnTop"] !== undefined) prefs.alwaysOnTop = raw["alwaysOnTop"] === "true";
  if (raw["startInCompactMode"] !== undefined) prefs.startInCompactMode = raw["startInCompactMode"] === "true";
  if (raw["reducedMotion"] !== undefined) prefs.reducedMotion = raw["reducedMotion"] === "true";
  if (raw["closeToTray"] !== undefined) prefs.closeToTray = raw["closeToTray"] === "true";
  if (raw["desktopNotificationsEnabled"] !== undefined) prefs.desktopNotificationsEnabled = raw["desktopNotificationsEnabled"] === "true";
  if (raw["audioEnabled"] !== undefined) prefs.audioEnabled = raw["audioEnabled"] === "true";
  if (raw["audioVolumeAmbient"] !== undefined) prefs.audioVolumeAmbient = parseFloat(raw["audioVolumeAmbient"]);
  if (raw["audioVolumeCreature"] !== undefined) prefs.audioVolumeCreature = parseFloat(raw["audioVolumeCreature"]);
  if (raw["audioVolumeEvent"] !== undefined) prefs.audioVolumeEvent = parseFloat(raw["audioVolumeEvent"]);
  if (raw["historyRetentionDays"] !== undefined) prefs.historyRetentionDays = parseInt(raw["historyRetentionDays"], 10);
  if (raw["defaultWorkspacePath"] !== undefined) prefs.defaultWorkspacePath = raw["defaultWorkspacePath"];
  if (raw["windowMonitor"] !== undefined) prefs.windowMonitor = raw["windowMonitor"] ? parseInt(raw["windowMonitor"], 10) : null;
  if (raw["windowX"] !== undefined) prefs.windowX = raw["windowX"] ? parseInt(raw["windowX"], 10) : null;
  if (raw["windowY"] !== undefined) prefs.windowY = raw["windowY"] ? parseInt(raw["windowY"], 10) : null;

  useAppStore.getState().actions.updatePreferences(prefs);
}

/** Persist a single preference change and apply it immediately (Req 17.6). */
export async function applyPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): Promise<void> {
  // Update store immediately
  useAppStore.getState().actions.updatePreferences({ [key]: value } as Partial<UserPreferences>);

  // Persist to SQLite
  await savePreference(key, String(value));

  // Apply side effects that don't require window re-init
  if (key === "audioEnabled" || key === "audioVolumeAmbient" || key === "audioVolumeCreature" || key === "audioVolumeEvent") {
    // AudioManager will react to store change — no extra action needed
  }

  // Window config changes require re-init (Req 17.6)
  if (key === "alwaysOnTop") {
    await invoke("set_always_on_top", { enabled: value as boolean });
  }
}

/** Save all preferences at once (e.g. on settings panel close). */
export async function saveSettings(prefs: UserPreferences): Promise<void> {
  useAppStore.getState().actions.updatePreferences(prefs);
  await saveAllPreferences(prefs);
  // Apply window-level settings
  await invoke("set_always_on_top", { enabled: prefs.alwaysOnTop });
}

/** Restore the saved window position on startup (Req 1.9). */
export async function restoreWindowPosition(): Promise<void> {
  const prefs = useAppStore.getState().preferences;
  if (prefs.windowX !== null && prefs.windowY !== null) {
    // Tauri window position is set in Rust setup(); frontend just reads it
    // Phase 1 stub — full implementation uses window.setPosition in Tauri
  }
}
