# Product Vision — Whimsical Agent Village

This document is loaded into every Kiro session for this project. It defines what the product is, what it must feel like, and the non-negotiable UX principles that govern every decision.

---

## What This Product Is

Whimsical Agent Village is a Windows desktop application where AI agents are represented as small animated creatures living inside a miniature fantasy workshop. Users assign real tasks to these creatures. The actual work is executed by a connected AI provider. The creature's behavior and animations reflect genuine execution events.

This is simultaneously:
- A cozy fantasy desktop companion.
- A fully functional multi-provider AI agent workspace.
- A Kiro University Challenge submission demonstrating spec-driven development.

It is **not** a chatbot. It is **not** a conventional SaaS dashboard. It is **not** a game with fake AI.

---

## Core Principles

These three principles override every other design decision. When in doubt, refer back to them.

### 1. Whimsy First
The application must feel charming, warm, cozy, and alive. The world and characters are the primary interface — not decoration layered onto a dashboard.

Every implementation decision must ask: "Does this feel like a miniature living world, or does it feel like a task manager with icons?"

### 2. Real Agents, Not Pretend Agents
Every creature's work must correspond to actual execution by a supported AI provider. The following are strictly forbidden:
- Fabricated agent outputs.
- Fake progress indicators when the provider has not reported progress.
- Simulated tool calls or file writes.
- Pretending a task is complete before the provider confirms it.

The world may simulate harmless ambient creature behaviors. All task-related behavior must reflect real execution events.

### 3. The World Is the Dashboard
Traditional concepts — agent lists, task queues, execution logs, provider settings — must be accessible through the world or a clean supporting interface. The primary experience is the miniature world, not a panel of tables and cards.

---

## Visual Aesthetic

The application must feel like a miniature fantasy workshop sitting inside a sophisticated desktop utility.

### Environment references
- Minecraft copper golem.
- Tiny wooden houses with warm interiors.
- Copper and brass machinery with gears and steam fittings.
- Warm amber lanterns casting soft halos.
- Moss, plants, and filled bookshelves.
- Small desks with tiny computers.
- Rainy windows and cozy nighttime atmosphere.

### Color language
- Amber accent: `#C68B3C` (±15% hue variation acceptable).
- Dark translucent glass backgrounds for UI overlays (≤20% opacity).
- Warm white body text.
- Soft, rounded UI elements (≥8px corner radius).

### What to avoid
- Oversaturated cartoon palette.
- Generic kawaii or chibi style.
- Corporate mascot characters.
- Generic humanoid avatars.
- SaaS blues and grays in the world scene.
- Flat, unlit sprite art.

---

## The Three Creatures

These are permanent characters. Their identities must not change.

### The Builder
- Appearance: copper golem with articulated joints.
- Workstation: copper workshop bench with tools.
- Personality: industrious, focused, reliable.
- Best suited for: coding and implementation tasks.

### The Researcher
- Appearance: owl-wizard creature wearing a small pointed hat.
- Workstation: library reading desk with books and a small lamp.
- Personality: curious, methodical, scholarly.
- Best suited for: research, analysis, and summarization tasks.

### The Debugger
- Appearance: small sleepy mechanical bug with antennae.
- Workstation: examination table with magnifying glass and mechanical parts.
- Personality: sleepy but sharp, reactive, detail-oriented.
- Best suited for: debugging, review, and testing tasks.

Each creature has eight animation states: `idle`, `walking`, `working`, `sleeping`, `celebrating`, `error_reaction`, `waiting`, `stretching`.

---

## Creature Behavior Rules

### Ambient behaviors (when idle, no task assigned)
Creatures cycle through lightweight ambient behaviors on a 10–30 second schedule:
- Walk to a random nearby tile (40% weight).
- Stretch in place (20% weight).
- Sit at a nearby prop (20% weight).
- Sleep briefly for 5–8 seconds (20% weight).

These behaviors are purely cosmetic. They do not represent agent activity. They must never be surfaced as task execution.

### Task-driven behaviors
When a task is assigned:
1. Creature transitions idle → walking toward its workstation.
2. Creature arrives → transitions to working.
3. Animations reflect real provider events (working during execution, waiting during approval requests).
4. On completion → celebrating then idle.
5. On failure → error_reaction then idle.

The transition sequence is always driven by real task lifecycle events, not a timer or simulation.

---

## Desktop Interaction Model — Dynamic Island Inspiration

The application has three display modes:

### Compact Mode (primary resting state)
- Floating pill ≤320×64px near the top of the screen.
- Shows active creature thumbnail, state label, task title or "idle".
- Unobtrusive while the user works in other applications.

### Full Workspace
- Complete window opened by double-clicking the pill.
- Shows the full world scene (≥60% of window area), task submission panel, execution output, history, and settings.
- Still feels like the world — not a dashboard.

### Expanded Mode
- Deferred to post-MVP (see design.md §8, ADR-001).
- Will show a condensed world view on hover when implemented.

---

## UX Principles

1. **The world comes first.** Clicking a creature or workstation is the primary way to inspect agent status. Panels are supplementary.

2. **No fabricated feedback.** If the provider does not report a tool call, the creature must not animate as though one occurred. Use honest generic states.

3. **Unobtrusive by default.** The compact pill must not demand attention. Notifications are opt-in.

4. **Audio off by default.** Sound enhances immersion but must never be forced on the user. All audio is muted on first launch.

5. **Performance is a UX requirement.** The world must run at 60fps in Full Workspace. CPU usage must drop below 2% when the window is hidden or minimized. Creatures do not animate while the window is invisible.

6. **Credentials are never visible.** API keys are masked at all times except the last 4 characters. They are never written to disk in plaintext. They never appear in logs.

---

## MVP Scope Reminder

The MVP delivers a complete vertical slice:
- Working Tauri v2 desktop app.
- One cozy workshop scene.
- Three animated creatures.
- Real task execution via all five provider adapters.
- Accurate task lifecycle.
- Secure credential handling.
- Demonstrable Kiro University Challenge workflows.

Out of scope for MVP: multiplayer, cloud orchestration, resource/survival mechanics, procedural worlds, advanced character customization, physics, Expanded Mode.
