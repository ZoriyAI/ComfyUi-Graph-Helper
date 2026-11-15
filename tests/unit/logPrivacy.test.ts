import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getVersion: () => '0', getPath: () => '/tmp' }, dialog: {}, shell: {} }));

describe('the conversation log keeps to itself', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('a saved log carries neither the profile folder nor the home folder', async () => {
    const { savedLogScrub } = await import('../../src/main/ipc/diagnosticsIpc');
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
