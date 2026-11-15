/**
 * The canvas context menu: right-click (or Shift+F10 / the Menu key) on a node, a port, a link, a group or empty
 * canvas lists the questions for the helper about that object and the edits that apply to it. CanvasFlow wraps the
 * whole canvas in it. The rows come from the command registry where a command exists, so labels, shortcuts and the
 * enabled state match the menu bar; editingMenu.tsx and lookMenu add the editing and collapse rows.
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Menu from '@radix-ui/react-context-menu';
import { useReactFlow } from '@xyflow/react';
import {
  ArrowRight, ArrowRightLeft, Cable, CircleArrowRight, CircleHelp, CircleMinus, Compass, Ghost, Layers, LogIn, LogOut,
  MessageCircleQuestion, PenLine, Plug, StickyNote, Tag, Trash2, Ungroup, Unlink, type LucideIcon,
} from 'lucide-react';
import { lookMenuItems } from './lookMenu';
import type { ObjectRef } from '../../../shared/contracts/objects';
import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID, modelledSubgraphs, nestsItself } from '../../../shared/graph/subgraphs';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { useDockStore } from '../../state/dockState';
import { ghostSpots, openProposals, useProposalsStore } from '../../state/proposalsState';
import type { GraphEdge, GraphNode, PortDefinition } from '../../types/graph';
import { askAbout, askWhatFlows } from './askAbout';
import { useCanvasStore } from './canvasStore';
import { commitManual } from './commit';
import { boundsOf, nodeRect, ghostNodePosition, GHOST_SIZE } from './lib/geometry';
import { subgraphCardSize } from './lib/nodeSizes';
import { placeNewNode } from './placeNode';
import { edgeRef, nodeRef, portRef } from './lib/selection';
import { selectOnLevel } from './lib/level';
import { copySelection, cutSelection, duplicateSelection, hasClipboard, pasteClipboard } from './lib/clipboard';
import { moveCamera, viewForBounds } from '../../motion/camera';
import { getCommand, isEnabled, runCommand } from '../../commands/registry';
import { addGroup, createSubgraph, dissolveSubgraph, openAddNode } from '../../commands/actions';
import Shortcut from '../../ui/Shortcut';
import { startGraphTour } from './tour/startTour';
import { nodeDisplayName } from './lib/nodeName';
import { edgeEditingItems, groupEditingItems, groupMembershipItems, nodeEditingItems, paneEditingItems } from './editingMenu';
import styles from './GraphContextMenu.module.css';

/**
 * Insert subgraph (contextMenu.insertSubgraph) from the menu: at the point of the click, moved to the nearest spot
 * where it covers no node.
 */
async function insertSubgraphAt(definition: { id: string; name: string; inputs: unknown[]; outputs: unknown[] }, at: { x: number; y: number }): Promise<void> {
  const spot = await placeNewNode(at, { size: subgraphCardSize(definition) });
  await commitManual({ type: 'insert-subgraph', definitionId: definition.id, x: spot.x, y: spot.y });
}

/** What the person right-clicked (or pressed Shift+F10 on). */
export type MenuTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'port'; nodeId: string; handle: string; direction: 'input' | 'output' }
  | { kind: 'edge'; edgeId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'pane'; at: { x: number; y: number } };

/** Reads the target from the DOM element under the pointer. Pure apart from DOM reads, so it is easy to follow. */
export function targetFromElement(element: Element | null, at: { x: number; y: number }): MenuTarget {
  const handle = element?.closest('.react-flow__handle');
  const nodeElement = element?.closest('.react-flow__node');
  if (handle && nodeElement) {
    const nodeId = nodeElement.getAttribute('data-id') ?? '';
    const id = handle.getAttribute('data-handleid') ?? '';
    return { kind: 'port', nodeId, handle: id, direction: handle.classList.contains('target') ? 'input' : 'output' };
  }
  if (nodeElement) return { kind: 'node', nodeId: nodeElement.getAttribute('data-id') ?? '' };
  const edge = element?.closest('.react-flow__edge');
  if (edge) return { kind: 'edge', edgeId: edge.getAttribute('data-id') ?? '' };
  const group = element?.closest('[data-group-id]');
  if (group) return { kind: 'group', groupId: group.getAttribute('data-group-id') ?? '' };
  return { kind: 'pane', at };
}

/** The name a person sees on the node card, for the questions' wording. */
function nodeName(node: GraphNode | undefined): string {
  return nodeDisplayName(node?.data);
}

/** The port behind a handle id on one side of a node. */
function findPort(node: GraphNode | undefined, direction: 'input' | 'output', handle: string): PortDefinition | undefined {
  return (direction === 'input' ? node?.data.inputs : node?.data.outputs)?.find((port) => port.id === handle);
}

interface Props {
  children: React.ReactNode;
  /** Nodes and edges of the level on screen. */
  nodes: Array<GraphNode | { id: string; type?: string; data: unknown; position: { x: number; y: number } }>;
  edges: GraphEdge[];
  readOnly: boolean;
}

/**
 * Right-click (or Shift+F10 / Menu key) anywhere on the canvas: questions about the object, and the build
 * actions that apply to it. Questions go out through askAbout.ts (services/ask.ts) and highlight the object; build
 * actions commit mutations. Radix primitives directly; the Shell's styled ContextMenu can replace them.
 */
export default function GraphContextMenu({ children, nodes: levelNodes, edges, readOnly }: Props) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const [target, setTarget] = useState<MenuTarget>({ kind: 'pane', at: { x: 0, y: 0 } });
  const rootNodes = useGraphStore((state) => state.nodes);
  const groups = useGraphStore((state) => state.groups);
  const subgraphs = useGraphStore((state) => state.subgraphs);
  const activeSubgraphId = useGraphStore((state) => state.activeSubgraphId);
  const enter = useGraphStore((state) => state.enterSubgraph);
  const setContextTarget = useUiStore((state) => state.setContextTarget);
  const setSelection = useUiStore((state) => state.setSelection);
  const proposals = useProposalsStore((state) => state.proposals);
  const setConnectFrom = useCanvasStore((state) => state.setConnectFrom);
  const nodes = levelNodes as GraphNode[];
  const inDefinition = activeSubgraphId !== null;
  const definition = subgraphs.find((item) => item.id === activeSubgraphId);

  const onContextMenu = useCallback((event: React.MouseEvent) => {
    // The canvas toolbar and its search are controls, not graph objects: no canvas menu there.
    if ((event.target as Element).closest?.('[role="toolbar"], [role="dialog"]')) {
      event.preventDefault();
      return;
    }
    const next = targetFromElement(event.target as Element, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    setTarget(next);
    const ref: ObjectRef | null = next.kind === 'node'
      ? nodeRef(nodes.find((node) => node.id === next.nodeId) ?? { id: next.nodeId }, activeSubgraphId)
      : next.kind === 'edge' ? edgeRef(next.edgeId, activeSubgraphId)
        : next.kind === 'group' ? { kind: 'group', id: next.groupId }
          : next.kind === 'port' ? portRef(next.nodeId, next.handle, next.direction, findPort(nodes.find((node) => node.id === next.nodeId), next.direction, next.handle)?.name, activeSubgraphId)
            : null;
    setContextTarget(ref);
  }, [flow, nodes, setContextTarget, activeSubgraphId]);

  /** Shift+F10 and the Menu key open the menu for the focused element, at its centre. */
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !event.currentTarget.contains(active)) return;
    if (active.closest('input, textarea, select')) return;
    event.preventDefault();
    // A synthetic contextmenu event on the focused element opens the same Radix menu a right-click opens; the point
    // stays near the element's top-left so the menu opens beside it, not in the middle of a wide node.
    const box = active.getBoundingClientRect();
    active.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: box.left + Math.min(box.width / 2, 40),
      clientY: box.top + Math.min(box.height / 2, 20),
    }));
  }, []);

  const selectedIds = nodes.filter((node) => node.selected).map((node) => node.id);
  const selectionFor = (nodeId: string) => (selectedIds.includes(nodeId) ? selectedIds : [nodeId]);
  const say = (key: string, values: Record<string, string>) => String(t(key, values));
  const items: React.ReactNode[] = [];
  /** One row: an icon so the menu reads at a glance, the words, and the shortcut when it has one. */
  const item = (key: string, label: string, run: () => void, options: { icon?: LucideIcon; danger?: boolean; disabled?: boolean; shortcut?: string } = {}) => (
    <Menu.Item key={key} className={`${styles.item}${options.danger ? ` ${styles.danger}` : ''}`} disabled={options.disabled} onSelect={run}>
      {options.icon ? <span className={styles.icon} aria-hidden="true"><options.icon size={14} /></span> : null}
      <span className={styles.label}>{label}</span>
      {options.shortcut ? <Shortcut shortcut={options.shortcut} quiet className={styles.shortcut} /> : null}
    </Menu.Item>
  );
  /** A registry command: the same label, shortcut and enabled state as in the menu bar. */
  const commandItem = (id: string, run?: () => void, options: { disabled?: boolean } = {}) => {
    const command = getCommand(id);
    if (!command) return null;
    return item(id, String(t(command.labelKey)), run ?? (() => void runCommand(id)), {
      icon: command.icon,
      shortcut: command.shortcut,
      disabled: options.disabled || (!run && !isEnabled(id)),
    });
  };
  const separator = (key: string) => <Menu.Separator key={key} className={styles.separator} />;
  /** A small caption over the questions: they go to the helper, the rows below act on the graph. */
  const askLabel = <Menu.Label key="ask-label" className={styles.groupLabel}>{t('contextMenu.askHelper')}</Menu.Label>;
  // Node, link and slot edits work on every level; making or dissolving subgraphs, groups and the helper's
  // suggestions belong to the root canvas.
  const canBuild = !readOnly;
  const canBuildRoot = canBuild && !inDefinition;

  if (target.kind === 'node') {
    const node = nodes.find((item) => item.id === target.nodeId);
    const name = nodeName(node);
    const isBoundary = target.nodeId === SUBGRAPH_INPUT_NODE_ID || target.nodeId === SUBGRAPH_OUTPUT_NODE_ID;
    if (node && !isBoundary) {
      const ref = nodeRef(node, activeSubgraphId);
      const instance = node.data.kind === 'subgraph-instance';
      const definitionId = node.data.subgraphId ?? node.data.comfyType;
      items.push(
        askLabel,
        item('what', t('contextMenu.whatIs'), () => askAbout(ref, say(instance ? 'contextMenu.askSubgraph' : 'contextMenu.askWhat', { name })), { icon: CircleHelp }),
        item('why', t('contextMenu.whyHere'), () => askAbout(ref, say('contextMenu.askWhy', { name })), { icon: MessageCircleQuestion }),
        item('next', t('contextMenu.whatNext'), () => askAbout(ref, say('contextMenu.askNext', { name })), { icon: CircleArrowRight }),
        item('ports', t('contextMenu.explainPorts'), () => askAbout(ref, say('contextMenu.askPorts', { name })), { icon: Cable }),
        separator('s0'),
        item('tour', t('contextMenu.tourFromHere'), () => void startGraphTour({ fromNodeId: node.id }), { icon: Compass }),
        separator('s1'),
      );
      if (instance) {
        items.push(
          item('enter', t('contextMenu.enter'), () => enter(definitionId), { icon: Layers, disabled: readOnly }),
          item('dissolve', t('contextMenu.dissolve'), () => void dissolveSubgraph(node.id), { icon: Ungroup, disabled: !canBuildRoot }),
        );
      }
      // Copy, cut and duplicate act on the selection; a right-click on a node outside it selects that node first.
      const onSelection = (run: () => unknown) => () => {
        if (!selectedIds.includes(node.id)) selectOnLevel([node.id]);
        // The next tick: the selection change must reach the stores before the clipboard reads it.
        window.setTimeout(() => void run(), 0);
      };
      items.push(
        commandItem('edit.copy', onSelection(copySelection), { disabled: readOnly }),
        commandItem('edit.cut', onSelection(cutSelection), { disabled: !canBuild }),
        commandItem('edit.duplicate', onSelection(duplicateSelection), { disabled: !canBuild }),
        separator('s-clip'),
        commandItem('graph.createSubgraph', () => void createSubgraph(selectionFor(node.id)), { disabled: !canBuild }),
        commandItem('graph.addGroup', () => void addGroup(selectionFor(node.id)), { disabled: !canBuildRoot }),
        item('rename', t('contextMenu.rename'), () => {
          setSelection([ref]);
          selectOnLevel([node.id]);
          useDockStore.getState().show('inspector');
          // The Properties panel needs a moment to mount the field for the newly selected node.
          window.setTimeout(() => {
            const field = document.getElementById(`node-title-${node.id}`) as HTMLInputElement | null;
            field?.focus();
            field?.select();
          }, 60);
        }, { icon: PenLine, disabled: !canBuild || instance }),
        item('docs', t('contextMenu.componentDocs'), () => {
          setSelection([ref]);
          selectOnLevel([node.id]);
          useDockStore.getState().show('inspector');
          window.setTimeout(() => document.getElementById(`component-purpose-node-${node.id}`)?.focus(), 60);
        }, { icon: StickyNote, disabled: inDefinition || readOnly }),
        // IMPORT+NODES: collapse / open (Alt+C), and the jump from a Get to its Set.
        ...lookMenuItems(node, nodes, selectionFor(node.id), !canBuild).map((entry) => item(entry.id, String(t(entry.labelKey, entry.values ?? {})), entry.run, { icon: entry.icon, shortcut: entry.shortcut, disabled: entry.disabled })),
        // Editing rows (editingMenu.tsx) beside collapse: bypass, mute, colour, replace.
        ...nodeEditingItems((key) => String(t(key)), node, nodes.filter((item): item is GraphNode => item.type === 'comfy' && selectionFor(node.id).includes(item.id)), !canBuild),
        ...(inDefinition ? [] : groupMembershipItems((key) => String(t(key)), nodes.filter((item): item is GraphNode => item.type === 'comfy' && selectionFor(node.id).includes(item.id)), groups, !canBuildRoot)),
        separator('s2'),
        item('remove', t('contextMenu.remove'), () => void commitManual({ type: 'remove-node', nodeId: node.id }), { icon: Trash2, danger: true, disabled: !canBuild, shortcut: 'Delete' }),
      );
    }
  } else if (target.kind === 'port') {
    const node = nodes.find((item) => item.id === target.nodeId);
    const port = findPort(node, target.direction, target.handle);
    const isBoundary = target.nodeId === SUBGRAPH_INPUT_NODE_ID || target.nodeId === SUBGRAPH_OUTPUT_NODE_ID;
    const portName = port?.name ?? target.handle;
    const ref = portRef(target.nodeId, target.handle, target.direction, portName, activeSubgraphId);
    const name = isBoundary ? (definition?.name ?? '') : nodeName(node);
    items.push(
      askLabel,
      target.direction === 'input'
        ? item('connect-in', t('contextMenu.whatConnectsIn'), () => {
          setConnectFrom({ nodeId: target.nodeId, handle: target.handle, direction: 'input', dataType: port?.dataType ?? '*' }, true);
          askAbout(ref, say('contextMenu.askConnectIn', { port: portName, name }));
        }, { icon: Plug })
        : item('where-out', t('contextMenu.whereGoes'), () => {
          setConnectFrom({ nodeId: target.nodeId, handle: target.handle, direction: 'output', dataType: port?.dataType ?? '*' }, true);
          askAbout(ref, say('contextMenu.askWhereOut', { port: portName, name }));
        }, { icon: ArrowRight }),
      item('type', t('contextMenu.whatType'), () => askAbout(ref, say('contextMenu.askType', { type: port?.dataType ?? '?', port: portName, name })), { icon: Tag }),
      separator('s0'),
      item('suggest', t('contextMenu.suggestConnection'), () => setConnectFrom({ nodeId: target.nodeId, handle: target.handle, direction: target.direction, dataType: port?.dataType ?? '*' }, true), { icon: Cable, disabled: readOnly }),
    );
    if (definition && !readOnly) {
      if (isBoundary) {
        // A boundary node's handles end in the slot's index ("out-2"); the empty slot at the end matches no slot.
        const slotIndex = Number(/-(\d+)$/.exec(target.handle)?.[1] ?? -1);
        const direction = target.nodeId === SUBGRAPH_INPUT_NODE_ID ? 'input' : 'output';
        const slot = (direction === 'input' ? definition.inputs : definition.outputs)[slotIndex];
        if (slot) {
          items.push(separator('s1'), item('remove-slot', t('contextMenu.removeSlot'), () => void commitManual({ type: 'remove-subgraph-io', definitionId: definition.id, direction, slotId: slot.id }), { icon: CircleMinus, danger: true }));
        }
      } else if (port) {
        items.push(
          separator('s1'),
          item('expose', target.direction === 'input' ? t('contextMenu.exposeInput') : t('contextMenu.exposeOutput'), () => void commitManual({
            type: 'add-subgraph-io',
            definitionId: definition.id,
            direction: target.direction,
            name: port.name,
            dataType: port.dataType,
            nodeId: target.nodeId,
            handle: target.handle,
          }), { icon: target.direction === 'input' ? LogIn : LogOut }),
        );
      }
    }
  } else if (target.kind === 'edge') {
    const edge = edges.find((item) => item.id === target.edgeId);
    if (edge) {
      const ref: ObjectRef = edgeRef(edge.id, activeSubgraphId);
      const source = nodeName(nodes.find((node) => node.id === edge.source)) || edge.source;
      const targetName = nodeName(nodes.find((node) => node.id === edge.target)) || edge.target;
      const type = String(edge.data?.dataType ?? '');
      items.push(
        askLabel,
        item('flows', t('contextMenu.whatFlows'), () => void askWhatFlows(edge.id, type, say('contextMenu.askFlows', { type, source, target: targetName }), activeSubgraphId), { icon: ArrowRightLeft }),
        item('why', t('contextMenu.whyEdge'), () => askAbout(ref, say('contextMenu.askWhyEdge', { source, target: targetName })), { icon: MessageCircleQuestion }),
        separator('s1'),
        ...edgeEditingItems((key) => String(t(key)), edge.id, !canBuild),
        item('remove', t('contextMenu.disconnect'), () => void commitManual({ type: 'remove-edge', edgeId: edge.id }), { icon: Unlink, danger: true, disabled: !canBuild }),
      );
    }
  } else if (target.kind === 'group') {
    const group = groups.find((item) => item.id === target.groupId);
    if (group) {
      const ref: ObjectRef = { kind: 'group', id: group.id };
      items.push(
        askLabel,
        item('what', t('contextMenu.whatGroup'), () => askAbout(ref, say('contextMenu.askGroup', { name: group.title })), { icon: CircleHelp }),
        separator('s1'),
        ...groupEditingItems((key) => String(t(key)), group.id, group.color, !canBuildRoot),
        item('remove', t('contextMenu.removeGroup'), () => void commitManual({ type: 'remove-group', groupId: group.id }), { icon: Ungroup, danger: true, disabled: !canBuildRoot }),
      );
    }
  } else {
    const at = target.at;
    const definitions = modelledSubgraphs(subgraphs);
    const open = openProposals(proposals);
    items.push(commandItem('graph.addNode', () => openAddNode(at), { disabled: !canBuild }));
    items.push(commandItem('edit.paste', () => void pasteClipboard(), { disabled: !canBuild || !hasClipboard() }));
    items.push(...paneEditingItems((key) => String(t(key)), at, !canBuild));
    items.push(
      <Menu.Sub key="insert">
        <Menu.SubTrigger className={styles.item} disabled={!canBuild}>
          <span className={styles.icon} aria-hidden="true"><Layers size={14} /></span>
          <span className={styles.label}>{t('contextMenu.insertSubgraph')}</span>
        </Menu.SubTrigger>
        <Menu.Portal>
          <Menu.SubContent className={styles.content} sideOffset={4}>
            {definitions.length === 0 ? <Menu.Item className={styles.item} disabled>{t('contextMenu.noSubgraphs')}</Menu.Item> : definitions.map((item) => (
              // Inside a subgraph, one that would hold itself (directly or through another) cannot go in.
              <Menu.Item key={item.id} className={styles.item} disabled={definition ? nestsItself(subgraphs, definition.id, item.id) : false} onSelect={() => void insertSubgraphAt(item, at)}>
                {item.name}
              </Menu.Item>
            ))}
          </Menu.SubContent>
        </Menu.Portal>
      </Menu.Sub>,
    );
    items.push(item('ghosts', t('contextMenu.showGhosts'), () => {
      const rects = open.flatMap((proposal) => {
        const payload = proposal.payload;
        // Where the canvas drew the ghost, when it has; else where it would.
        if (payload.type === 'add-node' || payload.type === 'insert-subgraph') return [{ ...(ghostSpots.get(proposal.id) ?? ghostNodePosition(payload, rootNodes)), ...GHOST_SIZE }];
        const ids = payload.type === 'create-subgraph' ? payload.nodeIds
          : payload.type === 'connect' ? [payload.source, payload.target]
            : 'nodeId' in payload ? [payload.nodeId] : [];
        return rootNodes.filter((node) => ids.includes(node.id)).map(nodeRect);
      });
      const box = boundsOf(rects, 40);
      if (box) void moveCamera(flow, viewForBounds(box, { padding: 0.1 }));
    }, { icon: Ghost, disabled: open.length === 0 || inDefinition }));
    if (open.length >= 2) items.push(commandItem('graph.acceptAll'), commandItem('graph.rejectAll'));
    items.push(separator('s1'), commandItem('view.fit'));
  }

  return (
    <Menu.Root onOpenChange={(open) => {
      if (!open) setContextTarget(null);
    }}>
      <Menu.Trigger asChild>
        <div className={styles.trigger} onContextMenu={onContextMenu} onKeyDown={onKeyDown}>
          {children}
        </div>
      </Menu.Trigger>
      <Menu.Portal>
        {/* Clear of the status bar at the bottom of the window (24px) as well as the window edges. */}
        <Menu.Content className={styles.content} aria-label={String(t('contextMenu.label'))} collisionPadding={{ top: 8, right: 8, bottom: 32, left: 8 }}>
          {items}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
