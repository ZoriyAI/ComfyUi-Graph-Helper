import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addLogRedactor, initLog, log, LOG_FILE, readLogTail, resetLog } from '../../src/main/log';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'log-test-'));
}

afterEach(() => resetLog());

describe('main log', () => {
  it('appends levelled lines to main.log', () => {
    const dir = tempDir();
    initLog({ dir, mirror: false });
    log.info('[App] hello', 42);
    log.warn('careful');
    log.error('broken', new Error('boom'));
    const text = fs.readFileSync(path.join(dir, LOG_FILE), 'utf8');
    expect(text).toMatch(/INFO  \[App\] hello 42/);
    expect(text).toMatch(/WARN  careful/);
    expect(text).toMatch(/ERROR broken Error: boom/);
  });

  it('redacts secret shapes and held values before writing', () => {
    const dir = tempDir();
    initLog({ dir, mirror: false });
    addLogRedactor((text) => text.split('held-value-1234').join('[redacted]'));
    log.info('key sk-ant-abcdefghijklmnop and Bearer abc.def.ghi and api_key=xyz987 and held-value-1234');
    const text = fs.readFileSync(path.join(dir, LOG_FILE), 'utf8');
    expect(text).not.toContain('sk-ant-abcdefghijklmnop');
    expect(text).not.toContain('abc.def.ghi');
    expect(text).not.toContain('xyz987');
    expect(text).not.toContain('held-value-1234');
    expect(text).toContain('[redacted]');
  });

  it('rotates past the size limit and keeps three files in all', () => {
    const dir = tempDir();
    initLog({ dir, mirror: false, maxBytes: 1000 });
    for (let index = 0; index < 200; index += 1) log.info(`line ${index} ${'x'.repeat(40)}`);
    const files = fs.readdirSync(dir).sort();
    expect(files).toEqual(['main.log', 'main.log.1', 'main.log.2']);
    for (const file of files) expect(fs.statSync(path.join(dir, file)).size).toBeLessThanOrEqual(1000);
    // The newest line is in main.log, the tail spans the rotation.
    expect(fs.readFileSync(path.join(dir, 'main.log'), 'utf8')).toContain('line 199');
    const tail = readLogTail(30);
    expect(tail).toHaveLength(30);
    expect(tail[tail.length - 1]).toContain('line 199');
  });

  it('keeps lines in memory when not initialised', () => {
    log.info('before init');
    expect(readLogTail(5).some((line) => line.includes('before init'))).toBe(true);
  });
});
