/**
 * Context menu pieces: Radix's primitives and styled content, items, separators and labels.
 * Who uses it: components/library/ModelLibrary.tsx (a model row's menu); the canvas menu draws its own.
 */
import React, { forwardRef } from 'react';
import * as Menu from '@radix-ui/react-context-menu';
import styles from './Menu.module.css';
import { cx } from './cx';

/** Radix primitives, re-exported unstyled for composition. */
export const ContextMenuRoot = Menu.Root;
export const ContextMenuTrigger = Menu.Trigger;
export const ContextMenuGroup = Menu.Group;
export const ContextMenuSub = Menu.Sub;
export const ContextMenuSubTrigger = Menu.SubTrigger;
export const ContextMenuPortal = Menu.Portal;

/** Styled menu surface (portalled). */
export const ContextMenuContent = forwardRef<HTMLDivElement, Menu.ContextMenuContentProps>(function ContextMenuContent(
  { className, ...rest },
  ref,
) {
  return (
    <Menu.Portal>
      <Menu.Content ref={ref} className={cx(styles.content, className)} collisionPadding={8} {...rest} />
    </Menu.Portal>
  );
});

/** Props of one menu item: an icon, a shortcut hint, and the danger look for removing actions. */
export interface ContextMenuItemProps extends Menu.ContextMenuItemProps {
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
}

/** One menu item with its icon and shortcut. */
export const ContextMenuItem = forwardRef<HTMLDivElement, ContextMenuItemProps>(function ContextMenuItem(
  { icon, shortcut, danger, className, children, ...rest },
  ref,
) {
  return (
    <Menu.Item ref={ref} className={cx(styles.item, danger && styles.danger, className)} {...rest}>
      {icon ? <span className={styles.itemIcon} aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
      {shortcut ? <ContextMenuShortcut>{shortcut}</ContextMenuShortcut> : null}
    </Menu.Item>
  );
});

/** A rule between groups of items. */
export const ContextMenuSeparator = forwardRef<HTMLDivElement, Menu.ContextMenuSeparatorProps>(function ContextMenuSeparator(
  { className, ...rest },
  ref,
) {
  return <Menu.Separator ref={ref} className={cx(styles.separator, className)} {...rest} />;
});

/** A heading inside the menu. */
export const ContextMenuLabel = forwardRef<HTMLDivElement, Menu.ContextMenuLabelProps>(function ContextMenuLabel(
  { className, ...rest },
  ref,
) {
  return <Menu.Label ref={ref} className={cx(styles.label, className)} {...rest} />;
});

/** The shortcut hint at the right of an item; hidden from screen readers, as the item's name says enough. */
export function ContextMenuShortcut({ children }: { children: React.ReactNode }) {
  return <span className={styles.shortcut} aria-hidden="true">{children}</span>;
}
