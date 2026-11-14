/**
 * The editing rows of the canvas context menu (GraphContextMenu.tsx): on a node, «Обойти», «Выключить», «Цвет» and
 * «Заменить на…»; on a link, «Вставить ноду…» and «Добавить reroute»; on a group, «Цвет»; on empty canvas,
 * «Добавить заметку». They run the same functions as the menu bar and the shortcuts (commands/editingCommands.ts),
 * so a node the person right-clicks, or the selection it belongs to, is what changes.
 */
import React from 'react';
import * as Menu from '@radix-ui/react-context-menu';
import { Ban, Check, Palette, Replace, Spline, StickyNote, Waypoints, type LucideIcon } from 'lucide-react';
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

type Translate = (key: string) => string;

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

/** «Цвет» with ComfyUI's palette and «Без цвета»; `current` is ticked. */
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
      <Menu.Item key="replace" className={styles.item} disabled={disabled} onSelect={() => openReplaceNode(node.id)}>
        <span className={styles.icon} aria-hidden="true"><Replace size={14} /></span>
        <span className={styles.label}>{t('editing.replaceNode')}</span>
      </Menu.Item>,
    );
  }
  return rows;
}

/** Rows for a link. */
export function edgeEditingItems(t: Translate, edgeId: string, disabled: boolean): React.ReactNode[] {
  return [
    <Menu.Item key="insert-node" className={styles.item} disabled={disabled} onSelect={() => openInsertOnLink(edgeId)}>
      <span className={styles.icon} aria-hidden="true"><Spline size={14} /></span>
      <span className={styles.label}>{t('editing.insertNode')}</span>
    </Menu.Item>,
    <Menu.Item key="add-reroute" className={styles.item} disabled={disabled} onSelect={() => void addRerouteOnLink(edgeId)}>
      <span className={styles.icon} aria-hidden="true"><Waypoints size={14} /></span>
      <span className={styles.label}>{t('editing.addReroute')}</span>
    </Menu.Item>,
  ];
}

/** «Цвет» for a group. */
export function groupEditingItems(t: Translate, groupId: string, color: unknown, disabled: boolean): React.ReactNode[] {
  const current = color === undefined || color === null ? 'none' : paletteNameOf(color);
  return [colorSubmenu('group-color', t, current, (next) => void colorGroup(groupId, next), disabled, 'group')];
}

/** «Добавить заметку» on empty canvas, at the point of the click. */
export function paneEditingItems(t: Translate, at: { x: number; y: number }, disabled: boolean): React.ReactNode[] {
  return [
    <Menu.Item key="add-note" className={styles.item} disabled={disabled} onSelect={() => void addNote(at)}>
      <span className={styles.icon} aria-hidden="true"><StickyNote size={14} /></span>
      <span className={styles.label}>{t('editing.addNote')}</span>
    </Menu.Item>,
  ];
}
