/**
 * The editing rows of the canvas context menu (GraphContextMenu.tsx): on a node, Bypass, Mute, Color and Replace
 * with (catalog editing.bypass, editing.mute, editing.color, editing.replaceNode); on a link, Insert node and Add
 * reroute; on a group, Color; on empty canvas, Add note (editing.addNote). They run the same functions as the menu
 * bar and the shortcuts (commands/editingCommands.ts), so a node the person right-clicks, or the selection it
 * belongs to, is what changes.
 */
import React from 'react';
import * as Menu from '@radix-ui/react-context-menu';
import { Ban, Check, Group, Palette, Replace, Spline, StickyNote, Ungroup, Waypoints, type LucideIcon } from 'lucide-react';
import type { GroupRecord } from '../../../shared/graph/subgraphs';
import { commitManual } from './commit';
import { NODE_COLORS } from '../../../shared/commands/types';
import { NODE_PALETTE, paletteNameOf, type ColorName } from '../../../shared/graph/palette';
import { nodeRunMode } from '../../../shared/graph/layout';
import { getCommand } from '../../commands/registry';
import {
  addNote, addRerouteOnLink, colorGroup, colorSelection, openInsertOnLink, openReplaceNode, replaceable, setRunMode,
} from '../../commands/editingCommands';
import Shortcut from '../../ui/Shortcut';
import type { GraphNode } from '../../types/graph';
import styles from './GraphContextMenu.module.css';

/** A plain translate function the context menu passes in. */
type Translate = (key: string) => string;

/**
 * Runs after the menu has closed and handed focus back: the node search it opens takes focus itself and closes when
 * its field loses focus, so it must open after the menu's own focus return.
 */
function afterMenu(run: () => void): void {
  window.setTimeout(run, 60);
}

/** A row with a tick: checked rows say the state the click takes away. */
function checkRow(key: string, label: string, checked: boolean, run: () => void, options: { icon: LucideIcon; disabled?: boolean; shortcut?: string }) {
  return (
    <Menu.CheckboxItem key={key} className={styles.item} checked={checked} disabled={options.disabled} onSelect={run}>
      <span className={styles.icon} aria-hidden="true">{checked ? <Check size={14} /> : <options.icon size={14} />}</span>
      <span className={styles.label}>{label}</span>
      {options.shortcut ? <Shortcut shortcut={options.shortcut} quiet className={styles.shortcut} /> : null}
    </Menu.CheckboxItem>
  );
}

/** Color (editing.color) with ComfyUI's palette and No color (editing.colorNone); `current` is ticked. */
function colorSubmenu(key: string, t: Translate, current: ColorName | 'none' | null, run: (color: ColorName | null) => void, disabled: boolean, swatch: 'node' | 'group') {
  return (
    <Menu.Sub key={key}>
      <Menu.SubTrigger className={styles.item} disabled={disabled}>
        <span className={styles.icon} aria-hidden="true"><Palette size={14} /></span>
        <span className={styles.label}>{t('editing.color')}</span>
      </Menu.SubTrigger>
      <Menu.Portal>
        <Menu.SubContent className={styles.content} sideOffset={4} aria-label={t('editing.color')}>
          <Menu.RadioGroup value={current ?? ''}>
            {NODE_COLORS.map((name) => (
              <Menu.RadioItem key={name} value={name} className={styles.item} onSelect={() => run(name)}>
                <span className={styles.icon} aria-hidden="true">
                  <span className={styles.swatch} style={{ background: swatch === 'node' ? NODE_PALETTE[name].bgcolor : NODE_PALETTE[name].groupcolor }} />
                </span>
                <span className={styles.label}>{t(`editing.colors.${name}`)}</span>
                <Menu.ItemIndicator className={styles.shortcut}><Check size={14} aria-hidden="true" /></Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
            <Menu.RadioItem value="none" className={styles.item} onSelect={() => run(null)}>
              <span className={styles.icon} aria-hidden="true" />
              <span className={styles.label}>{t('editing.colorNone')}</span>
              <Menu.ItemIndicator className={styles.shortcut}><Check size={14} aria-hidden="true" /></Menu.ItemIndicator>
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  );
}

/** The colour the nodes share, as colorSubmenu ticks it. */
function sharedColor(nodes: GraphNode[]): ColorName | 'none' | null {
  const names = new Set(nodes.map((node) => {
    const comfy = node.data.comfy as { color?: unknown } | undefined;
    return comfy?.color === undefined ? 'none' : paletteNameOf(comfy.color) ?? 'other';
  }));
  const [only] = names;
  return names.size === 1 && only !== 'other' ? only as ColorName | 'none' : null;
}

/** Rows for a node: they act on the node, or on the whole selection when the node is part of it. */
export function nodeEditingItems(t: Translate, node: GraphNode, targets: GraphNode[], disabled: boolean): React.ReactNode[] {
  // Notes never run, so bypass and mute do not apply to them; colour still does.
  const runnable = targets.filter((item) => !['Note', 'MarkdownNote'].includes(String(item.data.comfyType)));
  const ids = runnable.map((item) => item.id);
  const all = (mode: 'bypassed' | 'muted') => runnable.length > 0 && runnable.every((item) => nodeRunMode(item.data as { comfy?: unknown }) === mode);
  const bypassed = all('bypassed');
  const muted = all('muted');
  const rows: React.ReactNode[] = [];
  if (runnable.length > 0) {
    rows.push(
      checkRow('bypass', t('editing.bypass'), bypassed, () => void setRunMode(ids, bypassed ? 'always' : 'bypass'), { icon: Waypoints, disabled, shortcut: getCommand('graph.bypass')?.shortcut }),
      checkRow('mute', t('editing.mute'), muted, () => void setRunMode(ids, muted ? 'always' : 'mute'), { icon: Ban, disabled, shortcut: getCommand('graph.mute')?.shortcut }),
    );
  }
  rows.push(colorSubmenu('color', t, sharedColor(targets), (color) => void colorSelection(color, targets.map((item) => item.id)), disabled, 'node'));
  if (replaceable(node)) {
    rows.push(
      <Menu.Item key="replace" className={styles.item} disabled={disabled} onSelect={() => afterMenu(() => openReplaceNode(node.id))}>
        <span className={styles.icon} aria-hidden="true"><Replace size={14} /></span>
        <span className={styles.label}>{t('editing.replaceNode')}</span>
      </Menu.Item>,
    );
  }
  return rows;
}

/**
 * Add to group (editing.addToGroup, a submenu of the groups) and Take out of group (editing.removeFromGroup): a
 * group's frame is drawn around its nodes, so this is how a group grows or shrinks. Main canvas only, where groups live.
 */
export function groupMembershipItems(t: Translate, targets: GraphNode[], groups: GroupRecord[], disabled: boolean): React.ReactNode[] {
  const ids = targets.map((item) => item.id);
  const rows: React.ReactNode[] = [];
  const others = groups.filter((group) => ids.some((id) => !group.nodeIds.includes(id)));
  if (others.length > 0) {
    rows.push(
      <Menu.Sub key="add-to-group">
        <Menu.SubTrigger className={styles.item} disabled={disabled}>
          <span className={styles.icon} aria-hidden="true"><Group size={14} /></span>
          <span className={styles.label}>{t('editing.addToGroup')}</span>
        </Menu.SubTrigger>
        <Menu.Portal>
          <Menu.SubContent className={styles.content} sideOffset={4}>
            {others.map((group) => (
              <Menu.Item key={group.id} className={styles.item} onSelect={() => void commitManual({ type: 'set-group-members', groupId: group.id, add: ids, remove: [] })}>
                <span className={styles.label}>{group.title || t('contextMenu.groupTitle')}</span>
              </Menu.Item>
            ))}
          </Menu.SubContent>
        </Menu.Portal>
      </Menu.Sub>,
    );
  }
  // Taking out is offered only when one group holds the nodes, so it is clear which group they leave.
  const holding = groups.filter((group) => ids.some((id) => group.nodeIds.includes(id)));
  if (holding.length === 1) {
    const group = holding[0];
    rows.push(
      <Menu.Item key="remove-from-group" className={styles.item} disabled={disabled} onSelect={() => void commitManual({ type: 'set-group-members', groupId: group.id, add: [], remove: ids })}>
        <span className={styles.icon} aria-hidden="true"><Ungroup size={14} /></span>
        <span className={styles.label}>{t('editing.removeFromGroup')}</span>
      </Menu.Item>,
    );
  }
  return rows;
}

/** Rows for a link. */
export function edgeEditingItems(t: Translate, edgeId: string, disabled: boolean): React.ReactNode[] {
  return [
    <Menu.Item key="insert-node" className={styles.item} disabled={disabled} onSelect={() => afterMenu(() => openInsertOnLink(edgeId))}>
      <span className={styles.icon} aria-hidden="true"><Spline size={14} /></span>
      <span className={styles.label}>{t('editing.insertNode')}</span>
    </Menu.Item>,
    <Menu.Item key="add-reroute" className={styles.item} disabled={disabled} onSelect={() => void addRerouteOnLink(edgeId)}>
      <span className={styles.icon} aria-hidden="true"><Waypoints size={14} /></span>
      <span className={styles.label}>{t('editing.addReroute')}</span>
    </Menu.Item>,
  ];
}

/** Color (editing.color) for a group. */
export function groupEditingItems(t: Translate, groupId: string, color: unknown, disabled: boolean): React.ReactNode[] {
  const current = color === undefined || color === null ? 'none' : paletteNameOf(color);
  return [colorSubmenu('group-color', t, current, (next) => void colorGroup(groupId, next), disabled, 'group')];
}

/** Add note (editing.addNote) on empty canvas, at the point of the click. */
export function paneEditingItems(t: Translate, at: { x: number; y: number }, disabled: boolean): React.ReactNode[] {
  return [
    <Menu.Item key="add-note" className={styles.item} disabled={disabled} onSelect={() => void addNote(at)}>
      <span className={styles.icon} aria-hidden="true"><StickyNote size={14} /></span>
      <span className={styles.label}>{t('editing.addNote')}</span>
    </Menu.Item>,
  ];
}
