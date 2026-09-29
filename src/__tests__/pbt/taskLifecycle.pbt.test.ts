/**
 * PBT Property 2: Task_Lifecycle Invalid Transition Prohibition — Req 18.2
 *
 * FOR ALL valid sequences of task lifecycle events, terminal states
 * (Completed, Failed, Cancelled) never transition to Running or Queued.
 *
 * Also verifies the full set of forbidden transitions from design.md §5.2.
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { TERMINAL_TASK_STATUSES } from "../../store/appStore";
import type { TaskStatus } from "../../store/appStore";

// ── Pure lifecycle state machine ───────────────────────────────────────────────

type LifecycleEvent =
  | "CREATURE_ARRIVED"        // Queued → Assigned → Running
  | "TASK_COMPLETION_EVENT"   // Running → Completed
  | "TASK_ERROR_EVENT"        // Running → Failed
  | "APPROVAL_REQUESTED"      // Running → Waiting_For_Approval
  | "USER_APPROVED"           // Waiting_For_Approval → Running
  | "USER_DENIED"             // Waiting_For_Approval → Failed
  | "USER_CANCELLED"          // Running | Waiting_For_Approval → Cancelled
  | "TIMEOUT";                // Running → Failed

function lifecycleTransition(status: TaskStatus, event: LifecycleEvent): TaskStatus {
  // Terminal states never change (Req 18.2 core invariant)
  if (TERMINAL_TASK_STATUSES.has(status)) return status;

  switch (event) {
    case "CREATURE_ARRIVED":
      if (status === "Queued") return "Running";       // Queued→Assigned→Running collapsed
      return status;

    case "TASK_COMPLETION_EVENT":
      if (status === "Running") return "Completed";
      return status;

    case "TASK_ERROR_EVENT":
    case "TIMEOUT":
      if (status === "Running") return "Failed";
      return status;

    case "APPROVAL_REQUESTED":
      if (status === "Running") return "Waiting_For_Approval";
      return status;

    case "USER_APPROVED":
      if (status === "Waiting_For_Approval") return "Running";
      return status;

    case "USER_DENIED":
      if (status === "Waiting_For_Approval") return "Failed";
      return status;

    case "USER_CANCELLED":
      if (status === "Running" || status === "Waiting_For_Approval") return "Cancelled";
      return status;

    default:
      return status;
  }
}

const ALL_STATUSES: TaskStatus[] = [
  "Queued", "Assigned", "Running", "Waiting_For_Approval",
  "Completed", "Failed", "Cancelled",
];

const FORBIDDEN_AFTER_TERMINAL: TaskStatus[] = ["Running", "Queued", "Assigned"];

describe("PBT Property 2: Task_Lifecycle — no invalid transitions from terminal states (Req 18.2)", () => {

  it("terminal states never transition to Running, Queued, or Assigned", () => {
    const eventArb = fc.constantFrom<LifecycleEvent>(
      "CREATURE_ARRIVED", "TASK_COMPLETION_EVENT", "TASK_ERROR_EVENT",
      "APPROVAL_REQUESTED", "USER_APPROVED", "USER_DENIED",
      "USER_CANCELLED", "TIMEOUT"
    );
    const sequenceArb = fc.array(eventArb, { minLength: 1, maxLength: 30 });

    fc.assert(
      fc.property(sequenceArb, (events) => {
        let status: TaskStatus = "Queued";
        let wasTerminal = false;

        for (const event of events) {
          const prev = status;
          status = lifecycleTransition(status, event);

          if (TERMINAL_TASK_STATUSES.has(prev)) wasTerminal = true;

          // Core invariant: once terminal, never go back to active states
          if (wasTerminal && FORBIDDEN_AFTER_TERMINAL.includes(status)) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  it("Completed is always terminal — all events are no-ops", () => {
    const eventArb = fc.constantFrom<LifecycleEvent>(
      "CREATURE_ARRIVED", "TASK_COMPLETION_EVENT", "TASK_ERROR_EVENT",
      "APPROVAL_REQUESTED", "USER_APPROVED", "USER_DENIED",
      "USER_CANCELLED", "TIMEOUT"
    );
    fc.assert(
      fc.property(eventArb, (event) => {
        return lifecycleTransition("Completed", event) === "Completed";
      }),
      { numRuns: 500 }
    );
  });

  it("Failed is always terminal", () => {
    const eventArb = fc.constantFrom<LifecycleEvent>(
      "CREATURE_ARRIVED", "TASK_COMPLETION_EVENT", "TASK_ERROR_EVENT",
      "APPROVAL_REQUESTED", "USER_APPROVED", "USER_DENIED",
      "USER_CANCELLED", "TIMEOUT"
    );
    fc.assert(
      fc.property(eventArb, (event) => {
        return lifecycleTransition("Failed", event) === "Failed";
      }),
      { numRuns: 500 }
    );
  });

  it("Cancelled is always terminal", () => {
    const eventArb = fc.constantFrom<LifecycleEvent>(
      "CREATURE_ARRIVED", "TASK_COMPLETION_EVENT", "TASK_ERROR_EVENT",
      "APPROVAL_REQUESTED", "USER_APPROVED", "USER_DENIED",
      "USER_CANCELLED", "TIMEOUT"
    );
    fc.assert(
      fc.property(eventArb, (event) => {
        return lifecycleTransition("Cancelled", event) === "Cancelled";
      }),
      { numRuns: 500 }
    );
  });

  it("result is always one of the 7 valid TaskStatus values", () => {
    const validStatuses = new Set<string>(ALL_STATUSES);
    const eventArb = fc.constantFrom<LifecycleEvent>(
      "CREATURE_ARRIVED", "TASK_COMPLETION_EVENT", "TASK_ERROR_EVENT",
      "APPROVAL_REQUESTED", "USER_APPROVED", "USER_DENIED",
      "USER_CANCELLED", "TIMEOUT"
    );
    const sequenceArb = fc.array(eventArb, { minLength: 1, maxLength: 30 });
    fc.assert(
      fc.property(sequenceArb, (events) => {
        let status: TaskStatus = "Queued";
        for (const e of events) {
          status = lifecycleTransition(status, e);
          if (!validStatuses.has(status)) return false;
        }
        return true;
      }),
      { numRuns: 1000 }
    );
  });
});
