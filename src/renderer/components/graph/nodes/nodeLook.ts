/**
 * How a node from a file looks: whether its class is installed (for the missing-class chip and saved values) and
 * the card size and colours the file asks for. NodeCard, EditorNodes and the Properties panel (InspectorLook) use it,
 * so an imported graph looks as it did in ComfyUI.
 */
import type React from 'react';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { useNodeInfoStore } from '../nodeInfo';
import { classPresence, fileBox, fileColors, type ClassPresence } from '../../../../shared/workflow/comfyLook';

export type { ClassPresence };

/**
 * Whether a class is installed, unknown or not yet known. A class is called missing only once the catalog has been
 * read, so a graph opened before the first sync does not mark every node as missing.
 */
export function useClassPresence(classType: string, instance: boolean): ClassPresence {
  const catalogRead = useKnowledgeStore((state) => (state.sync?.counts.nodeClasses ?? 0) > 0);
  const detail = useNodeInfoStore((state) => (classType in state.details ? state.details[classType] : undefined));
  return classPresence(classType, detail, catalogRead, instance);
}

/**
 * The card style the file asks for: its width and least height (a node from a file), and its colours as CSS
 * variables the card mixes into the night palette (Node.module.css `.fileColor`).
 */
export function fileStyle(data: { comfy?: unknown; importedLinks?: unknown; comfyType?: unknown }): React.CSSProperties {
  const style: Record<string, string> = {};
  const box = fileBox(data);
  if (box) {
    style.width = `${box.width}px`;
    style.minHeight = `${box.minHeight}px`;
    style.maxWidth = 'none';
  }
  const colors = fileColors(data);
  if (colors.color) style['--file-color'] = colors.color;
  if (colors.bgcolor) style['--file-bgcolor'] = colors.bgcolor;
  return style as React.CSSProperties;
}
