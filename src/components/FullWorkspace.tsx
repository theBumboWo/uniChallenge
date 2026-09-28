/**
 * Full Workspace layout — Req 2.5, Req 2.6
 *
 * Contains: World scene (≥60% area, Phase 2 canvas), task submission panel,
 * execution output panel, task history list, settings panel.
 * Navigation control switches between panels in the sidebar.
 */

import { useState } from "react";
import { useAppStore } from "../store/appStore";
import Settings from "./Settings";
import WorldCanvas from "./WorldCanvas";

type SidePanel = "tasks" | "output" | "history" | "settings";

interface FullWorkspaceProps {
  onCollapse: () => void;
}

export default function FullWorkspace({ onCollapse }: FullWorkspaceProps) {
  const [activePanel, setActivePanel] = useState<SidePanel>("tasks");
  const tasks = useAppStore((s) => s.tasks);
  const providers = useAppStore((s) => s.providers);

  const availableCount = Object.values(providers).filter((p) => p.available).length;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg-glass)",
        overflow: "hidden",
      }}
    >
      {/* ── Title bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          height: "40px",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
          gap: "10px",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-amber)", letterSpacing: "0.05em" }}>
          🏚 Whimsical Agent Village
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          {availableCount}/5 providers
        </span>
        <button
          onClick={onCollapse}
          style={navBtnStyle}
          title="Collapse to pill"
          aria-label="Collapse to compact mode"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9 3L6 6L3 3M9 7L6 10L3 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Main body ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* World canvas area — ≥60% width (Req 2.6, Phase 2 renders here) */}
        <div
          style={{
            flex: "0 0 62%",
            position: "relative",
            background: "rgba(10,8,4,0.7)",
            borderRight: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        >
          <WorldCanvas compact={false} />
        </div>

        {/* Right sidebar */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Panel nav */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-border)",
              flexShrink: 0,
            }}
          >
            {(["tasks", "output", "history", "settings"] as SidePanel[]).map((p) => (
              <button
                key={p}
                onClick={() => setActivePanel(p)}
                style={{
                  ...tabBtnStyle,
                  borderBottom: activePanel === p ? "2px solid var(--color-amber)" : "2px solid transparent",
                  color: activePanel === p ? "var(--color-amber)" : "var(--color-text-muted)",
                }}
              >
                {p === "tasks" ? "Task" : p === "output" ? "Output" : p === "history" ? "History" : "Settings"}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
            {activePanel === "tasks" && <TaskPanel />}
            {activePanel === "output" && <OutputPanel />}
            {activePanel === "history" && <HistoryPanel tasks={Object.values(tasks)} />}
            {activePanel === "settings" && <Settings />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel stubs (Phase 3 will flesh these out) ────────────────────────────────

function TaskPanel() {
  return (
    <div>
      <p style={hintStyle}>
        Task submission form — Phase 3 (Req 6)
      </p>
      <p style={{ ...hintStyle, marginTop: "6px", fontSize: "11px" }}>
        Use <kbd style={kbdStyle}>Ctrl+Shift+N</kbd> to submit a task once implemented.
      </p>
    </div>
  );
}

function OutputPanel() {
  return (
    <div>
      <p style={hintStyle}>Execution output — Phase 3 (Req 6.7)</p>
    </div>
  );
}

function HistoryPanel({ tasks }: { tasks: ReturnType<typeof useAppStore>["tasks"] extends Record<string, infer T> ? T[] : never[] }) {
  if (tasks.length === 0) {
    return <p style={hintStyle}>No tasks yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {tasks.slice(0, 20).map((t) => (
        <div
          key={t.id}
          style={{
            padding: "8px 10px",
            background: "var(--color-bg-overlay)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)" }}>{t.title}</div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            {t.status} · {t.providerId}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  padding: "4px 6px",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
};

const tabBtnStyle: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  padding: "8px 4px",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  cursor: "pointer",
  textTransform: "uppercase" as const,
  transition: "color var(--transition-fast)",
};

const hintStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text-muted)",
  fontStyle: "italic",
};

const kbdStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid var(--color-border)",
  borderRadius: "3px",
  padding: "1px 5px",
  fontSize: "10px",
  fontFamily: "monospace",
  fontStyle: "normal",
};
