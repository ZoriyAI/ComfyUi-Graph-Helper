/**
 * The check that keeps private things out of a public copy of the project: what it must find, what it must
 * leave alone, and that the files tracked today pass it.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface Find {
  rule: string;
  file: string;
  line: number;
  match: string;
}

const check = require('../../scripts/public-tree-check.js') as {
  scanText: (file: string, text: string, privateValues?: string[]) => Find[];
  scanBinary: (file: string, buffer: Buffer, privateValues?: string[]) => Find[];
  scanName: (file: string, size: number) => Find[];
  privateAddress: (ip: string) => boolean;
};

const rules = (finds: Find[]) => finds.map((find) => find.rule);
const root = path.join(__dirname, '..', '..');
const script = path.join(root, 'scripts', 'public-tree-check.js');

describe('public tree check: what it finds', () => {
  it('finds a personal mailbox and says the line', () => {
    const finds = check.scanText('docs/a.md', 'first line\nwrite to jane.doe@some-mail.com please\n');
    expect(finds).toEqual([{ rule: 'mail', file: 'docs/a.md', line: 2, match: 'jane.doe@some-mail.com' }]);
  });

  it('finds a link to a private work session and a line that says which tool typed a commit', () => {
    const text = [
      'see https://claude.ai/code/session_01AbCdEfGh for details',
      'Co-Authored-By: Somebody <somebody@example.com>',
      'Claude-Session: https://example.com/x',
    ].join('\n');
    const found = rules(check.scanText('docs/notes.md', text));
    expect(found.filter((rule) => rule === 'session link')).toHaveLength(1);
    expect(found.filter((rule) => rule === 'commit trailer')).toHaveLength(2);
  });

  it('finds a path inside a real home folder on every system', () => {
    const text = 'a /home/marta/ComfyUI/models b /Users/Marta/Documents/x c C:\\Users\\Marta\\x d /root/.config/app';
    const found = check.scanText('src/a.ts', text).filter((find) => find.rule === 'home folder');
    expect(found.map((find) => find.match)).toEqual(['/home/marta', '/Users/Marta', 'C:\\Users\\Marta', '/root/.config']);
  });

  it('finds an address inside a private network outside the tests, and a sign-in written into an address', () => {
    expect(rules(check.scanText('docs/a.md', 'open http://172.20.3.4:8188 or http://100.101.102.103:8188'))).toEqual([
      'private address',
      'private address',
    ]);
    expect(rules(check.scanText('src/a.ts', "const url = 'https://name:word@files.some-host.com/x';"))).toEqual([
      'address with a password',
    ]);
  });

  it('finds a key that does not look made up', () => {
    const found = check.scanText('src/a.ts', "const key = 'ghp_Zq8Lm3Vt7Rk2Xw9Bn4Hc6Jd1Fs5Gy0PuEaIo';");
    expect(rules(found)).toEqual(['key']);
    expect(rules(check.scanText('src/a.ts', '-----BEGIN OPENSSH PRIVATE KEY-----'))).toEqual(['key']);
  });

  it('finds every private value of the list in any letter case, in text and inside a binary file', () => {
    const values = ['studio.private-host.io', 'Marta Kowalska'];
    const text = 'the server STUDIO.Private-Host.io belongs to marta kowalska';
    expect(check.scanText('README.md', text, values).map((find) => find.rule)).toEqual(['private value', 'private value']);
    const picture = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]), Buffer.from('tEXt https://studio.private-host.io/mcp', 'latin1')]);
    expect(check.scanBinary('tests/fixtures/a.png', picture, values).map((find) => find.rule)).toEqual(['private value']);
  });

  it('refuses files that must never be tracked and reports a large one', () => {
    expect(rules(check.scanName('.env.local', 10))).toEqual(['file that must not be tracked']);
    expect(rules(check.scanName('data/app.db', 10))).toEqual(['file that must not be tracked']);
    expect(rules(check.scanName('certs/release.pem', 10))).toEqual(['file that must not be tracked']);
    expect(rules(check.scanName('test-results/unit-tests.json', 10))).toEqual(['file that must not be tracked']);
    expect(rules(check.scanName('resources/hero.png', 3 * 1024 * 1024))).toEqual(['large file']);
    expect(check.scanName('src/main/index.ts', 4000)).toEqual([]);
  });
});

describe('public tree check: what it leaves alone', () => {
  it('leaves example mailboxes, hidden GitHub addresses and clone addresses', () => {
    const text = [
      'someone@example.com, a@sub.example.org, 12345+login@users.noreply.github.com',
      'git clone git@github.com:owner/name.git',
      'https://user:pw@host.example/x and mailto:person@proxy.test',
    ].join('\n');
    expect(check.scanText('docs/a.md', text)).toEqual([]);
  });

  it('leaves package names with a version and pictures for dense screens', () => {
    const text = 'react@18.3.1 electron@45.3.2 icon@2x.png @scope/name@1.0.0 tray@3x.webp archive@latest.tgz';
    expect(check.scanText('docs/a.md', text)).toEqual([]);
  });

  it('leaves example home folders, example addresses at home and made-up keys', () => {
    const text = [
      '/home/user/ComfyUI /home/you/models /Users/<name>/Library /home/$USER/x C:\\Users\\you\\AppData',
      'http://192.168.1.50:8188 http://10.0.0.5:8188 http://127.0.0.1:8188 version 10.2.3.4567',
      "sk-test-00000000000000000000000000000000 hf_exampleexampleexampleexampleexample",
    ].join('\n');
    expect(check.scanText('docs/a.md', text)).toEqual([]);
  });

  it('lets tests make up private network addresses and sign-ins inside addresses', () => {
    const text = "probe('http://172.16.9.9:8188'); open('https://user:pw@some-cdn.com/file');";
    expect(check.scanText('tests/unit/net.test.ts', text)).toEqual([]);
  });

  it('knows which addresses are private', () => {
    expect(['10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.44.7', '100.64.0.1'].map(check.privateAddress)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(['8.8.8.8', '172.32.0.1', '100.128.0.1', '127.0.0.1', '999.1.1.1'].map(check.privateAddress)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('public tree check: the command', () => {
  const run = (args: string[]): { code: number; out: string } => {
    try {
      return { code: 0, out: execFileSync('node', [script, ...args], { encoding: 'utf8' }) };
    } catch (error) {
      const failed = error as { status?: number; stdout?: string };
      return { code: failed.status ?? -1, out: failed.stdout ?? '' };
    }
  };

  it('passes on the files tracked today', () => {
    const result = run([]);
    expect(result.out).toContain('Nothing private found');
    expect(result.code).toBe(0);
  });

  it('fails on a folder with a private value and hides the middle of what it found', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-tree-'));
    try {
      fs.mkdirSync(path.join(dir, 'docs'));
      fs.writeFileSync(path.join(dir, 'docs', 'a.md'), 'line\nthe server is studio.private-host.io\n');
      fs.writeFileSync(path.join(dir, 'values.txt'), '# hosts\nstudio.private-host.io\n');
      const values = path.join(dir, 'values.txt');
      const result = run(['--dir', path.join(dir, 'docs'), '--values', values]);
      expect(result.code).toBe(1);
      expect(result.out).toContain('private value: 1');
      expect(result.out).toContain('a.md:2');
      expect(result.out).not.toContain('studio.private-host.io');
      expect(run(['--dir', path.join(dir, 'docs'), '--values', values, '--show']).out).toContain('studio.private-host.io');
      expect(run(['--dir', path.join(dir, 'docs')]).code).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
