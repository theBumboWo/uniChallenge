# Requirements Document

## Introduction

The Whimsical Agent Village is a Windows desktop application that presents AI agent execution as a living miniature fantasy workshop. Users assign real coding, research, and debugging tasks to animated creature characters — a copper golem named The Builder, an owl wizard named The Researcher, and a sleepy mechanical bug named The Debugger. Each task is executed by a real AI provider (OpenAI Codex, Claude Code, OpenCode, Kiro CLI, or OpenRouter-backed models). The miniature world is the primary dashboard: clicking a creature opens its task panel, clicking a workstation shows execution output, and every animation reflects a real execution event. The application ships as a polished Windows desktop binary using Tauri v2 (Rust + React/TypeScript), with a compact floating-pill mode, an expanded hover panel, and a full workspace window.

This spec also serves as the Kiro University Challenge submission artifact, demonstrating spec-driven development, steering documents, hooks, property-based testing, Kiro Powers usage, MCP integration, and custom agents.

---

## Glossary

- **Application**: The Whimsical Agent Village desktop application as a whole.
- **World**: The rendered 2D miniature fantasy-workshop scene that constitutes the primary UI.
- **Creature**: An animated sprite character (Builder, Researcher, or Debugger) that represents one AI agent slot.
- **Workstation**: The designated furniture or set-piece in the World associated with a specific Creature (workshop bench, library desk, debug table).
- **Task**: A unit of work submitted by the user and executed by a real AI provider.
- **Provider**: An external AI system capable of executing Tasks (OpenAI Codex, Claude Code, OpenCode, Kiro CLI, or OpenRouter).
- **Provider_Adapter**: The internal software component that wraps one Provider's discovery, authentication, session management, task submission, streaming, cancellation, approval handling, and error reporting.
- **Task_Lifecycle**: The ordered set of states a Task passes through: Queued → Assigned → Running → Waiting_For_Approval → Completed | Failed | Cancelled.
- **Execution_Event**: A streaming event emitted by a Provider_Adapter during task execution (token, tool-call, file-write, approval-request, error, completion).
- **Approval_Request**: A Provider-generated pause requiring user confirmation before a destructive or irreversible action (e.g., file delete, shell command).
- **World_State_Machine**: The lightweight deterministic finite automaton governing each Creature's ambient and task-driven animation states.
- **Compact_Mode**: The always-visible floating pill overlay showing minimal creature and activity status.
- **Expanded_Mode**: The hover/click-activated panel showing a condensed World view.
- **Full_Workspace**: The maximized application window with World, task panels, output, history, and settings.
- **Credential_Store**: The encrypted, OS-keychain-backed store for all provider API keys and tokens.
- **Persistence_Layer**: The local SQLite-backed store for task history, creature configurations, provider settings (non-secret), character positions, and user preferences.
- **Sprite_Sheet**: A PNG image containing all animation frames for one Creature or World element, indexed by row/column.
- **Particle_Effect**: A short-lived visual overlay (ZZZ bubbles, sparkles, exclamation marks) emitted by Creatures during specific state transitions.
- **Audio_Manager**: The component responsible for optional ambient and event-triggered sound playback.
- **Steering_Document**: A Kiro `.kiro/steering/*.md` file providing persistent context to the AI agent during development.
- **Hook**: A Kiro `.kiro/hooks/*.json` automation that fires on file-save, prompt submission, or tool use.
- **MCP_Server**: A Model Context Protocol server exposing tools or resources to an AI agent session.
- **Custom_Agent**: A Kiro `.kiro/agents/*.md` definition for a specialized AI agent persona (Provider_Integration_Specialist, World_Design_Specialist, QA_Specialist).
- **Kiro_Crew**: The Kiro multi-agent system accessed via `kiro-cli acp` or the Crew conductor.
- **ACP**: Agent Client Protocol — the JSON-RPC 2.0 stdio interface used to communicate with `kiro-cli acp` subprocesses.

---

## Requirements

---

### Requirement 1: Desktop Runtime and Application Shell

**User Story:** As a user, I want a native Windows desktop application that launches quickly, stays out of my way, and provides a stable container for the World, so that I can use it alongside other applications without friction.

#### Acceptance Criteria

1. THE Application SHALL be built using Tauri v2 with a React 19 + TypeScript frontend rendered in the Windows WebView2 system webview, producing a standalone installer of no more than 50 MB.
2. WHEN the Application is launched, THE Application SHALL display the Compact_Mode within 3 seconds of process start on a machine meeting the minimum hardware specification (4-core CPU, 8 GB RAM, integrated GPU).
3. WHEN the Application window is hidden or minimized, THE Application SHALL pause sprite-sheet animation frame updates and reduce CPU usage to below 2% within 500 ms of the window being hidden.
4. WHEN the Application window is restored from hidden state, THE Application SHALL resume animations within 200 ms.
5. THE Application SHALL support always-on-top window positioning as a user-configurable toggle persisted in the Persistence_Layer.
6. THE Application SHALL support window dragging by clicking and holding any non-interactive region of the Compact_Mode or Expanded_Mode panels.
7. WHEN the Application's close button is clicked, THE Application SHALL minimize to the system tray rather than terminate, unless the user has configured close-to-quit in preferences.
8. IF the Application encounters an unhandled Rust panic in the Tauri backend, THEN THE Application SHALL log the panic details to a local crash log, display a non-blocking toast notification, and attempt to restart the backend process without losing in-progress Task state.
9. THE Application SHALL support multi-monitor configurations by remembering which monitor and position the window was last placed on, restoring that position on next launch.
10. WHERE the user has enabled desktop notifications, THE Application SHALL emit an OS-level notification when a Task transitions to Completed, Failed, or Waiting_For_Approval.

---

### Requirement 2: Display Modes — Compact, Expanded, and Full Workspace

**User Story:** As a user, I want to choose how much screen real estate the application occupies, so that I can keep it visible and unobtrusive during focused work, or expand it when I want to interact with the World.

#### Acceptance Criteria

1. THE Application SHALL maintain three distinct display modes: Compact_Mode, Expanded_Mode, and Full_Workspace.
2. WHEN the Application is in Compact_Mode, THE Application SHALL render a floating pill overlay of no more than 320 × 64 pixels, showing the active Creature's sprite thumbnail, its current state label, and the abbreviated Task title or "idle" if no Task is active.
3. WHEN the user hovers over the Compact_Mode pill for more than 300 ms, THE Application SHALL transition to Expanded_Mode within 150 ms using a smooth CSS opacity and scale transition.
4. WHEN the user moves focus away from the Expanded_Mode panel for more than 2 seconds, THE Application SHALL transition back to Compact_Mode within 150 ms.
5. WHEN the user double-clicks the Compact_Mode pill or clicks the expand icon, THE Application SHALL open Full_Workspace.
6. THE Full_Workspace SHALL contain: the World scene occupying at least 60% of the window area, a task-submission panel, an execution-output panel, a task-history list, and a settings panel accessible via a navigation control.
7. WHEN the Application transitions between any two display modes, THE World SHALL continue to execute World_State_Machine updates without interruption or reset.
8. IF the user's screen resolution is below 1280 × 720, THEN THE Application SHALL disable Expanded_Mode and offer only Compact_Mode and Full_Workspace.

---

### Requirement 3: The Miniature World — Rendering and Environment

**User Story:** As a user, I want the World to feel like a warm, living fantasy workshop, so that working with AI agents feels delightful rather than utilitarian.

#### Acceptance Criteria

1. THE Application SHALL render the World as a 2D scene using a layered HTML Canvas element at a native logical resolution of 1280 × 720 pixels, scaled to fit the available container using CSS.
2. THE World SHALL include the following static environment layers rendered as tiled or large-format pixel-art backgrounds: (a) a rainy window background with animated rainfall, (b) workshop floor with stone/wood texture, (c) at least one bookshelf filled with miniature books, (d) at least one amber lantern emitting a warm animated glow halo, (e) copper/brass machinery props with subtle idle animations (gear rotation at ≤ 1 rotation per 4 seconds).
3. THE World SHALL contain exactly three Workstations, one per Creature: (a) The Builder's copper workshop bench with tools, (b) The Researcher's library reading desk with books and a small lamp, (c) The Debugger's examination table with magnifying glass and mechanical parts.
4. WHEN the World renders at 60 fps on the minimum hardware specification, THE Application SHALL sustain frame times below 16.7 ms for all World rendering operations.
5. WHEN the Application is in Compact_Mode or Expanded_Mode, THE World rendering canvas SHALL render at a maximum of 30 fps to conserve resources.
6. THE World's visual style SHALL use a dark translucent glass UI overlay palette (background ≤ 20% opacity overlays), warm amber accent colors (#C68B3C ± 15% hue), soft rounded corners (≥ 8 px radius on all UI panels), and smooth CSS transitions of 150–300 ms duration for all interactive state changes.
7. IF a Creature is in the sleeping state for more than 10 seconds, THEN THE Application SHALL emit a looping ZZZ Particle_Effect above the Creature's head at a rate of one ZZZ per 2 seconds.

---

### Requirement 4: Creatures — Identity, States, and Ambient Behaviors

**User Story:** As a user, I want each AI agent to have a distinct creature character with personality and life, so that the World feels inhabited and I can identify each agent at a glance.

#### Acceptance Criteria

1. THE Application SHALL include exactly three Creatures with the following permanent identities: (a) **The Builder** — a copper golem with articulated joints, stationed at the workshop bench; (b) **The Researcher** — an owl-wizard creature wearing a small pointed hat, stationed at the library desk; (c) **The Debugger** — a small sleepy mechanical bug with antennae, stationed at the examination table.
2. EACH Creature SHALL have a Sprite_Sheet containing frames for the following animation states: idle, walking, working, sleeping, celebrating, error_reaction, waiting, and stretching.
3. EACH Creature's Sprite_Sheet SHALL contain animation frames at a minimum size of 48 × 48 pixels per frame, with each animation loop containing at least 4 frames.
4. THE World_State_Machine SHALL govern each Creature's state with the following valid transitions: idle → walking → idle; idle → sleeping → idle; idle → stretching → idle; idle → working (on Task assignment); working → celebrating (on Task Completed); working → error_reaction (on Task Failed); working → waiting (on Approval_Request); waiting → working (on approval granted); waiting → error_reaction (on approval denied or timeout); error_reaction → idle; celebrating → idle.
5. WHILE a Creature is in idle state and no Task is queued, THE World_State_Machine SHALL select an ambient behavior every 10–30 seconds using a weighted random schedule: walking to a random walkable tile within 10 tiles of the Creature's current position (40%), stretching in place (20%), sitting at a nearby prop within 3 tiles of the Creature's current position (20%), sleeping for 5–8 seconds before transitioning back to idle (20%).
6. WHEN a Creature transitions to walking state, THE Application SHALL compute a shortest path between the Creature's current tile and the target tile using an A* grid pathfinder operating on the World's walkability grid.
7. WHEN a Creature reaches a Workstation tile while in walking state and a Task is assigned, THE Application SHALL immediately transition the Creature to working state.
8. WHILE a Creature is in working state, THE Application SHALL display a "thinking" particle halo above the Creature's head consisting of 3–5 simultaneously visible particles, each with a lifetime of 1 second, emitted at a rate of one particle per second.
9. WHEN a Creature transitions to celebrating state, THE Application SHALL emit a burst of 8–12 sparkle Particle_Effects radiating from the Creature's position over 1.5 seconds.
10. WHEN a Creature transitions to error_reaction state, THE Application SHALL display a single red "!" Particle_Effect above the Creature's head for 2 seconds.
11. THE Application SHALL ensure that no two Creatures occupy the same tile simultaneously.
12. IF a Creature's computed path is blocked by another Creature or obstacle, THEN THE Application SHALL pause the approaching Creature's movement for up to 3 seconds before recalculating an alternate path to the same target tile.
13. EACH Creature SHALL have a configurable display name of 1–32 characters, persisted in the Persistence_Layer, that defaults to "The Builder", "The Researcher", and "The Debugger" respectively.

---

### Requirement 5: World Interaction — Diegetic Dashboard

**User Story:** As a user, I want to inspect any Creature or Workstation by clicking on it, so that the World itself serves as my task dashboard without requiring a separate panel.

#### Acceptance Criteria

1. WHEN the user clicks a Creature in the World, THE Application SHALL open a Creature Detail panel displaying: the Creature's name, current World_State_Machine state, active Task title and status, configured Provider and model, and the last three Task summaries from history.
2. WHEN the user clicks a Workstation in the World, THE Application SHALL open a Workstation Detail panel displaying: the currently assigned Task (if any), real-time execution output stream, any pending Approval_Request, and the Workstation's task history.
3. WHEN the user clicks empty World space (not a Creature or Workstation), THE Application SHALL close any open detail panels without animating the World.
4. THE Application SHALL render click hit-boxes as rectangles aligned to each Creature's bounding box and each Workstation's bounding box; hit-boxes SHALL be updated whenever a Creature moves to a new tile.
5. WHEN a Creature or Workstation detail panel is open and the underlying entity's state changes, THE Application SHALL update the panel content within 200 ms without closing or re-opening the panel.
6. WHEN a Workstation has an active Approval_Request displayed, THE Application SHALL render Approve and Deny buttons within the Workstation Detail panel; clicking Approve or Deny SHALL propagate the decision to the Provider_Adapter within 500 ms.

---

### Requirement 6: Task Submission and Lifecycle

**User Story:** As a user, I want to submit natural-language tasks to a specific creature and track them through execution, so that I always know what my AI agents are doing and what they produced.

#### Acceptance Criteria

1. THE Application SHALL provide a Task Submission form accessible from the Full_Workspace and via the keyboard shortcut Ctrl+Shift+N, containing: a free-text prompt field (minimum 10 characters, maximum 4000 characters), a Creature selector (Builder / Researcher / Debugger), a Provider selector (OpenAI Codex / Claude Code / OpenCode / Kiro CLI / OpenRouter), a model selector populated from the selected Provider's discovered model list, and a Submit button.
2. IF the user activates the Submit button and the prompt field contains fewer than 10 characters or more than 4000 characters, THEN THE Application SHALL disable submission and display an inline validation error on the prompt field indicating the character limit requirement.
3. WHEN the user submits a Task, THE Application SHALL assign it a unique UUID, set its status to Queued, and persist it in the Persistence_Layer within 500 ms.
4. WHEN a Task enters Queued state, IF the target Creature is in idle or sleeping state, THEN THE Application SHALL transition the Creature to walking state toward the Creature's Workstation within 1 second.
5. IF a Task enters Queued state and the target Creature is already in Running state executing another Task, THEN THE Application SHALL retain the new Task in Queued state until the target Creature transitions to idle state, at which point criterion 4 applies.
6. WHEN the Creature reaches the Workstation and the Task is in Queued state, THE Application SHALL set the Task status to Assigned and then set it to Running, initiating execution via the appropriate Provider_Adapter within 200 ms of the Creature reaching the Workstation.
7. WHEN a Task transitions to Running state, THE Application SHALL display a live-streaming execution output panel and append each Execution_Event token within 100 ms of receipt from the Provider_Adapter.
8. WHEN a Provider_Adapter emits an Approval_Request Execution_Event, THE Application SHALL set the Task status to Waiting_For_Approval, halt the Creature's working animation, and display in the Workstation Detail panel the Approval_Request's action description, affected target (file path or command), and an Approve and a Deny button within 500 ms.
9. WHEN the user approves an Approval_Request, THE Application SHALL resume the Task's Running state and notify the Provider_Adapter within 500 ms.
10. WHEN the user denies an Approval_Request, THE Application SHALL set the Task status to Failed with reason "Approval denied by user" and notify the Provider_Adapter within 500 ms.
11. WHEN a Task transitions to Completed, THE Application SHALL persist the full execution output, the completion timestamp, and a token-count summary comprising input token count, output token count, and total token count to the Persistence_Layer within 1 second.
12. WHEN a Task transitions to Failed, THE Application SHALL persist the error details and the failure timestamp to the Persistence_Layer within 1 second.
13. WHEN the user clicks the Cancel button in the execution output panel while a Task is in Running or Waiting_For_Approval state, THE Application SHALL send a cancellation signal to the Provider_Adapter and set the Task status to Cancelled within 2 seconds.
14. IF the Provider_Adapter does not acknowledge the cancellation signal within 2 seconds of the cancellation request, THEN THE Application SHALL set the Task status to Cancelled and record the reason as "Cancellation signal unacknowledged by Provider_Adapter".
15. IF a Task remains in Running state for more than 10 minutes without any Execution_Event from the Provider_Adapter, THEN THE Application SHALL transition the Task to Failed with reason "Execution timeout" and trigger the Creature's error_reaction state.
16. WHEN the Application is relaunched after an unexpected shutdown and a Task was in Running state at shutdown, THE Application SHALL set that Task's status to Failed with reason "Application shutdown during execution" within 5 seconds of relaunch and SHALL NOT automatically restart the Task.

---

### Requirement 7: Provider Adapter Architecture

**User Story:** As a developer, I want all provider integrations to conform to a common interface, so that adding new providers or switching providers per task requires no changes to the orchestration layer.

#### Acceptance Criteria

1. THE Application SHALL implement a Provider_Adapter interface with the following required operations: `discover(): Promise<ProviderInfo>` (checks installation and availability), `authenticate(credentials: Credentials): Promise<AuthResult>`, `listModels(): Promise<ModelInfo[]>`, `startSession(task: Task): Promise<SessionHandle>`, `streamEvents(session: SessionHandle): AsyncIterable<Execution_Event>`, `sendApproval(session: SessionHandle, approved: boolean): Promise<void>`, `cancelSession(session: SessionHandle): Promise<void>`.
2. THE Application SHALL implement exactly five Provider_Adapters, one for each Provider: OpenAI_Codex_Adapter, Claude_Code_Adapter, OpenCode_Adapter, Kiro_CLI_Adapter, and OpenRouter_Adapter.
3. WHEN the Application starts, THE Application SHALL run `discover()` on all five Provider_Adapters concurrently, completing all discovery calls within 5 seconds, and SHALL mark each Provider as Available or Unavailable in the UI based on the result.
4. IF a Provider_Adapter's `discover()` returns Unavailable or throws an error, THEN THE Application SHALL mark that Provider as Unavailable and SHALL display it as grayed-out in the Provider selector with a tooltip indicating the reason (e.g., the missing binary name or a summary of the thrown error), without propagating the failure to other Provider_Adapters.
5. THE Application SHALL ensure that all Provider_Adapter implementations are isolated in separate TypeScript modules under `src/adapters/`, with no direct cross-adapter imports; the orchestration layer SHALL communicate with adapters only through the common interface.
6. WHEN a Provider_Adapter emits a streaming Execution_Event of type `token`, THE Application SHALL append the token text to the execution output panel within 100 ms of receiving the event.
7. WHEN a Provider_Adapter emits a streaming Execution_Event of type `tool_call`, THE Application SHALL display the tool name and arguments in the execution output panel in a visually separate block (distinct from plain token output, using a bordered or highlighted container) within 200 ms of receiving the event.
8. WHEN a Provider_Adapter emits a streaming Execution_Event of type `file_write`, THE Application SHALL display the affected file path and the operation type (create, modify, or delete) in the execution output panel within 200 ms of receiving the event.
9. IF a Provider_Adapter's `authenticate()` returns an AuthResult indicating failure, THEN THE Application SHALL display an error message indicating the authentication failure in the Provider selector area and SHALL not proceed to `startSession()` for that Provider.
10. IF a Provider_Adapter's `streamEvents()` emits an Execution_Event of type `error` or the stream terminates before a session-complete signal is received, THEN THE Application SHALL display an error message indicating the session ended unexpectedly in the execution output panel and SHALL mark the session as failed.

---

### Requirement 8: OpenAI Codex Provider Adapter

**User Story:** As a user, I want to assign tasks to The Builder using OpenAI Codex, so that I can leverage Codex's coding-optimized model for implementation tasks.

#### Acceptance Criteria

1. THE OpenAI_Codex_Adapter SHALL discover availability by checking for the `codex` CLI binary in the system PATH and verifying that the `OPENAI_API_KEY` credential is present in the Credential_Store.
2. WHEN starting a Codex session, THE OpenAI_Codex_Adapter SHALL launch `codex` as an MCP server subprocess using the `--mcp-server` flag, exposing the `codex()` and `codex-reply()` tools as documented in the Codex platform API.
3. THE OpenAI_Codex_Adapter SHALL support model selection from the following Codex models: `gpt-5.1-codex`, `gpt-5-codex`, and any additional models returned by the OpenAI `/v1/models` endpoint with the `codex` capability flag.
4. WHEN the Codex MCP server emits streamed execution events, THE OpenAI_Codex_Adapter SHALL translate each event into the normalized Execution_Event format within 50 ms of receipt.
5. WHEN the Codex harness raises an approval policy gate (sandbox enforcement), THE OpenAI_Codex_Adapter SHALL translate this to an Approval_Request Execution_Event with the proposed command and rationale populated.
6. WHEN cancellation is requested, THE OpenAI_Codex_Adapter SHALL send a SIGTERM to the `codex` subprocess and await process exit within 3 seconds before sending SIGKILL.
7. IF the `codex` subprocess exits with a non-zero exit code, THEN THE OpenAI_Codex_Adapter SHALL emit a Failed Execution_Event with the subprocess stderr content as the error message.

---

### Requirement 9: Claude Code Provider Adapter

**User Story:** As a user, I want to assign tasks to The Researcher using Claude Code, so that I can leverage Claude's strengths for research, summarization, and complex analysis tasks.

#### Acceptance Criteria

1. THE Claude_Code_Adapter SHALL discover availability by checking for the `claude` CLI binary in the system PATH and verifying that the `ANTHROPIC_API_KEY` credential is present in the Credential_Store.
2. WHEN starting a Claude Code session, THE Claude_Code_Adapter SHALL invoke the Claude Agent SDK using the TypeScript `@anthropic-ai/claude-code` package, calling `query()` with `includePartialMessages: true` to enable streaming output.
3. THE Claude_Code_Adapter SHALL support model selection from the following Claude models: `claude-opus-4`, `claude-sonnet-4`, `claude-haiku-4`, and any additional models returned by the Claude `/v1/models` endpoint.
4. WHEN the Claude Agent SDK yields a `StreamEvent` of type `assistant_message`, THE Claude_Code_Adapter SHALL map token text to a `token` Execution_Event and forward it within 50 ms.
5. WHEN the Claude Agent SDK yields a `StreamEvent` of type `tool_use`, THE Claude_Code_Adapter SHALL map it to a `tool_call` Execution_Event with the tool name and serialized arguments.
6. WHEN Claude Code surfaces a permission request (e.g., before executing a shell command or writing a file outside the project root), THE Claude_Code_Adapter SHALL emit an Approval_Request Execution_Event with the operation type, target path, and proposed command populated.
7. WHEN cancellation is requested, THE Claude_Code_Adapter SHALL call the SDK's session abort method and confirm session termination within 2 seconds.
8. THE Claude_Code_Adapter SHALL use the headless mode (`claude -p "<prompt>" --output-format stream-json`) as a fallback if the SDK package is not installed.

---

### Requirement 10: OpenCode Provider Adapter

**User Story:** As a user, I want to assign tasks using OpenCode, so that I can take advantage of its support for 75+ providers and open-source model access.

#### Acceptance Criteria

1. THE OpenCode_Adapter SHALL discover availability by checking for the `opencode` CLI binary in the system PATH and verifying that at least one provider API key is present in the Credential_Store or in the OpenCode config file.
2. WHEN starting an OpenCode session, THE OpenCode_Adapter SHALL launch `opencode serve` as a background subprocess, wait for the HTTP server to respond on its advertised local port (up to 5 seconds), and then interact with the server via the OpenCode JS/TS SDK (`@opencode-ai/sdk`).
3. THE OpenCode_Adapter SHALL retrieve the available model list by calling the OpenCode server's model enumeration endpoint and SHALL present all returned models in the model selector grouped by underlying provider.
4. WHEN submitting a Task to the OpenCode server, THE OpenCode_Adapter SHALL use the SDK's session create and message send API, subscribing to the server-sent event stream for real-time token and tool events.
5. WHEN the OpenCode server emits a tool-execution event, THE OpenCode_Adapter SHALL translate it to a `tool_call` Execution_Event within 100 ms.
6. WHEN cancellation is requested, THE OpenCode_Adapter SHALL call the SDK's session abort endpoint and then send SIGTERM to the `opencode serve` subprocess within 3 seconds.
7. IF the `opencode serve` subprocess fails to start within 5 seconds, THEN THE OpenCode_Adapter SHALL return Unavailable from `discover()` with error message "OpenCode server failed to start".
8. WHEN the OpenCode_Adapter shuts down normally, THE OpenCode_Adapter SHALL cleanly terminate the `opencode serve` subprocess to avoid orphaned processes.

---

### Requirement 11: Kiro CLI Provider Adapter

**User Story:** As a user, I want to assign tasks through Kiro CLI, so that I can leverage Kiro's multi-agent crew capabilities and steering-driven workflows.

#### Acceptance Criteria

1. THE Kiro_CLI_Adapter SHALL discover availability by checking for the `kiro-cli` binary in the system PATH and verifying that Kiro authentication credentials are present in the Credential_Store (Kiro uses social/SSO login; the adapter SHALL check for the Kiro session token).
2. WHEN starting a Kiro CLI session, THE Kiro_CLI_Adapter SHALL spawn `kiro-cli acp` as a child process and establish JSON-RPC 2.0 communication over the process's stdin/stdout using the Agent Client Protocol (ACP).
3. THE Kiro_CLI_Adapter SHALL perform the ACP initialization handshake (sending `initialize` request, receiving `initialize` response with server capabilities) within 3 seconds of process start.
4. WHEN submitting a Task, THE Kiro_CLI_Adapter SHALL send an ACP `session/create` request followed by an ACP `session/prompt` request containing the task text, and SHALL subscribe to streamed ACP response events.
5. WHEN the `kiro-cli acp` process emits an ACP message of type `agent/message`, THE Kiro_CLI_Adapter SHALL map token content to a `token` Execution_Event within 50 ms.
6. WHEN the `kiro-cli acp` process emits an ACP message of type `tool/result`, THE Kiro_CLI_Adapter SHALL map it to a `tool_call` Execution_Event.
7. WHERE Kiro Crew subagent orchestration is available (kiro-cli version ≥ 1.23), THE Kiro_CLI_Adapter SHALL support submitting pipeline tasks as a Crew workflow by sending the appropriate ACP subagent dispatch message.
8. WHEN cancellation is requested, THE Kiro_CLI_Adapter SHALL send an ACP `session/cancel` request and await acknowledgement within 2 seconds before sending SIGTERM to the subprocess.
9. IF the `kiro-cli acp` process exits unexpectedly, THEN THE Kiro_CLI_Adapter SHALL emit a Failed Execution_Event and attempt to restart the subprocess for the next Task (not the current one).

---

### Requirement 12: OpenRouter Provider Adapter

**User Story:** As a user, I want to assign tasks via OpenRouter, so that I can access hundreds of models through a single unified API key without managing multiple provider credentials.

#### Acceptance Criteria

1. THE OpenRouter_Adapter SHALL discover availability by verifying that the `OPENROUTER_API_KEY` credential is present in the Credential_Store; no CLI binary is required.
2. THE OpenRouter_Adapter SHALL retrieve the current model list by calling `GET https://openrouter.ai/api/v1/models` with the API key and SHALL cache the result for 1 hour, refreshing on next Application launch.
3. WHEN submitting a Task, THE OpenRouter_Adapter SHALL POST to `https://openrouter.ai/api/v1/chat/completions` with `stream: true`, `model: <selected_model_id>`, and the task prompt formatted as a user message.
4. WHEN the OpenRouter streaming response emits a `data:` SSE event containing a delta token, THE OpenRouter_Adapter SHALL emit a `token` Execution_Event within 100 ms.
5. THE OpenRouter_Adapter SHALL include the `HTTP-Referer` header set to `app://whimsical-agent-village` and the `X-Title` header set to `Whimsical Agent Village` on all API requests, as required by OpenRouter's usage policies.
6. IF the OpenRouter API returns a 4xx or 5xx HTTP status, THEN THE OpenRouter_Adapter SHALL emit a Failed Execution_Event containing the HTTP status code and the error message from the response body.
7. WHEN cancellation is requested, THE OpenRouter_Adapter SHALL abort the in-flight HTTP request using the Fetch API's AbortController within 500 ms.
8. THE OpenRouter_Adapter SHALL NOT attempt to execute shell commands, write files, or perform any actions outside of generating a text completion, as OpenRouter is a model API and not an agentic runtime; tasks assigned to OpenRouter SHALL be treated as single-turn completions with the full output returned as one streaming sequence.

---

### Requirement 13: Credential Management and Security

**User Story:** As a user, I want my API keys and tokens stored securely, so that my credentials are never exposed in logs, config files, or the UI.

#### Acceptance Criteria

1. THE Application SHALL store all provider API keys, tokens, and secrets exclusively in the OS credential store (Windows Credential Manager via the Tauri `keyring` plugin), never in plaintext files, environment variables written to disk, or the Persistence_Layer database.
2. WHILE the settings UI is open, THE Application SHALL display all credential input fields as masked inputs (●●●●●●●●) with the show/hide toggle defaulting to the hidden state; WHEN the show toggle is activated, THE Application SHALL display only the last 4 characters of the credential with all preceding characters masked.
3. THE Application SHALL never include credential values in application logs, error messages, or crash reports; IF a logging call would capture a Credential value, THEN THE Application SHALL replace the value with the string `[REDACTED]`.
4. WHEN the Application transmits credentials to a Provider_Adapter, THE Application SHALL pass credentials as in-memory values through the Tauri IPC boundary only, never serialized to disk as part of the transmission.
5. THE Application SHALL define explicit workspace boundaries for each Provider_Adapter: each adapter's file-system tool access SHALL be scoped to the user-designated project directory, configurable per task, defaulting to the user's home directory Documents/WhimsicalAgentVillage/projects/ folder.
6. WHEN a Provider_Adapter requests access to a file path outside the configured workspace boundary, THE Application SHALL emit an Approval_Request Execution_Event before permitting the operation, regardless of whether the underlying provider requested one.
7. WHEN a user initiates saving a credential to the Credential_Store, THE Application SHALL display a confirmation modal showing the provider name and credential type (not the credential value) before persisting; this requirement applies to both new credentials and updates to existing credentials; IF the user dismisses or cancels the confirmation modal, THEN THE Application SHALL discard the pending credential value without writing to the Credential_Store.
8. IF the OS Credential_Store is unavailable or returns a write error when saving a credential, THEN THE Application SHALL display an error message indicating the save failed, and SHALL NOT persist the credential value to any alternative storage location.

---

### Requirement 14: Persistence Layer

**User Story:** As a user, I want my task history, creature configurations, and preferences to survive application restarts, so that I can review past work and maintain a consistent experience.

#### Acceptance Criteria

1. THE Application SHALL use a local SQLite database (via Tauri's `tauri-plugin-sql`) stored at `%APPDATA%\WhimsicalAgentVillage\data.db` for all Persistence_Layer data.
2. THE Persistence_Layer SHALL store the following entity types: Tasks (id, title, prompt, status, provider, model, creature_id, timestamps, execution_output, error_details, token_count), Creatures (id, name, provider_default, model_default, position_x, position_y), ProviderSettings (provider_id, is_available, last_discovered_at, model_cache_json), UserPreferences (key, value).
3. WHEN the Application performs a Persistence_Layer write, THE Application SHALL complete the write within 200 ms using WAL mode for non-blocking reads.
4. THE Application SHALL run SQLite schema migrations at startup using an embedded migration runner; IF a migration fails, THEN THE Application SHALL log the failure, display an error notification, and launch in read-only mode rather than corrupting the database.
5. THE Persistence_Layer SHALL retain Task records indefinitely but SHALL offer a manual "Clear history older than N days" action in preferences, defaulting to 90 days.
6. WHEN the Application exports task history, THE Application SHALL write a JSON file containing all Task records to a user-selected directory, excluding credential values.
7. THE Application SHALL persist each Creature's last known World tile position so that Creatures resume at their last position on next launch rather than resetting to their home Workstation.

---

### Requirement 15: Multi-Agent Workflows

**User Story:** As a user, I want to define sequential workflows involving multiple creatures, so that I can chain research, implementation, and debugging steps into a single coordinated pipeline.

#### Acceptance Criteria

1. THE Application SHALL allow the user to define a Pipeline: an ordered list of up to 5 Task definitions, each specifying a prompt template, a target Creature, and a Provider, where later tasks in the Pipeline may reference the output of earlier tasks using a `{{task_N_output}}` placeholder token.
2. WHEN a Pipeline is submitted, THE Application SHALL execute Tasks sequentially: each Task SHALL only enter Queued state after the preceding Task has reached Completed status.
3. IF any Task in a Pipeline reaches Failed status, THEN THE Application SHALL halt the Pipeline, set all remaining Tasks to Cancelled, and display a Pipeline failure notification identifying the failing step.
4. WHEN a Pipeline is executing, THE Application SHALL show all involved Creatures in animated states reflecting their actual Task_Lifecycle position (idle for not-yet-started, working for active, celebrating for completed, error_reaction for failed).
5. THE Application SHALL allow concurrent execution of independent Tasks (not part of the same Pipeline) across different Creatures simultaneously, provided each Creature has at most one active Task at a time.
6. THE Application SHALL NOT simulate inter-agent communication; all data passed between Pipeline steps SHALL be the literal text output of the preceding Task, formatted and truncated to the token budget of the next provider's model if necessary.

---

### Requirement 16: Audio

**User Story:** As a user, I want optional ambient and event sounds that enhance the cozy workshop atmosphere without being intrusive, so that I can enable them when I want immersion and disable them when I need focus.

#### Acceptance Criteria

1. THE Application SHALL initialize the Audio_Manager with all audio disabled (muted) by default on first launch.
2. WHERE the user has enabled audio in preferences, THE Audio_Manager SHALL play the following event-driven sounds: (a) soft footstep loop while a Creature is in walking state, (b) gentle typing/clicking loop while a Creature is in working state, (c) a short chime when a Task transitions to Completed, (d) a short low tone when a Task transitions to Failed, (e) a soft ambient rain loop at configurable volume.
3. THE Application SHALL provide an independent volume control for each audio category (ambient, creature sounds, event sounds) persisted in the Persistence_Layer.
4. THE Audio_Manager SHALL use the Web Audio API for all audio playback, loading audio assets from bundled files within the Tauri application bundle.
5. WHEN the Application window is hidden or minimized, THE Audio_Manager SHALL fade all audio to 0% volume within 1 second and pause all audio playback.

---

### Requirement 17: Settings and Configuration

**User Story:** As a user, I want a clear settings interface for managing providers, creatures, workspace paths, and preferences, so that I can configure the application without editing files.

#### Acceptance Criteria

1. THE Application SHALL provide a Settings panel accessible from Full_Workspace containing the following sections: Providers, Creatures, Workspace, Appearance, Audio, and Advanced.
2. THE Providers section SHALL list all five Providers with their availability status, a credential entry field (masked), a "Test Connection" button that calls `discover()` on-demand, and a model preference selector.
3. THE Creatures section SHALL allow the user to rename each Creature (1–32 characters, alphanumeric and spaces only), set a default Provider and model per Creature, and view per-Creature task statistics (total tasks, success rate).
4. THE Workspace section SHALL allow the user to configure the default project directory path per Provider_Adapter.
5. THE Appearance section SHALL provide toggles for: always-on-top, start in Compact_Mode, reduced motion (disables Particle_Effects and limits animation to state-change frames only), and Dark/Cozy color scheme variants.
6. WHEN the user saves a change in Settings, THE Application SHALL persist the change to the Persistence_Layer within 500 ms and apply the change immediately without requiring a restart, except for changes that affect the Tauri window configuration (always-on-top, transparency), which SHALL require the window to be re-initialized.

---

### Requirement 18: Property-Based Testing — Agent State Transitions

**User Story:** As a developer, I want formal property-based tests covering the World_State_Machine and Task_Lifecycle, so that state machine bugs are caught before they reach the user.

#### Acceptance Criteria

1. THE Application's test suite SHALL include property-based tests using `fast-check` that verify the following World_State_Machine invariant: FOR ALL valid event sequences of length 1–50 drawn from {task_assigned, task_completed, task_failed, approval_requested, approval_granted, approval_denied, idle_timer_fires}, the Creature's resulting state SHALL always be one of {idle, walking, working, sleeping, celebrating, error_reaction, waiting, stretching}.
2. THE Application's test suite SHALL include property-based tests that verify the Task_Lifecycle invariant: FOR ALL valid sequences of Task status transitions, the resulting Task status SHALL always be one of {Queued, Assigned, Running, Waiting_For_Approval, Completed, Failed, Cancelled}, and none of the following invalid transitions SHALL be reachable: Completed → Running, Completed → Queued, Failed → Running, Failed → Queued, Cancelled → Running, Cancelled → Queued.
3. THE Application's test suite SHALL include property-based tests that verify persistence round-trip consistency: FOR ALL valid Task objects generated by `fast-check`, serializing the Task to the Persistence_Layer and reading it back SHALL produce an object whose id, prompt, status, provider, model, creature_id, input_token_count, output_token_count, and error_details fields are equal to the original.
4. THE Application's test suite SHALL include property-based tests that verify concurrent event safety: FOR ALL orderings of concurrent Execution_Events from two simultaneous Provider_Adapter streams (one per Creature), no Creature's state SHALL be undefined or null after processing the event sequence, and the total number of events processed across both streams SHALL equal the total number of events emitted.
5. THE Application's test suite SHALL include property-based tests that verify Provider_Adapter contract compliance: FOR ALL valid Task inputs generated by `fast-check`, each Provider_Adapter mock SHALL return an AsyncIterable of Execution_Events where the last event is always of type `completion` or `error`, never terminating mid-stream without one of these terminal events.
6. THE Application's test suite SHALL include property-based tests that verify Character state consistency: FOR ALL World grid coordinates (x, y) where x is in range [1, 80] and y is in range [1, 45] generated by `fast-check`, the A* pathfinder SHALL return a non-empty valid path if and only if both start and end tiles are distinct and marked walkable in the walkability grid, and every tile in the returned path SHALL be marked walkable.

---

### Requirement 19: Kiro University Challenge — Steering Documents

**User Story:** As a developer using Kiro IDE to build this application, I want comprehensive steering documents that give Kiro's agent accurate, persistent context, so that every agent session produces code aligned with this product's architecture, visual style, and coding standards.

#### Acceptance Criteria

1. THE Application's repository SHALL contain the following Kiro steering documents in `.kiro/steering/`: `product-vision.md`, `architecture.md`, `ui-visual-design.md`, `coding-standards.md`, and `provider-integration.md`.
2. THE `product-vision.md` steering document SHALL describe the whimsy-first principle, the three core principles (Whimsy first, Real agents, World is the dashboard), the target user persona, and the cozy-workshop aesthetic reference.
3. THE `architecture.md` steering document SHALL describe the Tauri v2 + React architecture, the separation of concerns (desktop runtime / UI / world rendering / character simulation / agent orchestration / provider adapters / task management / persistence / credential management), and the Rust–TypeScript IPC boundary.
4. THE `ui-visual-design.md` steering document SHALL include the color palette (amber accent #C68B3C, dark glass overlay backgrounds, warm white text), typography choices, pixel-art sprite style guidelines, animation timing standards (150–300 ms transitions), and the Dynamic-Island-inspired mode-switching behavior.
5. THE `coding-standards.md` steering document SHALL define: TypeScript strict mode enabled, ESLint with `@typescript-eslint/recommended`, Prettier formatting, module naming conventions (PascalCase for classes, camelCase for functions, SCREAMING_SNAKE_CASE for constants), and the prohibition on `any` types in adapter interfaces.
6. THE `provider-integration.md` steering document SHALL document the Provider_Adapter interface contract, the five provider integration patterns (CLI subprocess, SDK, HTTP, ACP JSON-RPC), credential handling rules, and the approval flow protocol.

---

### Requirement 20: Kiro University Challenge — Hooks

**User Story:** As a developer, I want meaningful Kiro hooks that automate quality gates and catch issues early, so that the development loop enforces standards without manual intervention.

#### Acceptance Criteria

1. THE Application's repository SHALL contain the following Kiro hooks in `.kiro/hooks/`: `run-tests-on-save.json`, `lint-on-save.json`, `validate-provider-adapters.json`, and `doc-completeness-check.json`.
2. WHEN a TypeScript or React source file is saved, the `run-tests-on-save` hook SHALL run `vitest --run` against the changed file's corresponding test file and append the result to a `.kiro/hooks/test-results.log` file.
3. WHEN a TypeScript source file is saved, the `lint-on-save` hook SHALL run `eslint --fix` on the saved file and output any remaining lint errors to the Kiro session context.
4. WHEN a file matching `src/adapters/*.ts` is saved, the `validate-provider-adapters` hook SHALL run a static analysis script that verifies the saved adapter exports all required interface methods, reporting any missing methods as errors.
5. WHEN a steering document in `.kiro/steering/` is saved, the `doc-completeness-check` hook SHALL verify that all six required sections listed in Requirement 19 are present in the documents and report missing sections.

---

### Requirement 21: Kiro University Challenge — MCP Integration

**User Story:** As a developer building this application, I want meaningful MCP server integrations in the development workflow, so that Kiro agents have access to real project tools and data during development sessions.

#### Acceptance Criteria

1. THE Application's repository SHALL contain a `.kiro/mcp.json` configuration file defining MCP server connections for at least the following servers: (a) a `filesystem` MCP server scoped to the project root for safe file operations, (b) a `sqlite` MCP server connected to a development copy of the Persistence_Layer database for querying task history during development.
2. THE `.kiro/mcp.json` file SHALL include a `whimsical-village-dev` custom MCP server entry that exposes the following development tools: `list_creatures()` (returns the current creature configuration from the dev database), `list_tasks(status?: string)` (queries tasks from the dev database by optional status), and `validate_adapter(adapter_name: string)` (runs the provider adapter validation script and returns the result).
3. THE `whimsical-village-dev` MCP server SHALL be implemented as a Node.js process in `tools/mcp-server/` that reads from the dev SQLite database and executes the validation scripts.
4. WHEN the `whimsical-village-dev` MCP server's `validate_adapter` tool is called with a valid adapter name, THE MCP server SHALL return a JSON object containing `{ adapter: string, valid: boolean, missingMethods: string[], errors: string[] }` within 10 seconds.

---

### Requirement 22: Kiro University Challenge — Custom Agents

**User Story:** As a developer, I want specialized Kiro custom agent configurations for the three major technical domains of this project, so that each domain gets an agent persona optimized for its concerns.

#### Acceptance Criteria

1. THE Application's repository SHALL contain the following Kiro custom agent definition files in `.kiro/agents/`: `provider-integration-specialist.md`, `world-design-specialist.md`, and `qa-specialist.md`.
2. THE `provider-integration-specialist` agent SHALL have a system prompt that includes: expertise in TypeScript async iteration, subprocess management (Node.js child_process), ACP JSON-RPC 2.0 protocol, the five provider adapter patterns documented in this spec, credential security rules, and the Approval_Request flow.
3. THE `world-design-specialist` agent SHALL have a system prompt that includes: expertise in HTML Canvas 2D rendering, pixel-art sprite sheet animation, A* pathfinding on tile grids, the World_State_Machine design, particle effect systems, and the dark-glass + amber visual design language defined in the ui-visual-design steering document.
4. THE `qa-specialist` agent SHALL have a system prompt that includes: expertise in property-based testing with `fast-check`, Vitest configuration, the six PBT categories defined in Requirement 18, integration test design for Tauri IPC boundaries, and the provider adapter contract verification approach.
5. EACH custom agent definition SHALL reference the relevant steering documents by name so that Kiro loads them as additional context for sessions using that agent.

---

### Requirement 23: MVP Scope Boundaries

**User Story:** As a stakeholder, I want the MVP clearly defined with explicit in-scope and out-of-scope boundaries, so that the team delivers a polished vertical slice without scope creep.

#### Acceptance Criteria

1. THE MVP SHALL include all of the following in-scope items: working Tauri v2 desktop application with installer, Compact_Mode and Full_Workspace display modes, one World scene with three Workstations, three Creatures with sprite animations for all eight states, real task execution through all five Provider_Adapter implementations, accurate Task_Lifecycle tracking, secure credential storage, task history persistence, and complete Kiro University Challenge artifacts (steering documents, hooks, MCP server, custom agents, property-based tests).
2. THE MVP SHALL explicitly exclude the following out-of-scope items: multiplayer or cloud-synced worlds, resource or survival mechanics, procedural world generation, advanced character customization (sprite editing, new characters), physics simulation, unrestricted filesystem access, complex autonomous agent societies without user task submission, and Expanded_Mode (deferred to post-MVP).
3. WHEN a development decision would add a feature not listed in acceptance criterion 1 above, THE Application SHALL reject the addition and document the decision in a `docs/decisions/` Architecture Decision Record (ADR) file.

---

## Appendix A: Provider Capability Matrix

| Capability | OpenAI Codex | Claude Code | OpenCode | Kiro CLI | OpenRouter |
|---|---|---|---|---|---|
| **Integration method** | CLI subprocess + MCP server mode | Agent SDK (TS/Python) + headless CLI | `opencode serve` HTTP + JS/TS SDK | `kiro-cli acp` JSON-RPC 2.0 stdio | REST API (OpenAI-compat.) |
| **Streaming** | Yes (MCP events) | Yes (`includePartialMessages`) | Yes (SSE from server) | Yes (ACP stream events) | Yes (`stream: true` SSE) |
| **Tool/shell execution** | Yes (sandbox-enforced) | Yes (with permission gates) | Yes (provider-dependent) | Yes (with ACP tool bridge) | No (text completion only) |
| **Approval/permission flow** | Yes (sandbox policy gates) | Yes (permission requests) | Provider-dependent | Yes (ACP approval messages) | N/A |
| **Cancellation** | SIGTERM to subprocess | SDK session abort | SDK abort endpoint | ACP `session/cancel` | AbortController on fetch |
| **Model selection** | gpt-5.1-codex, gpt-5-codex | claude-opus-4, sonnet-4, haiku-4 | 75+ providers/models | Model via agent config | 200+ models via catalog |
| **Auth mechanism** | `OPENAI_API_KEY` env / keychain | `ANTHROPIC_API_KEY` env / keychain | Per-provider config in opencode config | Kiro SSO session token | `OPENROUTER_API_KEY` |
| **Multi-agent support** | Via Agents SDK orchestration | Via Agent SDK subagents | Via opencode skills/agents | Via Kiro Crew (v1.23+) | No (single-turn only) |
| **Requires local install** | Yes (codex CLI) | Yes (claude CLI or SDK) | Yes (opencode binary) | Yes (kiro-cli binary) | No |
| **Primary task type** | Coding, file editing | Coding, research, analysis | Coding, any LLM task | Coding, multi-step agentic | Any (model-dependent) |
| **Known limitation** | Requires API key + codex CLI in PATH | Requires Node.js for SDK; CLI as fallback | Server startup adds ~3s latency | ACP protocol is non-standard | No agentic capability; text only |

---

## Appendix B: Phased Implementation Roadmap

### Phase 0 — Repository and Capability Audit (Week 1)
- Initialize Tauri v2 + React 19 + TypeScript project.
- Configure ESLint, Prettier, Vitest, and `fast-check`.
- Audit all five provider CLI tools for installation and version compatibility on the target Windows machine.
- Create all Kiro steering documents, hooks, MCP server scaffolding, and custom agent definitions.
- Establish Persistence_Layer schema and migrations.

### Phase 1 — Application Shell (Week 2)
- Implement Tauri window management: always-on-top, tray minimize, multi-monitor restore.
- Implement Compact_Mode pill UI.
- Implement Full_Workspace layout with empty panels.
- Implement Credential_Store integration via Windows Credential Manager.
- Implement Settings panel (Providers and Preferences sections).

### Phase 2 — Living World (Weeks 3–4)
- Implement Canvas 2D World renderer with layered backgrounds.
- Create placeholder sprite sheets for all three Creatures (8 states × 4 frames minimum).
- Implement World_State_Machine for ambient behaviors.
- Implement A* pathfinder on walkability grid.
- Implement Particle_Effect system (ZZZ, sparkle, error).
- Implement click hit-box detection and Creature/Workstation detail panels.

### Phase 3 — Agent Execution (Weeks 5–6)
- Implement Provider_Adapter interface and orchestration layer.
- Implement OpenAI_Codex_Adapter (MCP server subprocess mode).
- Implement Claude_Code_Adapter (Agent SDK streaming).
- Implement Task Submission form and Task_Lifecycle state machine.
- Connect Task lifecycle events to World_State_Machine (creature walks to workstation, works, celebrates/reacts).
- Implement execution output streaming panel.
- Implement Approval_Request flow (surface in UI, route response to adapter).

### Phase 4 — Full Provider Coverage (Week 7)
- Implement OpenCode_Adapter (`opencode serve` + SDK).
- Implement Kiro_CLI_Adapter (ACP JSON-RPC subprocess).
- Implement OpenRouter_Adapter (streaming REST).
- Implement provider discovery and availability display in UI.
- Implement Pipeline (multi-agent sequential workflow).

### Phase 5 — Polish and Persistence (Week 8)
- Finalize pixel-art sprite sheets with full animation quality.
- Add ambient audio (rain, footsteps, typing, chimes) — disabled by default.
- Implement task history export.
- Implement "Clear history" preference.
- Performance profiling: verify 60 fps in Full_Workspace, < 2% CPU when hidden.
- Implement all property-based tests (Requirement 18).
- Smoke test all five provider adapters end-to-end.

### Phase 6 — Challenge Validation and Submission (Week 9)
- Verify all seven Kiro University Challenge lessons are demonstrably complete.
- Run full property-based test suite; document results.
- Validate MCP server tools with live Kiro session.
- Record a demo video showing: creature animations, real task execution on all five providers, approval flow, pipeline workflow, settings and credential management.
- Submit spec, implementation, and demo.

---

## Appendix C: Unresolved Questions, Risks, and Assumptions

### Unresolved Questions

1. **Codex CLI version lock**: The Codex `--mcp-server` flag behavior may change between CLI versions. The adapter should validate the CLI version at discovery time and document the minimum required version.
2. **Kiro CLI Windows availability**: `kiro-cli` on Windows may require WSL or a dedicated Windows binary. The Kiro_CLI_Adapter must handle the case where `kiro-cli` is only available via WSL and spawn the subprocess accordingly.
3. **OpenCode port configuration**: `opencode serve` selects a port dynamically. The adapter must parse the server startup output to determine the actual port rather than assuming a fixed one.
4. **Sprite art sourcing**: The spec requires pixel-art sprites. Whether these are AI-generated, licensed assets, or hand-drawn must be decided before Phase 2. All assets must be cleared for commercial use if the app is distributed.
5. **Tauri system tray on Windows**: Tray icon behavior on Windows 11 may require administrator permissions in certain enterprise environments. This should be tested on a clean Windows 11 installation.

### Risks

1. **Provider CLI not installed**: Users may not have any of the five provider CLIs installed. The app must gracefully degrade to showing only OpenRouter (which requires no local binary) as the default available provider.
2. **Subprocess lifecycle management on Windows**: Managing long-lived subprocesses (codex, opencode serve, kiro-cli acp) on Windows requires careful handling of process groups and cleanup to avoid orphaned processes on crash. Tauri's `shell` plugin must be configured with the `kill_children: true` option.
3. **ACP protocol stability**: The Kiro ACP protocol is described as an open standard but may evolve. The Kiro_CLI_Adapter should version-negotiate during the initialize handshake and fail gracefully if the version is incompatible.
4. **Canvas performance on integrated graphics**: Layered Canvas rendering at 60 fps may exceed the capability of low-end integrated GPUs. The Application should auto-detect GPU tier and reduce layer count or frame rate accordingly.
5. **Token budget for pipeline tasks**: When passing Task output to the next Pipeline step, the output may exceed the target model's context window. A truncation strategy must be defined (e.g., last N tokens of output).

### Assumptions

1. The target Windows version is Windows 10 22H2 or later, which ships WebView2 as a system component (Tauri v2 prerequisite).
2. Node.js 20 LTS is available on the development machine for building the app; it is bundled or not required at runtime.
3. All five provider CLI tools (codex, claude, opencode, kiro-cli) are installed by the user as a prerequisite; the app does not install them automatically.
4. The pixel-art visual style does not require WebGL; HTML Canvas 2D API is sufficient for the required rendering complexity.
5. The OpenRouter API's `/api/v1/models` endpoint returns a stable, filterable model list that includes at minimum models suitable for coding tasks (e.g., `openai/gpt-5.1-codex`, `anthropic/claude-sonnet-4`).
