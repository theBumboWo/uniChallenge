/**
 * Whimsical Agent Village — Root Zustand Store
 *
 * Contains all TypeScript interfaces from design.md §4 and the top-level
 * AppState shape. Phase 0 skeleton — slices are populated in later phases.
 *
 * Req 7 (adapter interface types), Req 14 (persistence data shapes),
 * Req 4 (creature / WSM types), Req 6 (task types).
 */

import { create } from "zustand";

// ─── Core Identifiers ────────────────────────────────────────────────────────

export type CreatureId = "builder" | "researcher" | "debugger";
export type WorkstationId = "workshop_bench" | "library_desk" | "examination_table";
export type ProviderId =
  | "openai_codex"
  | "claude_code"
  | "opencode"
  | "kiro_cli"
  | "openrouter";

// ─── Display Modes ───────────────────────────────────────────────────────────

export type DisplayMode = "compact" | "full_workspace";
// NOTE: "expanded" is post-MVP per design.md §8 ADR-001

// ─── Tile / World Geometry ───────────────────────────────────────────────────

export interface Tile {
  x: number; // 0–79
  y: number; // 0–44
}

export interface Point {
  x: number; // canvas px
  y: number; // canvas px
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "Queued"
  | "Assigned"
  | "Running"
  | "Waiting_For_Approval"
  | "Completed"
  | "Failed"
  | "Cancelled";

/** Terminal states — no further transitions are valid (PBT Property 2). */
export const TERMINAL_TASK_STATUSES = new Set<TaskStatus>([
  "Completed",
  "Failed",
  "Cancelled",
]);

export interface ApprovalRequest {
  actionDescription: string; // Human-readable description of the action
  affectedTarget: string; // File path or shell command
  requestedAt: number; // Unix ms
}

export interface Task {
  id: string; // UUID v4
  title: string; // First 60 chars of prompt
  prompt: string; // 10–4000 chars
  status: TaskStatus;
  creatureId: CreatureId;
  providerId: ProviderId;
  modelId: string;
  pipelineId: string | null; // null if standalone
  pipelineStep: number | null; // 0-based index in pipeline
  createdAt: number; // Unix ms
  assignedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  executionOutput: string; // Accumulated token text
  errorDetails: string | null;
  inputTokenCount: number | null;
  outputTokenCount: number | null;
  totalTokenCount: number | null;
  approvalRequest: ApprovalRequest | null;
}

// ─── Creature ────────────────────────────────────────────────────────────────

export type CreatureAnimationState =
  | "idle"
  | "walking"
  | "working"
  | "sleeping"
  | "celebrating"
  | "error_reaction"
  | "waiting"
  | "stretching";

/** All valid creature animation states (used in PBT Property 1). */
export const VALID_CREATURE_STATES = new Set<CreatureAnimationState>([
  "idle",
  "walking",
  "working",
  "sleeping",
  "celebrating",
  "error_reaction",
  "waiting",
  "stretching",
]);

export interface Creature {
  id: CreatureId;
  name: string; // 1–32 chars
  animationState: CreatureAnimationState;
  position: Tile; // Current tile
  targetPosition: Tile | null; // Walking destination
  currentPath: Tile[]; // Remaining A* path
  activeTaskId: string | null;
  defaultProviderId: ProviderId;
  defaultModelId: string;
  frameIndex: number; // Current sprite frame (0-based)
  frameTimer: number; // ms since last frame advance
  idleTimer: number; // ms until next ambient behaviour
  blockTimer: number; // ms waiting for blocked path (0 = not blocked)
}

// ─── Provider ────────────────────────────────────────────────────────────────

export interface ProviderInfo {
  providerId: ProviderId;
  available: boolean;
  unavailableReason: string | null;
  version: string | null;
}

export interface Credentials {
  providerId: ProviderId;
  value: string; // In-memory only — NEVER persisted to disk
}

export interface AuthResult {
  success: boolean;
  error: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number | null;
  capabilities: string[];
}

// ─── Execution Events (discriminated union) ──────────────────────────────────

export interface TokenEvent {
  type: "token";
  text: string;
}

export interface ToolCallEvent {
  type: "tool_call";
  toolName: string;
  arguments: Record<string, unknown>;
  callId: string;
}

export interface FileWriteEvent {
  type: "file_write";
  filePath: string;
  operationType: "create" | "modify" | "delete";
}

export interface ApprovalRequestEvent {
  type: "approval_request";
  actionDescription: string;
  affectedTarget: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
  code: string | null;
}

export interface CompletionEvent {
  type: "completion";
  stopReason: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** All ExecutionEvent subtypes — stream must always end with completion or error. */
export type ExecutionEvent =
  | TokenEvent
  | ToolCallEvent
  | FileWriteEvent
  | ApprovalRequestEvent
  | ErrorEvent
  | CompletionEvent;

// ─── Session ─────────────────────────────────────────────────────────────────

export interface SessionHandle {
  sessionId: string;
  providerId: ProviderId;
  processId: number | null; // For subprocess-based providers
  startedAt: number;
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export interface PipelineStep {
  promptTemplate: string; // May contain {{task_N_output}} placeholders
  creatureId: CreatureId;
  providerId: ProviderId;
  modelId: string;
}

export interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[]; // 1–5 steps
  createdAt: number;
  taskIds: string[]; // Generated Task IDs (one per step, populated as steps are created)
}

// ─── User Preferences ────────────────────────────────────────────────────────

export interface UserPreferences {
  alwaysOnTop: boolean;
  startInCompactMode: boolean;
  reducedMotion: boolean;
  closeToTray: boolean;
  desktopNotificationsEnabled: boolean;
  audioEnabled: boolean;
  audioVolumeAmbient: number; // 0–1
  audioVolumeCreature: number; // 0–1
  audioVolumeEvent: number; // 0–1
  historyRetentionDays: number; // default 90
  defaultWorkspacePath: string;
  windowMonitor: number | null;
  windowX: number | null;
  windowY: number | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  alwaysOnTop: false,
  startInCompactMode: false,
  reducedMotion: false,
  closeToTray: true,
  desktopNotificationsEnabled: false,
  audioEnabled: false,
  audioVolumeAmbient: 0.4,
  audioVolumeCreature: 0.6,
  audioVolumeEvent: 0.8,
  historyRetentionDays: 90,
  defaultWorkspacePath: "",
  windowMonitor: null,
  windowX: null,
  windowY: null,
};

// ─── World State ─────────────────────────────────────────────────────────────

export interface WorldState {
  /** 80×45 flat array; true = walkable. Index = y * 80 + x */
  walkabilityGrid: boolean[];
  entities: {
    creatures: Record<CreatureId, Creature>;
    workstations: Record<
      WorkstationId,
      {
        id: WorkstationId;
        position: Tile;
        bounds: Rect;
        assignedCreatureId: CreatureId;
      }
    >;
  };
}

// ─── Particle ────────────────────────────────────────────────────────────────

export type ParticleKind = "zzz" | "sparkle" | "error_bang" | "thinking_dot";

export interface Particle {
  id: string;
  kind: ParticleKind;
  x: number; // canvas px
  y: number; // canvas px
  vx: number; // px/ms velocity
  vy: number; // px/ms velocity
  alpha: number; // 0–1
  scale: number;
  lifetime: number; // total ms
  age: number; // ms elapsed
}

// ─── Sprite Sheet Metadata ───────────────────────────────────────────────────

export interface SpriteSheetMetadata {
  creatureId: CreatureId;
  state: CreatureAnimationState;
  frameWidth: number; // px, minimum 48
  frameHeight: number; // px, minimum 48
  frameCount: number; // minimum 4
  fps: number;
  src: string; // Path relative to public/sprites/
}

// ─── UI State ────────────────────────────────────────────────────────────────

export interface UIState {
  displayMode: DisplayMode;
  selectedCreatureId: CreatureId | null;
  selectedWorkstationId: WorkstationId | null;
  activePanel: "task_form" | "execution_output" | "settings" | "history" | null;
  taskFormOpen: boolean;
  isWindowVisible: boolean;
}

// ─── Top-Level App State (Zustand store shape) ───────────────────────────────

export interface AppState {
  // Data slices
  tasks: Record<string, Task>;
  creatures: Record<CreatureId, Creature>;
  providers: Record<ProviderId, ProviderInfo>;
  models: Record<ProviderId, ModelInfo[]>;
  pipelines: Record<string, Pipeline>;
  preferences: UserPreferences;

  // World simulation
  world: WorldState;
  particles: Particle[];

  // UI
  ui: UIState;

  // Actions — implemented in later phases
  actions: {
    // Task actions
    addTask: (task: Task) => void;
    updateTask: (id: string, patch: Partial<Task>) => void;

    // Creature actions
    updateCreature: (id: CreatureId, patch: Partial<Creature>) => void;

    // Provider actions
    setProviderInfo: (info: ProviderInfo) => void;
    setModels: (providerId: ProviderId, models: ModelInfo[]) => void;

    // World actions
    addParticle: (particle: Particle) => void;
    removeParticle: (id: string) => void;
    tickParticles: (deltaMs: number) => void;

    // UI actions
    setDisplayMode: (mode: DisplayMode) => void;
    selectCreature: (id: CreatureId | null) => void;
    selectWorkstation: (id: WorkstationId | null) => void;
    setWindowVisible: (visible: boolean) => void;

    // Preference actions
    updatePreferences: (patch: Partial<UserPreferences>) => void;
  };
}

// ─── Default creature positions (home tiles) ─────────────────────────────────

const DEFAULT_CREATURES: Record<CreatureId, Creature> = {
  builder: {
    id: "builder",
    name: "The Builder",
    animationState: "idle",
    position: { x: 20, y: 30 },
    targetPosition: null,
    currentPath: [],
    activeTaskId: null,
    defaultProviderId: "openrouter",
    defaultModelId: "",
    frameIndex: 0,
    frameTimer: 0,
    idleTimer: 15000, // 15s initial idle timer
    blockTimer: 0,
  },
  researcher: {
    id: "researcher",
    name: "The Researcher",
    animationState: "idle",
    position: { x: 50, y: 30 },
    targetPosition: null,
    currentPath: [],
    activeTaskId: null,
    defaultProviderId: "openrouter",
    defaultModelId: "",
    frameIndex: 0,
    frameTimer: 0,
    idleTimer: 20000,
    blockTimer: 0,
  },
  debugger: {
    id: "debugger",
    name: "The Debugger",
    animationState: "sleeping",
    position: { x: 35, y: 38 },
    targetPosition: null,
    currentPath: [],
    activeTaskId: null,
    defaultProviderId: "openrouter",
    defaultModelId: "",
    frameIndex: 0,
    frameTimer: 0,
    idleTimer: 25000,
    blockTimer: 0,
  },
};

const DEFAULT_PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai_codex: { providerId: "openai_codex", available: false, unavailableReason: null, version: null },
  claude_code: { providerId: "claude_code", available: false, unavailableReason: null, version: null },
  opencode: { providerId: "opencode", available: false, unavailableReason: null, version: null },
  kiro_cli: { providerId: "kiro_cli", available: false, unavailableReason: null, version: null },
  openrouter: { providerId: "openrouter", available: false, unavailableReason: null, version: null },
};

// ─── 80×45 walkability grid — all walkable for now; Phase 2 sets walls ────────
const GRID_WIDTH = 80;
const GRID_HEIGHT = 45;
const DEFAULT_WALKABILITY = new Array<boolean>(GRID_WIDTH * GRID_HEIGHT).fill(true);

// ─── Store creation ───────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  tasks: {},
  creatures: DEFAULT_CREATURES,
  providers: DEFAULT_PROVIDERS,
  models: {
    openai_codex: [],
    claude_code: [],
    opencode: [],
    kiro_cli: [],
    openrouter: [],
  },
  pipelines: {},
  preferences: DEFAULT_PREFERENCES,

  world: {
    walkabilityGrid: DEFAULT_WALKABILITY,
    entities: {
      creatures: DEFAULT_CREATURES,
      workstations: {
        workshop_bench: {
          id: "workshop_bench",
          position: { x: 18, y: 28 },
          bounds: { x: 17, y: 27, width: 4, height: 3 },
          assignedCreatureId: "builder",
        },
        library_desk: {
          id: "library_desk",
          position: { x: 48, y: 28 },
          bounds: { x: 47, y: 27, width: 4, height: 3 },
          assignedCreatureId: "researcher",
        },
        examination_table: {
          id: "examination_table",
          position: { x: 33, y: 36 },
          bounds: { x: 32, y: 35, width: 4, height: 3 },
          assignedCreatureId: "debugger",
        },
      },
    },
  },

  particles: [],

  ui: {
    displayMode: "full_workspace",
    selectedCreatureId: null,
    selectedWorkstationId: null,
    activePanel: null,
    taskFormOpen: false,
    isWindowVisible: true,
  },

  actions: {
    addTask: (task) =>
      set((s) => ({ tasks: { ...s.tasks, [task.id]: task } })),

    updateTask: (id, patch) =>
      set((s) => ({
        tasks: {
          ...s.tasks,
          [id]: { ...s.tasks[id], ...patch },
        },
      })),

    updateCreature: (id, patch) =>
      set((s) => ({
        creatures: {
          ...s.creatures,
          [id]: { ...s.creatures[id], ...patch },
        },
      })),

    setProviderInfo: (info) =>
      set((s) => ({
        providers: { ...s.providers, [info.providerId]: info },
      })),

    setModels: (providerId, models) =>
      set((s) => ({
        models: { ...s.models, [providerId]: models },
      })),

    addParticle: (particle) =>
      set((s) => ({ particles: [...s.particles, particle] })),

    removeParticle: (id) =>
      set((s) => ({ particles: s.particles.filter((p) => p.id !== id) })),

    tickParticles: (deltaMs) =>
      set((s) => ({
        particles: s.particles
          .map((p) => ({ ...p, age: p.age + deltaMs, alpha: Math.max(0, 1 - (p.age + deltaMs) / p.lifetime) }))
          .filter((p) => p.age < p.lifetime),
      })),

    setDisplayMode: (mode) =>
      set((s) => ({ ui: { ...s.ui, displayMode: mode } })),

    selectCreature: (id) =>
      set((s) => ({ ui: { ...s.ui, selectedCreatureId: id } })),

    selectWorkstation: (id) =>
      set((s) => ({ ui: { ...s.ui, selectedWorkstationId: id } })),

    setWindowVisible: (visible) =>
      set((s) => ({ ui: { ...s.ui, isWindowVisible: visible } })),

    updatePreferences: (patch) =>
      set((s) => ({ preferences: { ...s.preferences, ...patch } })),
  },
}));
