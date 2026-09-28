/**
 * Workstation Detail panel — Req 5.2, 5.5, 5.6
 *
 * Opens when user clicks a workstation.
 * Shows: assigned task (if any), live execution output stream,
 * pending approval request with Approve/Deny buttons, task history.
 * Updates within 200 ms of state change.
 * Approve/Deny propagates to provider adapter within 500 ms (Phase 3 wires).
 */

import { useAppStore } from "../store/appStore";
import type { WorkstationId, CreatureId } from "../store/appStore";

interface Props {
  workstationId: WorkstationId;
  onClose: () => void;
  onApprove?: (taskId: string) => void;
  onDeny?: (taskId: string) => void;
}

const WS_LABEL: Record<WorkstationId, { name: string; icon: string; creature: CreatureId }> = {
  workshop_bench:    { name: "Workshop Bench",   icon: "🔧", creature: "builder"    },
  library_desk:      { name: "Library Desk",     icon: "📚", creature: "researcher" },
  examination_table: { name: "Examination Table", icon: "🔬", creature: "debugger"  },
};

export default function WorkstationDetail({ workstationId, onClose, onApprove, onDeny }: Props) {
  const { name, icon, creature: creatureId } = WS_LABEL[workstationId];
  const creature = useAppStore((s) => s.creatures[creatureId]);
  const tasks = useAppStore((s) => s.tasks);

  const activeTask = creature.activeTaskId ? tasks[creature.activeTaskId] : null;
  const hasApproval = activeTask?.approvalRequest != null;

  // Recent task history for this workstation's creature
  const history = Object.values(tasks)
    .filter((t) => t.creatureId === creatureId)
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
    .slice(0, 5);

  return (
    <div style={panelStyle} role="dialog" aria-label={`${name} details`}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: "18px" }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)" }}>{name}</div>
          <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginTop: "1px" }}>
            {creature.name} · {creature.animationState}
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
      </div>

      <div style={dividerStyle} />

      {/* Active task output */}
      {activeTask ? (
        <>
          <div style={sectionStyle}>
            <div style={labelStyle}>Current task</div>
            <div style={{ fontSize: "12px", color: "var(--color-text-primary)", fontWeight: 600, marginBottom: "4px" }}>
              {activeTask.title}
            </div>
            <span style={statusBadgeStyle(activeTask.status)}>
              {activeTask.status.replace("_", " ")}
            </span>
          </div>

          {/* Execution output stream (Req 5.2) */}
          {activeTask.executionOutput.length > 0 && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Output</div>
              <pre style={outputStyle}>
                {activeTask.executionOutput.slice(-800)}
              </pre>
            </div>
          )}

          {/* Approval request (Req 5.6) */}
          {hasApproval && (
            <div style={{ ...sectionStyle, background: "rgba(200,140,40,0.08)", borderTop: "1px solid rgba(200,140,40,0.2)" }}>
              <div style={labelStyle}>Approval required</div>
              <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginBottom: "6px", lineHeight: 1.4 }}>
                <strong>{activeTask.approvalRequest!.actionDescription}</strong>
                <br />
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--color-text-muted)" }}>
                  {activeTask.approvalRequest!.affectedTarget}
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => onApprove?.(activeTask.id)}
                  style={approveBtnStyle}
                  aria-label="Approve action"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => onDeny?.(activeTask.id)}
                  style={denyBtnStyle}
                  aria-label="Deny action"
                >
                  ✗ Deny
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ ...sectionStyle }}>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            No active task.
          </div>
        </div>
      )}

      {/* Task history */}
      {history.length > 0 && (
        <>
          <div style={dividerStyle} />
          <div style={sectionStyle}>
            <div style={labelStyle}>History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {history.map((t) => (
                <div key={t.id} style={historyRowStyle}>
                  <span style={{ fontSize: "10px", color: "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title}
                  </span>
                  <span style={statusBadgeStyle(t.status, true)}>
                    {t.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const statusColours: Record<string, string> = {
  Completed: "#5fcf7f", Failed: "#cf7f7f", Cancelled: "#9f9f9f",
  Running: "#c68b3c", Waiting_For_Approval: "#d0a040",
  Queued: "#7a9fcf", Assigned: "#7a9fcf",
};

function statusBadgeStyle(status: string, small = false): React.CSSProperties {
  const colour = statusColours[status] ?? "#9f9f9f";
  return {
    display: "inline-block",
    fontSize: small ? "9px" : "10px",
    padding: small ? "1px 5px" : "2px 7px",
    borderRadius: "99px",
    background: colour + "22",
    color: colour,
    fontWeight: 600,
  };
}

const panelStyle: React.CSSProperties = {
  background: "var(--color-bg-panel)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  width: "260px",
  maxHeight: "480px",
  overflowY: "auto",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};
const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", padding: "12px 12px 10px",
};
const closeBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none",
  color: "var(--color-text-muted)", cursor: "pointer", fontSize: "12px", padding: "2px 4px",
};
const dividerStyle: React.CSSProperties = { height: "1px", background: "var(--color-border)", margin: "0 12px" };
const sectionStyle: React.CSSProperties = { padding: "8px 12px" };
const labelStyle: React.CSSProperties = {
  fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px",
};
const outputStyle: React.CSSProperties = {
  fontSize: "10px", fontFamily: "monospace", color: "var(--color-text-secondary)",
  background: "rgba(0,0,0,0.3)", borderRadius: "var(--radius-sm)",
  padding: "6px 8px", maxHeight: "120px", overflowY: "auto",
  whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
};
const approveBtnStyle: React.CSSProperties = {
  background: "rgba(80,200,100,0.15)", color: "#5fcf7f",
  border: "1px solid rgba(80,200,100,0.3)", borderRadius: "var(--radius-sm)",
  padding: "5px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
};
const denyBtnStyle: React.CSSProperties = {
  background: "rgba(200,80,80,0.12)", color: "#cf7f7f",
  border: "1px solid rgba(200,80,80,0.2)", borderRadius: "var(--radius-sm)",
  padding: "5px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
};
const historyRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px",
  background: "var(--color-bg-overlay)", padding: "3px 6px", borderRadius: "var(--radius-sm)",
};
