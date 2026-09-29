/**
 * WorldCanvas — mounts the Canvas element, wires the WorldRenderer,
 * starts all WorldStateMachines, and routes click events.
 * Req 2.7 (WSM continues across mode switches), Req 5.1–6.
 */

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../store/appStore";
import { WorldRenderer, CANVAS_WIDTH, CANVAS_HEIGHT } from "../world/WorldRenderer";
import { startAllWSMs } from "../world/WorldStateMachine";
import CreatureDetail from "./CreatureDetail";
import WorkstationDetail from "./WorkstationDetail";

// WSMs are singletons — started once and kept running across mode switches
let wsmsStarted = false;

interface Props {
  compact?: boolean; // true = 30fps cap
}

export default function WorldCanvas({ compact = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const { selectCreature, selectWorkstation } = useAppStore((s) => s.actions);
  const selectedCreatureId = useAppStore((s) => s.ui.selectedCreatureId);
  const selectedWorkstationId = useAppStore((s) => s.ui.selectedWorkstationId);

  // Start renderer on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new WorldRenderer(canvas);
    renderer.setCompactMode(compact);
    renderer.start();
    rendererRef.current = renderer;

    // Start WSMs once globally (Req 2.7 — continue across mode switches)
    if (!wsmsStarted) {
      startAllWSMs();
      wsmsStarted = true;
    }

    return () => {
      renderer.stop();
      // Don't stop WSMs — they should keep running when in compact mode
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update fps cap when mode changes
  useEffect(() => {
    rendererRef.current?.setCompactMode(compact);
  }, [compact]);

  // ── Click routing (Req 5.1–5.3) ────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const rect = canvas.getBoundingClientRect();
    // Scale from display pixels to canvas logical pixels
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const hit = renderer.getHitBoxManager().test(px, py);

    if (hit.kind === "creature") {
      selectCreature(hit.id);
      selectWorkstation(null);
    } else if (hit.kind === "workstation") {
      selectWorkstation(hit.id);
      selectCreature(null);
    } else {
      // Empty space — close panels (Req 5.3)
      selectCreature(null);
      selectWorkstation(null);
    }
  }, [selectCreature, selectWorkstation]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Canvas scales via CSS to fill its container while maintaining 16:9 ratio */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          cursor: "default",
          display: "block",
        }}
        aria-label="Whimsical Agent Village world"
      />

      {/* Floating detail panels — positioned over the canvas */}
      {selectedCreatureId && (
        <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 10 }}>
          <CreatureDetail
            creatureId={selectedCreatureId}
            onClose={() => selectCreature(null)}
          />
        </div>
      )}

      {selectedWorkstationId && (
        <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 10 }}>
          <WorkstationDetail
            workstationId={selectedWorkstationId}
            onClose={() => selectWorkstation(null)}
          />
        </div>
      )}
    </div>
  );
}
