# Technical Architecture — Whimsical Agent Village

This document is loaded into every Kiro session. It defines the approved technical stack, project structure, coding conventions, and architectural rules. Do not deviate from these decisions without creating an ADR in `docs/decisions/`.

---

## Approved Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop runtime | Tauri | v2 (stable) |
| Frontend framework | React | 19 |
| Language | TypeScript | 5.x strict mode |
| Build tool | Vite | latest compatible with Tauri v2 |
| Package manager | pnpm | latest |
| State management | Zustand | latest |
| World rendering | HTML Canvas 2D API | — (no WebGL, no Pixi.js) |
| Database | SQLite via `tauri-plugin-sql` | WAL mode |
| Credential storage | Windows Credential Manager via `tauri-plugin-keyring` | — |
| Subprocess management | `tauri-plugin-shell` | `kill_children: true` |
| Notifications | `tauri-plugin-notification` | — |
| System tray | `tauri-plugin-tray` | — |
| Test runner | Vitest | latest |
| Property-based testing | fast-check | latest |
| Linter | ESLint with `@typescript-eslint/recommended` | — |
| Formatter | Prettier | — |

**Do not introduce Electron, Vue, Redux, WebGL, Pixi.js, Three.js, or a full game engine.** These are explicitly out of scope.

---

## Project Directory Structure

```
uniChallenge/
├── src/                          # React + TypeScript frontend
│   ├── App.tsx
│   ├── store/
│   │   └── appStore.ts           # Zustand root store
│   ├── components/               # UI React components
│   │   ├── CompactMode.tsx
│   │   ├── FullWorkspace.tsx
│   │   ├── TaskForm.tsx
│   │   ├── ExecutionOutput.tsx
│   │   ├── Settings.tsx
│   │   ├── CreatureDetail.tsx
│   │   └── WorkstationDetail.tsx
│   ├── world/                    # Canvas 2D world subsystem
│   │   ├── WorldRenderer.ts
│   │   ├── WorldStateMachine.ts
│   │   ├── Pathfinder.ts
│   │   ├── ParticleSystem.ts
│   │   ├── SpriteSheetManager.ts
│   │   └── HitBoxManager.ts
│   ├── agents/                   # Agent orchestration
│   │   ├── TaskOrchestrator.ts
│   │   ├── ApprovalHandler.ts
│   │   └── PipelineExecutor.ts
│   ├── adapters/                 # Provider adapter implementations
│   │   ├── types.ts              # ProviderAdapter interface + all shared types
│   │   ├── OpenRouterAdapter.ts
│   │   ├── OpenAICodexAdapter.ts
│   │   ├── ClaudeCodeAdapter.ts
│   │   ├── OpenCodeAdapter.ts
│   │   └── KiroCLIAdapter.ts
│   ├── services/                 # Frontend service clients
│   │   ├── persistenceService.ts
│   │   ├── credentialService.ts
│   │   ├── AudioManager.ts
│   │   └── SettingsService.ts
│   └── __tests__/
│       └── pbt/                  # Property-based tests
│           ├── worldStateMachine.pbt.test.ts
│           ├── taskLifecycle.pbt.test.ts
│           ├── persistenceRoundTrip.pbt.test.ts
│           ├── concurrentEvents.pbt.test.ts
│           ├── adapterContract.pbt.test.ts
│           └── pathfinder.pbt.test.ts
├── src-tauri/                    # Rust Tauri backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── window.rs             # Window management
│   │   ├── credentials.rs        # Keychain wrapper
│   │   ├── persistence.rs        # SQLite commands
│   │   ├── process_manager.rs    # Subprocess spawn/kill/relay
│   │   ├── paths.rs
│   │   ├── dialogs.rs
│   │   └── notifications.rs
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── assets/
│   │   └── audio/                # Bundled audio files
│   └── tauri.conf.json
├── tools/
│   └── mcp-server/
│       └── index.ts              # whimsical-village-dev MCP server
├── docs/
│   └── decisions/                # Architecture Decision Records
│       └── ADR-001-expanded-mode-deferred.md
├── .kiro/
│   ├── steering/
│   ├── hooks/
│   ├── agents/
│   ├── specs/whimsical-agent-village/
│   └── mcp.json
└── public/
    └── sprites/                  # Sprite sheet PNG assets
```

---

## Architectural Separation of Concerns

Eight layers must remain independent. Cross-layer imports are forbidden in the directions marked.

| Layer | Location | Must NOT import from |
|-------|----------|----------------------|
| Desktop runtime (Rust) | `src-tauri/` | Frontend modules |
| UI components | `src/components/` | `src/world/`, `src/adapters/` directly |
| World subsystem | `src/world/` | `src/agents/`, `src/adapters/`, `src/services/` |
| Agent orchestration | `src/agents/` | `src/world/` directly (use store events) |
| Provider adapters | `src/adapters/` | Each other (no cross-adapter imports) |
| Services | `src/services/` | `src/world/`, `src/agents/` |
| Persistence | Rust `persistence.rs` + `src/services/persistenceService.ts` | Provider-specific code |
| Credential management | Rust `credentials.rs` + `src/services/credentialService.ts` | World or agent code |

The world subsystem must **never** execute shell commands, spawn processes, or read credentials. The adapter layer must **never** directly update React state or manipulate Canvas elements.

---

## IPC Architecture

All communication between the TypeScript frontend and the Rust backend uses Tauri's IPC:

- **Commands (request/response):** `invoke()` from `@tauri-apps/api/core`
- **Streaming events (Rust → frontend push):** `listen()` from `@tauri-apps/api/event`

Frontend code must never read files, spawn processes, or access the OS keychain directly. All such operations are routed through `invoke()` commands to Rust handlers.

### Key Tauri commands (see design.md §6 for full contract)

```
set_always_on_top        minimize_to_tray         restore_window
save_credential          get_credential           delete_credential
db_execute               db_select
check_binary             spawn_provider_process   kill_provider_process
send_process_stdin       get_app_data_dir
show_save_dialog         send_os_notification
```

### Streaming event names

```
execution-event          process-stdout           process-stderr
process-exited           window-visibility-changed   backend-error
```

---

## Provider Adapter Architecture

All five provider integrations are mandatory. Each must implement the `ProviderAdapter` interface defined in `src/adapters/types.ts`.

### The ProviderAdapter interface

```typescript
interface ProviderAdapter {
  discover(): Promise<ProviderInfo>
  authenticate(credentials: Credentials): Promise<AuthResult>
  listModels(): Promise<ModelInfo[]>
  startSession(task: Task): Promise<SessionHandle>
  streamEvents(session: SessionHandle): AsyncIterable<ExecutionEvent>
  sendApproval(session: SessionHandle, approved: boolean): Promise<void>
  cancelSession(session: SessionHandle): Promise<void>
}
```

### The five adapters and their integration patterns

| Adapter | File | Integration Pattern |
|---------|------|-------------------|
| `OpenRouterAdapter` | `src/adapters/OpenRouterAdapter.ts` | HTTP REST + SSE streaming. No local binary required. |
| `OpenAICodexAdapter` | `src/adapters/OpenAICodexAdapter.ts` | `codex --mcp-server` subprocess. Exposes `codex()` and `codex-reply()` MCP tools. |
| `ClaudeCodeAdapter` | `src/adapters/ClaudeCodeAdapter.ts` | `@anthropic-ai/claude-code` SDK primary; `claude -p ... --output-format stream-json` CLI fallback. |
| `OpenCodeAdapter` | `src/adapters/OpenCodeAdapter.ts` | `opencode serve` HTTP subprocess + `@opencode-ai/sdk`. Parse port from stdout on startup. |
| `KiroCLIAdapter` | `src/adapters/KiroCLIAdapter.ts` | `kiro-cli acp` subprocess. JSON-RPC 2.0 over stdin/stdout (Agent Client Protocol). |

### Adapter rules

1. Each adapter lives in its own file. No cross-adapter imports.
2. All credential values are received as in-memory strings passed from `credentialService`. Adapters must not read them from disk or environment variables.
3. Adapters must never log credential values. Replace with `[REDACTED]` in all error messages.
4. On subprocess spawn, use `kill_children: true` to prevent orphaned processes.
5. Discovery (`discover()`) must not throw — return `ProviderInfo` with `available: false` and a reason string on failure.
6. Stream errors must emit an `ExecutionEvent` of type `error` rather than throwing from `streamEvents()`.
7. OpenRouter is a model API, not an agentic runtime. Its adapter does not execute shell commands, write files, or send approval signals.

### Provider availability on startup

All five `discover()` calls run concurrently at startup via `Promise.allSettled()`. Unavailable providers display as grayed-out with a tooltip explaining the missing dependency. The application starts normally regardless of how many providers are unavailable.

---

## Task Lifecycle

Tasks progress through these states. No other states exist.

```
Queued → Assigned → Running → Completed
                            → Failed
                            → Cancelled
                 → Waiting_For_Approval → Running (approved)
                                        → Failed (denied)
                                        → Cancelled
```

### Forbidden transitions (enforced by TaskOrchestrator, verified by PBT)
- `Completed → *` (terminal)
- `Failed → *` (terminal)
- `Cancelled → *` (terminal)

### Timeout rules
- **Execution timeout:** 10 minutes in `Running` with no `ExecutionEvent` → `Failed` with reason `"Execution timeout"`.
- **Cancellation acknowledgement:** 2 seconds after cancel signal; force `Cancelled` if adapter does not respond.
- **Restart detection:** On app launch, any task in `Running` or `Waiting_For_Approval` state → immediately `Failed` with reason `"Application shutdown during execution"`. Never auto-restart.

---

## World State Machine

Each creature is governed by a deterministic state machine. States:

```
idle  walking  working  sleeping  celebrating  error_reaction  waiting  stretching
```

Key transition rules:
- `idle` is the default return state after all terminal animation states.
- Task assignment always interrupts `idle` or `sleeping` → `walking` → `working`.
- `working`, `waiting`, `celebrating`, `error_reaction` require an `activeTaskId`.
- No two creatures occupy the same tile simultaneously.
- State machine updates run at 10 Hz (`setInterval`), decoupled from the 60 fps render loop.
- The `requestAnimationFrame` render loop pauses automatically when the window is hidden (via `document.visibilityState`).

A* pathfinder operates on an 80×45 tile walkability grid. Path computation is synchronous and must complete within one 10 Hz tick.

---

## Persistence

SQLite database at `%APPDATA%\WhimsicalAgentVillage\data.db`.

- WAL mode enabled. All writes complete within 200 ms.
- Schema migrations run at startup from `src-tauri/migrations/`. Migration failure → launch in read-only mode, surface error toast.
- Credentials are **never** stored in SQLite. Credentials live exclusively in Windows Credential Manager.
- SQLite stores: Tasks, Creatures (positions, config), ProviderSettings (availability cache, model cache), UserPreferences.

---

## Credential Security Rules

These rules are absolute. No exceptions.

1. All API keys and tokens are stored in Windows Credential Manager via `tauri-plugin-keyring`.
2. Credentials are passed to provider adapters as in-memory strings via IPC only. Never serialized to disk.
3. Credentials never appear in log files, error messages, crash reports, or console output. Replace with `[REDACTED]`.
4. The settings UI displays credentials as `●●●●●●●●` with the show/hide toggle defaulting to hidden. Show reveals only the last 4 characters.
5. A confirmation modal appears before every credential save (new or update). Dismissal discards the value without writing.
6. If the OS keychain write fails, the credential is discarded. No fallback to file storage.

---

## Coding Conventions

### TypeScript

- `strict: true` in `tsconfig.json`. No `any` types in adapter interfaces or public APIs.
- No implicit `any`. No `ts-ignore` comments without an accompanying explanation.
- All async functions return typed Promises. All event handlers are typed.
- Discriminated unions for `ExecutionEvent`, `TaskStatus`, `CreatureAnimationState`.
- Use `type` for unions and primitives; `interface` for object shapes.

### Naming

| Context | Convention |
|---------|-----------|
| Classes, interfaces, types | `PascalCase` |
| Functions, variables, properties | `camelCase` |
| Constants (top-level, module-level) | `SCREAMING_SNAKE_CASE` |
| File names (components) | `PascalCase.tsx` |
| File names (services, utilities) | `camelCase.ts` |
| CSS custom properties | `--kebab-case` |

### Module rules

- Each provider adapter is a single file. No adapter imports from another adapter file.
- `src/world/` modules do not import from `src/agents/` or `src/adapters/`.
- `src/adapters/` modules communicate with the rest of the app via the Zustand store and Tauri events only.
- Circular imports are forbidden.

### ESLint and Prettier

The project uses `@typescript-eslint/recommended`. Run `pnpm lint` before committing. The `lint-on-save` Kiro hook runs ESLint automatically on file save.

### Testing

- Test files live adjacent to source files or in `src/__tests__/`.
- PBT files live in `src/__tests__/pbt/`.
- Unit test naming: `ComponentName.test.ts`.
- PBT naming: `feature.pbt.test.ts`.
- `pnpm test` runs all tests once (no watch mode in CI).
- Each PBT property runs a minimum of 1000 examples.

---

## World Rendering

The world is rendered on a single `<canvas>` element at logical resolution 1280×720, scaled to fit its container via CSS.

- **Rendering layers (back to front):** background (rainy window), floor/walls, props (bookshelves, machinery), workstations, creatures, particles, UI overlays.
- **Frame rate:** 60 fps in Full Workspace; 30 fps in Compact Mode. Pause on `visibilitychange`.
- **Sprite sheets:** PNG files in `public/sprites/`. Minimum 48×48px per frame, minimum 4 frames per animation state. Loaded and cached by `SpriteSheetManager`.
- **Particle system:** Short-lived overlay effects (ZZZ, sparkles, error !, thinking halo). Managed by `ParticleSystem`, drawn on each frame.
- **Hit detection:** Axis-aligned bounding boxes per creature (updated on tile move) and per workstation (fixed). Handled by `HitBoxManager`.

---

## Audio

`AudioManager` uses the Web Audio API. All audio is disabled by default. Assets are lazy-loaded on first enable. Audio fades to 0% within 1 second when the window is hidden.

Audio categories: ambient (rain loop), creature sounds (footsteps, typing), event sounds (completion chime, failure tone). Each category has an independent volume control persisted in SQLite.
