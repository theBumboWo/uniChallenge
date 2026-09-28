/**
 * A* Pathfinder — Req 4.6, 4.11, Req 18.6
 *
 * Operates on an 80×45 flat boolean walkability grid.
 * Grid index = y * GRID_WIDTH + x.
 * Path computation is synchronous and must complete within one 10 Hz tick (~100 ms).
 * For a 3600-node grid this is trivially fast (<1 ms in practice).
 *
 * No two creatures share a tile (Req 4.11) — the caller passes a set of
 * occupied tiles as additional obstacles.
 */

export const GRID_WIDTH = 80;
export const GRID_HEIGHT = 45;

export interface Tile {
  x: number; // 0–79
  y: number; // 0–44
}

function idx(x: number, y: number): number {
  return y * GRID_WIDTH + x;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

function heuristic(a: Tile, b: Tile): number {
  // Manhattan distance (no diagonal movement)
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const NEIGHBOURS: [number, number][] = [
  [0, -1], // up
  [0,  1], // down
  [-1, 0], // left
  [1,  0], // right
];

/**
 * Find the shortest path from `start` to `goal` on `grid`.
 *
 * @param grid        Flat boolean array (true = walkable), length GRID_WIDTH * GRID_HEIGHT
 * @param start       Starting tile
 * @param goal        Target tile
 * @param occupied    Set of additional blocked tiles (e.g. other creatures)
 * @returns           Array of tiles from start (exclusive) to goal (inclusive),
 *                    or [] if no path exists.
 *
 * PBT invariants (Req 18.6):
 *   - Returns non-empty path iff start ≠ goal AND both tiles are walkable
 *   - Every tile in the returned path is walkable and in-bounds
 */
export function findPath(
  grid: boolean[],
  start: Tile,
  goal: Tile,
  occupied: Set<number> = new Set()
): Tile[] {
  // Degenerate cases
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!inBounds(start.x, start.y) || !inBounds(goal.x, goal.y)) return [];
  if (!grid[idx(start.x, start.y)] || !grid[idx(goal.x, goal.y)]) return [];

  const gScore = new Float32Array(GRID_WIDTH * GRID_HEIGHT).fill(Infinity);
  const fScore = new Float32Array(GRID_WIDTH * GRID_HEIGHT).fill(Infinity);
  const cameFrom = new Int32Array(GRID_WIDTH * GRID_HEIGHT).fill(-1);
  const inOpen = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);

  const startIdx = idx(start.x, start.y);
  const goalIdx = idx(goal.x, goal.y);

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(start, goal);
  inOpen[startIdx] = 1;

  // Minimal priority queue — for 3600 nodes a sorted array is sufficient
  // We use a simple min-heap keyed on fScore
  const open: number[] = [startIdx];

  while (open.length > 0) {
    // Pop node with lowest fScore
    let bestPos = 0;
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[bestPos]]) bestPos = i;
    }
    const current = open[bestPos];
    open.splice(bestPos, 1);
    inOpen[current] = 0;

    if (current === goalIdx) {
      // Reconstruct path
      const path: Tile[] = [];
      let c = current;
      while (cameFrom[c] !== -1) {
        path.unshift({ x: c % GRID_WIDTH, y: Math.floor(c / GRID_WIDTH) });
        c = cameFrom[c];
      }
      return path;
    }

    const cx = current % GRID_WIDTH;
    const cy = Math.floor(current / GRID_WIDTH);

    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const nIdx = idx(nx, ny);
      if (!grid[nIdx]) continue; // wall
      if (nIdx !== goalIdx && occupied.has(nIdx)) continue; // another creature

      const tentativeG = gScore[current] + 1;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic({ x: nx, y: ny }, goal);
        if (!inOpen[nIdx]) {
          inOpen[nIdx] = 1;
          open.push(nIdx);
        }
      }
    }
  }

  return []; // No path found
}

/** Build a Set of occupied tile indices from an array of tiles. */
export function occupiedSet(tiles: Tile[]): Set<number> {
  return new Set(tiles.map((t) => idx(t.x, t.y)));
}

/** Convert tile coordinates to canvas pixel centre (16 px per tile). */
export const TILE_SIZE = 16;
export function tileToPixel(tile: Tile): { x: number; y: number } {
  return { x: tile.x * TILE_SIZE + TILE_SIZE / 2, y: tile.y * TILE_SIZE + TILE_SIZE / 2 };
}
