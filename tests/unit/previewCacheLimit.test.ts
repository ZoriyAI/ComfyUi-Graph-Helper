import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { trimCache } from '../../src/main/knowledge/preview';

describe('picture cache limit', () => {
  it('removes the oldest pictures past a count or a size, newest kept', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-cache-'));
    try {
      for (let index = 0; index < 6; index += 1) {
        const file = path.join(folder, `p${index}.png`);
        fs.writeFileSync(file, Buffer.alloc(1000));
        const time = new Date(2026, 0, 1, 0, index);
        fs.utimesSync(file, time, time);
      }
      trimCache(folder, 5);
      expect(fs.readdirSync(folder).sort()).toEqual(['p1.png', 'p2.png', 'p3.png', 'p4.png', 'p5.png']);
      trimCache(folder, 100, 2500);
      expect(fs.readdirSync(folder).sort()).toEqual(['p4.png', 'p5.png']);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});
