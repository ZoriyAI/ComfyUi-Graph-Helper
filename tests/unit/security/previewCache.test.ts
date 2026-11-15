/**
 * Protects the size report and the clear action of the cache of node preview pictures and clips.
 * A person who empties the cache in Settings must see a true count and get the disk space back, and a
 * missing cache folder (a fresh install) must read as empty instead of failing.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { clearPreviewCache, previewCacheSize } from '../../../src/main/knowledge/preview';

describe('the picture cache', () => {
  it('says how much it holds and empties on request', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'previews-'));
    fs.writeFileSync(path.join(dir, 'a.png'), Buffer.alloc(100));
    fs.writeFileSync(path.join(dir, 'b.mp4'), Buffer.alloc(250));
    expect(previewCacheSize(dir)).toEqual({ files: 2, bytes: 350 });
    expect(clearPreviewCache(dir)).toEqual({ files: 2, bytes: 350 });
    expect(previewCacheSize(dir)).toEqual({ files: 0, bytes: 0 });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('a folder that is not there holds nothing', () => {
    expect(previewCacheSize('/nonexistent/previews')).toEqual({ files: 0, bytes: 0 });
    expect(clearPreviewCache('/nonexistent/previews')).toEqual({ files: 0, bytes: 0 });
  });
});
