/**
 * Tab pieces: Radix tabs with the app's look.
 * Who uses it: components/shell/Rail.tsx (library tabs), components/shell/Dock.tsx and settings/SettingsPanel.tsx.
 */
import React, { forwardRef } from 'react';
import * as T from '@radix-ui/react-tabs';
import styles from './Tabs.module.css';
import { cx } from './cx';

/** Radix tabs root, re-exported unstyled. */
export const TabsRoot = T.Root;

/** Tab list. Keyboard: arrows move, Home/End jump (Radix roving focus). */
export const TabsList = forwardRef<HTMLDivElement, T.TabsListProps>(function TabsList({ className, ...rest }, ref) {
  return <T.List ref={ref} className={cx(styles.list, className)} {...rest} />;
});

/** One tab. */
export const TabsTrigger = forwardRef<HTMLButtonElement, T.TabsTriggerProps>(function TabsTrigger({ className, ...rest }, ref) {
  return <T.Trigger ref={ref} className={cx(styles.trigger, className)} {...rest} />;
});

/** The panel of one tab. */
export const TabsContent = forwardRef<HTMLDivElement, T.TabsContentProps>(function TabsContent({ className, ...rest }, ref) {
  return <T.Content ref={ref} className={cx(styles.content, className)} {...rest} />;
});
