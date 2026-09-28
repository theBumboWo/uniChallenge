# Development Workflow — Whimsical Agent Village

This document is loaded into every Kiro session. It defines how the approved spec and requirements are used during development, the definition of done, git conventions, and the rules for updating documentation.

---

## Spec-First Rule

**Implementation does not begin until the relevant spec artifact exists.**

The approved spec documents live at:
- `.kiro/specs/whimsical-agent-village/requirements.md` — 23 requirements, authoritative source of truth
- `.kiro/specs/whimsical-agent-village/design.md` — technical design, architecture, phases, traceability matrix
- `.kiro/specs/whimsical-agent-village/tasks.md` — implementation task list generated from the design

Before writing any implementation code, identify which requirement number and which design section the work satisfies. If neither exists, the work is out of scope until the spec is updated.

---

## How to Use the Spec During Development

### Starting a task
1. Find the task in `tasks.md`. Note its phase, the requirement(s) it satisfies, and the completion criteria.
2. Read the relevant requirement(s) in `requirements.md`. Every acceptance criterion is a test you need to pass.
3. Read the relevant component description in `design.md §3` and any IPC commands in `design.md §6`.
4. Check the traceability matrix in `design.md §9` to confirm which component is responsible.

### Writing code
- Follow the component file locations defined in `tech.md` and `design.md §3`. Do not create files in new locations without a corresponding design update.
- Implement exactly what the acceptance criteria require. Do not add unrequested features, abstractions, or defensive code beyond the task scope.
- Match the data model types from `design.md §4`. Do not invent new types without updating the design.
- Follow all architectural rules in `tech.md` — separation of concerns, import restrictions, IPC pattern.

### Completing a task
Mark the task complete in `tasks.md` only after all acceptance criteria for the corresponding requirement are met. See "Definition of Done" below.

---

## Definition of Done

A task is done when ALL of the following are true:

1. **Code written** — the implementation exists at the correct file path from `design.md §3`.
2. **Acceptance criteria met** — every criterion in the corresponding `requirements.md` requirement passes. If a criterion has a measurable bound (e.g., "within 100 ms", "≤320×64px"), the bound is verified.
3. **Tests pass** — `pnpm test` passes with no failures. If the task touches a PBT-covered area (see `design.md §9` traceability matrix), the relevant PBT file runs without shrink failures.
4. **Lint passes** — `pnpm lint` produces no errors (the `lint-on-save` hook catches most of these automatically).
5. **No new `any` types** — no untyped adapter interfaces or public APIs introduced.
6. **Security rules respected** — if the task touches credentials, subprocess spawning, or filesystem access, all rules from `tech.md` (Credential Security Rules) are followed.
7. **No fabricated agent behavior** — if the task involves creature animations during task execution, all animations are driven by real `ExecutionEvent` values from the provider adapter, not timers or simulations.

### Phase completion
A phase is done when all its tasks are done AND:
- The phase completion criteria from `design.md §7` are verifiable.
- No regressions in previous phases (full `pnpm test` passes).
- Any new ADRs for decisions made during the phase are written to `docs/decisions/`.

---

## Rules for Updating Requirements

The requirements document is the authoritative specification. It must not be changed casually.

### When a change IS allowed
- A genuine gap is discovered (a scenario that no requirement covers and that is clearly needed).
- An acceptance criterion is found to be untestable or contradictory.
- An external dependency changes (e.g., a provider API breaks an assumption).

### When a change is NOT allowed
- You want to simplify implementation by weakening a requirement.
- A requirement is difficult and you want to defer it without discussion.
- You want to add a feature that wasn't requested.

### How to propose a change
1. Document the proposed change in a comment or note — what would change, why, what the impact is.
2. Present it for review before modifying the file.
3. If approved, update `requirements.md` and note the change in the relevant ADR or a commit message.
4. If the change affects the design, update `design.md` accordingly (traceability matrix, component descriptions, phase deliverables).

### Expanding scope
Any addition to the MVP scope must be explicitly discussed. Additions are out of scope until they appear in `requirements.md` and `design.md`. Do not implement features not listed in `requirements.md §23.1`.

---

## Rules for Updating the Design

`design.md` describes decisions that were made. It is a living document but not a scratch pad.

- **Do update** when: a component's interface changes, a new IPC command is added, a phase deliverable changes, a risk materializes and the mitigation changes behavior.
- **Do not update** as a post-hoc rationalization of code that diverged from the design.
- When a design decision changes, create or update an ADR in `docs/decisions/`.
- The traceability matrix in `design.md §9` must stay accurate. If a component changes ownership of a requirement, update the matrix.

---

## Git Conventions

### Branch naming
```
phase/0-foundation
phase/1-app-shell
phase/2-living-world
phase/3-agent-execution
phase/4-provider-coverage
phase/5-polish
phase/6-challenge-validation
feat/short-description        # for features within a phase
fix/short-description         # for bug fixes
docs/short-description        # for documentation-only changes
```

### Commit message format
```
<type>(<scope>): <short description>

<optional body explaining the why, not the what>

Req: #N                        # reference the requirement number
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`

Scopes match the directory structure: `world`, `adapters`, `agents`, `components`, `store`, `services`, `tauri`, `steering`, `hooks`, `mcp`

Examples:
```
feat(adapters): implement OpenRouterAdapter streaming
Req: #12

fix(world): correct A* pathfinder to avoid diagonal wall clipping
Req: #4

test(pbt): add persistence round-trip property (Property 3)
Req: #18

docs(steering): update tech.md with correct Tauri plugin versions
```

### Commit rules
- Never commit with `pnpm test` failing.
- Never commit with `pnpm lint` producing errors.
- Never commit plaintext credentials or API keys. `.env` files are `.gitignore`d.
- Stage specific files rather than `git add .` to avoid committing unrelated changes.
- Never use `--no-verify` to skip hooks.
- Never force-push to `main`.

### Branching strategy
- `main` — stable, phase-complete code only.
- Phase branches merge to `main` when the phase completion criteria are verified.
- Feature branches merge to the current phase branch, not directly to `main`.
- Pull requests (or equivalent) require: tests passing, lint clean, no plaintext secrets.

---

## Testing Workflow

```
pnpm test          # Run all tests once (Vitest, no watch)
pnpm test --run    # Alias for above
pnpm lint          # ESLint check
pnpm lint:fix      # ESLint auto-fix
pnpm build         # Full production build (Vite + Tauri)
pnpm tauri dev     # Development mode (hot reload)
pnpm tauri build   # Production installer build
```

### When to run tests
- Before every commit.
- After every merge.
- During Phase 5: run PBT suite with `--reporter=verbose` to verify ≥1000 runs per property.
- The `run-tests-on-save` hook runs relevant tests automatically on file save.

### When tests fail
- Fix the failure before continuing. Do not disable tests.
- If a PBT property finds a counterexample, fix the production code (not the test). fast-check will print the minimal failing case.
- If a test reveals a gap in the spec, follow the "Rules for Updating Requirements" above.

---

## Provider Development Guidelines

When implementing or debugging a provider adapter:

1. **Read the requirements first.** Each adapter has its own requirement (Req 8–12). Read every acceptance criterion before writing a line.
2. **Use the `provider-integration-specialist` custom agent** for sessions focused on adapter work. It has context for all five integration patterns.
3. **Do not fabricate events.** If the provider API doesn't emit a `tool_call` event, the adapter must not invent one. Use honest generic states.
4. **Test with the real provider when possible.** The `validate_adapter` MCP tool (`tools/mcp-server/`) checks the adapter interface contract.
5. **OpenRouter first.** OpenRouter requires no local binary. Use it to verify the end-to-end streaming pipeline before debugging subprocess-based adapters.

---

## World and Animation Guidelines

When implementing world rendering or creature animations:

1. **Use the `world-design-specialist` custom agent** for sessions focused on Canvas, sprites, or the World_State_Machine.
2. **Animations must reflect real events.** The World_State_Machine transitions are driven by `TaskOrchestrator` events, not timers simulating agent work.
3. **Ambient behaviors are cosmetic only.** The 40/20/20/20 weighted idle schedule must never be mistaken for or surfaced as agent activity.
4. **Performance first.** Check frame time after adding any new rendering feature. Target: <16.7 ms per frame in Full Workspace.
5. **Sprites go in `public/sprites/`.** Naming convention: `{creatureId}_{state}.png` (e.g., `builder_working.png`).

---

## Security Checklist (run before any credential-related commit)

- [ ] No credential values in any `console.log`, `log::info!`, or error message.
- [ ] No credential values written to SQLite.
- [ ] No credential values passed as URL parameters or query strings.
- [ ] Credential inputs in the UI use `type="password"` by default.
- [ ] The save confirmation modal is shown before any keychain write.
- [ ] Keychain write failure shows an error toast — no silent fallback.
- [ ] `[REDACTED]` replaces any credential value that would appear in output.

---

## Scope Guardrails

If you find yourself about to implement any of the following, stop and check the requirements:

| Temptation | Status | Why not |
|-----------|--------|---------|
| Expanded Mode hover panel | Post-MVP | Deferred in Req 23.2, ADR-001 |
| Multiplayer / shared villages | Out of scope | Explicitly excluded by Req 23.2 |
| Cloud orchestration infrastructure | Out of scope | Explicitly excluded |
| Resource / survival mechanics | Out of scope | Explicitly excluded |
| Procedural world generation | Out of scope | Explicitly excluded |
| Physics simulation | Out of scope | Explicitly excluded |
| Character sprite editor | Out of scope | Explicitly excluded |
| Autonomous agent societies | Out of scope | Explicitly excluded |
| WebGL / Pixi.js / Three.js | Out of scope | Canvas 2D is the approved renderer |
| Electron | Out of scope | Tauri v2 is the approved runtime |
| Redux | Out of scope | Zustand is the approved state manager |

Any deviation requires a new requirement in `requirements.md`, a design update in `design.md`, and an ADR.
