/**
 * World Renderer — Req 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 *
 * Single HTML Canvas at 1280×720 logical pixels, CSS-scaled to fit container.
 * Rendering layers (back to front):
 *   1. Background (rainy window — static in Phase 2, animated in Phase 5)
 *   2. Floor / walls
 *   3. Props (bookshelves, copper machinery — static in Phase 2)
 *   4. Workstations
 *   5. Creatures
 *   6. Particles
 *   7. UI overlays (hit-box debug, optional)
 *
 * Frame rate:
 *   Full Workspace  → 60 fps via requestAnimationFrame
 *   Compact Mode    → throttled to 30 fps
 *   Window hidden   → paused (Req 1.3)
 *
 * ZZZ emission is managed here: tracked per creature, emits one ZZZ per 2 s
 * after the creature has been sleeping > 10 s (Req 3.7).
 */

import { useAppStore } from "../store/appStore";
import type { CreatureId, WorkstationId } from "../store/appStore";
import { drawCreatureFrame, getFrameMs, preloadCreature } from "./SpriteSheetManager";
import { drawParticles, emitZZZ, emitThinkingDot } from "./ParticleSystem";
import { HitBoxManager } from "./HitBoxManager";
import { TILE_SIZE } from "./Pathfinder";

export const CANVAS_WIDTH  = 1280;
export const CANVAS_HEIGHT = 720;

// Colour palette (Req 3.6)
const COLOUR = {
  bgDeep:     "#0a0804",
  floor:      "#1a150e",
  floorGrid:  "#221a10",
  wall:       "#130f08",
  shelf:      "#2a1f12",
  shelfBook:  ["#8b3a3a", "#3a6b8b", "#5a8b3a", "#8b7a3a", "#6b3a8b"],
  workbench:  "#3d2a16",
  workLight:  "#c68b3c",
  copperMid:  "#b07030",
  copperDark: "#7a4a20",
  mossDark:   "#2a3a1a",
  mossLight:  "#3a5020",
  lanternGlow:"rgba(198,139,60,0.18)",
  amber:      "#c68b3c",
  rainLine:   "rgba(160,190,220,0.25)",
};

// Workstation tile positions (must match appStore defaults)
const WORKSTATION_TILES: Record<WorkstationId, { x: number; y: number }> = {
  workshop_bench:    { x: 18, y: 28 },
  library_desk:      { x: 48, y: 28 },
  examination_table: { x: 33, y: 36 },
};

export class WorldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hitBoxManager: HitBoxManager;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private compactMode = false;

  // Per-creature sleep tracking for ZZZ emission (Req 3.7)
  private sleepDuration: Record<CreatureId, number> = {
    builder: 0, researcher: 0, debugger: 0,
  };
  private zzzTimer: Record<CreatureId, number> = {
    builder: 0, researcher: 0, debugger: 0,
  };

  // Rain animation
  private rainDrops: { x: number; y: number; speed: number; length: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.hitBoxManager = new HitBoxManager();
    this.initRain();
    this.initHitBoxes();
    void this.preloadSprites();
  }

  private initRain() {
    for (let i = 0; i < 60; i++) {
      this.rainDrops.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 1.5 + Math.random() * 2,
        length: 8 + Math.random() * 12,
      });
    }
  }

  private initHitBoxes() {
    // Set fixed workstation boxes
    (Object.entries(WORKSTATION_TILES) as [WorkstationId, { x: number; y: number }][]).forEach(
      ([id, tile]) => this.hitBoxManager.setWorkstation(id, tile)
    );
    // Creature boxes are updated each frame from current positions
  }

  private async preloadSprites() {
    const ids: CreatureId[] = ["builder", "researcher", "debugger"];
    await Promise.all(ids.map((id) => preloadCreature(id)));
  }

  /** Set compact mode (caps fps to 30). */
  setCompactMode(compact: boolean) {
    this.compactMode = compact;
  }

  /** Expose hit-box manager so WorldCanvas can route clicks. */
  getHitBoxManager(): HitBoxManager {
    return this.hitBoxManager;
  }

  // ── RAF loop ────────────────────────────────────────────────────────────────

  start() {
    if (this.rafId !== null) return;
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      const store = useAppStore.getState();
      // Pause when window hidden (Req 1.3 / Req 3.5)
      if (!store.ui.isWindowVisible) {
        this.rafId = requestAnimationFrame(loop);
        return;
      }

      const targetMs = this.compactMode ? 1000 / 30 : 1000 / 60;
      const elapsed = now - this.lastFrameTime;
      if (elapsed >= targetMs) {
        this.lastFrameTime = now - (elapsed % targetMs);
        this.frame(elapsed, store);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ── Main frame ──────────────────────────────────────────────────────────────

  private frame(deltaMs: number, store: ReturnType<typeof useAppStore.getState>) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Layer 1: background
    this.drawBackground(ctx, deltaMs);
    // Layer 2: floor
    this.drawFloor(ctx);
    // Layer 3: props
    this.drawProps(ctx);
    // Layer 4: workstations
    this.drawWorkstations(ctx);
    // Layer 5: creatures + advance frame timers
    this.drawCreatures(ctx, deltaMs, store);
    // Layer 6: particles (advance + draw)
    store.actions.tickParticles(deltaMs);
    drawParticles(ctx, store.particles);
    // Emit ongoing particles for sleeping/working creatures
    this.emitOngoingParticles(deltaMs, store);
  }

  // ── Layer 1: background (rainy window) ──────────────────────────────────────

  private drawBackground(ctx: CanvasRenderingContext2D, deltaMs: number) {
    // Deep night sky through window
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT * 0.45);
    grad.addColorStop(0, "#060810");
    grad.addColorStop(1, "#0d1018");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT * 0.45);

    // Animated rain (Phase 2: simple lines; Phase 5 adds tileable texture)
    ctx.strokeStyle = COLOUR.rainLine;
    ctx.lineWidth = 1;
    for (const drop of this.rainDrops) {
      drop.y += drop.speed * (deltaMs / 16.7);
      if (drop.y > CANVAS_HEIGHT * 0.45) {
        drop.y = -drop.length;
        drop.x = Math.random() * CANVAS_WIDTH;
      }
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 1, drop.y + drop.length);
      ctx.stroke();
    }

    // Window frame
    ctx.fillStyle = COLOUR.wall;
    ctx.fillRect(0, CANVAS_HEIGHT * 0.43, CANVAS_WIDTH, 8);
    ctx.fillRect(0, 0, 6, CANVAS_HEIGHT * 0.45);
    ctx.fillRect(CANVAS_WIDTH - 6, 0, 6, CANVAS_HEIGHT * 0.45);
    ctx.fillRect(CANVAS_WIDTH / 2 - 3, 0, 6, CANVAS_HEIGHT * 0.45);

    // Ambient lantern glow (Req 3.2d)
    this.drawLanternGlow(ctx, 200, 300);
    this.drawLanternGlow(ctx, CANVAS_WIDTH - 200, 300);
  }

  private drawLanternGlow(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const rad = ctx.createRadialGradient(x, y, 10, x, y, 120);
    rad.addColorStop(0, "rgba(198,139,60,0.22)");
    rad.addColorStop(1, "rgba(198,139,60,0)");
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(x, y, 120, 0, Math.PI * 2);
    ctx.fill();

    // Lantern body (small rectangle)
    ctx.fillStyle = COLOUR.copperMid;
    ctx.fillRect(x - 8, y - 16, 16, 22);
    ctx.fillStyle = "rgba(255,220,100,0.8)";
    ctx.fillRect(x - 5, y - 12, 10, 14);
  }

  // ── Layer 2: floor ──────────────────────────────────────────────────────────

  private drawFloor(ctx: CanvasRenderingContext2D) {
    const floorY = CANVAS_HEIGHT * 0.45;
    ctx.fillStyle = COLOUR.floor;
    ctx.fillRect(0, floorY, CANVAS_WIDTH, CANVAS_HEIGHT - floorY);

    // Subtle floor grid (plank lines)
    ctx.strokeStyle = COLOUR.floorGrid;
    ctx.lineWidth = 0.5;
    for (let y = floorY; y < CANVAS_HEIGHT; y += TILE_SIZE * 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    for (let x = 0; x < CANVAS_WIDTH; x += TILE_SIZE * 8) {
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
  }

  // ── Layer 3: props (bookshelves, copper machinery) ──────────────────────────

  private drawProps(ctx: CanvasRenderingContext2D) {
    // Left bookshelf (Req 3.2c)
    this.drawBookshelf(ctx, 40, 400, 120, 160);
    // Right bookshelf
    this.drawBookshelf(ctx, CANVAS_WIDTH - 160, 400, 120, 160);
    // Copper gear prop (Req 3.2e — gear rotation in Phase 5; static for now)
    this.drawGearProp(ctx, 640, 420);
    // Moss patches (Req 3.2)
    ctx.fillStyle = COLOUR.mossDark;
    ctx.beginPath(); ctx.ellipse(80, 620, 40, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOUR.mossLight;
    ctx.beginPath(); ctx.ellipse(80, 618, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOUR.mossDark;
    ctx.beginPath(); ctx.ellipse(CANVAS_WIDTH - 90, 620, 38, 11, 0, 0, Math.PI * 2); ctx.fill();
  }

  private drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = COLOUR.shelf;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLOUR.copperDark;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    // Books
    let bx = x + 4;
    let shelf = 0;
    while (bx < x + w - 8) {
      const bw = 8 + Math.floor(Math.random() * 8);
      const bh = 30 + Math.floor(Math.random() * 20);
      const colour = COLOUR.shelfBook[(bx + shelf) % COLOUR.shelfBook.length];
      const by = y + 8 + shelf * 52;
      if (by + bh > y + h - 4) break;
      ctx.fillStyle = colour;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, bw, bh);
      bx += bw + 2;
      if (bx >= x + w - 8) { bx = x + 4; shelf++; }
    }
  }

  private drawGearProp(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    // Outer ring
    ctx.strokeStyle = COLOUR.copperMid;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.stroke();
    // Teeth (8 rectangular teeth)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = COLOUR.copperMid;
      ctx.fillRect(-3, 26, 6, 8);
      ctx.restore();
    }
    // Inner hub
    ctx.fillStyle = COLOUR.copperDark;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    // Spokes
    ctx.strokeStyle = COLOUR.copperDark;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 22, cy + Math.sin(angle) * 22);
      ctx.stroke();
    }
  }

  // ── Layer 4: workstations ──────────────────────────────────────────────────

  private drawWorkstations(ctx: CanvasRenderingContext2D) {
    this.drawWorkshopBench(ctx, WORKSTATION_TILES.workshop_bench.x, WORKSTATION_TILES.workshop_bench.y);
    this.drawLibraryDesk(ctx, WORKSTATION_TILES.library_desk.x, WORKSTATION_TILES.library_desk.y);
    this.drawExamTable(ctx, WORKSTATION_TILES.examination_table.x, WORKSTATION_TILES.examination_table.y);
  }

  private drawWorkshopBench(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
    const x = tx * TILE_SIZE, y = ty * TILE_SIZE, w = 64, h = 32;
    ctx.fillStyle = COLOUR.workbench;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLOUR.copperMid; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    // Tools
    ctx.fillStyle = COLOUR.copperMid;
    ctx.fillRect(x + 8, y + 6, 4, 18);  // screwdriver
    ctx.fillRect(x + 16, y + 8, 14, 4); // hammer head
    ctx.fillStyle = "#888"; ctx.fillRect(x + 20, y + 5, 4, 16); // hammer handle
    // Small monitor
    ctx.fillStyle = "#1a1a2e"; ctx.fillRect(x + 36, y + 4, 22, 16);
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.strokeRect(x + 36, y + 4, 22, 16);
    ctx.fillStyle = "#00ff88"; ctx.fillRect(x + 38, y + 6, 18, 10);
    // Label
    ctx.fillStyle = COLOUR.amber; ctx.font = "7px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("Workshop", x + w / 2, y + h + 8);
  }

  private drawLibraryDesk(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
    const x = tx * TILE_SIZE, y = ty * TILE_SIZE, w = 64, h = 32;
    ctx.fillStyle = "#2a1f14"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#6b4a28"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    // Open book
    ctx.fillStyle = "#f5e8c8";
    ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + 8, y + 24);
    ctx.lineTo(x + 30, y + 20); ctx.lineTo(x + 30, y + 8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 32, y + 8); ctx.lineTo(x + 54, y + 8);
    ctx.lineTo(x + 54, y + 24); ctx.lineTo(x + 32, y + 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#c0a070"; ctx.lineWidth = 0.5;
    for (let line = 0; line < 3; line++) {
      ctx.beginPath(); ctx.moveTo(x + 10, y + 12 + line * 4); ctx.lineTo(x + 28, y + 12 + line * 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 34, y + 12 + line * 4); ctx.lineTo(x + 52, y + 12 + line * 4); ctx.stroke();
    }
    // Lamp
    ctx.fillStyle = "#d0a060"; ctx.fillRect(x + 50, y + 2, 4, 20);
    ctx.fillStyle = "rgba(255,220,100,0.5)"; ctx.beginPath();
    ctx.arc(x + 52, y + 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOUR.amber; ctx.font = "7px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("Library", x + w / 2, y + h + 8);
  }

  private drawExamTable(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
    const x = tx * TILE_SIZE, y = ty * TILE_SIZE, w = 64, h = 32;
    ctx.fillStyle = "#181412"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#484038"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    // Magnifying glass
    ctx.strokeStyle = "#a0a0a0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + 20, y + 14, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 28, y + 22); ctx.lineTo(x + 38, y + 30); ctx.stroke();
    // Mechanical parts scattered
    ctx.fillStyle = COLOUR.copperMid;
    [14, 24, 34, 44].forEach((px, i) => {
      ctx.beginPath(); ctx.arc(x + px + 8, y + 10 + i % 2 * 8, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = COLOUR.amber; ctx.font = "7px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("Debug Table", x + w / 2, y + h + 8);
  }

  // ── Layer 5: creatures ─────────────────────────────────────────────────────

  private drawCreatures(
    ctx: CanvasRenderingContext2D,
    deltaMs: number,
    store: ReturnType<typeof useAppStore.getState>
  ) {
    const creatures = store.creatures;
    const SPRITE_SCALE = 2; // 48px × 2 = 96px rendered
    const SW = 48 * SPRITE_SCALE;
    const SH = 48 * SPRITE_SCALE;

    (["builder", "researcher", "debugger"] as CreatureId[]).forEach((id) => {
      const c = creatures[id];
      const px = c.position.x * TILE_SIZE - SW / 2 + TILE_SIZE / 2;
      const py = c.position.y * TILE_SIZE - SH + TILE_SIZE;

      // Advance frame timer
      const frameMs = getFrameMs(c.animationState);
      let newTimer = c.frameTimer + deltaMs;
      let newFrame = c.frameIndex;
      if (newTimer >= frameMs) {
        newTimer = newTimer % frameMs;
        newFrame = (c.frameIndex + 1) % 4; // min 4 frames loop
      }
      if (newFrame !== c.frameIndex || newTimer !== c.frameTimer) {
        store.actions.updateCreature(id, { frameIndex: newFrame, frameTimer: newTimer });
      }

      // Draw
      drawCreatureFrame(ctx, id, c.animationState, newFrame, px, py, SPRITE_SCALE);

      // Update hit-box for this frame (Req 5.4)
      this.hitBoxManager.updateCreature(id, c.position);

      // Track sleep duration (Req 3.7)
      if (c.animationState === "sleeping") {
        this.sleepDuration[id] = (this.sleepDuration[id] ?? 0) + deltaMs;
      } else {
        this.sleepDuration[id] = 0;
        this.zzzTimer[id] = 0;
      }
    });
  }

  // ── Ongoing particle emission ──────────────────────────────────────────────

  private emitOngoingParticles(
    deltaMs: number,
    store: ReturnType<typeof useAppStore.getState>
  ) {
    const SPRITE_SCALE = 2;
    const TS = TILE_SIZE;

    (["builder", "researcher", "debugger"] as CreatureId[]).forEach((id) => {
      const c = store.creatures[id];
      const cx = c.position.x * TS + TS / 2;
      const cy = c.position.y * TS - 48 * SPRITE_SCALE / 2;

      // ZZZ: emit one per 2000ms after 10s of sleeping (Req 3.7)
      if (c.animationState === "sleeping" && this.sleepDuration[id] > 10000) {
        this.zzzTimer[id] = (this.zzzTimer[id] ?? 0) + deltaMs;
        if (this.zzzTimer[id] >= 2000) {
          this.zzzTimer[id] = 0;
          emitZZZ(cx, cy);
        }
      }

      // Thinking dots: emit one per 1000ms while working (Req 4.8)
      if (c.animationState === "working") {
        this.zzzTimer[id] = (this.zzzTimer[id] ?? 0) + deltaMs;
        if (this.zzzTimer[id] >= 1000) {
          this.zzzTimer[id] = 0;
          emitThinkingDot(cx, cy);
        }
      }
    });
  }
}
