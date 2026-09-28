/**
 * App root — display mode routing + startup initialisation.
 * Req 1 (desktop shell), Req 2.1/2.5 (mode switching), Req 6.16 (orphan detection),
 * Req 7.3 (provider discovery on startup).
 */

import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "./store/appStore";
import type { ProviderId } from "./store/appStore";
import { loadPreferences } from "./services/SettingsService";
import { detectOrphanedTasks } from "./services/persistenceService";
import CompactMode from "./components/CompactMode";
import FullWorkspace from "./components/FullWorkspace";
import { useWindowVisibility } from "./hooks/useWindowVisibility";

// Provider binary names for discovery (Req 7.3)
const PROVIDER_BINARIES: Record<ProviderId, string> = {
  openrouter: "", // No binary — just needs an API key
  openai_codex: "codex",
  claude_code: "claude",
  opencode: "opencode",
  kiro_cli: "kiro-cli",
};

export default function App() {
  const displayMode = useAppStore((s) => s.ui.displayMode);
  const preferences = useAppStore((s) => s.preferences);
  const { setDisplayMode, setProviderInfo, setWindowVisible, updateTask } = useAppStore(
    (s) => s.actions
  );

  // Req 1.3 — pause animations when window hidden
  useWindowVisibility();

  // ── Startup initialisation ─────────────────────────────────────────────────

  useEffect(() => {
    let unlistenVisibility: (() => void) | undefined;

    async function init() {
      // 1. Load preferences from SQLite → Zustand (Req 17.6)
      try {
        await loadPreferences();
      } catch {
        // DB may not be ready yet on very first launch — use defaults
      }

      // Re-read startInCompactMode after loading
      const { startInCompactMode } = useAppStore.getState().preferences;
      if (startInCompactMode) {
        setDisplayMode("compact");
      }

      // 2. Detect orphaned tasks from last session (Req 6.16 — within 5s of launch)
      try {
        const orphanIds = await detectOrphanedTasks();
        for (const id of orphanIds) {
          updateTask(id, {
            status: "Failed",
            errorDetails: "Application shutdown during execution",
            completedAt: Date.now(),
          });
        }
      } catch {
        // Non-fatal — DB may not have any tasks
      }

      // 3. Run provider discovery concurrently (Req 7.3 — all 5 within 5s)
      const discoveryPromises = (Object.entries(PROVIDER_BINARIES) as [ProviderId, string][]).map(
        async ([providerId, binaryName]) => {
          try {
            if (providerId === "openrouter") {
              // OpenRouter needs only an API key — mark as "needs key" but not unavailable yet;
              // actual availability is checked when the user enters a key
              setProviderInfo({
                providerId,
                available: false,
                unavailableReason: "API key required — enter in Settings",
                version: null,
              });
              return;
            }

            const result = await invoke<{ found: boolean; path: string | null; version: string | null }>(
              "check_binary",
              { name: binaryName }
            );

            setProviderInfo({
              providerId,
              available: result.found,
              unavailableReason: result.found
                ? null
                : `${binaryName} not found in PATH`,
              version: result.version,
            });
          } catch {
            setProviderInfo({
              providerId,
              available: false,
              unavailableReason: "Discovery failed",
              version: null,
            });
          }
        }
      );

      // Run all discoveries concurrently, cap at 5 seconds (Req 7.3)
      await Promise.race([
        Promise.allSettled(discoveryPromises),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);

      // 4. Listen for window visibility changes from Tauri backend (Req 1.3)
      unlistenVisibility = await listen<boolean>("window-visibility-changed", ({ payload }) => {
        setWindowVisible(payload);
      });
    }

    void init();

    // Keyboard shortcut: Ctrl+Shift+N → open task form (Req 6.1)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setDisplayMode("full_workspace");
        // Phase 3 will also open the task form panel here
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unlistenVisibility?.();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mode switch handlers ───────────────────────────────────────────────────

  const handleExpand = useCallback(() => {
    setDisplayMode("full_workspace");
  }, [setDisplayMode]);

  const handleCollapse = useCallback(() => {
    setDisplayMode("compact");
  }, [setDisplayMode]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Full Workspace: fill the Tauri window
  if (displayMode === "full_workspace") {
    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <FullWorkspace onCollapse={handleCollapse} />
      </div>
    );
  }

  // Compact Mode: centre the pill in the transparent window
  // (Phase 1: Tauri window will be resized to pill dimensions in full impl;
  //  for now the pill is centred in the current window)
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12px",
      }}
    >
      <CompactMode onExpand={handleExpand} />
    </div>
  );
}
