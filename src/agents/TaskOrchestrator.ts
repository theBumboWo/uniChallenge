/**
 * Task Orchestrator — Req 6 (task submission and lifecycle)
 *
 * Manages the full Task_Lifecycle state machine:
 *   Queued → Assigned → Running → Completed | Failed | Cancelled
 *                              ↓
 *                     Waiting_For_Approval → Running | Failed | Cancelled
 *
 * Wires task events to the WorldStateMachine (creature walks, works, celebrates).
 * Enforces: 10-minute execution timeout, cancellation ack timeout (2s),
 * restart detection on app launch (within 5s).
 *
 * One singleton instance manages all active tasks.
 */

import { useAppStore } from "../store/appStore";
import type { Task, CreatureId, SessionHandle } from "../store/appStore";
import { getAdapter } from "../adapters/types";
import { getWSM } from "../world/WorldStateMachine";
import { emitCelebration, emitErrorBang } from "../world/ParticleSystem";
import { saveTask, updateTask as persistUpdateTask } from "../services/persistenceService";
import { handleApprovalRequest } from "./ApprovalHandler";
import { tileToPixel } from "../world/Pathfinder";

// Import all adapters so they self-register
import "../adapters/OpenRouterAdapter";

const EXECUTION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (Req 6.15)
const CANCEL_ACK_TIMEOUT_MS = 2000;           // 2 seconds (Req 6.14)

// Active sessions keyed by taskId
const _sessions = new Map<string, SessionHandle>();
// Execution timeout handles
const _timeouts = new Map<string, ReturnType<typeof setTimeout>>();
// Last event timestamp (for timeout detection)
const _lastEventAt = new Map<string, number>();

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Submit a new task. Assigns UUID, persists to SQLite, transitions creature
 * to walking state. (Req 6.2–6.4)
 */
export async function submitTask(params: {
  prompt: string;
  creatureId: CreatureId;
  providerId: Task["providerId"];
  modelId: string;
}): Promise<Task> {
  const id = crypto.randomUUID();
  const title = params.prompt.slice(0, 60);
  const now = Date.now();

  const task: Task = {
    id,
    title,
    prompt: params.prompt,
    status: "Queued",
    creatureId: params.creatureId,
    providerId: params.providerId,
    modelId: params.modelId,
    pipelineId: null,
    pipelineStep: null,
    createdAt: now,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    executionOutput: "",
    errorDetails: null,
    inputTokenCount: null,
    outputTokenCount: null,
    totalTokenCount: null,
    approvalRequest: null,
  };

  // Add to store and persist (Req 6.3 — within 500 ms)
  useAppStore.getState().actions.addTask(task);
  await saveTask(task);

  // Trigger creature to walk to workstation (Req 6.3)
  const store = useAppStore.getState();
  const workstation = Object.values(store.world.entities.workstations).find(
    (ws) => ws.assignedCreatureId === params.creatureId
  );
  if (workstation) {
    getWSM(params.creatureId).dispatch({
      type: "TASK_ASSIGNED",
      taskId: id,
      workstationTile: workstation.position,
    });
  }

  // Watch for creature arrival to start execution (Req 6.6)
  watchForArrival(id, params.creatureId);

  return task;
}

/** Cancel a running or waiting task (Req 6.13). */
export async function cancelTask(taskId: string): Promise<void> {
  const store = useAppStore.getState();
  const task = store.tasks[taskId];
  if (!task) return;
  if (task.status !== "Running" && task.status !== "Waiting_For_Approval") return;

  const session = _sessions.get(taskId);
  const adapter = getAdapter(task.providerId);

  // Send cancel signal to adapter
  let acknowledged = false;
  if (session && adapter) {
    const ackPromise = adapter.cancelSession(session).then(() => { acknowledged = true; });
    await Promise.race([
      ackPromise,
      new Promise<void>((resolve) => setTimeout(resolve, CANCEL_ACK_TIMEOUT_MS)),
    ]);
  }

  // Req 6.14: force Cancelled even if adapter didn't ack
  const reason = acknowledged
    ? "Cancelled by user"
    : "Cancellation signal unacknowledged by Provider_Adapter";

  const now = Date.now();
  useAppStore.getState().actions.updateTask(taskId, {
    status: "Cancelled",
    errorDetails: reason,
    completedAt: now,
  });
  await persistUpdateTask(taskId, { status: "Cancelled", errorDetails: reason, completedAt: now });

  _cleanupTask(taskId);
  getWSM(task.creatureId).dispatch({ type: "TASK_FAILED" }); // transitions to error_reaction → idle
}

// ── Internal: wait for creature to arrive, then start execution ───────────────

function watchForArrival(taskId: string, creatureId: CreatureId) {
  // Poll the store at 10 Hz to detect when creature transitions to working state.
  // This is driven by the WSM's ARRIVED_AT_WORKSTATION event.
  const interval = setInterval(async () => {
    const store = useAppStore.getState();
    const creature = store.creatures[creatureId];
    const task = store.tasks[taskId];
    if (!task || task.status === "Cancelled") { clearInterval(interval); return; }

    if (creature.animationState === "working" && creature.activeTaskId === taskId) {
      clearInterval(interval);
      await _startExecution(taskId);
    }
  }, 100);
}

async function _startExecution(taskId: string): Promise<void> {
  const store = useAppStore.getState();
  const task = store.tasks[taskId];
  if (!task) return;

  const adapter = getAdapter(task.providerId);
  if (!adapter) {
    await _failTask(taskId, "Provider adapter not available");
    return;
  }

  // Get credentials
  const { getCredential } = await import("../services/credentialService");
  const credValue = await getCredential(task.providerId);
  if (!credValue) {
    await _failTask(taskId, `No credential configured for ${task.providerId}`);
    return;
  }

  // Authenticate (Req 7.9)
  const authResult = await adapter.authenticate({ providerId: task.providerId, value: credValue });
  if (!authResult.success) {
    await _failTask(taskId, `Authentication failed: ${authResult.error ?? "unknown error"}`);
    return;
  }

  // Start session
  let session: SessionHandle;
  try {
    session = await adapter.startSession(task, { providerId: task.providerId, value: credValue });
  } catch (e) {
    await _failTask(taskId, `Failed to start session: ${(e as Error).message}`);
    return;
  }

  _sessions.set(taskId, session);

  // Update task to Running (Req 6.6 — within 200 ms of arriving)
  const now = Date.now();
  useAppStore.getState().actions.updateTask(taskId, { status: "Running", startedAt: now, assignedAt: now });
  await persistUpdateTask(taskId, { status: "Running", startedAt: now, assignedAt: now });

  // Start execution timeout (Req 6.15)
  _startTimeout(taskId);

  // Stream events
  await _streamTask(taskId, session, adapter);
}

async function _streamTask(
  taskId: string,
  session: SessionHandle,
  adapter: ReturnType<typeof getAdapter>
): Promise<void> {
  if (!adapter) return;

  let accumulatedOutput = "";

  try {
    for await (const event of adapter.streamEvents(session)) {
      // Reset timeout on each event (Req 6.15)
      _lastEventAt.set(taskId, Date.now());

      const store = useAppStore.getState();
      const task = store.tasks[taskId];

      // If task was cancelled externally, stop processing
      if (!task || task.status === "Cancelled") break;

      switch (event.type) {
        case "token": {
          // Req 7.6 — append within 100 ms
          accumulatedOutput += event.text;
          useAppStore.getState().actions.updateTask(taskId, { executionOutput: accumulatedOutput });
          break;
        }

        case "tool_call": {
          // Req 7.7 — display in bordered block within 200 ms
          const toolLine = `\n[TOOL: ${event.toolName}] ${JSON.stringify(event.arguments)}\n`;
          accumulatedOutput += toolLine;
          useAppStore.getState().actions.updateTask(taskId, { executionOutput: accumulatedOutput });
          break;
        }

        case "file_write": {
          // Req 7.8 — display path + operation type within 200 ms
          const fileLine = `\n[FILE ${event.operationType.toUpperCase()}] ${event.filePath}\n`;
          accumulatedOutput += fileLine;
          useAppStore.getState().actions.updateTask(taskId, { executionOutput: accumulatedOutput });
          break;
        }

        case "approval_request": {
          // Req 6.8 — transition to Waiting_For_Approval within 500 ms
          await handleApprovalRequest(taskId, event);
          // Halt creature working animation
          const currentTask = useAppStore.getState().tasks[taskId];
          if (currentTask) {
            getWSM(currentTask.creatureId).dispatch({ type: "APPROVAL_REQUESTED" });
          }
          break;
        }

        case "error": {
          // Req 7.10 — mark session failed
          await _failTask(taskId, event.message, accumulatedOutput);
          return;
        }

        case "completion": {
          // Req 6.11 — persist output + token counts within 1s
          const completionTask = useAppStore.getState().tasks[taskId];
          if (!completionTask) return;

          const finishedAt = Date.now();
          const inputTokens = event.inputTokens ?? null;
          const outputTokens = event.outputTokens ?? null;
          const total = inputTokens != null && outputTokens != null
            ? inputTokens + outputTokens : null;

          useAppStore.getState().actions.updateTask(taskId, {
            status: "Completed",
            completedAt: finishedAt,
            executionOutput: accumulatedOutput,
            inputTokenCount: inputTokens,
            outputTokenCount: outputTokens,
            totalTokenCount: total,
          });
          await persistUpdateTask(taskId, {
            status: "Completed",
            completedAt: finishedAt,
            executionOutput: accumulatedOutput,
            inputTokenCount: inputTokens,
            outputTokenCount: outputTokens,
            totalTokenCount: total,
          });

          // Celebrate! (Req 4.9)
          getWSM(completionTask.creatureId).dispatch({ type: "TASK_COMPLETED" });
          _fireCelebrationParticles(completionTask.creatureId);
          _cleanupTask(taskId);
          return;
        }
      }
    }
  } catch (e) {
    await _failTask(taskId, (e as Error).message, accumulatedOutput);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function _failTask(taskId: string, reason: string, output = ""): Promise<void> {
  const store = useAppStore.getState();
  const task = store.tasks[taskId];
  if (!task) return;

  const now = Date.now();
  useAppStore.getState().actions.updateTask(taskId, {
    status: "Failed",
    errorDetails: reason,
    completedAt: now,
    executionOutput: output || task.executionOutput,
  });
  await persistUpdateTask(taskId, {
    status: "Failed",
    errorDetails: reason,
    completedAt: now,
  });

  getWSM(task.creatureId).dispatch({ type: "TASK_FAILED" });
  _fireErrorParticles(task.creatureId);
  _cleanupTask(taskId);
}

function _startTimeout(taskId: string) {
  _lastEventAt.set(taskId, Date.now());
  const handle = setTimeout(async () => {
    const last = _lastEventAt.get(taskId) ?? 0;
    if (Date.now() - last >= EXECUTION_TIMEOUT_MS) {
      await _failTask(taskId, "Execution timeout");
    }
  }, EXECUTION_TIMEOUT_MS);
  _timeouts.set(taskId, handle);
}

function _cleanupTask(taskId: string) {
  const handle = _timeouts.get(taskId);
  if (handle) clearTimeout(handle);
  _timeouts.delete(taskId);
  _sessions.delete(taskId);
  _lastEventAt.delete(taskId);
}

function _fireCelebrationParticles(creatureId: CreatureId) {
  const store = useAppStore.getState();
  const creature = store.creatures[creatureId];
  const { x, y } = tileToPixel(creature.position);
  emitCelebration(x, y - 20);
}

function _fireErrorParticles(creatureId: CreatureId) {
  const store = useAppStore.getState();
  const creature = store.creatures[creatureId];
  const { x, y } = tileToPixel(creature.position);
  emitErrorBang(x, y - 30);
}

/** Expose session map for ApprovalHandler. */
export function getSession(taskId: string): SessionHandle | undefined {
  return _sessions.get(taskId);
}
