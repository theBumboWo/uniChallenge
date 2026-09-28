/**
 * Phase 0 smoke tests — verify the store initialises with correct defaults.
 * Req 4 (creature defaults), Req 14 (persistence data shapes), Req 7 (provider defaults).
 */
import { describe, it, expect } from "vitest";
import {
  useAppStore,
  TERMINAL_TASK_STATUSES,
  VALID_CREATURE_STATES,
  DEFAULT_PREFERENCES,
} from "../store/appStore";

describe("AppStore — initial state", () => {
  it("initialises three creatures with correct IDs", () => {
    const { creatures } = useAppStore.getState();
    expect(Object.keys(creatures)).toEqual(
      expect.arrayContaining(["builder", "researcher", "debugger"])
    );
  });

  it("builder starts idle", () => {
    const { creatures } = useAppStore.getState();
    expect(creatures.builder.animationState).toBe("idle");
  });

  it("debugger starts sleeping (personality)", () => {
    const { creatures } = useAppStore.getState();
    expect(creatures.debugger.animationState).toBe("sleeping");
  });

  it("all five providers initialise as unavailable", () => {
    const { providers } = useAppStore.getState();
    const ids = Object.keys(providers);
    expect(ids).toHaveLength(5);
    ids.forEach((id) => {
      expect(providers[id as keyof typeof providers].available).toBe(false);
    });
  });

  it("display mode defaults to full_workspace", () => {
    const { ui } = useAppStore.getState();
    expect(ui.displayMode).toBe("full_workspace");
  });

  it("audio defaults to disabled (Req 16.1)", () => {
    const { preferences } = useAppStore.getState();
    expect(preferences.audioEnabled).toBe(false);
  });

  it("walkability grid is 80×45 = 3600 entries", () => {
    const { world } = useAppStore.getState();
    expect(world.walkabilityGrid).toHaveLength(80 * 45);
  });
});

describe("AppStore — TERMINAL_TASK_STATUSES set", () => {
  it("contains Completed, Failed, Cancelled", () => {
    expect(TERMINAL_TASK_STATUSES.has("Completed")).toBe(true);
    expect(TERMINAL_TASK_STATUSES.has("Failed")).toBe(true);
    expect(TERMINAL_TASK_STATUSES.has("Cancelled")).toBe(true);
  });

  it("does not contain Running or Queued", () => {
    expect(TERMINAL_TASK_STATUSES.has("Running")).toBe(false);
    expect(TERMINAL_TASK_STATUSES.has("Queued")).toBe(false);
  });
});

describe("AppStore — VALID_CREATURE_STATES set", () => {
  it("contains all 8 animation states from Req 4.2", () => {
    const expected = [
      "idle", "walking", "working", "sleeping",
      "celebrating", "error_reaction", "waiting", "stretching",
    ];
    expected.forEach((state) => {
      expect(VALID_CREATURE_STATES.has(state as never)).toBe(true);
    });
  });

  it("has exactly 8 states", () => {
    expect(VALID_CREATURE_STATES.size).toBe(8);
  });
});

describe("AppStore — actions", () => {
  it("addTask adds a task to the store", () => {
    const { actions } = useAppStore.getState();
    actions.addTask({
      id: "test-uuid-1",
      title: "Test task",
      prompt: "Write a hello world function",
      status: "Queued",
      creatureId: "builder",
      providerId: "openrouter",
      modelId: "openai/gpt-4o",
      pipelineId: null,
      pipelineStep: null,
      createdAt: Date.now(),
      assignedAt: null,
      startedAt: null,
      completedAt: null,
      executionOutput: "",
      errorDetails: null,
      inputTokenCount: null,
      outputTokenCount: null,
      totalTokenCount: null,
      approvalRequest: null,
    });
    const { tasks } = useAppStore.getState();
    expect(tasks["test-uuid-1"]).toBeDefined();
    expect(tasks["test-uuid-1"].status).toBe("Queued");
  });

  it("updateTask patches task status", () => {
    const { actions, tasks } = useAppStore.getState();
    const existingId = Object.keys(tasks)[0];
    if (existingId) {
      actions.updateTask(existingId, { status: "Running" });
      expect(useAppStore.getState().tasks[existingId].status).toBe("Running");
    }
  });

  it("setProviderInfo marks provider available", () => {
    const { actions } = useAppStore.getState();
    actions.setProviderInfo({
      providerId: "openrouter",
      available: true,
      unavailableReason: null,
      version: null,
    });
    expect(useAppStore.getState().providers.openrouter.available).toBe(true);
  });

  it("DEFAULT_PREFERENCES has closeToTray true", () => {
    expect(DEFAULT_PREFERENCES.closeToTray).toBe(true);
  });
});
