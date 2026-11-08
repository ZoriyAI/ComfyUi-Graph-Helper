import React, { forwardRef } from 'react';
import * as T from '@radix-ui/react-tabs';
import styles from './Tabs.module.css';
import { cx } from './cx';

export const TabsRoot = T.Root;

/** Tab list. Keyboard: arrows move, Home/End jump (Radix roving focus). */
export const TabsList = forwardRef<HTMLDivElement, T.TabsListProps>(function TabsList({ className, ...rest }, ref) {
  return <T.List ref={ref} className={cx(styles.list, className)} {...rest} />;
});

export const TabsTrigger = forwardRef<HTMLButtonElement, T.TabsTriggerProps>(function TabsTrigger({ className, ...rest }, ref) {
  return <T.Trigger ref={ref} className={cx(styles.trigger, className)} {...rest} />;
});

export const TabsContent = forwardRef<HTMLDivElement, T.TabsContentProps>(function TabsContent({ className, ...rest }, ref) {
  return <T.Content ref={ref} className={cx(styles.content, className)} {...rest} />;
});
