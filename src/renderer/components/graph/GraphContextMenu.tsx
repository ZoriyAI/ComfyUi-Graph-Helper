import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Menu from '@radix-ui/react-context-menu';
import { useReactFlow } from '@xyflow/react';
import type { ObjectRef } from '../../../shared/contracts/objects';
import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID, modelledSubgraphs } from '../../../shared/graph/subgraphs';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { useDockStore } from '../../state/dockState';
import { openProposals, useProposalsStore } from '../../state/proposalsState';
import type { GraphEdge, GraphNode, PortDefinition } from '../../types/graph';
import { askAbout } from './askAbout';
import { useCanvasStore } from './canvasStore';
import { commitManual } from './commit';
import { acceptAllProposals, FIT_PADDING } from './CanvasToolbar';
import { boundsOf, nodeRect, ghostNodePosition } from './lib/geometry';
import { nodeRef, portRef } from './lib/selection';
import { fitDurationMs } from '../../motion/policy';
import { startGraphTour } from './tour/startTour';
import styles from './GraphContextMenu.module.css';

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

function nodeName(node: GraphNode | undefined): string {
  return node ? String(node.data.title || node.data.comfyType) : '';
}

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
 * actions that apply to it. Questions go out through services/ask.ts and highlight the object; build
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
  const openSearch = useCanvasStore((state) => state.openAddSearch);
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
      ? nodeRef(nodes.find((node) => node.id === next.nodeId) ?? { id: next.nodeId })
      : next.kind === 'edge' ? { kind: 'edge', id: next.edgeId }
        : next.kind === 'group' ? { kind: 'group', id: next.groupId }
          : next.kind === 'port' ? portRef(next.nodeId, next.handle, next.direction, findPort(nodes.find((node) => node.id === next.nodeId), next.direction, next.handle)?.name)
            : null;
    setContextTarget(ref);
  }, [flow, nodes, setContextTarget]);

  /** Shift+F10 and the Menu key open the menu for the focused element, at its centre. */
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !event.currentTarget.contains(active)) return;
    if (active.closest('input, textarea, select')) return;
    event.preventDefault();
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
  const item = (key: string, label: string, run: () => void, options: { danger?: boolean; disabled?: boolean } = {}) => (
    <Menu.Item key={key} className={`${styles.item}${options.danger ? ` ${styles.danger}` : ''}`} disabled={options.disabled} onSelect={run}>
      {label}
    </Menu.Item>
  );
  const separator = (key: string) => <Menu.Separator key={key} className={styles.separator} />;
  const canBuild = !readOnly && !inDefinition;

  if (target.kind === 'node') {
    const node = nodes.find((item) => item.id === target.nodeId);
    const name = nodeName(node);
    const isBoundary = target.nodeId === SUBGRAPH_INPUT_NODE_ID || target.nodeId === SUBGRAPH_OUTPUT_NODE_ID;
    if (node && !isBoundary) {
      const ref = nodeRef(node);
      const instance = node.data.kind === 'subgraph-instance';
      const definitionId = node.data.subgraphId ?? node.data.comfyType;
      items.push(
        item('what', t('contextMenu.whatIs'), () => askAbout(ref, say(instance ? 'contextMenu.askSubgraph' : 'contextMenu.askWhat', { name }))),
        item('why', t('contextMenu.whyHere'), () => askAbout(ref, say('contextMenu.askWhy', { name }))),
        item('next', t('contextMenu.whatNext'), () => askAbout(ref, say('contextMenu.askNext', { name }))),
        item('ports', t('contextMenu.explainPorts'), () => askAbout(ref, say('contextMenu.askPorts', { name }))),
        item('tour', t('contextMenu.tourFromHere'), () => void startGraphTour({ fromNodeId: node.id })),
        separator('s1'),
      );
      if (instance) {
        items.push(
          item('enter', t('contextMenu.enter'), () => enter(definitionId), { disabled: readOnly }),
          item('dissolve', t('contextMenu.dissolve'), () => void commitManual({ type: 'dissolve-subgraph', nodeId: node.id }), { disabled: !canBuild }),
        );
      }
      items.push(
        item('subgraph', t('contextMenu.createSubgraph'), () => void commitManual({
          type: 'create-subgraph',
          name: String(t('contextMenu.subgraphName')),
          nodeIds: selectionFor(node.id),
          inputs: [],
          outputs: [],
        }), { disabled: !canBuild }),
        item('group', t('contextMenu.addGroup'), () => void commitManual({ type: 'add-group', title: String(t('contextMenu.groupTitle')), nodeIds: selectionFor(node.id) }), { disabled: !canBuild }),
        item('docs', t('contextMenu.componentDocs'), () => {
          setSelection([ref]);
          useGraphStore.setState((state) => ({ nodes: state.nodes.map((item) => ({ ...item, selected: item.id === node.id })) }));
          useDockStore.getState().show('inspector');
          window.setTimeout(() => document.getElementById(`component-purpose-node-${node.id}`)?.focus(), 60);
        }, { disabled: inDefinition || readOnly }),
        separator('s2'),
        item('remove', t('contextMenu.remove'), () => void commitManual({ type: 'remove-node', nodeId: node.id }), { danger: true, disabled: !canBuild }),
      );
    }
  } else if (target.kind === 'port') {
    const node = nodes.find((item) => item.id === target.nodeId);
    const port = findPort(node, target.direction, target.handle);
    const isBoundary = target.nodeId === SUBGRAPH_INPUT_NODE_ID || target.nodeId === SUBGRAPH_OUTPUT_NODE_ID;
    const portName = port?.name ?? target.handle;
    const ref = portRef(target.nodeId, target.handle, target.direction, portName);
    const name = isBoundary ? (definition?.name ?? '') : nodeName(node);
    items.push(
      target.direction === 'input'
        ? item('connect-in', t('contextMenu.whatConnectsIn'), () => {
          setConnectFrom({ nodeId: target.nodeId, handle: target.handle, direction: 'input', dataType: port?.dataType ?? '*' }, true);
          askAbout(ref, say('contextMenu.askConnectIn', { port: portName, name }));
        })
        : item('where-out', t('contextMenu.whereGoes'), () => {
          setConnectFrom({ nodeId: target.nodeId, handle: target.handle, direction: 'output', dataType: port?.dataType ?? '*' }, true);
          askAbout(ref, say('contextMenu.askWhereOut', { port: portName, name }));
        }),
      item('type', t('contextMenu.whatType'), () => askAbout(ref, say('contextMenu.askType', { type: port?.dataType ?? '?', port: portName, name }))),
      item('suggest', t('contextMenu.suggestConnection'), () => setConnectFrom({ nodeId: target.nodeId, handle: target.handle, direction: target.direction, dataType: port?.dataType ?? '*' }, true), { disabled: readOnly }),
    );
    if (definition && !readOnly) {
      if (isBoundary) {
        const slotIndex = Number(/-(\d+)$/.exec(target.handle)?.[1] ?? -1);
        const direction = target.nodeId === SUBGRAPH_INPUT_NODE_ID ? 'input' : 'output';
        const slot = (direction === 'input' ? definition.inputs : definition.outputs)[slotIndex];
        if (slot) {
          items.push(separator('s1'), item('remove-slot', t('contextMenu.removeSlot'), () => void commitManual({ type: 'remove-subgraph-io', definitionId: definition.id, direction, slotId: slot.id }), { danger: true }));
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
          })),
        );
      }
    }
  } else if (target.kind === 'edge') {
    const edge = edges.find((item) => item.id === target.edgeId);
    if (edge) {
      const ref: ObjectRef = { kind: 'edge', id: edge.id };
      const source = nodeName(nodes.find((node) => node.id === edge.source)) || edge.source;
      const targetName = nodeName(nodes.find((node) => node.id === edge.target)) || edge.target;
      const type = String(edge.data?.dataType ?? '');
      items.push(
        item('flows', t('contextMenu.whatFlows'), () => askAbout(ref, say('contextMenu.askFlows', { type, source, target: targetName }))),
        item('why', t('contextMenu.whyEdge'), () => askAbout(ref, say('contextMenu.askWhyEdge', { source, target: targetName }))),
        separator('s1'),
        item('remove', t('contextMenu.disconnect'), () => void commitManual({ type: 'remove-edge', edgeId: edge.id }), { danger: true, disabled: !canBuild }),
      );
    }
  } else if (target.kind === 'group') {
    const group = groups.find((item) => item.id === target.groupId);
    if (group) {
      const ref: ObjectRef = { kind: 'group', id: group.id };
      items.push(
        item('what', t('contextMenu.whatGroup'), () => askAbout(ref, say('contextMenu.askGroup', { name: group.title }))),
        separator('s1'),
        item('remove', t('contextMenu.removeGroup'), () => void commitManual({ type: 'remove-group', groupId: group.id }), { danger: true, disabled: !canBuild }),
      );
    }
  } else {
    const at = target.at;
    const definitions = modelledSubgraphs(subgraphs);
    const open = openProposals(proposals);
    items.push(item('add', t('contextMenu.addNode'), () => openSearch(at), { disabled: !canBuild }));
    items.push(
      <Menu.Sub key="insert">
        <Menu.SubTrigger className={styles.item} disabled={!canBuild}>{t('contextMenu.insertSubgraph')}</Menu.SubTrigger>
        <Menu.Portal>
          <Menu.SubContent className={styles.content} sideOffset={4}>
            {definitions.length === 0 ? <Menu.Item className={styles.item} disabled>{t('contextMenu.noSubgraphs')}</Menu.Item> : definitions.map((item) => (
              <Menu.Item key={item.id} className={styles.item} onSelect={() => void commitManual({ type: 'insert-subgraph', definitionId: item.id, x: Math.round(at.x), y: Math.round(at.y) })}>
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
        if (payload.type === 'add-node') return [{ ...ghostNodePosition(payload, rootNodes), width: 240, height: 120 }];
        if (payload.type === 'insert-subgraph') return [{ x: payload.x, y: payload.y, width: 240, height: 120 }];
        const ids = payload.type === 'create-subgraph' ? payload.nodeIds
          : payload.type === 'connect' ? [payload.source, payload.target]
            : 'nodeId' in payload ? [payload.nodeId] : [];
        return rootNodes.filter((node) => ids.includes(node.id)).map(nodeRect);
      });
      const box = boundsOf(rects, 40);
      if (box) void flow.fitBounds(box, { duration: fitDurationMs() });
    }, { disabled: open.length === 0 || inDefinition }));
    if (open.length >= 2) items.push(item('accept-all', t('contextMenu.acceptAll'), () => void acceptAllProposals(), { disabled: readOnly || inDefinition }));
    items.push(separator('s1'), item('fit', t('contextMenu.fit'), () => void flow.fitView({ padding: FIT_PADDING, duration: fitDurationMs() })));
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
        <Menu.Content className={styles.content} aria-label={String(t('contextMenu.label'))} collisionPadding={8}>
          {items}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
