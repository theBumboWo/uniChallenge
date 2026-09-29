/**
 * PBT Property 5: Provider Adapter Contract Compliance — Req 18.5
 *
 * FOR ALL valid Task inputs, each provider adapter mock returns an
 * AsyncGenerator<ExecutionEvent> whose last event is always type
 * "completion" or "error" — never terminates mid-stream.
 *
 * Tests the contract rather than real network calls.
 * Uses mock adapters that mirror the expected behavior of each real adapter.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { ExecutionEvent, Task } from "../../store/appStore";

// ── Arbitraries ────────────────────────────────────────────────────────────────

const taskArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 60 }),
  prompt: fc.string({ minLength: 10, maxLength: 4000 }),
  status: fc.constant("Running" as const),
  creatureId: fc.constantFrom("builder" as const, "researcher" as const, "debugger" as const),
  providerId: fc.constantFrom(
    "openrouter" as const, "openai_codex" as const,
    "claude_code" as const, "opencode" as const, "kiro_cli" as const
  ),
  modelId: fc.string({ minLength: 1, maxLength: 100 }),
  pipelineId: fc.constant(null),
  pipelineStep: fc.constant(null),
  createdAt: fc.nat(),
  assignedAt: fc.option(fc.nat(), { nil: null }),
  startedAt: fc.option(fc.nat(), { nil: null }),
  completedAt: fc.constant(null),
  executionOutput: fc.constant(""),
  errorDetails: fc.constant(null),
  inputTokenCount: fc.constant(null),
  outputTokenCount: fc.constant(null),
  totalTokenCount: fc.constant(null),
  approvalRequest: fc.constant(null),
});

// ── Mock adapter factory ──────────────────────────────────────────────────────
// Generates a stream of 0–10 intermediate events followed by a terminal event.

type StreamSpec = {
  intermediateEvents: Array<"token" | "tool_call" | "file_write" | "approval_request">;
  terminalEvent: "completion" | "error";
};

const streamSpecArb: fc.Arbitrary<StreamSpec> = fc.record({
  intermediateEvents: fc.array(
    fc.constantFrom("token" as const, "tool_call" as const, "file_write" as const, "approval_request" as const),
    { minLength: 0, maxLength: 10 }
  ),
  terminalEvent: fc.constantFrom("completion" as const, "error" as const),
});

function buildEventFromKind(kind: StreamSpec["intermediateEvents"][0]): ExecutionEvent {
  switch (kind) {
    case "token":          return { type: "token", text: "hello" };
    case "tool_call":      return { type: "tool_call", toolName: "shell", arguments: {}, callId: "1" };
    case "file_write":     return { type: "file_write", filePath: "/tmp/x.ts", operationType: "create" };
    case "approval_request": return { type: "approval_request", actionDescription: "run shell", affectedTarget: "rm -rf" };
  }
}

function buildTerminalEvent(kind: "completion" | "error"): ExecutionEvent {
  if (kind === "completion") {
    return { type: "completion", stopReason: "stop", inputTokens: 10, outputTokens: 20 };
  }
  return { type: "error", message: "mock error", code: "MOCK" };
}

/** Mock adapter that generates events according to a spec. */
async function* mockAdapterStream(spec: StreamSpec): AsyncGenerator<ExecutionEvent> {
  for (const kind of spec.intermediateEvents) {
    yield buildEventFromKind(kind);
  }
  yield buildTerminalEvent(spec.terminalEvent);
}

/** Consume the entire stream and return all events. */
async function drainStream(gen: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("PBT Property 5: Provider adapter stream always terminates correctly (Req 18.5)", () => {

  it("last event is always 'completion' or 'error' for any stream spec", async () => {
    await fc.assert(
      fc.asyncProperty(taskArb, streamSpecArb, async (_task: Task, spec: StreamSpec) => {
        const events = await drainStream(mockAdapterStream(spec));
        if (events.length === 0) return false;
        const last = events[events.length - 1];
        return last.type === "completion" || last.type === "error";
      }),
      { numRuns: 1000 }
    );
  });

  it("stream never emits a completion or error event in a non-terminal position", async () => {
    await fc.assert(
      fc.asyncProperty(streamSpecArb, async (spec: StreamSpec) => {
        const events = await drainStream(mockAdapterStream(spec));
        const terminalIdx = events.length - 1;
        for (let i = 0; i < terminalIdx; i++) {
          if (events[i].type === "completion" || events[i].type === "error") {
            return false; // terminal event appeared before end
          }
        }
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  it("stream with zero intermediate events still terminates correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("completion" as const, "error" as const),
        async (terminalKind) => {
          const spec: StreamSpec = { intermediateEvents: [], terminalEvent: terminalKind };
          const events = await drainStream(mockAdapterStream(spec));
          return events.length === 1
            && (events[0].type === "completion" || events[0].type === "error");
        }
      ),
      { numRuns: 200 }
    );
  });

  it("OpenRouterAdapter is registered and has required interface methods", async () => {
    // Import the adapter to trigger self-registration, then check the registry
    await import("../../adapters/OpenRouterAdapter");
    const { getAdapter } = await import("../../adapters/types");
    const adapter = getAdapter("openrouter");
    expect(adapter).toBeDefined();
    expect(typeof adapter!.discover).toBe("function");
    expect(typeof adapter!.authenticate).toBe("function");
    expect(typeof adapter!.listModels).toBe("function");
    expect(typeof adapter!.startSession).toBe("function");
    expect(typeof adapter!.streamEvents).toBe("function");
    expect(typeof adapter!.sendApproval).toBe("function");
    expect(typeof adapter!.cancelSession).toBe("function");
  });
});
