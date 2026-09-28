/**
 * Compact Mode pill — Req 2.2, Req 1.6
 *
 * Floating pill ≤320×64px. Shows active creature thumbnail placeholder,
 * current state label, and abbreviated task title or "idle".
 * Draggable by mousedown on non-interactive regions.
 * Double-click opens Full Workspace (Req 2.5).
 */

import { useRef, useCallback } from "react";
import { useAppStore } from "../store/appStore";
import type { CreatureAnimationState } from "../store/appStore";

// State → emoji label mapping (placeholder until sprites are ready in Phase 2)
const STATE_LABEL: Record<CreatureAnimationState, string> = {
  idle: "Idle",
  walking: "Walking…",
  working: "Working…",
  sleeping: "Sleeping",
  celebrating: "Done! 🎉",
  error_reaction: "Error ⚠",
  waiting: "Waiting…",
  stretching: "Stretching",
};

// State → glyph for the tiny status dot
const STATE_COLOR: Record<CreatureAnimationState, string> = {
  idle: "var(--color-text-muted)",
  walking: "var(--color-amber)",
  working: "var(--color-amber-light)",
  sleeping: "#7a9fbf",
  celebrating: "#5fcf7f",
  error_reaction: "#e05050",
  waiting: "#e0a030",
  stretching: "var(--color-text-muted)",
};

interface CompactModeProps {
  onExpand: () => void;
}

export default function CompactMode({ onExpand }: CompactModeProps) {
  const builder = useAppStore((s) => s.creatures.builder);
  const tasks = useAppStore((s) => s.tasks);

  // Find the active task for the most-active creature
  const activeTask = builder.activeTaskId ? tasks[builder.activeTaskId] : null;
  const taskTitle = activeTask
    ? activeTask.title.slice(0, 28) + (activeTask.title.length > 28 ? "…" : "")
    : "idle";

  // ── Dragging (Req 1.6) ────────────────────────────────────────────────────
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't drag from buttons
    if ((e.target as HTMLElement).closest("button")) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: window.screenX,
      originY: window.screenY,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      // Move the Tauri window
      // Phase 1 stub: Tauri window.setCursorGrab / setPosition via IPC in Phase 1 full impl
      void dx; void dy;
    };

    const onMouseUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const onDoubleClick = useCallback(() => {
    onExpand();
  }, [onExpand]);

  return (
    <div
      ref={pillRef}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        // Req 2.2: ≤320×64px floating pill
        width: "320px",
        height: "64px",
        background: "var(--color-bg-glass)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-pill)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "0 16px",
        cursor: "grab",
        userSelect: "none",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        transition: "border-color var(--transition-fast)",
        position: "relative",
        overflow: "hidden",
      }}
      title="Double-click to open workspace"
    >
      {/* Creature thumbnail placeholder (Phase 2 replaces with sprite) */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "rgba(198,139,60,0.18)",
          border: "1.5px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          flexShrink: 0,
        }}
      >
        ⚙️
      </div>

      {/* Status text */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "2px",
          }}
        >
          {/* Status dot */}
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: STATE_COLOR[builder.animationState],
              flexShrink: 0,
              boxShadow: `0 0 6px ${STATE_COLOR[builder.animationState]}`,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {STATE_LABEL[builder.animationState]}
          </span>
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {taskTitle}
        </div>
      </div>

      {/* Expand button */}
      <button
        onClick={onExpand}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-text-muted)",
          cursor: "pointer",
          padding: "4px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "color var(--transition-fast)",
        }}
        onMouseEnter={(e) => ((e.currentTarget.style.color = "var(--color-amber)"))}
        onMouseLeave={(e) => ((e.currentTarget.style.color = "var(--color-text-muted)"))}
        title="Open workspace"
        aria-label="Open full workspace"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2h4M2 2v4M12 12H8M12 12V8M2 12h4M2 12V8M12 2H8M12 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Subtle amber shimmer on the left edge */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "3px",
          background: `linear-gradient(180deg, transparent, var(--color-amber), transparent)`,
          opacity: builder.animationState === "working" ? 0.8 : 0.3,
          transition: "opacity var(--transition-slow)",
        }}
      />
    </div>
  );
}
