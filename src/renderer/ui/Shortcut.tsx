import React from 'react';
import Kbd from './Kbd';
import { cx } from './cx';
import { detectPlatform, formatShortcut, shortcutKeys, type Platform } from '../commands/shortcuts';
import styles from './Shortcut.module.css';

/**
 * A command's shortcut as key caps, with the labels of this platform ('Ctrl+Shift+Z' or '⇧⌘Z').
 * `quiet` draws flat caps for menus, where the shortcut is a right-aligned hint.
 */
export default function Shortcut({ shortcut, quiet, platform, className }: { shortcut: string; quiet?: boolean; platform?: Platform; className?: string }) {
  if (quiet) {
    return (
      <span className={cx(styles.shortcut, styles.quiet, className)} aria-hidden="true">
        <Kbd className={styles.key}>{formatShortcut(shortcut, platform)}</Kbd>
      </span>
    );
  }
  const keys = shortcutKeys(shortcut, platform);
  const joiner = (platform ?? detectPlatform()) === 'mac' ? '' : '+';
  return (
    <span className={cx(styles.shortcut, className)} aria-hidden="true">
      {keys.map((key, index) => (
        <React.Fragment key={`${key}-${index}`}>
          {index > 0 && joiner ? <span className={styles.joiner}>{joiner}</span> : null}
          <Kbd className={styles.key}>{key}</Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}
