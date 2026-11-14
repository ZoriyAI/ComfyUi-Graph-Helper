import type React from 'react';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { useNodeInfoStore } from '../nodeInfo';
import { classPresence, fileBox, fileColors, type ClassPresence } from '../../../../shared/workflow/comfyLook';

export type { ClassPresence };

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
