/**
 * How a lesson moves on the canvas (motion package). LessonPanel's running lesson mounts useLessonMotion.
 *
 * - Focus: the nodes the current step lacks something on (the two ends of a missing link, the node of a field)
 *   stand out and the rest of the graph steps back, so a person sees where to work.
 * - A passed step: what closed it (the new node, the link, the node of the field) flashes, and after a moment the
 *   camera goes to the place of the next step without selecting anything.
 * Why: the panel said "done" and moved on in text only; on a big graph the person had to look for both the thing
 * that counted and the next place.
 * Every move follows the motion policy: the flash is a still ring with motion reduced or off, and the camera cuts.
 * tests/unit/motionPolicy.test.ts covers focusOf, passedMarks and placeOf.
 */
import { useEffect, useRef } from 'react';
import type { Missing, Progress } from '../../../shared/lessons/engine';
import { captureEditOrigin, originIsCurrent } from '../graph/lib/editOrigin';
import { levelEdges } from '../graph/lib/level';
import { useCanvasStore } from '../graph/canvasStore';
import { flash, useAttentionStore } from '../../motion/attention';
import { tokenMs } from '../../motion/policy';


/** The nodes a step's first missing thing is about. */
export function focusOf(missing: Missing | undefined): string[] | null {
  if (!missing) return null;
  if (missing.kind === 'link') return [missing.from.nodeId, missing.to.nodeId];
  if (missing.kind === 'field') return [missing.nodeId];
  return null;
}

/** What to flash when a step is passed: the thing it lacked, now on the canvas. */
export function passedMarks(lacked: Missing | undefined, roles: Record<string, string>, edges: ReadonlyArray<{ id: string; source: string; target: string }>): { nodes: string[]; edges: string[] } {
  if (!lacked) return { nodes: [], edges: [] };
  if (lacked.kind === 'node') return { nodes: roles[lacked.role] ? [roles[lacked.role]] : [], edges: [] };
  if (lacked.kind === 'field') return { nodes: [lacked.nodeId], edges: [] };
  const link = edges.find((edge) => edge.source === lacked.from.nodeId && edge.target === lacked.to.nodeId);
  return { nodes: [lacked.to.nodeId], edges: link ? [link.id] : [] };
}

/** Where the camera goes for a step: the node the missing link goes into, or the node of the missing field. */
export function placeOf(missing: Missing | undefined): string | null {
  if (!missing) return null;
  if (missing.kind === 'link') return missing.to.nodeId;
  if (missing.kind === 'field') return missing.nodeId;
  return null;
}

/** Drives the canvas for a running lesson; `active` is false once the lesson is finished. */
export function useLessonMotion(lessonId: string, progress: Progress, active: boolean): void {
  const first = active ? progress.missing[0] : undefined;
  // The focus as a string, so a recomputed but equal list does not set the store again.
  const focusKey = JSON.stringify(focusOf(first));
  useEffect(() => {
    useAttentionStore.getState().setLessonFocus(JSON.parse(focusKey) as string[] | null);
  }, [focusKey]);
  useEffect(() => () => useAttentionStore.getState().setLessonFocus(null), []);

  const last = useRef<{ lessonId: string; current: number; lacked: Missing | undefined } | null>(null);
  useEffect(() => () => { last.current = null; }, []);
  useEffect(() => {
    const before = last.current;
    last.current = { lessonId, current: progress.current, lacked: progress.missing[0] };
    if (!before || before.lessonId !== lessonId || progress.current <= before.current) return;
    flash(passedMarks(before.lacked, progress.roles, levelEdges()));
    const next = placeOf(progress.missing[0]);
    if (!next) return;
    // The flash is seen first; then the camera moves on, after half the mark's reading time. Not cancelled when the
    // progress is recomputed meanwhile (it is, after every projection); only a step passed since then wins.
    const step = progress.current;
    const origin = captureEditOrigin();
    window.setTimeout(() => {
      if (originIsCurrent(origin) && last.current?.lessonId === lessonId && last.current.current === step) useCanvasStore.getState().requestCenter(next, undefined, { select: false });
    }, tokenMs('--motion-mark') / 2);
  }, [lessonId, progress]);
}
