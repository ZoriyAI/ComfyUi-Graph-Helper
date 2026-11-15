/**
 * The conversation log keeps to itself: a log saved for a bug report (savedLogScrub in main/ipc/diagnosticsIpc.ts)
 * names neither the profile folder nor the home folder, and with "Keep the log" off the model trace
 * (main/trace/modelTrace.ts) writes no line about a turn. A person's folder names and chats stay on their computer
 * unless they choose otherwise.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// diagnosticsIpc imports electron; the test runs outside it, so a minimal stand-in is enough.
vi.mock('electron', () => ({ app: { getVersion: () => '0', getPath: () => '/tmp' }, dialog: {}, shell: {} }));

describe('the conversation log keeps to itself', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('a saved log carries neither the profile folder nor the home folder', async () => {
    const { savedLogScrub } = await import('../../src/main/ipc/diagnosticsIpc');
    // A folder whose name only begins like the home folder's is someone else's and stays as it is.
    const scrub = savedLogScrub('/home/ann/.config/nodewise-studio/', '/home/ann');
    expect(scrub('db at /home/ann/.config/nodewise-studio/app.db, file /home/ann/pics/a.png, other /home/anna/x'))
      .toBe('db at [app profile]/app.db, file ~/pics/a.png, other /home/anna/x');
    expect(scrub(JSON.stringify({ p: 'C:\\\\Users\\\\x' }))).toContain('Users');
  });

  it('with "Keep the log" off no line about a turn is written', async () => {
    const trace = await import('../../src/main/trace/modelTrace');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-'));
    let on = false;
    trace.configureModelTrace({ dir, redact: (text: string) => text, enabled: () => on });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    trace.turnLog('[Agent] Turn with 3 messages');
    expect(log).not.toHaveBeenCalled();
    expect(trace.turnLinesAllowed()).toBe(false);
    on = true;
    trace.turnLog('[Agent] Turn with 3 messages');
    expect(log).toHaveBeenCalledTimes(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
