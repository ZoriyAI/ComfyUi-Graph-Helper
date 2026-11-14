import { app, shell, type IpcMain } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { HELP_TOPICS, type AboutInfo, type HelpPage, type HelpTopic, type ThirdPartyComponent } from '../../shared/contracts/about';
import { appVersion } from '../identity';

/** dist/ (this file is dist/main/ipc/aboutIpc.js, packaged or not): notices and help are written there at build. */
const DIST = path.join(__dirname, '..', '..');

function chromiumLicencesPath(): string {
  return path.join(path.dirname(process.execPath), 'LICENSES.chromium.html');
}

/** "Ubuntu 24.04.1 LTS · Linux 6.8.0 x64", or just the kernel line when the distribution does not say. */
export function systemLine(osRelease: string | null, type = os.type(), release = os.release(), arch = os.arch()): string {
  const pretty = osRelease ? /^PRETTY_NAME="?([^"\n]+)"?/m.exec(osRelease)?.[1] : undefined;
  const kernel = `${type} ${release} ${arch}`;
  return pretty ? `${pretty} · ${kernel}` : kernel;
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** The file Help shows for a topic and a language; whatsnew exists in Russian only (release notes are). */
export function helpFile(dist: string, topic: HelpTopic, language: string): string[] {
  if (topic === 'whatsnew') return [path.join(dist, 'help', 'whatsnew.md')];
  const lang = language === 'en' ? 'en' : 'ru';
  return [path.join(dist, 'help', `${topic}.${lang}.md`), path.join(dist, 'help', `${topic}.ru.md`)];
}

export function registerAboutIpc(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.ABOUT_INFO, (): AboutInfo => ({
    version: app.isPackaged ? app.getVersion() : appVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    system: systemLine(readText('/etc/os-release')),
    dataFolder: app.getPath('userData'),
    chromiumLicences: fs.existsSync(chromiumLicencesPath()),
  }));

  ipcMain.handle(IPC_CHANNELS.ABOUT_LICENCE, (): string => readText(path.join(DIST, 'notices', 'LICENSE.txt')) ?? '');

  ipcMain.handle(IPC_CHANNELS.ABOUT_NOTICES, (): ThirdPartyComponent[] => {
    const text = readText(path.join(DIST, 'notices', 'third-party.json'));
    if (!text) return [];
    try {
      const parsed = JSON.parse(text) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is ThirdPartyComponent => Boolean(item) && typeof item.name === 'string') : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.ABOUT_OPEN_DATA_FOLDER, async () => {
    const error = await shell.openPath(app.getPath('userData'));
    return error ? { ok: false as const, error } : { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.ABOUT_OPEN_CHROMIUM_LICENCES, async () => {
    const file = chromiumLicencesPath();
    if (!fs.existsSync(file)) return { ok: false as const, error: 'missing' };
    const error = await shell.openPath(file);
    return error ? { ok: false as const, error } : { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.HELP_READ, (_event, topic: unknown, language: unknown): HelpPage => {
    if (typeof topic !== 'string' || !(HELP_TOPICS as readonly string[]).includes(topic)) return { ok: false, error: 'unknown' };
    for (const file of helpFile(DIST, topic as HelpTopic, typeof language === 'string' ? language : 'ru')) {
      const text = readText(file);
      if (text) return { ok: true, text };
    }
    return { ok: false, error: 'missing' };
  });
}
