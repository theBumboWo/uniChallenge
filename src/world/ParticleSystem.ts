/**
 * Particle System — Req 3.7, 4.8, 4.9, 4.10
 *
 * Manages short-lived visual overlay effects:
 *   ZZZ    — looping sleep bubbles (Req 3.7: one per 2s after 10s sleeping)
 *   sparkle — celebrating burst (Req 4.9: 8–12 radiating over 1.5s)
 *   error ! — error reaction (Req 4.10: single red ! for 2s)
 *   thinking — working halo (Req 4.8: 3–5 simultaneous, 1s lifetime, 1/s emission)
 *
 * Particles are drawn by WorldRenderer on top of all other layers.
 * The store holds the live particle array; this module provides emitters and
 * a draw helper.
 */

import { useAppStore } from "../store/appStore";
import type { Particle, ParticleKind } from "../store/appStore";

let _particleIdCounter = 0;
function newId(): string {
  return `p${_particleIdCounter++}`;
}

// ── Emitters ───────────────────────────────────────────────────────────────────

/** Emit one ZZZ bubble above the creature (Req 3.7). */
export function emitZZZ(cx: number, cy: number) {
  const p: Particle = {
    id: newId(),
    kind: "zzz",
    x: cx + (Math.random() * 12 - 6),
    y: cy - 20,
    vx: (Math.random() * 0.4 - 0.2),
    vy: -0.06, // float upward
    alpha: 1,
    scale: 0.7 + Math.random() * 0.6,
    lifetime: 2000,
    age: 0,
  };
  useAppStore.getState().actions.addParticle(p);
}

/** Emit 8–12 sparkle burst on task completion (Req 4.9). */
export function emitCelebration(cx: number, cy: number) {
  const count = 8 + Math.floor(Math.random() * 5); // 8–12
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 0.04 + Math.random() * 0.05;
    const p: Particle = {
      id: newId(),
      kind: "sparkle",
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      scale: 0.5 + Math.random() * 0.8,
      lifetime: 1500,
      age: 0,
    };
    useAppStore.getState().actions.addParticle(p);
  }
}

/** Emit a single red "!" error indicator (Req 4.10). */
export function emitErrorBang(cx: number, cy: number) {
  const p: Particle = {
    id: newId(),
    kind: "error_bang",
    x: cx,
    y: cy - 28,
    vx: 0,
    vy: -0.01,
    alpha: 1,
    scale: 1,
    lifetime: 2000,
    age: 0,
  };
  useAppStore.getState().actions.addParticle(p);
}

/** Emit one thinking dot (Req 4.8: one per second, 3–5 live at once). */
export function emitThinkingDot(cx: number, cy: number) {
  const existing = useAppStore
    .getState()
    .particles.filter((p) => p.kind === "thinking_dot").length;
  if (existing >= 5) return; // cap at 5 simultaneous
  const angle = Math.random() * Math.PI * 2;
  const radius = 12 + Math.random() * 6;
  const p: Particle = {
    id: newId(),
    kind: "thinking_dot",
    x: cx + Math.cos(angle) * radius,
    y: cy - 16 + Math.sin(angle) * radius * 0.5,
    vx: 0,
    vy: -0.015,
    alpha: 0.8,
    scale: 0.4 + Math.random() * 0.3,
    lifetime: 1000,
    age: 0,
  };
  useAppStore.getState().actions.addParticle(p);
}

// ── Rendering ──────────────────────────────────────────────────────────────────

const SPARKLE_COLOUR = "#f0d060";
const ERROR_COLOUR   = "#e05050";
const ZZZ_COLOUR     = "#90b8e0";
const THINK_COLOUR   = "#c68b3c";

/**
 * Draw all live particles onto the canvas context.
 * Called each frame from WorldRenderer after creatures are drawn.
 */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.scale(p.scale, p.scale);

    switch (p.kind) {
      case "zzz":
        ctx.fillStyle = ZZZ_COLOUR;
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("z", 0, 0);
        break;

      case "sparkle": {
        ctx.fillStyle = SPARKLE_COLOUR;
        ctx.beginPath();
        // Simple 4-point star
        const s = 5;
        ctx.moveTo(0, -s);
        ctx.lineTo(1.5, -1.5);
        ctx.lineTo(s, 0);
        ctx.lineTo(1.5, 1.5);
        ctx.lineTo(0, s);
        ctx.lineTo(-1.5, 1.5);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-1.5, -1.5);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case "error_bang":
        ctx.fillStyle = ERROR_COLOUR;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, 0);
        break;

      case "thinking_dot":
        ctx.fillStyle = THINK_COLOUR;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }
}
