import React, { useCallback, useRef, useState } from 'react';
import * as Menubar from '@radix-ui/react-menubar';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Shortcut from '../../ui/Shortcut';
import { cx } from '../../ui/cx';
import menuStyles from '../../ui/Menu.module.css';
import SyncIndicator from '../sync/SyncIndicator';
import { allCommands, getCommand, hintOf, runCommand, useCommandStates } from '../../commands/registry';
import { rememberFocusBeforeMenuBar, restoreFocusAfterMenuBar } from '../../commands/hotkeys';
import { DESCRIPTION_MODE_CHOICES, LANGUAGE_CHOICES, MOTION_CHOICES, providerCommandId } from '../../commands/appCommands';
import { providerChoices } from '../../state/providerState';
import styles from './MenuBar.module.css';

/** One entry of a menu: a command, a check or radio row, a submenu, or a rule. */
type Entry =
  | { kind: 'command'; id: string }
  | { kind: 'check'; id: string }
  | { kind: 'radio'; labelKey: string; ids: string[]; valueOf: (id: string) => string }
  | { kind: 'separator' };

const command = (id: string): Entry => ({ kind: 'command', id });
const check = (id: string): Entry => ({ kind: 'check', id });
const separator: Entry = { kind: 'separator' };

const MENUS: Array<{ value: string; labelKey: string; entries: Entry[] }> = [
  {
    value: 'file',
    labelKey: 'menu.file',
    entries: [
      command('file.new'), command('file.open'), command('file.save'), separator,
      command('file.import'), command('file.export'), command('file.catalog'), separator,
      command('file.settings'), separator, command('file.quit'),
    ],
  },
  {
    value: 'edit',
    labelKey: 'menu.edit',
    entries: [command('edit.undo'), command('edit.redo'), separator, command('edit.selectAll'), command('edit.delete')],
  },
  {
    value: 'view',
    labelKey: 'menu.view',
    entries: [
      command('view.fit'), command('view.zoomIn'), command('view.zoomOut'), command('view.zoomReset'), separator,
      check('view.rail'), check('view.dock'), check('view.showBoth'), separator,
      { kind: 'radio', labelKey: 'menu.descriptions', ids: DESCRIPTION_MODE_CHOICES.map((choice) => `view.descriptions.${choice.value}`), valueOf: (id) => id.slice('view.descriptions.'.length) },
      check('view.minimap'), check('view.followAgent'), separator,
      { kind: 'radio', labelKey: 'menu.language', ids: LANGUAGE_CHOICES.map((choice) => `view.language.${choice.value}`), valueOf: (id) => id.slice('view.language.'.length) },
      { kind: 'radio', labelKey: 'menu.motion', ids: MOTION_CHOICES.map((choice) => `view.motion.${choice.value}`), valueOf: (id) => id.slice('view.motion.'.length) },
    ],
  },
  {
    value: 'graph',
    labelKey: 'menu.graph',
    entries: [
      command('graph.addNode'), command('graph.arrange'), separator,
      command('graph.createSubgraph'), command('graph.dissolveSubgraph'), command('graph.addGroup'), separator,
      command('graph.check'), command('graph.acceptAll'), separator,
      check('graph.tour'), check('graph.replay'),
    ],
  },
  {
    value: 'assistant',
    labelKey: 'menu.assistant',
    entries: [
      command('assistant.focusChat'), command('assistant.askSelection'), separator,
      command('assistant.pause'), command('assistant.resume'), command('assistant.end'), separator,
      { kind: 'radio', labelKey: 'menu.provider', ids: providerChoices().map((choice) => providerCommandId(choice.value)), valueOf: (id) => id },
      command('assistant.settings'),
    ],
  },
  {
    value: 'sync',
    labelKey: 'menu.sync',
    entries: [command('sync.now'), check('sync.auto'), separator, command('sync.settings')],
  },
  {
    value: 'help',
    labelKey: 'menu.help',
    entries: [command('help.shortcuts'), separator, command('help.modelLog'), command('help.openLogs'), command('help.copyDiagnostics'), separator, command('help.about')],
  },
];

function Label({ id }: { id: string }) {
  const { t } = useTranslation();
  const entry = getCommand(id);
  return <span className={styles.itemLabel}>{entry ? t(entry.labelKey) : id}</span>;
}

function ShortcutHint({ id }: { id: string }) {
  const shortcut = getCommand(id)?.shortcut;
  return shortcut ? <Shortcut shortcut={shortcut} quiet className={cx(menuStyles.shortcut, styles.shortcut)} /> : null;
}

/**
 * The application menu bar (`.document-bar`): File · Edit · View · Graph · Assistant · Sync · Help, built
 * from the command registry, with the sync state at the right end (the helper is chosen once, in the toolbar). Alt or F10
 * focuses it (commands/hotkeys.ts); arrows move between menus and items; Escape closes.
 */
export default function MenuBar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState('');
  const chosen = useRef(false);
  // Re-render when any command turns on, off or checked, so an open menu stays truthful.
  useCommandStates(allCommands().map((item) => item.id));

  /** Runs after the menu has closed and focus went back to where it was, so a dialog can take focus. */
  const choose = useCallback((id: string) => {
    chosen.current = true;
    window.setTimeout(() => void runCommand(id), 0);
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    if (!chosen.current) return;
    chosen.current = false;
    event.preventDefault();
    restoreFocusAfterMenuBar();
  }, []);

  const renderEntry = (entry: Entry, index: number): React.ReactNode => {
    if (entry.kind === 'separator') return <Menubar.Separator key={`s${index}`} className={menuStyles.separator} />;
    if (entry.kind === 'radio') {
      const current = entry.ids.find((id) => getCommand(id)?.checked?.()) ?? '';
      return (
        <Menubar.Sub key={entry.labelKey}>
          <Menubar.SubTrigger className={cx(menuStyles.item, styles.item)}>
            <span className={styles.itemLabel}>{t(entry.labelKey)}</span>
            <ChevronRight size={14} className={styles.subChevron} aria-hidden="true" />
          </Menubar.SubTrigger>
          <Menubar.Portal>
            <Menubar.SubContent className={cx(menuStyles.content, styles.content)} sideOffset={2} alignOffset={-5}>
              <Menubar.RadioGroup value={current ? entry.valueOf(current) : ''}>
                {entry.ids.map((id) => (
                  <Menubar.RadioItem key={id} value={entry.valueOf(id)} className={cx(menuStyles.item, styles.item)} onSelect={() => choose(id)}>
                    <Menubar.ItemIndicator className={cx(menuStyles.itemIcon, styles.indicator)}><Circle size={7} fill="currentColor" aria-hidden="true" /></Menubar.ItemIndicator>
                    <Label id={id} />
                  </Menubar.RadioItem>
                ))}
              </Menubar.RadioGroup>
            </Menubar.SubContent>
          </Menubar.Portal>
        </Menubar.Sub>
      );
    }
    const item = getCommand(entry.id);
    if (!item) return null;
    let enabled = false;
    try {
      enabled = item.enabled();
    } catch {
      enabled = false;
    }
    if (entry.kind === 'check') {
      return (
        <Menubar.CheckboxItem
          key={entry.id}
          className={cx(menuStyles.item, styles.item)}
          checked={Boolean(item.checked?.())}
          disabled={!enabled}
          onSelect={() => choose(entry.id)}
          data-command={entry.id}
        >
          <Menubar.ItemIndicator className={cx(menuStyles.itemIcon, styles.indicator)}><Check size={14} aria-hidden="true" /></Menubar.ItemIndicator>
          <Label id={entry.id} />
          <ShortcutHint id={entry.id} />
        </Menubar.CheckboxItem>
      );
    }
    const Icon = item.icon;
    return (
      <Menubar.Item key={entry.id} className={cx(menuStyles.item, styles.item)} disabled={!enabled} onSelect={() => choose(entry.id)} data-command={entry.id} title={hintOf(entry.id)}>
        {Icon ? <span className={menuStyles.itemIcon} aria-hidden="true"><Icon size={14} aria-hidden="true" /></span> : null}
        <Label id={entry.id} />
        <ShortcutHint id={entry.id} />
      </Menubar.Item>
    );
  };

  return (
    <header className={cx(styles.bar, 'document-bar')}>
      <span className={cx(styles.mark, 'product-mark')} aria-hidden="true" />
      <Menubar.Root
        className={styles.menubar}
        value={open}
        onValueChange={setOpen}
        aria-label={String(t('menu.label'))}
        onFocusCapture={(event) => rememberFocusBeforeMenuBar(event.relatedTarget as Element | null)}
        loop
      >
        {MENUS.map((menu) => (
          <Menubar.Menu key={menu.value} value={menu.value}>
            <Menubar.Trigger className={cx(styles.trigger, 'menubar-trigger')}>{t(menu.labelKey)}</Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className={cx(menuStyles.content, styles.content)} align="start" sideOffset={4} alignOffset={-2} onCloseAutoFocus={onCloseAutoFocus}>
                {menu.entries.map(renderEntry)}
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>
        ))}
      </Menubar.Root>
      <span className={styles.spacer} />
      <div className={cx(styles.status, 'header-status')}>
        <SyncIndicator />
      </div>
    </header>
  );
}
