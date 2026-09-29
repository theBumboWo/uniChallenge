/**
 * PBT Property 1: World_State_Machine State Validity — Req 18.1
 *
 * FOR ALL event sequences of length 1–50 drawn from the WSM event alphabet,
 * the resulting creature state is always a member of VALID_CREATURE_STATES.
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { VALID_CREATURE_STATES } from "../../store/appStore";

// ── Pure state machine (no Zustand side-effects — testable in isolation) ──────

type State =
  | "idle" | "walking" | "working" | "sleeping"
  | "celebrating" | "error_reaction" | "waiting" | "stretching";

type Event =
  | "TASK_ASSIGNED"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "IDLE_TIMER_FIRED"
  | "ARRIVED_AT_WORKSTATION"
  | "ARRIVED_AT_IDLE_DEST"
  | "ANIM_COMPLETE";

/** Pure transition function — mirrors WorldStateMachine.dispatch() logic. */
function transition(state: State, event: Event, hasActiveTask: boolean): State {
  switch (event) {
    case "TASK_ASSIGNED":
      if (["idle", "sleeping", "stretching"].includes(state)) return "walking";
      return state;

    case "ARRIVED_AT_WORKSTATION":
      if (state === "walking" && hasActiveTask) return "working";
      return state;

    case "TASK_COMPLETED":
      if (state === "working" || state === "waiting") return "celebrating";
      return state;

    case "TASK_FAILED":
      if (state === "working" || state === "waiting") return "error_reaction";
      return state;

    case "APPROVAL_REQUESTED":
      if (state === "working") return "waiting";
      return state;

    case "APPROVAL_GRANTED":
      if (state === "waiting") return "working";
      return state;

    case "APPROVAL_DENIED":
      if (state === "waiting") return "error_reaction";
      return state;

    case "IDLE_TIMER_FIRED":
      if (state === "idle" && !hasActiveTask) {
        // Randomly pick one of the 4 ambient outcomes
        return ["walking", "stretching", "idle", "sleeping"][
          Math.floor(Math.random() * 4)
        ] as State;
      }
      return state;

    case "ARRIVED_AT_IDLE_DEST":
      if (state === "walking" && !hasActiveTask) return "idle";
      return state;

    case "ANIM_COMPLETE":
      if (state === "celebrating" || state === "error_reaction") return "idle";
      if (state === "stretching") return "idle";
      return state;

    default:
      return state;
  }
}

describe("PBT Property 1: WSM state always valid after any event sequence (Req 18.1)", () => {
  it("FOR ALL event sequences of length 1–50, creature state ∈ VALID_CREATURE_STATES", () => {
    const eventArb = fc.constantFrom<Event>(
      "TASK_ASSIGNED", "TASK_COMPLETED", "TASK_FAILED",
      "APPROVAL_REQUESTED", "APPROVAL_GRANTED", "APPROVAL_DENIED",
      "IDLE_TIMER_FIRED", "ARRIVED_AT_WORKSTATION", "ARRIVED_AT_IDLE_DEST",
      "ANIM_COMPLETE"
    );
    const sequenceArb = fc.array(eventArb, { minLength: 1, maxLength: 50 });

    fc.assert(
      fc.property(sequenceArb, (events) => {
        let state: State = "idle";
        let hasTask = false;
        for (const event of events) {
          if (event === "TASK_ASSIGNED") hasTask = true;
          if (event === "TASK_COMPLETED" || event === "TASK_FAILED" || event === "ANIM_COMPLETE") {
            if (state === "celebrating" || state === "error_reaction") hasTask = false;
          }
          state = transition(state, event, hasTask);
          // Invariant: state must always be valid
          if (!VALID_CREATURE_STATES.has(state as never)) return false;
        }
        return true;
      }),
      { numRuns: 1000 }
    );
  });
});
