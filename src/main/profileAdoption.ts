import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { APP_ID } from '../shared/productNames';
import { LEGACY_APP_ID } from '../shared/legacyNames';
import type { Translator } from '../shared/i18n';

/**
 * Taking over the 0.x profile folder at the first start of 1.0.
 *
 * Who uses it: src/main/index.ts, once per start, right after it has pointed userData at ~/.config/nodewise-studio
 * and before anything (the single-instance lock, the log, the database, the password-store override) opens a file
 * there. Why: 0.x kept settings, projects, conversations, the database and the key and token files in
 * ~/.config/<LEGACY_APP_ID>. 1.0 renamed the app, and with it the folder; without this step an upgrade would open an
 * empty profile.
 *
 * Rules: the old folder is renamed, never copied and never deleted; nothing happens when the new folder exists
 * (whether or not the old one does), so a person who already used 1.0 keeps both untouched; an old folder that
 * cannot be read is left where it is; an old folder a running 0.x still holds is left alone for this start and the
 * person is asked to quit the old version. The key file and the token file inside the folder move with it and keep
 * working. Keys that the system password store encrypted do not: the store keeps its secret under the app's name,
 * so they must be entered again (the notice below says so once).
 *
 * No Electron import, so the whole decision is unit-tested (tests/unit/profileAdoption.test.ts).
 */

/** What the start did with the 0.x profile. */
export type ProfileAdoption =
  | { outcome: 'adopted'; from: string; to: string }
  | { outcome: 'none' }
  | { outcome: 'both-exist'; from: string; to: string }
  | { outcome: 'old-unreadable'; from: string; error: string }
  | { outcome: 'old-in-use'; from: string }
  | { outcome: 'failed'; from: string; error: string };

/** The file left in the adopted folder until the person has been told once (see takeAdoptionNotice). */
export const ADOPTION_NOTICE_FILE = 'profile-adopted.json';

type FsLike = Pick<typeof fs, 'lstatSync' | 'statSync' | 'accessSync' | 'readdirSync' | 'readlinkSync' | 'renameSync' | 'writeFileSync' | 'readFileSync' | 'rmSync'>;

export interface AdoptionDeps {
  fs?: FsLike;
  hostname?: string;
  /** Whether a process with this id runs on this computer. */
  alive?: (pid: number) => boolean;
  now?: () => Date;
}

function exists(fsImpl: FsLike, file: string): boolean {
  try {
    fsImpl.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else; it still holds the folder.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Whether a running app still holds this profile. Chromium marks a profile in use with the symlink SingletonLock,
 * whose target is "<host>-<pid>"; a lock left by a crash names a process that is gone and does not count.
 */
export function profileInUse(dir: string, deps: AdoptionDeps = {}): boolean {
  const fsImpl = deps.fs ?? fs;
  let target: string;
  try {
    target = String(fsImpl.readlinkSync(path.join(dir, 'SingletonLock')));
  } catch {
    return false;
  }
  const match = /^(.*)-(\d+)$/.exec(target);
  if (!match) return false;
  if (match[1] !== (deps.hostname ?? os.hostname())) return false;
  return (deps.alive ?? processAlive)(Number(match[2]));
}

/**
 * Moves ~/.config/<LEGACY_APP_ID> to ~/.config/<APP_ID> (both under `appData`) when only the old one exists, and
 * leaves a note for the one-time notice. Never throws: whatever goes wrong, the app starts.
 */
export function adoptLegacyProfile(appData: string, deps: AdoptionDeps = {}): ProfileAdoption {
  const fsImpl = deps.fs ?? fs;
  const from = path.join(appData, LEGACY_APP_ID);
  const to = path.join(appData, APP_ID);
  const hasOld = exists(fsImpl, from);
  if (exists(fsImpl, to)) return hasOld ? { outcome: 'both-exist', from, to } : { outcome: 'none' };
  if (!hasOld) return { outcome: 'none' };
  try {
    // A folder (or a link to one) the app can list and change; anything else is not a profile to take over.
    if (!fsImpl.statSync(from).isDirectory()) return { outcome: 'old-unreadable', from, error: 'not a folder' };
    fsImpl.accessSync(from, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
    fsImpl.readdirSync(from);
  } catch (error) {
    return { outcome: 'old-unreadable', from, error: (error as NodeJS.ErrnoException).code ?? String(error) };
  }
  if (profileInUse(from, deps)) return { outcome: 'old-in-use', from };
  try {
    fsImpl.renameSync(from, to);
  } catch (error) {
    return { outcome: 'failed', from, error: (error as NodeJS.ErrnoException).code ?? String(error) };
  }
  try {
    const note = { from, adoptedAt: (deps.now ?? (() => new Date()))().toISOString() };
    fsImpl.writeFileSync(path.join(to, ADOPTION_NOTICE_FILE), `${JSON.stringify(note)}\n`, { mode: 0o600 });
  } catch {
    // The folder moved; only the notice is lost.
  }
  return { outcome: 'adopted', from, to };
}

/**
 * The note an adoption left, read and removed in one step, so the notice is shown once even if the window closes
 * while it is open. Null when there is none.
 */
export function takeAdoptionNotice(userData: string, fsImpl: FsLike = fs): { from: string } | null {
  const file = path.join(userData, ADOPTION_NOTICE_FILE);
  let text: string;
  try {
    text = String(fsImpl.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  try {
    fsImpl.rmSync(file, { force: true });
  } catch {
    // Read-only now: the notice may come again next time, which is better than never.
  }
  try {
    const parsed = JSON.parse(text) as { from?: unknown };
    return { from: typeof parsed.from === 'string' ? parsed.from : '' };
  } catch {
    return { from: '' };
  }
}

/** The texts of the one-time notice after an adoption, and of the "quit the old version first" message. */
export function adoptionTexts(t: Translator, kind: 'adopted' | 'old-in-use', folder: string): { title: string; message: string; detail: string } {
  if (kind === 'adopted') {
    return { title: t('profileMove.adoptedTitle'), message: t('profileMove.adoptedMessage', { folder }), detail: t('profileMove.adoptedKeys') };
  }
  return { title: t('profileMove.inUseTitle'), message: t('profileMove.inUseMessage'), detail: t('profileMove.inUseDetail', { folder }) };
}

/** A path under the home folder written with `~`, as the notices show it. */
export function homeRelative(file: string, home: string = os.homedir()): string {
  return home && (file === home || file.startsWith(`${home}${path.sep}`)) ? `~${file.slice(home.length)}` : file;
}
