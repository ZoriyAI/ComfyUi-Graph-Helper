/**
 * Checks that the preload's hand copy of the IPC channel names equals src/shared/ipc-channels.ts. The sandboxed
 * preload is compiled without a bundler, so it cannot import the shared list at run time; without this check a
 * channel renamed on one side would silently stop answering.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';

/** The `KEY: 'channel'` pairs of the preload's `const IPC_CHANNELS = { … } as const`. */
function preloadChannels(): Record<string, string> {
  const source = fs.readFileSync(path.join(__dirname, '../../src/preload/index.ts'), 'utf8');
  const start = source.indexOf('const IPC_CHANNELS = {');
  const end = source.indexOf('} as const', start);
  expect(start).toBeGreaterThanOrEqual(0);
  const block = source.slice(start, end);
  return Object.fromEntries([...block.matchAll(/^\s+([A-Z0-9_]+):\s*'([^']+)'/gm)].map((match) => [match[1], match[2]]));
}

describe('IPC channel names', () => {
  it('are the same in the preload and in src/shared', () => {
    expect(preloadChannels()).toEqual({ ...IPC_CHANNELS });
  });
});
