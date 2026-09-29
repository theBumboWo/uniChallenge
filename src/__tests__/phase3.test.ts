/**
 * Phase 3 integration tests — adapter interface, task lifecycle helpers.
 * Req 6, 7, 12.
 */
import { describe, it, expect } from "vitest";
import { useAppStore, TERMINAL_TASK_STATUSES } from "../store/appStore";

describe("Adapter registry (Req 7.2, 7.5)", () => {
  it("OpenRouterAdapter registers itself on import", async () => {
    const { getAdapter } = await import("../adapters/types");
    // Trigger self-registration
    await import("../adapters/OpenRouterAdapter");
    const adapter = getAdapter("openrouter");
    expect(adapter).toBeDefined();
  });

  it("OpenRouterAdapter exposes all 7 required interface methods (Req 7.1)", async () => {
    const { getAdapter } = await import("../adapters/types");
    await import("../adapters/OpenRouterAdapter");
    const adapter = getAdapter("openrouter");
    const methods = ["discover","authenticate","listModels","startSession","streamEvents","sendApproval","cancelSession"];
    methods.forEach((m) => {
      expect(typeof (adapter as unknown as Record<string, unknown>)[m]).toBe("function");
    });
  });

  it("discover() returns ProviderInfo without throwing (Req 7.3)", async () => {
    const { getAdapter } = await import("../adapters/types");
    await import("../adapters/OpenRouterAdapter");
    const adapter = getAdapter("openrouter");
    const info = await adapter!.discover();
    expect(info).toHaveProperty("providerId", "openrouter");
    expect(info).toHaveProperty("available");
    expect(typeof info.available).toBe("boolean");
  });

  it("authenticate() returns AuthResult with error when no key (Req 7.9)", async () => {
    const { getAdapter } = await import("../adapters/types");
    await import("../adapters/OpenRouterAdapter");
    const adapter = getAdapter("openrouter");
    const result = await adapter!.authenticate({ providerId: "openrouter", value: "" });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("Task store actions (Req 6.3)", () => {
  it("addTask persists task in store with Queued status", () => {
    const task = {
      id: "test-task-phase3",
      title: "Phase 3 test task",
      prompt: "Write a hello world function in TypeScript",
      status: "Queued" as const,
      creatureId: "builder" as const,
      providerId: "openrouter" as const,
      modelId: "openai/gpt-4o-mini",
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
    };
    useAppStore.getState().actions.addTask(task);
    expect(useAppStore.getState().tasks["test-task-phase3"]?.status).toBe("Queued");
  });

  it("updateTask changes status correctly", () => {
    useAppStore.getState().actions.updateTask("test-task-phase3", { status: "Running" });
    expect(useAppStore.getState().tasks["test-task-phase3"]?.status).toBe("Running");
  });

  it("terminal states are Completed, Failed, Cancelled", () => {
    expect(TERMINAL_TASK_STATUSES.has("Completed")).toBe(true);
    expect(TERMINAL_TASK_STATUSES.has("Failed")).toBe(true);
    expect(TERMINAL_TASK_STATUSES.has("Cancelled")).toBe(true);
    expect(TERMINAL_TASK_STATUSES.has("Running")).toBe(false);
    expect(TERMINAL_TASK_STATUSES.has("Queued")).toBe(false);
  });
});

describe("ApprovalHandler (Req 6.8–10)", () => {
  it("handleApprovalRequest is importable and is a function", async () => {
    const mod = await import("../agents/ApprovalHandler");
    expect(typeof mod.handleApprovalRequest).toBe("function");
    expect(typeof mod.handleApprove).toBe("function");
    expect(typeof mod.handleDeny).toBe("function");
  });
});

describe("TaskOrchestrator (Req 6)", () => {
  it("submitTask and cancelTask are exported functions", async () => {
    const mod = await import("../agents/TaskOrchestrator");
    expect(typeof mod.submitTask).toBe("function");
    expect(typeof mod.cancelTask).toBe("function");
    expect(typeof mod.getSession).toBe("function");
  });
});

describe("ExecutionOutput component contract (Req 6.7)", () => {
  it("ExecutionOutput module exports a default component", async () => {
    const mod = await import("../components/ExecutionOutput");
    expect(typeof mod.default).toBe("function");
  });
});

describe("TaskForm component contract (Req 6.1)", () => {
  it("TaskForm module exports a default component", async () => {
    const mod = await import("../components/TaskForm");
    expect(typeof mod.default).toBe("function");
  });
});
