/**
 * Provider Adapter Interface — Req 7
 *
 * All five provider adapters implement this interface.
 * The orchestration layer communicates ONLY through this contract.
 * No cross-adapter imports. No direct world/UI imports from adapters.
 *
 * SECURITY: Credentials arrive as in-memory strings from credentialService.
 * Adapters MUST NOT read from disk, env vars, or log credential values.
 * Replace any credential value in error messages with [REDACTED].
 */

// ─── Re-export execution event types from appStore ────────────────────────────
export type {
  ExecutionEvent,
  TokenEvent,
  ToolCallEvent,
  FileWriteEvent,
  ApprovalRequestEvent,
  ErrorEvent,
  CompletionEvent,
  SessionHandle,
  ProviderId,
  ModelInfo,
} from "../store/appStore";

import type { Task, ProviderId, ModelInfo, SessionHandle, ExecutionEvent } from "../store/appStore";

// ─── Discovery / Auth types ───────────────────────────────────────────────────

export interface ProviderInfo {
  providerId: ProviderId;
  available: boolean;
  unavailableReason: string | null;
  version: string | null;
}

export interface Credentials {
  providerId: ProviderId;
  /** Raw value — in-memory only, never logged, never written to disk. */
  value: string;
}

export interface AuthResult {
  success: boolean;
  error: string | null;
}

// ─── The ProviderAdapter interface (Req 7.1) ──────────────────────────────────

export interface ProviderAdapter {
  /** Check if the provider binary/service is available. Must NOT throw. */
  discover(): Promise<ProviderInfo>;

  /** Verify credentials are valid. Returns AuthResult — never throws. */
  authenticate(credentials: Credentials): Promise<AuthResult>;

  /** Return available models for this provider. */
  listModels(credentials: Credentials): Promise<ModelInfo[]>;

  /** Begin a provider session for the given task. */
  startSession(task: Task, credentials: Credentials): Promise<SessionHandle>;

  /**
   * Stream execution events. The last event MUST be type "completion" or "error"
   * (PBT Property 5 — Req 18.5). Never throws; emits an error event instead.
   */
  streamEvents(session: SessionHandle): AsyncGenerator<ExecutionEvent>;

  /** Send user's approval/denial for an approval request. */
  sendApproval(session: SessionHandle, approved: boolean): Promise<void>;

  /** Cancel a running session. */
  cancelSession(session: SessionHandle): Promise<void>;
}

// ─── Adapter registry ─────────────────────────────────────────────────────────

const _registry = new Map<ProviderId, ProviderAdapter>();

export function registerAdapter(id: ProviderId, adapter: ProviderAdapter): void {
  _registry.set(id, adapter);
}

export function getAdapter(id: ProviderId): ProviderAdapter | undefined {
  return _registry.get(id);
}

export function getAllAdapters(): Map<ProviderId, ProviderAdapter> {
  return _registry;
}
