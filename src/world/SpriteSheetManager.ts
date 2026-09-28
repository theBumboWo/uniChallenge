/**
 * Sprite Sheet Manager — Req 4.2, 4.3
 *
 * Loads and caches PNG sprite sheets from public/sprites/.
 * Each sheet: one animation state for one creature.
 * Minimum: 48×48 px per frame, ≥4 frames per loop.
 *
 * Naming convention: {creatureId}_{state}.png (e.g. builder_working.png)
 * Frame layout: horizontal strip — frame 0 at x=0, frame 1 at x=frameWidth, etc.
 *
 * Falls back to procedural placeholder drawing when assets are missing (Phase 2).
 */

import type { CreatureId, CreatureAnimationState } from "../store/appStore";

export const FRAME_WIDTH = 48;
export const FRAME_HEIGHT = 48;
export const MIN_FRAMES = 4;

// Frames per second for each animation state
const STATE_FPS: Record<CreatureAnimationState, number> = {
  idle:           4,
  walking:        8,
  working:        6,
  sleeping:       2,
  celebrating:    10,
  error_reaction: 8,
  waiting:        4,
  stretching:     6,
};

export function getFrameMs(state: CreatureAnimationState): number {
  return 1000 / STATE_FPS[state];
}

// ── Cache ──────────────────────────────────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement | null>();
// null = failed to load (use placeholder)

function cacheKey(creatureId: CreatureId, state: CreatureAnimationState): string {
  return `${creatureId}_${state}`;
}

/**
 * Load a sprite sheet (or return cached version).
 * Never rejects — sets cache entry to null on error so caller draws placeholder.
 */
export function loadSprite(
  creatureId: CreatureId,
  state: CreatureAnimationState
): Promise<HTMLImageElement | null> {
  const key = cacheKey(creatureId, state);
  if (imageCache.has(key)) {
    return Promise.resolve(imageCache.get(key)!);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(key, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(key, null); // mark as missing, use placeholder
      resolve(null);
    };
    img.src = `/sprites/${creatureId}_${state}.png`;
  });
}

/** Pre-load all sprite sheets for a creature. */
export async function preloadCreature(creatureId: CreatureId): Promise<void> {
  const states: CreatureAnimationState[] = [
    "idle", "walking", "working", "sleeping",
    "celebrating", "error_reaction", "waiting", "stretching",
  ];
  await Promise.all(states.map((s) => loadSprite(creatureId, s)));
}

/**
 * Draw one animation frame for a creature.
 * If the sprite sheet is loaded, draws the correct frame.
 * Otherwise draws a procedural placeholder (coloured rectangle with an icon).
 */
export function drawCreatureFrame(
  ctx: CanvasRenderingContext2D,
  creatureId: CreatureId,
  state: CreatureAnimationState,
  frameIndex: number,
  x: number, // canvas px (top-left of the sprite)
  y: number,
  scale = 2   // default 2× for visibility at 16px tiles
) {
  const key = cacheKey(creatureId, state);
  const img = imageCache.get(key);
  const w = FRAME_WIDTH * scale;
  const h = FRAME_HEIGHT * scale;

  if (img) {
    const frameCount = Math.max(MIN_FRAMES, Math.floor(img.width / FRAME_WIDTH));
    const fi = frameIndex % frameCount;
    ctx.drawImage(img, fi * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT, x, y, w, h);
    return;
  }

  // Placeholder drawing (used until real sprites are added)
  drawPlaceholderCreature(ctx, creatureId, state, x, y, w, h);
}

// Placeholder colours per creature
const PLACEHOLDER_COLOURS: Record<CreatureId, string> = {
  builder:    "#c68b3c", // copper amber
  researcher: "#6090c0", // slate blue
  debugger:   "#70a870", // muted green
};

// State → emoji for placeholder display
const STATE_EMOJI: Record<CreatureAnimationState, string> = {
  idle:           "😐",
  walking:        "🚶",
  working:        "⚙️",
  sleeping:       "😴",
  celebrating:    "🎉",
  error_reaction: "💥",
  waiting:        "⏳",
  stretching:     "🙆",
};

function drawPlaceholderCreature(
  ctx: CanvasRenderingContext2D,
  creatureId: CreatureId,
  state: CreatureAnimationState,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const colour = PLACEHOLDER_COLOURS[creatureId];
  const radius = 8;

  // Rounded rectangle body
  ctx.save();
  ctx.fillStyle = colour + "cc";
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, radius);
  ctx.fill();
  ctx.stroke();

  // State emoji
  ctx.font = `${Math.floor(h * 0.42)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(STATE_EMOJI[state], x + w / 2, y + h / 2);

  ctx.restore();
}
