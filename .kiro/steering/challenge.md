---
inclusion: manual
---

# Kiro University Challenge — Requirements and Evidence

Load this document when working on Kiro University Challenge compliance, writing challenge artifacts, preparing the demo, or verifying submission requirements. It is not needed for routine feature development.

---

## Overview

This project is a Kiro University Challenge submission. All seven required lessons must be demonstrably implemented. Evidence for each lesson must exist in the repository and be verifiable during the demo.

Do not claim a lesson is complete unless:
1. The implementation exists and functions correctly.
2. The evidence artifact exists in the repository.
3. It can be demonstrated live or pointed to in the recorded demo.

---

## Lesson 1: Spec-Driven Development

**Requirement:** Use Kiro's spec-driven development workflow to define and implement the application. Demonstrate that the specification guides development and that changes are reflected in it.

### Implementation

The project follows the full spec-driven workflow:
- `requirements.md` — 23 requirements with EARS-format acceptance criteria, glossary, provider capability matrix, phased roadmap, and risks register.
- `design.md` — technical design covering architecture, data models, state machines, IPC contract, component breakdown, traceability matrix, and implementation phases.
- `tasks.md` — concrete implementation task list generated from the design.

Every component traces back to a numbered requirement via the traceability matrix in `design.md §9`.

Architecture Decision Records in `docs/decisions/` document all deviations from requirements (e.g., `ADR-001-expanded-mode-deferred.md`).

### Evidence
- `.kiro/specs/whimsical-agent-village/requirements.md` — exists, 23 requirements, complete.
- `.kiro/specs/whimsical-agent-village/design.md` — exists, architecture + phases + traceability.
- `.kiro/specs/whimsical-agent-village/tasks.md` — generated from design, tasks trace to requirements.
- `docs/decisions/` — ADR files for deferred decisions.
- Demo shows: spec document open, a feature being built, the requirement it satisfies, the task that was checked off.

---

## Lesson 2: Steering Documents

**Requirement:** Create steering documents covering product vision, architecture, UI/visual design, coding standards, and provider integration. Ensure they are actually used by Kiro during development.

### Implementation

Five steering files in `.kiro/steering/`:

| File | Inclusion | Content |
|------|-----------|---------|
| `product.md` | Always | Product vision, three core principles, aesthetic, three creatures, ambient behavior rules, UX principles |
| `tech.md` | Always | Tauri v2 + React stack, project structure, separation of concerns, IPC contract, all 5 adapter patterns, task lifecycle, credential rules, coding conventions |
| `challenge.md` | Manual | This file — challenge requirements, evidence criteria, bonus opportunities |
| `workflow.md` | Always | Spec usage, definition of done, git conventions, rules for updating requirements |

Note: `product.md` and `tech.md` are included in every session. `challenge.md` is manually included when doing challenge-related work. `workflow.md` is included in every session.

The design.md §12 documents the specific impact of each steering document — e.g., `tech.md` prevents agents from choosing Electron or Vue; `product.md` prevents over-engineering the UX into a task manager.

### Evidence
- All steering files present in `.kiro/steering/`.
- During demo: open a Kiro session, show that product vision and architecture context are present, show a code generation result that respects the constraints (e.g., correct adapter isolation, amber color usage).

---

## Lesson 3: Hooks

**Requirement:** Identify meaningful Kiro hooks that automate development workflows. Hooks must perform useful, demonstrable work.

### Implementation

Four hook files in `.kiro/hooks/`:

| Hook | Trigger | Matcher | Action |
|------|---------|---------|--------|
| `run-tests-on-save.json` | `PostFileSave` | `\.(ts\|tsx)$` | `vitest --run` on the file's corresponding test; appends to `.kiro/hooks/test-results.log` |
| `lint-on-save.json` | `PostFileSave` | `src/.*\.ts$` | `eslint --fix` on the saved file; reports remaining errors to context |
| `validate-provider-adapters.json` | `PostFileSave` | `src/adapters/.*\.ts$` | Static analysis script verifies the saved adapter exports all required `ProviderAdapter` interface methods |
| `doc-completeness-check.json` | `PostFileSave` | `\.kiro/steering/.*\.md$` | Verifies all required sections are present in the modified steering document |

### Evidence
- All four hook files present in `.kiro/hooks/`.
- During demo: save a TypeScript file → show tests running automatically. Save an adapter file → show the validation script output.

---

## Lesson 4: Property-Based Testing

**Requirement:** Use property-based testing. Define meaningful properties and execute them. Retain evidence.

### Implementation

Six property groups using `fast-check` with `vitest`. All files in `src/__tests__/pbt/`.

| # | File | Requirement | Property |
|---|------|-------------|---------|
| 1 | `worldStateMachine.pbt.test.ts` | Req 18.1 | For all event sequences of length 1–50, creature state is always one of the 8 valid states |
| 2 | `taskLifecycle.pbt.test.ts` | Req 18.2 | Terminal states (Completed, Failed, Cancelled) never transition to Running or Queued |
| 3 | `persistenceRoundTrip.pbt.test.ts` | Req 18.3 | All Task fields survive SQLite round-trip (id, prompt, status, provider, model, creature, token counts, error details) |
| 4 | `concurrentEvents.pbt.test.ts` | Req 18.4 | Concurrent execution events from two provider streams never corrupt creature state; all events are processed |
| 5 | `adapterContract.pbt.test.ts` | Req 18.5 | All provider adapter mocks return an `AsyncIterable<ExecutionEvent>` that terminates with `completion` or `error` |
| 6 | `pathfinder.pbt.test.ts` | Req 18.6 | A* returns a valid non-empty path iff both start and end tiles are distinct and walkable; no path tile is unwalkable |

Each property runs a minimum of 1000 examples. Results documented in `docs/pbt-results.md` after Phase 5.

### Evidence
- All six PBT files present and passing.
- `docs/pbt-results.md` shows run counts, pass rates, and any found edge cases.
- During demo: run `pnpm test` live, show fast-check shrinking output, show pass count ≥ 1000 per property.

---

## Lesson 5: Powers

**Requirement:** Investigate and use Kiro Powers where appropriate. Document how they contribute.

### Implementation

Powers used during the development workflow (not runtime app features):

| Power / Capability | When Used | Contribution |
|--------------------|-----------|-------------|
| `context-gatherer` agent | Phases 3–4 (provider adapters) | Analyze provider SDK documentation; extract correct streaming event formats before writing adapter code |
| `semantic_reviewer` agent | End of each phase | Behavioral code review of diffs; checks credential handling security, adapter isolation, architecture compliance |
| `custom-agent-creator` | Phase 0 | Create the three custom agent definitions in `.kiro/agents/` |

### Evidence
- Session histories showing Powers invocations.
- Code reviews produced by `semantic_reviewer` stored in `docs/reviews/` or referenced in commit messages.
- During demo: show a `context-gatherer` session being used to analyze a provider SDK, show the resulting adapter code.

---

## Lesson 6: MCP Integration

**Requirement:** Integrate MCP in a meaningful way. Document configuration, permissions, tools, and how the integration is demonstrated.

### Implementation

Configuration file: `.kiro/mcp.json`

Three MCP servers:

**1. filesystem** — `@modelcontextprotocol/server-filesystem`
- Scoped to the project workspace root.
- Used by Kiro agents to safely read and write project files during development sessions.

**2. sqlite** — `@modelcontextprotocol/server-sqlite`
- Connected to a development copy of the Persistence_Layer database.
- Used to query task history, creature state, and provider settings during development.

**3. whimsical-village-dev** — custom server at `tools/mcp-server/index.ts`
- Exposes three development tools:
  - `list_creatures()` — returns current creature configuration from the dev database.
  - `list_tasks(status?)` — queries tasks from the dev database, optionally filtered by status.
  - `validate_adapter(adapter_name)` — runs the provider adapter validation script and returns `{ adapter, valid, missingMethods, errors }`.
- Implemented using `@modelcontextprotocol/sdk`. Reads from SQLite, executes validation scripts.
- Returns results within 10 seconds for `validate_adapter`.

### Evidence
- `.kiro/mcp.json` present with all three server configurations.
- `tools/mcp-server/index.ts` implemented and running.
- During demo: in a Kiro session, call `validate_adapter("OpenRouterAdapter")` → show the JSON response. Call `list_tasks("Running")` → show live task data.

---

## Lesson 7: Custom Agents

**Requirement:** Create meaningful custom Kiro agents for specialized development responsibilities. Avoid redundant agents with no useful specialization.

### Implementation

Three custom agent definition files in `.kiro/agents/`:

**`provider-integration-specialist.md`**
- Specialization: All five provider adapters, subprocess lifecycle management, ACP protocol, streaming event normalization, credential security, approval flow.
- References steering: `tech.md`, `product.md`.
- Uses when: implementing or debugging any of the five `ProviderAdapter` implementations, writing subprocess management code, handling streaming events.

**`world-design-specialist.md`**
- Specialization: HTML Canvas 2D rendering, pixel-art sprite sheet animation, A* pathfinding on tile grids, World_State_Machine design, particle effect systems, the dark-glass + amber visual language.
- References steering: `product.md`, `tech.md`.
- Uses when: working on `src/world/`, designing sprite sheets, implementing the world renderer, building the particle system.

**`qa-specialist.md`**
- Specialization: Property-based testing with `fast-check`, Vitest configuration, the six PBT property groups (§11 of design.md), integration test design for Tauri IPC boundaries, provider adapter contract verification.
- References steering: `tech.md`.
- Uses when: writing PBT tests, debugging flaky tests, expanding test coverage, verifying the MCP `validate_adapter` tool.

### Evidence
- All three agent definition files present in `.kiro/agents/`.
- During demo: open a session using the `provider-integration-specialist` agent, show it generates adapter code that correctly follows the interface contract and credential rules.

---

## Bonus Opportunities

### Kiro Web Bonus

**Requirement (verify against official challenge instructions):** A demonstrable Kiro Web workflow.

**Plan:**
- Verify exact requirements from official challenge documentation before claiming this bonus.
- If applicable, create a Kiro Web workflow that demonstrates the spec-driven development process for this project.
- Document the workflow in `docs/kiro-web-workflow.md`.

**Status:** Pending official requirement verification.

### Power Packaging Bonus

**Requirement (verify against official challenge instructions):** A publicly accessible Power repository with `plugin.json`, bundled resources, and a reproducible installation guide.

**Plan:**
- Verify exact requirements from official challenge documentation.
- If applicable, create a `power/` directory with `plugin.json`, steering files, agents, and hooks packaged for reuse.
- Publish to a public repository with installation instructions in `README.md`.

**Status:** Pending official requirement verification.

---

## Challenge Evidence Checklist

Use this checklist before submission. Every item must be checked off.

### Lesson 1 — Spec-Driven Development
- [ ] `requirements.md` complete with 23 requirements and acceptance criteria
- [ ] `design.md` complete with architecture, data models, state machines, traceability matrix
- [ ] `tasks.md` generated and used for implementation
- [ ] `docs/decisions/ADR-001-expanded-mode-deferred.md` exists
- [ ] Demo shows spec-guided development workflow

### Lesson 2 — Steering Documents
- [ ] `product.md` present and loaded in sessions (always)
- [ ] `tech.md` present and loaded in sessions (always)
- [ ] `challenge.md` present (manual inclusion)
- [ ] `workflow.md` present and loaded in sessions (always)
- [ ] Demo shows steering context influencing generated code

### Lesson 3 — Hooks
- [ ] `run-tests-on-save.json` present and fires on `.ts`/`.tsx` save
- [ ] `lint-on-save.json` present and fires on `src/` save
- [ ] `validate-provider-adapters.json` present and fires on `src/adapters/` save
- [ ] `doc-completeness-check.json` present and fires on `.kiro/steering/` save
- [ ] Demo shows at least one hook firing with visible output

### Lesson 4 — Property-Based Testing
- [ ] All 6 PBT files present in `src/__tests__/pbt/`
- [ ] All 6 properties pass with ≥ 1000 runs each
- [ ] `docs/pbt-results.md` documents results
- [ ] Demo shows `pnpm test` running, fast-check output visible

### Lesson 5 — Powers
- [ ] `context-gatherer` used during adapter development (session evidence)
- [ ] `semantic_reviewer` used at end of at least one phase
- [ ] Evidence of Powers usage documented in `docs/reviews/` or commit messages
- [ ] Demo shows a Powers invocation

### Lesson 6 — MCP Integration
- [ ] `.kiro/mcp.json` present with all three server configurations
- [ ] `tools/mcp-server/index.ts` implemented
- [ ] All three MCP tools (`list_creatures`, `list_tasks`, `validate_adapter`) working
- [ ] Demo shows MCP tools called from a Kiro session with real responses

### Lesson 7 — Custom Agents
- [ ] `provider-integration-specialist.md` present in `.kiro/agents/`
- [ ] `world-design-specialist.md` present in `.kiro/agents/`
- [ ] `qa-specialist.md` present in `.kiro/agents/`
- [ ] Each agent references its relevant steering documents
- [ ] Demo shows a custom agent session with specialized output

### Bonus (pending verification)
- [ ] Verify official Kiro Web bonus requirements
- [ ] Verify official Power Packaging bonus requirements
- [ ] Implement if eligible
