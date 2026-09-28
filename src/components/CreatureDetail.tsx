/**
 * Creature Detail panel — Req 5.1, 5.5
 *
 * Opens when user clicks a creature in the World.
 * Shows: name, current state, active task title + status,
 * configured provider/model, last 3 task summaries.
 * Updates within 200 ms of state change (driven by Zustand subscription).
 */

import { useAppStore } from "../store/appStore";
import type { CreatureId } from "../store/appStore";

interface Props {
  creatureId: CreatureId;
  onClose: () => void;
}

const CREATURE_ICON: Record<CreatureId, string> = {
  builder:    "⚙️",
  researcher: "🦉",
  debugger:   "🐛",
};

const STATE_LABEL: Record<string, string> = {
  idle:           "Idle",
  walking:        "Walking…",
  working:        "Working",
  sleeping:       "Sleeping",
  celebrating:    "Celebrating!",
  error_reaction: "Error",
  waiting:        "Waiting for approval",
  stretching:     "Stretching",
};

export default function CreatureDetail({ creatureId, onClose }: Props) {
  const creature = useAppStore((s) => s.creatures[creatureId]);
  const tasks = useAppStore((s) => s.tasks);
  const providers = useAppStore((s) => s.providers);

  const activeTask = creature.activeTaskId ? tasks[creature.activeTaskId] : null;

  // Last 3 completed/failed tasks for this creature
  const recentTasks = Object.values(tasks)
    .filter((t) => t.creatureId === creatureId && t.status !== "Running" && t.status !== "Queued")
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
    .slice(0, 3);

  const providerInfo = providers[creature.defaultProviderId];

  return (
    <div style={panelStyle} role="dialog" aria-label={`${creature.name} details`}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: "22px" }}>{CREATURE_ICON[creatureId]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            {creature.name}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            {STATE_LABEL[creature.animationState] ?? creature.animationState}
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
      </div>

      <div style={{ height: "1px", background: "var(--color-border)", margin: "0 12px" }} />

      {/* Active task */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Active task</div>
        {activeTask ? (
          <div>
            <div style={{ fontSize: "12px", color: "var(--color-text-primary)", fontWeight: 600 }}>
              {activeTask.title}
            </div>
            <StatusBadge status={activeTask.status} />
          </div>
        ) : (
          <div style={mutedStyle}>None</div>
        )}
      </div>

      {/* Provider */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Provider / Model</div>
        <div style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>
          {providerInfo?.available ? (
            <span style={{ color: "#5fcf7f" }}>●</span>
          ) : (
            <span style={{ color: "#cf7f7f" }}>●</span>
          )}{" "}
          {creature.defaultProviderId.replace("_", " ")}
          {creature.defaultModelId ? ` — ${creature.defaultModelId}` : ""}
        </div>
      </div>

      {/* Recent tasks */}
      {recentTasks.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Recent tasks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {recentTasks.map((t) => (
              <div key={t.id} style={recentTaskRowStyle}>
                <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}
                </span>
                <StatusBadge status={t.status} small />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const colours: Record<string, { bg: string; text: string }> = {
    Completed:           { bg: "rgba(80,200,100,0.15)", text: "#5fcf7f" },
    Failed:              { bg: "rgba(200,80,80,0.12)",  text: "#cf7f7f" },
    Cancelled:           { bg: "rgba(150,150,150,0.12)", text: "#9f9f9f" },
    Running:             { bg: "rgba(198,139,60,0.15)", text: "#c68b3c" },
    Waiting_For_Approval:{ bg: "rgba(200,160,60,0.15)", text: "#d0a040" },
    Queued:              { bg: "rgba(100,140,200,0.15)", text: "#7a9fcf" },
    Assigned:            { bg: "rgba(100,140,200,0.15)", text: "#7a9fcf" },
  };
  const c = colours[status] ?? { bg: "rgba(150,150,150,0.1)", text: "#9f9f9f" };
  return (
    <span style={{
      fontSize: small ? "9px" : "10px",
      padding: small ? "1px 5px" : "2px 7px",
      borderRadius: "99px",
      background: c.bg,
      color: c.text,
      marginTop: small ? 0 : "4px",
      display: "inline-block",
      fontWeight: 600,
    }}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background: "var(--color-bg-panel)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  width: "220px",
  overflow: "hidden",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};
const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px",
  padding: "12px 12px 10px",
};
const closeBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none",
  color: "var(--color-text-muted)", cursor: "pointer",
  fontSize: "12px", padding: "2px 4px", borderRadius: "4px",
};
const sectionStyle: React.CSSProperties = { padding: "8px 12px" };
const labelStyle: React.CSSProperties = {
  fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px",
};
const mutedStyle: React.CSSProperties = { fontSize: "11px", color: "var(--color-text-muted)", fontStyle: "italic" };
const recentTaskRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px",
  background: "var(--color-bg-overlay)",
  padding: "4px 6px", borderRadius: "var(--radius-sm)",
};
