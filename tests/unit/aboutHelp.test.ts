import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { helpFile, systemLine } from '../../src/main/ipc/aboutIpc';

const root = path.join(__dirname, '..', '..');

describe('About: the system line', () => {
  it('names the distribution when /etc/os-release does', () => {
    const release = 'NAME="Ubuntu"\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\nID=ubuntu\n';
    expect(systemLine(release, 'Linux', '6.8.0-45-generic', 'x64')).toBe('Ubuntu 24.04.1 LTS · Linux 6.8.0-45-generic x64');
  });

  it('falls back to the kernel line', () => {
    expect(systemLine(null, 'Linux', '6.8.0', 'x64')).toBe('Linux 6.8.0 x64');
    expect(systemLine('ID=debian\n', 'Linux', '6.1.0', 'x64')).toBe('Linux 6.1.0 x64');
  });
});

describe('Help pages', () => {
  it('reads the page in the interface language and falls back to Russian', () => {
    expect(helpFile('/d', 'guide', 'en')).toEqual([path.join('/d', 'help', 'guide.en.md'), path.join('/d', 'help', 'guide.ru.md')]);
    expect(helpFile('/d', 'troubleshooting', 'ru')[0]).toBe(path.join('/d', 'help', 'troubleshooting.ru.md'));
    expect(helpFile('/d', 'whatsnew', 'en')).toEqual([path.join('/d', 'help', 'whatsnew.md')]);
  });

  it('has the notes of the current release, which Help ▸ What is new shows', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
    expect(fs.existsSync(path.join(root, 'docs', 'releases', `v${pkg.version}.md`))).toBe(true);
  });
});
