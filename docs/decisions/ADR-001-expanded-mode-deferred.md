# ADR-001: Expanded Mode Deferred to Post-MVP

**Date:** 2026-09-28
**Status:** Accepted
**Deciders:** Project team
**Requirements reference:** Req 2.1, Req 2.3, Req 2.4, Req 23.2

---

## Context

Requirements document Req 2.1 defines three display modes: Compact Mode, Expanded Mode, and Full Workspace.

Req 2.3 specifies that hovering over the Compact Mode pill for more than 300 ms transitions to Expanded Mode within 150 ms. Req 2.4 specifies that focus-away for more than 2 seconds collapses back to Compact Mode.

Req 23.2 explicitly lists Expanded Mode as out-of-scope for the MVP: *"THE MVP SHALL explicitly exclude the following out-of-scope items: ... Expanded_Mode (deferred to post-MVP)."*

These two requirements are contradictory. Req 23.2 (the MVP scope definition) takes precedence.

---

## Decision

Expanded Mode (hover-activated condensed World view panel) is deferred to post-MVP.

The MVP implements:
- Compact Mode pill (≤320×64px, always visible)
- Full Workspace (complete window, double-click to open)

Expanded Mode hover transitions (Req 2.3, Req 2.4) will not be implemented in the current development cycle.

---

## Rationale

1. **Req 23.2 is the explicit MVP boundary.** It was written after Req 2 and takes precedence as the authoritative scope definition.

2. **Expanded Mode has no value without the World.** It requires a condensed World view, which depends on Phase 2 (Living World). Building the hover state machine before the World exists inverts the dependency order.

3. **Mode transitions are additive.** Compact ↔ Full Workspace covers the entire useful interaction surface. Expanded Mode is an intermediate convenience, not a required path.

4. **Scope risk.** Implementing Expanded Mode hover logic in Phase 1 risks scope creep and delays the Phase 2 World and Phase 3 execution pipeline, which are the core product value.

---

## Consequences

- Req 2.1 acceptance criterion 1 ("three distinct display modes") is partially deferred.
- Req 2.3 (hover expand transition) is deferred.
- Req 2.4 (focus-away collapse) is deferred.
- Req 2.8 (resolution guard for Expanded Mode) has no effect in MVP.
- All other Req 2 criteria (Compact pill dimensions, Full Workspace contents, World continues across mode switches, screen resolution guard) remain in scope.

**To revisit:** When post-MVP work begins, create a new branch `feat/expanded-mode`, implement against Req 2.3–2.4, and close this ADR as superseded.

---

## Alternatives Considered

**Implement stub:** Add the hover listener but not the panel content. Rejected — a stub creates UI surface with no feedback, which is worse than no hover response.

**Move Expanded Mode to Phase 2:** Rejected — it depends on the World renderer being complete, which is Phase 2's output, not input.
