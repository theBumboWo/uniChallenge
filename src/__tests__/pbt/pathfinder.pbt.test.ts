/**
 * PBT Property 6: A* Pathfinder Correctness — Req 18.6
 *
 * FOR ALL (start, goal) pairs on the 80×45 grid:
 *   - If both tiles are walkable and distinct → path is non-empty and all-walkable
 *   - If either tile is not walkable or start === goal → path is empty
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { findPath, GRID_WIDTH, GRID_HEIGHT } from "../../world/Pathfinder";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build an all-walkable grid. */
function allWalkable(): boolean[] {
  return new Array<boolean>(GRID_WIDTH * GRID_HEIGHT).fill(true);
}

/** Build a grid with a single non-walkable tile at (bx, by). */
function gridWithWall(bx: number, by: number): boolean[] {
  const g = allWalkable();
  g[by * GRID_WIDTH + bx] = false;
  return g;
}

const tileArb = fc.record({
  x: fc.integer({ min: 0, max: GRID_WIDTH - 1 }),
  y: fc.integer({ min: 0, max: GRID_HEIGHT - 1 }),
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("PBT Property 6: A* pathfinder on 80×45 grid (Req 18.6)", () => {

  it("returns non-empty path when start ≠ goal and both are walkable", () => {
    const grid = allWalkable();
    fc.assert(
      fc.property(
        tileArb,
        tileArb,
        (start, goal) => {
          fc.pre(start.x !== goal.x || start.y !== goal.y); // start ≠ goal
          const path = findPath(grid, start, goal);
          // Path must be non-empty
          if (path.length === 0) return false;
          // Last tile must be the goal
          const last = path[path.length - 1];
          if (last.x !== goal.x || last.y !== goal.y) return false;
          // All tiles in path must be walkable and in-bounds
          return path.every(
            (t) =>
              t.x >= 0 && t.x < GRID_WIDTH &&
              t.y >= 0 && t.y < GRID_HEIGHT &&
              grid[t.y * GRID_WIDTH + t.x] === true
          );
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("returns empty path when start === goal", () => {
    const grid = allWalkable();
    fc.assert(
      fc.property(tileArb, (tile) => {
        const path = findPath(grid, tile, tile);
        return path.length === 0;
      }),
      { numRuns: 500 }
    );
  });

  it("returns empty path when start tile is not walkable", () => {
    fc.assert(
      fc.property(tileArb, tileArb, (start, goal) => {
        fc.pre(start.x !== goal.x || start.y !== goal.y);
        const grid = gridWithWall(start.x, start.y);
        const path = findPath(grid, start, goal);
        return path.length === 0;
      }),
      { numRuns: 500 }
    );
  });

  it("returns empty path when goal tile is not walkable", () => {
    fc.assert(
      fc.property(tileArb, tileArb, (start, goal) => {
        fc.pre(start.x !== goal.x || start.y !== goal.y);
        const grid = gridWithWall(goal.x, goal.y);
        const path = findPath(grid, start, goal);
        return path.length === 0;
      }),
      { numRuns: 500 }
    );
  });

  it("no path tile is ever non-walkable", () => {
    const grid = allWalkable();
    fc.assert(
      fc.property(tileArb, tileArb, (start, goal) => {
        fc.pre(start.x !== goal.x || start.y !== goal.y);
        const path = findPath(grid, start, goal);
        return path.every((t) => grid[t.y * GRID_WIDTH + t.x] === true);
      }),
      { numRuns: 1000 }
    );
  });
});
