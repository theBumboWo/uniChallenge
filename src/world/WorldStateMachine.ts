/**
 * World State Machine — Req 4.4, 4.5, 4.7–12, Req 18.1
 *
 * One instance per creature. Runs at 10 Hz via setInterval (decoupled from rAF).
 * All transitions are driven by explicit events — ambient behaviours are scheduled
 * by the idle timer, task transitions by TaskOrchestrator events (Phase 3).
 *
 * IMPORTANT: Ambient behaviour animations NEVER represent agent execution.
 * Task-driven transitions ONLY fire when TaskOrchestrator emits a real event.
 */

import { useAppStore } from "../store/appStore";
import type { CreatureId, Tile } from "../store/appStore";
import { findPath, occupiedSet, GRID_WIDTH } from "./Pathfinder";

// ── WSM Event types ────────────────────────────────────────────────────────────

export type WSMEvent =
  | { type: "TASK_ASSIGNED"; taskId: string; workstationTile: Tile }
  | { type: "TASK_COMPLETED" }
  | { type: "TASK_FAILED" }
  | { type: "APPROVAL_REQUESTED" }
  | { type: "APPROVAL_GRANTED" }
  | { type: "APPROVAL_DENIED" }
  | { type: "IDLE_TIMER_FIRED"; behaviour: AmbientBehaviour }
  | { type: "PATH_BLOCKED" }
  | { type: "ARRIVED_AT_WORKSTATION" }
  | { type: "ARRIVED_AT_IDLE_DEST" }
  | { type: "ANIM_COMPLETE" }; // celebrating / error_reaction / stretching finished

export type AmbientBehaviour = "walk" | "stretch" | "sit" | "sleep";

// ── Weighted ambient behaviour selection (Req 4.5: 40/20/20/20) ────────────────

const AMBIENT_WEIGHTS: [AmbientBehaviour, number][] = [
  ["walk",    0.40],
  ["stretch", 0.20],
  ["sit",     0.20],
  ["sleep",   0.20],
];

export function pickAmbientBehaviour(): AmbientBehaviour {
  const r = Math.random();
  let cumulative = 0;
  for (const [behaviour, weight] of AMBIENT_WEIGHTS) {
    cumulative += weight;
    if (r < cumulative) return behaviour;
  }
  return "walk";
}

/** Random idle interval: 10–30 seconds in ms (Req 4.5). */
export function randomIdleInterval(): number {
  return (10 + Math.random() * 20) * 1000;
}

// ── WorldStateMachine class ────────────────────────────────────────────────────

export class WorldStateMachine {
  private creatureId: CreatureId;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // Timers (in ms, decremented each tick)
  private idleTimer = randomIdleInterval();
  private blockTimer = 0;
  private animTimer = 0; // for celebrating (1500ms), error_reaction (2000ms), stretching (800ms)
  private sleepTimer = 0; // 5000–8000ms (Req 4.5)

  constructor(creatureId: CreatureId) {
    this.creatureId = creatureId;
  }

  start() {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => this.tick(), 100); // 10 Hz
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /** Dispatch an external event (from TaskOrchestrator or internal timer). */
  dispatch(event: WSMEvent) {
    const store = useAppStore.getState();
    const creature = store.creatures[this.creatureId];
    const state = creature.animationState;

    switch (event.type) {
      // ── Task-driven transitions ──────────────────────────────────────────
      case "TASK_ASSIGNED": {
        if (state === "idle" || state === "sleeping" || state === "stretching" || state === "sitting" as never) {
          this.walkToWorkstation(event.workstationTile);
          store.actions.updateCreature(this.creatureId, {
            activeTaskId: event.taskId,
            animationState: "walking",
          });
        }
        // If already walking/working: ignore (creature already heading there)
        break;
      }

      case "ARRIVED_AT_WORKSTATION": {
        if (state === "walking" && creature.activeTaskId) {
          store.actions.updateCreature(this.creatureId, {
            animationState: "working",
            currentPath: [],
            targetPosition: null,
          });
        }
        break;
      }

      case "TASK_COMPLETED": {
        if (state === "working" || state === "waiting") {
          this.animTimer = 1500; // celebrating lasts 1500ms (Req 4.9)
          store.actions.updateCreature(this.creatureId, { animationState: "celebrating" });
        }
        break;
      }

      case "TASK_FAILED": {
        if (state === "working" || state === "waiting") {
          this.animTimer = 2000; // error_reaction lasts 2000ms (Req 4.10)
          store.actions.updateCreature(this.creatureId, { animationState: "error_reaction" });
        }
        break;
      }

      case "APPROVAL_REQUESTED": {
        if (state === "working") {
          store.actions.updateCreature(this.creatureId, { animationState: "waiting" });
        }
        break;
      }

      case "APPROVAL_GRANTED": {
        if (state === "waiting") {
          store.actions.updateCreature(this.creatureId, { animationState: "working" });
        }
        break;
      }

      case "APPROVAL_DENIED": {
        if (state === "waiting") {
          this.animTimer = 2000;
          store.actions.updateCreature(this.creatureId, { animationState: "error_reaction" });
        }
        break;
      }

      // ── Ambient transitions ──────────────────────────────────────────────
      case "IDLE_TIMER_FIRED": {
        if (state !== "idle") break; // only fire from idle
        switch (event.behaviour) {
          case "walk": {
            const dest = this.randomNearbyTile(10);
            if (dest) {
              const path = this.computePath(dest);
              if (path.length > 0) {
                store.actions.updateCreature(this.creatureId, {
                  animationState: "walking",
                  currentPath: path,
                  targetPosition: dest,
                });
              }
            }
            break;
          }
          case "stretch": {
            this.animTimer = 800;
            store.actions.updateCreature(this.creatureId, { animationState: "stretching" });
            break;
          }
          case "sit":
            // Sit: stay idle but visually sit — handled by a different sprite frame
            // For Phase 2 we treat sit as extended idle
            this.idleTimer = randomIdleInterval();
            break;
          case "sleep": {
            this.sleepTimer = 5000 + Math.random() * 3000; // 5–8 s (Req 4.5)
            store.actions.updateCreature(this.creatureId, { animationState: "sleeping" });
            break;
          }
        }
        break;
      }

      case "ARRIVED_AT_IDLE_DEST": {
        if (state === "walking" && !creature.activeTaskId) {
          store.actions.updateCreature(this.creatureId, {
            animationState: "idle",
            currentPath: [],
            targetPosition: null,
          });
          this.idleTimer = randomIdleInterval();
        }
        break;
      }

      case "ANIM_COMPLETE": {
        // celebrating → idle, error_reaction → idle, stretching → idle
        if (state === "celebrating" || state === "error_reaction") {
          store.actions.updateCreature(this.creatureId, {
            animationState: "idle",
            activeTaskId: null,
          });
          this.idleTimer = randomIdleInterval();
        } else if (state === "stretching") {
          store.actions.updateCreature(this.creatureId, { animationState: "idle" });
          this.idleTimer = randomIdleInterval();
        }
        break;
      }

      case "PATH_BLOCKED": {
        this.blockTimer = 3000; // wait up to 3s (Req 4.12)
        break;
      }
    }
  }

  /** 10 Hz tick — advance timers and step along path. */
  private tick() {
    const DELTA = 100; // ms per tick
    const store = useAppStore.getState();
    const creature = store.creatures[this.creatureId];
    const state = creature.animationState;

    // Don't run while window hidden (animations paused)
    if (!store.ui.isWindowVisible) return;

    // ── Advance animation timer ────────────────────────────────────────────
    if (state === "celebrating" || state === "error_reaction" || state === "stretching") {
      this.animTimer -= DELTA;
      if (this.animTimer <= 0) {
        this.animTimer = 0;
        this.dispatch({ type: "ANIM_COMPLETE" });
      }
      return;
    }

    // ── Sleep timer ───────────────────────────────────────────────────────
    if (state === "sleeping" && !creature.activeTaskId) {
      this.sleepTimer -= DELTA;
      if (this.sleepTimer <= 0) {
        store.actions.updateCreature(this.creatureId, { animationState: "idle" });
        this.idleTimer = randomIdleInterval();
      }
      return;
    }

    // ── Path stepping (walking state) ─────────────────────────────────────
    if (state === "walking") {
      const path = creature.currentPath;
      if (path.length === 0) {
        // Arrived — was it a workstation or an idle walk?
        if (creature.activeTaskId) {
          this.dispatch({ type: "ARRIVED_AT_WORKSTATION" });
        } else {
          this.dispatch({ type: "ARRIVED_AT_IDLE_DEST" });
        }
        return;
      }

      // Check collision (Req 4.11)
      const nextTile = path[0];
      const otherPositions = Object.entries(store.creatures)
        .filter(([id]) => id !== this.creatureId)
        .map(([, c]) => c.position);
      const blocked = otherPositions.some(
        (p) => p.x === nextTile.x && p.y === nextTile.y
      );

      if (blocked) {
        this.blockTimer -= DELTA;
        if (this.blockTimer <= 0) {
          // Recalculate path (Req 4.12)
          const dest = creature.targetPosition;
          if (dest) {
            const newPath = this.computePath(dest);
            store.actions.updateCreature(this.creatureId, { currentPath: newPath });
            this.blockTimer = 3000;
          }
        }
        return;
      }

      // Advance one tile per tick (visual speed ~ 1.6 tiles/s at 10 Hz)
      store.actions.updateCreature(this.creatureId, {
        position: nextTile,
        currentPath: path.slice(1),
      });
      return;
    }

    // ── Idle timer ────────────────────────────────────────────────────────
    if (state === "idle" && !creature.activeTaskId) {
      this.idleTimer -= DELTA;
      if (this.idleTimer <= 0) {
        this.idleTimer = randomIdleInterval();
        this.dispatch({ type: "IDLE_TIMER_FIRED", behaviour: pickAmbientBehaviour() });
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private computePath(dest: Tile): Tile[] {
    const store = useAppStore.getState();
    const creature = store.creatures[this.creatureId];
    const grid = store.world.walkabilityGrid;
    const otherTiles = Object.entries(store.creatures)
      .filter(([id]) => id !== this.creatureId)
      .map(([, c]) => c.position);
    return findPath(grid, creature.position, dest, occupiedSet(otherTiles));
  }

  private walkToWorkstation(workstationTile: Tile) {
    const store = useAppStore.getState();
    const path = this.computePath(workstationTile);
    store.actions.updateCreature(this.creatureId, {
      currentPath: path,
      targetPosition: workstationTile,
    });
  }

  private randomNearbyTile(maxDist: number): Tile | null {
    const store = useAppStore.getState();
    const creature = store.creatures[this.creatureId];
    const grid = store.world.walkabilityGrid;
    // Try up to 10 random nearby tiles
    for (let attempt = 0; attempt < 10; attempt++) {
      const dx = Math.floor(Math.random() * (maxDist * 2 + 1)) - maxDist;
      const dy = Math.floor(Math.random() * (maxDist * 2 + 1)) - maxDist;
      const nx = creature.position.x + dx;
      const ny = creature.position.y + dy;
      if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < 45) {
        const nIdx = ny * GRID_WIDTH + nx;
        if (grid[nIdx]) return { x: nx, y: ny };
      }
    }
    return null;
  }
}

// ── Singleton registry ─────────────────────────────────────────────────────────

const machines = new Map<CreatureId, WorldStateMachine>();

export function getWSM(creatureId: CreatureId): WorldStateMachine {
  if (!machines.has(creatureId)) {
    machines.set(creatureId, new WorldStateMachine(creatureId));
  }
  return machines.get(creatureId)!;
}

export function startAllWSMs() {
  const ids: CreatureId[] = ["builder", "researcher", "debugger"];
  ids.forEach((id) => getWSM(id).start());
}

export function stopAllWSMs() {
  machines.forEach((m) => m.stop());
}
