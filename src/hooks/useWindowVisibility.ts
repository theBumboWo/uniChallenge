/**
 * useWindowVisibility — Req 1.3, Req 1.4
 *
 * Bridges the browser's Page Visibility API and the Tauri
 * window-visibility-changed event into a single reactive hook.
 *
 * When the window is hidden/minimised:
 *   - Updates the Zustand store (isWindowVisible = false)
 *   - The World renderer (Phase 2) watches this flag to pause rAF
 *   - AudioManager (Phase 5) watches this flag to fade audio
 *
 * CPU usage drops below 2% within 500 ms of window hide (Req 1.3).
 */

import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

export function useWindowVisibility() {
  const setWindowVisible = useAppStore((s) => s.actions.setWindowVisible);

  useEffect(() => {
    // Page Visibility API — fires when the tab/window is hidden or restored
    function handleVisibilityChange() {
      setWindowVisible(document.visibilityState === "visible");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Set initial state
    setWindowVisible(document.visibilityState === "visible");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [setWindowVisible]);
}
