/**
 * OpenRouter Provider Adapter — Req 12
 *
 * Integration: HTTP REST + SSE streaming. No local binary required.
 * Text-completion only — no tool calls, no file writes, no approval requests.
 * Cancel via AbortController (Req 12.7: within 500 ms).
 *
 * SECURITY: API key passed in-memory from credentialService. Never logged.
 * Headers: HTTP-Referer + X-Title required by OpenRouter policy (Req 12.5).
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  Credentials,
  AuthResult,
} from "./types";
import type {
  Task,
  ModelInfo,
  SessionHandle,
  ExecutionEvent,
} from "../store/appStore";
import { registerAdapter } from "./types";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const APP_REFERER = "app://whimsical-agent-village";
const APP_TITLE = "Whimsical Agent Village";

// Model list cache (1-hour TTL per Req 12.2)
let _modelCache: ModelInfo[] | null = null;
let _modelCacheAt = 0;
const MODEL_CACHE_TTL = 60 * 60 * 1000;

// Active AbortControllers keyed by sessionId (Req 12.7)
const _abortControllers = new Map<string, AbortController>();

function authHeaders(apiKey: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "HTTP-Referer": APP_REFERER,
    "X-Title": APP_TITLE,
    "Content-Type": "application/json",
  };
}

function redactKey(key: string): string {
  if (key.length <= 4) return "[REDACTED]";
  return `[REDACTED]...${key.slice(-4)}`;
}

class OpenRouterAdapterImpl implements ProviderAdapter {

  // ── Discovery (Req 12.1) ──────────────────────────────────────────────────

  async discover(): Promise<ProviderInfo> {
    // OpenRouter needs only a key — no binary check. Availability is confirmed
    // when authenticate() succeeds. For discover() we just report ready-to-configure.
    return {
      providerId: "openrouter",
      available: false, // set to true after authenticate() succeeds
      unavailableReason: "API key required — enter in Settings",
      version: null,
    };
  }

  // ── Authentication (Req 12.2 test) ────────────────────────────────────────

  async authenticate(credentials: Credentials): Promise<AuthResult> {
    if (!credentials.value || credentials.value.trim().length === 0) {
      return { success: false, error: "No API key provided" };
    }
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: authHeaders(credentials.value),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        return { success: true, error: null };
      }
      // Req 12.6: 4xx/5xx → Failed
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return {
        success: false,
        error: `HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`,
      };
    } catch (e) {
      // SECURITY: never include the key value in the error
      return {
        success: false,
        error: `Connection error (key: ${redactKey(credentials.value)}): ${(e as Error).message}`,
      };
    }
  }

  // ── Model list (Req 12.2 — cache 1 hr) ───────────────────────────────────

  async listModels(credentials: Credentials): Promise<ModelInfo[]> {
    const now = Date.now();
    if (_modelCache && now - _modelCacheAt < MODEL_CACHE_TTL) {
      return _modelCache;
    }
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: authHeaders(credentials.value),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const data = await res.json() as { data?: Array<{ id: string; name?: string; context_length?: number }> };
      const models: ModelInfo[] = (data.data ?? []).map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        contextWindow: m.context_length ?? null,
        capabilities: ["text"],
      }));
      _modelCache = models;
      _modelCacheAt = now;
      return models;
    } catch {
      return _modelCache ?? [];
    }
  }

  // ── Session (Req 12.3) ────────────────────────────────────────────────────

  async startSession(_task: Task, _credentials: Credentials): Promise<SessionHandle> {
    const sessionId = crypto.randomUUID();
    return {
      sessionId,
      providerId: "openrouter",
      processId: null,
      startedAt: Date.now(),
    };
  }

  // ── Streaming (Req 12.3, 12.4) ────────────────────────────────────────────

  async *streamEvents(session: SessionHandle): AsyncGenerator<ExecutionEvent> {
    // Retrieve credentials via credentialService at stream time
    // (credentials are not stored on the session handle)
    const { getCredential } = await import("../services/credentialService");
    const apiKey = await getCredential("openrouter");

    if (!apiKey) {
      yield { type: "error", message: "OpenRouter API key not configured", code: "NO_KEY" };
      return;
    }

    // Find the task (need model and prompt)
    const { useAppStore } = await import("../store/appStore");
    const store = useAppStore.getState();
    const task = Object.values(store.tasks).find(
      (t) => t.status === "Running" && t.creatureId !== undefined
    );

    if (!task) {
      yield { type: "error", message: "Task not found for session", code: "NO_TASK" };
      return;
    }

    const controller = new AbortController();
    _abortControllers.set(session.sessionId, controller);

    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: authHeaders(apiKey),
        signal: controller.signal,
        body: JSON.stringify({
          model: task.modelId || "openai/gpt-4o-mini",
          messages: [{ role: "user", content: task.prompt }],
          stream: true,
        }),
      });

      // Req 12.6: non-2xx → error event
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
        yield {
          type: "error",
          message: `HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`,
          code: String(res.status),
        };
        return;
      }

      if (!res.body) {
        yield { type: "error", message: "No response body", code: "NO_BODY" };
        return;
      }

      // Parse SSE stream (Req 12.4)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const chunk = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };

            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: "token", text: delta };
            }

            // Capture token usage from final chunk
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens ?? null;
              outputTokens = chunk.usage.completion_tokens ?? null;
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }

      // Terminal event — always completion or error (PBT Property 5)
      yield {
        type: "completion",
        stopReason: "stop",
        inputTokens,
        outputTokens,
      };

    } catch (e) {
      if ((e as Error).name === "AbortError") {
        // Cancelled by user — emit completion so stream terminates cleanly
        yield { type: "completion", stopReason: "cancelled", inputTokens: null, outputTokens: null };
      } else {
        yield {
          type: "error",
          message: (e as Error).message,
          code: "FETCH_ERROR",
        };
      }
    } finally {
      _abortControllers.delete(session.sessionId);
    }
  }

  // ── Approval (N/A for OpenRouter — text-only, Req 12.8) ──────────────────

  async sendApproval(_session: SessionHandle, _approved: boolean): Promise<void> {
    // OpenRouter is text-only. No approval flow. This is a no-op.
  }

  // ── Cancellation (Req 12.7 — within 500 ms) ──────────────────────────────

  async cancelSession(session: SessionHandle): Promise<void> {
    const controller = _abortControllers.get(session.sessionId);
    if (controller) {
      controller.abort();
      _abortControllers.delete(session.sessionId);
    }
  }
}

// Register singleton
const openRouterAdapter = new OpenRouterAdapterImpl();
registerAdapter("openrouter", openRouterAdapter);

export { openRouterAdapter };
export default openRouterAdapter;
