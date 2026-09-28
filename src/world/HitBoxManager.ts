/**
 * Hit Box Manager — Req 5.1–4
 *
 * Maintains axis-aligned bounding boxes (AABB) for all creatures and workstations.
 * Routes canvas click events to the correct entity.
 * Creature hit-boxes are updated whenever a creature moves to a new tile (Req 5.4).
 */

import type { CreatureId, WorkstationId, Tile } from "../store/appStore";
import { TILE_SIZE } from "./Pathfinder";

export interface HitBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HitResult =
  | { kind: "creature"; id: CreatureId }
  | { kind: "workstation"; id: WorkstationId }
  | { kind: "empty" };

// Creature hit-box: 2×2 tiles centred on the creature position (64×64 canvas px)
const CREATURE_BOX_W = TILE_SIZE * 2;
const CREATURE_BOX_H = TILE_SIZE * 2;

// Workstation hit-box: 4×3 tiles (64×48 canvas px)
const WORKSTATION_BOX_W = TILE_SIZE * 4;
const WORKSTATION_BOX_H = TILE_SIZE * 3;

export class HitBoxManager {
  private creatureBoxes = new Map<CreatureId, HitBox>();
  private workstationBoxes = new Map<WorkstationId, HitBox>();

  /** Update a creature's hit-box to its current tile position (Req 5.4). */
  updateCreature(id: CreatureId, tile: Tile) {
    const cx = tile.x * TILE_SIZE - CREATURE_BOX_W / 2 + TILE_SIZE / 2;
    const cy = tile.y * TILE_SIZE - CREATURE_BOX_H / 2 + TILE_SIZE / 2;
    this.creatureBoxes.set(id, { x: cx, y: cy, width: CREATURE_BOX_W, height: CREATURE_BOX_H });
  }

  /** Set a workstation's fixed hit-box (called once on world init). */
  setWorkstation(id: WorkstationId, tile: Tile) {
    this.workstationBoxes.set(id, {
      x: tile.x * TILE_SIZE,
      y: tile.y * TILE_SIZE,
      width: WORKSTATION_BOX_W,
      height: WORKSTATION_BOX_H,
    });
  }

  /**
   * Test a canvas click at (px, py) against all hit-boxes.
   * Returns the first match found (creatures tested before workstations).
   * Req 5.3 — clicking empty space returns { kind: "empty" }.
   */
  test(px: number, py: number): HitResult {
    // Test creatures first (they're on top)
    for (const [id, box] of this.creatureBoxes) {
      if (this.contains(box, px, py)) return { kind: "creature", id };
    }
    // Then workstations
    for (const [id, box] of this.workstationBoxes) {
      if (this.contains(box, px, py)) return { kind: "workstation", id };
    }
    return { kind: "empty" };
  }

  private contains(box: HitBox, px: number, py: number): boolean {
    return (
      px >= box.x && px < box.x + box.width &&
      py >= box.y && py < box.y + box.height
    );
  }

  getCreatureBox(id: CreatureId): HitBox | undefined {
    return this.creatureBoxes.get(id);
  }

  getWorkstationBox(id: WorkstationId): HitBox | undefined {
    return this.workstationBoxes.get(id);
  }
}
