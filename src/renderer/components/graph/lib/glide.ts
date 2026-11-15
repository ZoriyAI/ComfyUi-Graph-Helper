import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motionMs } from '../../../motion/policy';
import { cameraEase } from '../../../motion/camera';

/**
 * Nodes glide to new positions instead of jumping when something other than the person's own drag moves them:
 * «Разложить граф», the tidy after a build, an undo of either. The movement is the explanation ("these nodes
 * were rearranged, here is where each went"); with reduced or no motion the positions simply change.
 * Edges follow, because the interpolated positions are what React Flow draws.
 */

export interface Point {
  x: number;
  y: number;
}

interface GlidingNode {
  id: string;
  position: Point;
  dragging?: boolean;
}

/** How long a glide takes: the longest camera move (--motion-camera), 0 unless motion is full. */
export function glideMs(): number {
  return motionMs('--motion-camera');
}

/** The glide's curve: the camera's in-out curve, so nodes and the camera travel alike. */
export function easeInOut(t: number): number {
  return cameraEase(Math.min(1, Math.max(0, t)));
}

export function lerpPoint(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** Nodes whose position differs from what is on screen (by more than half a pixel), with where they are now. */
export function movedFrom(shown: Map<string, Point>, nodes: GlidingNode[]): Map<string, Point> {
  const from = new Map<string, Point>();
  for (const node of nodes) {
    const was = shown.get(node.id);
    if (was && (Math.abs(was.x - node.position.x) > 0.5 || Math.abs(was.y - node.position.y) > 0.5)) from.set(node.id, was);
  }
  return from;
}

interface Glide {
  from: Map<string, Point>;
  to: Map<string, Point>;
  start: number;
  duration: number;
  frame: number;
}

/**
 * The nodes to draw: the store's nodes, with positions in flight while a glide runs. `skipNext` marks the next
 * change as the person's own (a drag, an arrow key), which moves at once; `stop` ends a glide where it is
 * headed (any pointer down on the canvas calls it, so a glide never fights a drag).
 */
export function useGlide<T extends GlidingNode>(nodes: T[], enabled: boolean): { nodes: T[]; skipNext: () => void; stop: () => void } {
  const shown = useRef(new Map<string, Point>());
  const glide = useRef<Glide | null>(null);
  const skip = useRef(false);
  const wasEnabled = useRef(enabled);
  const latest = useRef(nodes);
  latest.current = nodes;
  const [frame, setFrame] = useState<Map<string, Point> | null>(null);

  const cancel = useCallback(() => {
    if (glide.current) window.cancelAnimationFrame(glide.current.frame);
    glide.current = null;
  }, []);

  const stop = useCallback(() => {
    if (!glide.current) return;
    cancel();
    shown.current = new Map(latest.current.map((node) => [node.id, node.position]));
    setFrame(null);
  }, [cancel]);

  useLayoutEffect(() => {
    const targets = new Map(nodes.map((node) => [node.id, node.position]));
    // A level that just came on screen (back from a replay or a subgraph) starts where it is.
    const own = skip.current || !wasEnabled.current;
    skip.current = false;
    wasEnabled.current = enabled;
    const dragging = nodes.some((node) => node.dragging);
    const duration = enabled && !own && !dragging ? glideMs() : 0;
    const running = glide.current;
    if (duration > 0 && running) {
      // A re-render mid-glide (a selection, a measured size) keeps the glide going when its targets stand.
      const same = [...running.to].every(([id, to]) => {
        const target = targets.get(id);
        return !target || (target.x === to.x && target.y === to.y);
      });
      const others = movedFrom(shown.current, nodes.filter((node) => !running.to.has(node.id)));
      if (same && others.size === 0) return;
    }
    const from = duration > 0 ? movedFrom(shown.current, nodes) : new Map<string, Point>();
    cancel();
    if (from.size === 0) {
      shown.current = targets;
      setFrame((current) => (current ? null : current));
      return;
    }
    const to = new Map([...from.keys()].map((id) => [id, targets.get(id)!]));
    const next: Glide = { from, to, start: performance.now(), duration, frame: 0 };
    const tick = (now: number) => {
      if (glide.current !== next) return;
      const t = (now - next.start) / next.duration;
      const eased = easeInOut(t);
      const positions = new Map<string, Point>();
      for (const node of latest.current) {
        const start = next.from.get(node.id);
        if (start) positions.set(node.id, lerpPoint(start, node.position, eased));
      }
      shown.current = new Map(latest.current.map((node) => [node.id, positions.get(node.id) ?? node.position]));
      if (t >= 1) {
        glide.current = null;
        setFrame(null);
        return;
      }
      setFrame(positions);
      next.frame = window.requestAnimationFrame(tick);
    };
    glide.current = next;
    // The first frame shows where the nodes were, before the browser paints the new positions.
    setFrame(new Map(from));
    next.frame = window.requestAnimationFrame(tick);
  }, [nodes, enabled, cancel]);

  useLayoutEffect(() => cancel, [cancel]);

  const drawn = useMemo(() => (frame
    ? nodes.map((node) => {
      const at = frame.get(node.id);
      return at ? { ...node, position: at } : node;
    })
    : nodes), [nodes, frame]);

  const skipNext = useCallback(() => {
    skip.current = true;
  }, []);

  return { nodes: drawn, skipNext, stop };
}
