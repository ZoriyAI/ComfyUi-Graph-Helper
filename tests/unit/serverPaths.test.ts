/**
 * Protects the reading of file paths a ComfyUI server reports over MCP about its own disk, which may be Linux,
 * macOS or Windows whatever the app runs on. Paths that climb out of a model folder or hide control characters
 * are refused, so a server cannot make the app ask for files outside the folders the person shared.
 */
import { describe, expect, it } from 'vitest';
import { isPlainRelativeName, isPlainServerPath, isUnderServerFolder, joinServerPath, normalServerFolder, pathStyle } from '../../src/shared/mcp/serverPaths';

describe('paths a server reports about its own machine', () => {
  it('are absolute on Linux, macOS or Windows', () => {
    expect(pathStyle('/srv/comfyui/models')).toBe('posix');
    expect(pathStyle('C:\\ComfyUI\\models')).toBe('windows');
    expect(pathStyle('d:/AI/models')).toBe('windows');
    for (const path of ['models/loras', 'C:models', '\\\\server\\share\\models', '', '~/models']) expect(pathStyle(path), path).toBeNull();
  });

  it('never climb, never hold an empty part or a control character', () => {
    for (const path of ['/srv/models/a.webp', 'C:\\models\\a.webp', 'C:/models/sub/a.webp']) expect(isPlainServerPath(path), path).toBe(true);
    for (const path of [
      '/srv/../etc/a', '/srv//a', '/srv/./a', '/srv/models\\a.webp', 'C:\\models\\..\\a', 'C:\\models\\\\a', 'C:\\a\0b\\c', '/srv/a\nb/c',
    ]) expect(isPlainServerPath(path), JSON.stringify(path)).toBe(false);
  });

  it('are folders without trailing separators, and a bare drive is not one', () => {
    expect(normalServerFolder('/srv/models/')).toBe('/srv/models');
    expect(normalServerFolder('C:\\ComfyUI\\models\\')).toBe('C:\\ComfyUI\\models');
    expect(normalServerFolder('C:\\')).toBeNull();
    expect(normalServerFolder('/')).toBeNull();
    expect(normalServerFolder(42)).toBeNull();
  });

  it("are joined with the folder's own separator", () => {
    expect(joinServerPath('/srv/models', 'loras', 'a.webp')).toBe('/srv/models/loras/a.webp');
    expect(joinServerPath('C:\\ComfyUI\\models', 'loras/sub\\a.webp')).toBe('C:\\ComfyUI\\models\\loras\\sub\\a.webp');
    expect(joinServerPath('C:/ComfyUI/models', 'a.webp')).toBe('C:/ComfyUI/models/a.webp');
    expect(joinServerPath('C:\\ComfyUI\\models', '..\\..\\Windows')).toBeNull();
    expect(joinServerPath('relative', 'a')).toBeNull();
  });

  it('lie inside a folder only below it; Windows compares without case and with either slash', () => {
    expect(isUnderServerFolder('/srv/models/a.webp', '/srv/models')).toBe(true);
    expect(isUnderServerFolder('/srv/models2/a.webp', '/srv/models')).toBe(false);
    expect(isUnderServerFolder('/srv/models', '/srv/models')).toBe(false);
    expect(isUnderServerFolder('c:/comfyui/Models/a.webp', 'C:\\ComfyUI\\models')).toBe(true);
    expect(isUnderServerFolder('C:\\ComfyUI\\models2\\a.webp', 'C:\\ComfyUI\\models')).toBe(false);
    expect(isUnderServerFolder('/srv/models/a.webp', 'C:\\srv\\models')).toBe(false);
  });

  it('as listed inside a model folder, may hold sub-folders with either slash but are never absolute', () => {
    for (const name of ['a.safetensors', 'sub/a.safetensors', 'sub\\a.safetensors']) expect(isPlainRelativeName(name), name).toBe(true);
    for (const name of ['/a', 'C:\\a', '\\a', '..\\a', 'sub/../a', '', 'a\0b']) expect(isPlainRelativeName(name), name).toBe(false);
  });
});
