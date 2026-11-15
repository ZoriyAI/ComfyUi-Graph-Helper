/**
 * The first start of 1.0 takes over the 0.x profile folder (src/main/profileAdoption.ts): it is renamed when only the
 * old folder exists, and left alone in every other case. Real folders in a temp directory; the unreadable case uses
 * an injected file system, because the tests may run as root, for whom every folder is readable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ADOPTION_NOTICE_FILE, adoptLegacyProfile, adoptionTexts, homeRelative, profileInUse, takeAdoptionNotice } from '../../src/main/profileAdoption';
import { APP_ID } from '../../src/shared/productNames';
import { LEGACY_APP_ID } from '../../src/shared/legacyNames';
import { createTranslator } from '../../src/shared/i18n';

let appData: string;
let oldDir: string;
let newDir: string;

beforeEach(() => {
  appData = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-adoption-'));
  oldDir = path.join(appData, LEGACY_APP_ID);
  newDir = path.join(appData, APP_ID);
});

afterEach(() => {
  fs.rmSync(appData, { recursive: true, force: true });
});

/** A 0.x profile as people have it: the database, the key file and the token file. */
function makeOldProfile(): void {
  fs.mkdirSync(path.join(oldDir, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(oldDir, 'comfyui-desktop.db'), 'db');
  fs.writeFileSync(path.join(oldDir, 'model-key.json'), '{"version":2,"keys":{}}', { mode: 0o600 });
  fs.writeFileSync(path.join(oldDir, 'mcp-token.json'), '{}', { mode: 0o600 });
}

describe('taking over the 0.x profile', () => {
  it('renames the old folder when only the old one exists, with the key and token files inside', () => {
    makeOldProfile();
    const result = adoptLegacyProfile(appData, { now: () => new Date('2026-11-15T10:00:00Z') });
    expect(result).toEqual({ outcome: 'adopted', from: oldDir, to: newDir });
    expect(fs.existsSync(oldDir)).toBe(false);
    for (const file of ['comfyui-desktop.db', 'model-key.json', 'mcp-token.json', 'logs']) expect(fs.existsSync(path.join(newDir, file))).toBe(true);
    // The owner-only key file keeps its mode: a rename moves the same file.
    expect(fs.statSync(path.join(newDir, 'model-key.json')).mode & 0o777).toBe(0o600);
    expect(JSON.parse(fs.readFileSync(path.join(newDir, ADOPTION_NOTICE_FILE), 'utf8'))).toEqual({ from: oldDir, adoptedAt: '2026-11-15T10:00:00.000Z' });
  });

  it('does nothing when only the new folder exists', () => {
    fs.mkdirSync(newDir);
    expect(adoptLegacyProfile(appData)).toEqual({ outcome: 'none' });
    expect(fs.readdirSync(newDir)).toEqual([]);
  });

  it('never touches either folder when both exist', () => {
    makeOldProfile();
    fs.mkdirSync(newDir);
    expect(adoptLegacyProfile(appData)).toEqual({ outcome: 'both-exist', from: oldDir, to: newDir });
    expect(fs.readdirSync(oldDir).sort()).toEqual(['comfyui-desktop.db', 'logs', 'mcp-token.json', 'model-key.json']);
    expect(fs.readdirSync(newDir)).toEqual([]);
  });

  it('does nothing when neither exists (a first install)', () => {
    expect(adoptLegacyProfile(appData)).toEqual({ outcome: 'none' });
    expect(fs.readdirSync(appData)).toEqual([]);
  });

  it('leaves an old folder it cannot read where it is', () => {
    makeOldProfile();
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const result = adoptLegacyProfile(appData, { fs: { ...fs, accessSync: () => { throw denied; } } });
    expect(result).toEqual({ outcome: 'old-unreadable', from: oldDir, error: 'EACCES' });
    expect(fs.existsSync(oldDir)).toBe(true);
    expect(fs.existsSync(newDir)).toBe(false);
  });

  it('leaves an old name that is a file, not a folder, where it is', () => {
    fs.writeFileSync(oldDir, 'not a profile');
    expect(adoptLegacyProfile(appData)).toMatchObject({ outcome: 'old-unreadable', error: 'not a folder' });
    expect(fs.existsSync(oldDir)).toBe(true);
  });

  it('says when the rename itself fails and deletes nothing', () => {
    makeOldProfile();
    const busy = Object.assign(new Error('busy'), { code: 'EBUSY' });
    const result = adoptLegacyProfile(appData, { fs: { ...fs, renameSync: () => { throw busy; } } });
    expect(result).toEqual({ outcome: 'failed', from: oldDir, error: 'EBUSY' });
    expect(fs.existsSync(path.join(oldDir, 'comfyui-desktop.db'))).toBe(true);
  });

  it('waits while a running 0.x holds the old folder, and ignores a lock left by a crash', () => {
    makeOldProfile();
    fs.symlinkSync('this-host-4242', path.join(oldDir, 'SingletonLock'));
    expect(profileInUse(oldDir, { hostname: 'this-host', alive: () => true })).toBe(true);
    expect(adoptLegacyProfile(appData, { hostname: 'this-host', alive: () => true })).toEqual({ outcome: 'old-in-use', from: oldDir });
    expect(fs.existsSync(oldDir)).toBe(true);
    expect(fs.existsSync(newDir)).toBe(false);
    // The process named by the lock is gone, or ran on another computer: the folder is free.
    expect(profileInUse(oldDir, { hostname: 'this-host', alive: () => false })).toBe(false);
    expect(profileInUse(oldDir, { hostname: 'other-host', alive: () => true })).toBe(false);
    expect(adoptLegacyProfile(appData, { hostname: 'this-host', alive: () => false }).outcome).toBe('adopted');
  });
});

describe('the one-time notice', () => {
  it('is taken once: the note is removed when read', () => {
    makeOldProfile();
    adoptLegacyProfile(appData);
    expect(takeAdoptionNotice(newDir)).toEqual({ from: oldDir });
    expect(fs.existsSync(path.join(newDir, ADOPTION_NOTICE_FILE))).toBe(false);
    expect(takeAdoptionNotice(newDir)).toBeNull();
  });

  it('says in both languages where the work is and that keyring keys are entered again', () => {
    for (const language of ['en', 'ru'] as const) {
      const text = adoptionTexts(createTranslator(language), 'adopted', '~/.config/nodewise-studio');
      expect(text.title).toContain('NodeWise Studio');
      expect(text.message).toContain('~/.config/nodewise-studio');
      expect(text.detail).toMatch(language === 'en' ? /entered again/ : /ввести заново/);
      const waiting = adoptionTexts(createTranslator(language), 'old-in-use', '~/.config/old');
      expect(waiting.detail).toContain('~/.config/old');
      expect(`${waiting.title} ${waiting.message}`).toContain('0.9');
    }
  });

  it('writes paths under the home folder with ~', () => {
    expect(homeRelative('/home/someone/.config/nodewise-studio', '/home/someone')).toBe('~/.config/nodewise-studio');
    expect(homeRelative('/srv/profile', '/home/someone')).toBe('/srv/profile');
  });
});
