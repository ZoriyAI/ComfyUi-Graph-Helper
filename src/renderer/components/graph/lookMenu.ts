/**
 * Node context menu rows for workflows drawn the ComfyUI way (IMPORT+NODES): collapse or expand a node, and jump
 * between a Set node and its Get nodes. GraphContextMenu adds these rows; the actions live in importLook.ts.
 */
import { ChevronsDownUp, ChevronsUpDown, Crosshair, type LucideIcon } from 'lucide-react';
import { editorKind, isCollapsed, partnersOf } from '../../../shared/workflow/comfyLook';
import { goToNode, setCollapsed } from './importLook';

/** One row of the node context menu, in the shape GraphContextMenu draws. */
export interface LookMenuItem {
  id: string;
  labelKey: string;
  values?: Record<string, unknown>;
  icon: LucideIcon;
  shortcut?: string;
  disabled: boolean;
  run: () => void;
}

/** The parts of a node the rows are built from. */
type MenuNode = { id: string; data: { comfyType?: unknown; comfy?: unknown; title?: unknown } };

/**
 * The node menu rows of IMPORT+NODES: collapse or open (as ComfyUI's Alt+C; the selection, or the node clicked),
 * and for a Get "Go to its Set" (for a Set, its first Get). Labels are catalog keys.
 */
export function lookMenuItems(node: MenuNode, nodes: MenuNode[], targets: string[], readOnly: boolean): LookMenuItem[] {
  const collapsed = isCollapsed(node.data);
  const items: LookMenuItem[] = [{
    id: 'collapse',
    labelKey: collapsed ? 'importLook.menuExpand' : 'importLook.menuCollapse',
    icon: collapsed ? ChevronsUpDown : ChevronsDownUp,
    shortcut: 'Alt+C',
    disabled: readOnly,
    run: () => void setCollapsed(targets, !collapsed),
  }];
  const kind = editorKind(node.data.comfyType);
  if (kind === 'set' || kind === 'get') {
    const partners = partnersOf(node.id, nodes);
    items.push({
      id: 'go-partner',
      labelKey: kind === 'get' ? 'importLook.goToSet' : 'importLook.goToGet',
      values: { count: partners.length },
      icon: Crosshair,
      disabled: partners.length === 0,
      run: () => {
        if (partners[0]) goToNode(partners[0]);
      },
    });
  }
  return items;
}
