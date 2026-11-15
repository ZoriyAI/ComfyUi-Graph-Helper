import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
const control = vi.hoisted(() => ({ failWriteAfter: -1, readCalls: 0 }));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  let writes = 0;
  const writeSync = ((...args: Parameters<typeof actual.writeSync>) => {
    if (control.failWriteAfter >= 0) {
      writes += 1;
      if (writes > control.failWriteAfter) throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
      const [handle, buffer, offset, length] = args as unknown as [number, Buffer, number, number];
      return actual.writeSync(handle, buffer, offset, Math.min(length, 4));
    }
    return (actual.writeSync as (...rest: unknown[]) => number)(...args);
  }) as typeof actual.writeSync;
  const readFileSync = ((...args: Parameters<typeof actual.readFileSync>) => {
    control.readCalls += 1;
    return (actual.readFileSync as (...rest: unknown[]) => unknown)(...args);
  }) as typeof actual.readFileSync;
  const patched = { ...actual, writeSync, readFileSync };
  return { ...patched, default: patched };
});

import { fileOpenErrorCode, fileWriteErrorCode, OPEN_FILE_MAX_BYTES, readPickedFile, writeFileAtomic } from '../../src/main/files/atomicWrite';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';

const folders: string[] = [];
function folder(): string {
  const made = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-files-'));
  folders.push(made);
  return made;
}
afterEach(() => {
  control.failWriteAfter = -1;
  for (const item of folders.splice(0)) fs.rmSync(item, { recursive: true, force: true });
});

describe('writing a file the person saves', () => {
  it('writes a new file and replaces an old one, leaving nothing else behind', () => {
    const dir = folder();
    const target = path.join(dir, 'Мой проект с пробелами.nodewise.json');
    writeFileAtomic(target, '{"a":1}');
    expect(fs.readFileSync(target, 'utf8')).toBe('{"a":1}');
    writeFileAtomic(target, '{"a":2,"текст":"ё"}');
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({ a: 2, текст: 'ё' });
    expect(fs.readdirSync(dir)).toEqual(['Мой проект с пробелами.nodewise.json']);
  });

  it('keeps the permissions of the file it replaces and writes through a link', () => {
    const dir = folder();
    const real = path.join(dir, 'real.json');
    fs.writeFileSync(real, 'old');
    fs.chmodSync(real, 0o600);
    const link = path.join(dir, 'link.json');
    fs.symlinkSync(real, link);
    writeFileAtomic(link, 'new');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(real, 'utf8')).toBe('new');
    expect(fs.statSync(real).mode & 0o777).toBe(0o600);
  });

  it('leaves the old file whole when the disk fills half way', () => {
    const dir = folder();
    const target = path.join(dir, 'project.json');
    fs.writeFileSync(target, '{"kept":true}');
    control.failWriteAfter = 1;
    let caught: unknown = null;
    try {
      writeFileAtomic(target, '{"kept":false,"padding":"xxxxxxxxxxxxxxxxxxxxxxxx"}');
    } catch (error) {
      caught = error;
    }
    expect((caught as { code?: string }).code).toBe('ENOSPC');
    expect(fs.readFileSync(target, 'utf8')).toBe('{"kept":true}');
    expect(fs.readdirSync(dir)).toEqual(['project.json']);
    expect(fileWriteErrorCode(caught, 'The project file could not be written.')).toBe('The disk is full.');
  });

  it('says in plain words why a file could not be written', () => {
    const ru = createTranslator('ru');
    const code = (name: string) => fileWriteErrorCode(Object.assign(new Error('raw'), { code: name }), 'The project file could not be written.');
    expect(translateKnownError(ru, code('EROFS'))).toBe('В эту папку нельзя записывать. Выберите другую папку.');
    expect(translateKnownError(ru, code('EACCES'))).toBe('В эту папку нельзя записывать. Выберите другую папку.');
    expect(translateKnownError(ru, code('EDQUOT'))).toMatch(/нет свободного места/);
    expect(translateKnownError(ru, code('ENOENT'))).toBe('Файл проекта не удалось записать.');
    // A folder that is not there.
    expect(() => writeFileAtomic(path.join(folder(), 'missing', 'x.json'), '{}')).toThrow();
  });
});

describe('opening a file the person picked', () => {
  it('reads a normal file and refuses one too large before reading it', () => {
    const dir = folder();
    const small = path.join(dir, 'w.json');
    fs.writeFileSync(small, '{"nodes":[]}');
    expect(readPickedFile(small)).toBe('{"nodes":[]}');
    const big = path.join(dir, 'big.json');
    const handle = fs.openSync(big, 'w');
    fs.ftruncateSync(handle, OPEN_FILE_MAX_BYTES + 1);
    fs.closeSync(handle);
    const readsBefore = control.readCalls;
    let caught: unknown = null;
    try {
      readPickedFile(big);
    } catch (error) {
      caught = error;
    }
    expect(control.readCalls).toBe(readsBefore);
    expect(fileOpenErrorCode(caught, 'Workflow JSON could not be parsed.')).toBe('The file is too large to open.');
    expect(translateKnownError(createTranslator('ru'), 'The file is too large to open.')).toBe('Этот файл слишком большой, чтобы его открыть.');
    expect(fileOpenErrorCode(new SyntaxError('Unexpected end'), 'Workflow JSON could not be parsed.')).toBe('Workflow JSON could not be parsed.');
  });
});
