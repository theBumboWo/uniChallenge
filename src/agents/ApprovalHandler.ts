/**
 * Approval Handler — Req 6.8–10, 5.6
 *
 * When a provider emits an ApprovalRequestEvent, this module:
 *  1. Updates the task to Waiting_For_Approval.
 *  2. Stores the ApprovalRequest on the task for WorkstationDetail to surface.
 *  3. Provides handleApprove / handleDeny which route back to the adapter.
 *  4. Both operations must complete within 500 ms (Req 6.9–10).
 */

import { useAppStore } from "../store/appStore";
import type { SessionHandle } from "../store/appStore";
import { getAdapter } from "../adapters/types";
import { updateTask } from "../services/persistenceService";
import type { ApprovalRequestEvent } from "../store/appStore";

export async function handleApprovalRequest(
  taskId: string,
  event: ApprovalRequestEvent
): Promise<void> {
  const store = useAppStore.getState();
  const task = store.tasks[taskId];
  if (!task) return;

  const approvalRequest = {
    actionDescription: event.actionDescription,
    affectedTarget: event.affectedTarget,
    requestedAt: Date.now(),
  };

  // Update in-memory store
  store.actions.updateTask(taskId, {
    status: "Waiting_For_Approval",
    approvalRequest,
  });

  // Persist status change
  await updateTask(taskId, { status: "Waiting_For_Approval" });
}

/** User approves — resume task (Req 6.9: within 500 ms). */
export async function handleApprove(
  taskId: string,
  session: SessionHandle
): Promise<void> {
  const store = useAppStore.getState();
  const task = store.tasks[taskId];
  if (!task || task.status !== "Waiting_For_Approval") return;

  // Resume task
  store.actions.updateTask(taskId, {
    status: "Running",
    approvalRequest: null,
  });

  // Notify adapter
  const adapter = getAdapter(task.providerId);
  if (adapter) {
    await adapter.sendApproval(session, true);
  }

  await updateTask(taskId, { status: "Running" });
}

/** User denies — fail task (Req 6.10: within 500 ms). */
export async function handleDeny(
  taskId: string,
  session: SessionHandle
): Promise<void> {
  const store = useAppStore.getState();
  const task = store.tasks[taskId];
  if (!task || task.status !== "Waiting_For_Approval") return;

  const now = Date.now();
  store.actions.updateTask(taskId, {
    status: "Failed",
    errorDetails: "Approval denied by user",
    completedAt: now,
    approvalRequest: null,
  });

  const adapter = getAdapter(task.providerId);
  if (adapter) {
    await adapter.sendApproval(session, false);
  }

  await updateTask(taskId, {
    status: "Failed",
    errorDetails: "Approval denied by user",
    completedAt: now,
  });
}
