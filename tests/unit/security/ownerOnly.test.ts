import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: {}, dialog: {}, shell: {} }));

import { openDatabase } from '../../../src/main/database';
import { ownerOnlyFiles } from '../../../src/main/profileFolder';

describe("files with the person's data are readable by them only", () => {
  it('the database and its journal files are 0600 after opening, whatever the umask made of them', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-only-'));
    const file = path.join(dir, 'app.db');
    fs.writeFileSync(file, '');
    fs.chmodSync(file, 0o644);
    const db = openDatabase(file);
    db.prepare('SELECT 1').get();
    for (const name of [file, `${file}-wal`, `${file}-shm`]) {
      if (fs.existsSync(name)) expect(fs.statSync(name).mode & 0o777, name).toBe(0o600);
    }
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips files that are not there', () => {
    const chmod = vi.fn();
    ownerOnlyFiles(['/nope/a', '/nope/b'], { chmodSync: chmod, existsSync: () => false } as never);
    expect(chmod).not.toHaveBeenCalled();
  });
});
