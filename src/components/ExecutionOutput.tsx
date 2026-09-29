/**
 * Execution Output Panel — Req 6.7, 7.6, 7.7, 7.8
 *
 * Live-streaming token output, tool_call bordered blocks, file_write lines.
 * Cancel button (Req 6.13). Auto-scrolls to bottom on new tokens.
 * Tokens appended within 100 ms, tool_call/file_write within 200 ms
 * (ensured by Zustand subscription — React renders within one frame).
 */

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../store/appStore";
import { cancelTask } from "../agents/TaskOrchestrator";

/** Parse accumulated executionOutput into typed segments for rendering. */
type Segment =
  | { kind: "token"; text: string }
  | { kind: "tool_call"; raw: string }
  | { kind: "file_write"; raw: string };

function parseOutput(raw: string): Segment[] {
  const segments: Segment[] = [];
  // Split on [TOOL: ...] and [FILE ...] markers written by TaskOrchestrator
  const parts = raw.split(/(\[TOOL:.*?\].*?\n|\[FILE (?:CREATE|MODIFY|DELETE)\].*?\n)/s);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("[TOOL:")) {
      segments.push({ kind: "tool_call", raw: part.trim() });
    } else if (part.startsWith("[FILE ")) {
      segments.push({ kind: "file_write", raw: part.trim() });
    } else {
      segments.push({ kind: "token", text: part });
    }
  }
  return segments;
}

interface Props {
  taskId?: string; // If provided, shows that specific task; otherwise shows most recent Running task
}

export default function ExecutionOutput({ taskId: explicitTaskId }: Props) {
  const tasks = useAppStore((s) => s.tasks);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find target task
  const task = (() => {
    if (explicitTaskId) return tasks[explicitTaskId] ?? null;
    // Show most recently started running task
    const running = Object.values(tasks)
      .filter((t) => t.status === "Running" || t.status === "Waiting_For_Approval")
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    return running[0] ?? null;
  })();

  // Auto-scroll to bottom on new output (Req 6.7)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [task?.executionOutput]);

  const handleCancel = useCallback(async () => {
    if (task) await cancelTask(task.id);
  }, [task]);

  if (!task) {
    return (
      <div style={emptyStyle}>
        <p style={{ color: "var(--color-text-muted)", fontSize: "12px", fontStyle: "italic" }}>
          No active execution. Submit a task to get started.
        </p>
      </div>
    );
  }

  const segments = parseOutput(task.executionOutput);
  const isActive = task.status === "Running" || task.status === "Waiting_For_Approval";
  const isWaiting = task.status === "Waiting_For_Approval";

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
            <StatusDot status={task.status} />
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
              {task.status.replace(/_/g, " ")} · {task.providerId.replace(/_/g, " ")}
            </span>
            {task.totalTokenCount != null && (
              <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                · {task.totalTokenCount.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>

        {/* Cancel button (Req 6.13) */}
        {isActive && (
          <button
            onClick={handleCancel}
            style={cancelBtnStyle}
            aria-label="Cancel task"
          >
            ✕ Cancel
          </button>
        )}
      </div>

      {/* Waiting for approval banner */}
      {isWaiting && task.approvalRequest && (
        <div style={approvalBannerStyle}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#d0a040" }}>⏳ Approval required</span>
          <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginLeft: "8px" }}>
            {task.approvalRequest.actionDescription}
          </span>
          <code style={{ fontSize: "10px", color: "var(--color-text-muted)", display: "block", marginTop: "2px" }}>
            {task.approvalRequest.affectedTarget}
          </code>
        </div>
      )}

      {/* Output stream */}
      <div ref={scrollRef} style={outputContainerStyle}>
        {segments.length === 0 && isActive && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "11px", fontStyle: "italic" }}>
            Waiting for output…
          </span>
        )}
        {segments.map((seg, i) => {
          if (seg.kind === "token") {
            return (
              <span key={i} style={tokenStyle}>
                {seg.text}
              </span>
            );
          }
          if (seg.kind === "tool_call") {
            return (
              // Req 7.7 — bordered block distinct from token output
              <div key={i} style={toolCallStyle}>
                {seg.raw}
              </div>
            );
          }
          // file_write (Req 7.8 — path + operation type)
          return (
            <div key={i} style={fileWriteStyle}>
              {seg.raw}
            </div>
          );
        })}
        {/* Cursor blink while running */}
        {task.status === "Running" && <span style={cursorStyle}>▋</span>}
      </div>

      {/* Footer: error details */}
      {task.status === "Failed" && task.errorDetails && (
        <div style={errorFooterStyle}>
          ⚠ {task.errorDetails}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colours: Record<string, string> = {
    Running: "#c68b3c", Waiting_For_Approval: "#d0a040",
    Completed: "#5fcf7f", Failed: "#cf7f7f",
    Cancelled: "#9f9f9f", Queued: "#7a9fcf", Assigned: "#7a9fcf",
  };
  const c = colours[status] ?? "#9f9f9f";
  return (
    <span style={{
      width: "6px", height: "6px", borderRadius: "50%",
      background: c, display: "inline-block", flexShrink: 0,
      boxShadow: status === "Running" ? `0 0 5px ${c}` : "none",
    }} />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "0",
  height: "100%", overflow: "hidden",
};
const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: "8px",
  padding: "0 0 8px", borderBottom: "1px solid var(--color-border)",
  flexShrink: 0,
};
const cancelBtnStyle: React.CSSProperties = {
  background: "rgba(200,80,80,0.1)", color: "#cf7f7f",
  border: "1px solid rgba(200,80,80,0.2)", borderRadius: "var(--radius-sm)",
  padding: "3px 9px", fontSize: "10px", fontWeight: 700,
  cursor: "pointer", flexShrink: 0,
};
const approvalBannerStyle: React.CSSProperties = {
  background: "rgba(200,140,40,0.08)", border: "1px solid rgba(200,140,40,0.2)",
  borderRadius: "var(--radius-sm)", padding: "6px 10px", marginTop: "6px", flexShrink: 0,
};
const outputContainerStyle: React.CSSProperties = {
  flex: 1, overflow: "auto", marginTop: "8px",
  fontFamily: "monospace", fontSize: "11px", lineHeight: 1.6,
  color: "var(--color-text-secondary)",
  background: "rgba(0,0,0,0.25)", borderRadius: "var(--radius-sm)",
  padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word",
};
const tokenStyle: React.CSSProperties = { color: "var(--color-text-secondary)" };
const toolCallStyle: React.CSSProperties = {
  // Req 7.7: visually distinct bordered block
  display: "block", margin: "6px 0",
  background: "rgba(198,139,60,0.08)", border: "1px solid rgba(198,139,60,0.25)",
  borderRadius: "4px", padding: "4px 8px",
  color: "var(--color-amber)", fontSize: "10px",
};
const fileWriteStyle: React.CSSProperties = {
  // Req 7.8: file path + operation type
  display: "block", margin: "4px 0",
  background: "rgba(100,140,200,0.08)", border: "1px solid rgba(100,140,200,0.2)",
  borderRadius: "4px", padding: "3px 8px",
  color: "#7a9fcf", fontSize: "10px",
};
const cursorStyle: React.CSSProperties = {
  display: "inline-block", animation: "blink 1s step-end infinite",
  color: "var(--color-amber)",
};
const errorFooterStyle: React.CSSProperties = {
  fontSize: "10px", color: "#cf7f7f", padding: "6px 0 0",
  borderTop: "1px solid rgba(200,80,80,0.15)", marginTop: "4px", flexShrink: 0,
};
const emptyStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  height: "100%",
};
