import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from '../locale';

/** The built main process every spec starts: run `npm run build` first, or the specs test old code. */
export const MAIN_ENTRY = path.join(__dirname, '../../../dist/main/index.js');

export interface LaunchOptions {
  /** Name prefix of the temporary profile folder; it shows in /tmp when a run is kept for a look. */
  prefix?: string;
  /** A profile folder of the caller's own (kept on close); otherwise a temporary one is made and removed on close. */
  userData?: string;
  /** Extra environment for main, for example MCP or model fakes. NODE_ENV is 'production' unless given. */
  env?: Record<string, string | undefined>;
  /** Extra command-line arguments after the entry and the profile. */
  args?: string[];
  /** Switch the window to English before handing it over (most specs read English names). */
  english?: boolean;
  /** Window size, when the spec measures layout. */
  viewport?: { width: number; height: number };
}

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  userData: string;
  /** Errors the page threw, for an assertion at the end of a spec. */
  pageErrors: string[];
  /** Closes the app and removes a temporary profile. Safe to call twice. */
  close: () => Promise<void>;
}

/** A temporary profile folder; NODEWISE_KEEP_PROFILES=1 keeps them after the run for a look. */
export function temporaryProfile(prefix = 'nodewise-e2e-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeProfile(folder: string): void {
  if (process.env.NODEWISE_KEEP_PROFILES === '1') return;
  fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

/**
 * Starts the built app in a profile of its own, waits for the shell, and returns a close() that cleans up.
 * Never starts it without --user-data-dir: a spec must not read or write the profile of the person running it.
 */
export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const own = options.userData === undefined;
  const userData = options.userData ?? temporaryProfile(options.prefix);
  const app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userData}`, ...(options.args ?? [])],
    env: { ...process.env, NODE_ENV: 'production', ...options.env } as Record<string, string>,
  });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await app.close().catch(() => undefined);
    if (own) removeProfile(userData);
  };
  try {
    const page = await app.firstWindow();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    if (options.viewport) await page.setViewportSize(options.viewport);
    await page.locator('.app-shell').waitFor({ timeout: 30_000 });
    if (options.english) await useEnglish(page);
    return { app, page, userData, pageErrors, close };
  } catch (error) {
    await close();
    throw error;
  }
}
