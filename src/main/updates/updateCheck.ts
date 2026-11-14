import * as fs from 'fs';
import * as path from 'path';
import type { UpdateLink, UpdateStatus } from '../../shared/contracts/updates';

/**
 * The update notice: when the person turned it on (Settings ▸ Privacy, off by default), ask the project's releases
 * page at most once a day whether a newer version exists. The request carries the app's user agent and nothing
 * else; the answer is kept in <profile>/update-check.json. Nothing is downloaded: the notice's links open the
 * release page or the file for this kind of install in the browser.
 *
 * No Electron import here: the IPC side is in updateIpc.ts, so unit tests load this file as is.
 */

/** At most one question a day. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** After a failed question (offline, rate limit), ask again in an hour, not at every start. */
export const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
/** The latest-release answer is a few kilobytes; anything far larger is not it. */
export const RELEASE_ANSWER_MAX_BYTES = 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;

export type InstallKind = 'deb' | 'rpm' | 'appimage' | 'tarball';

export interface ReleaseAsset {
  name: string;
  url: string;
}

export interface ReleaseFacts {
  version: string;
  pageUrl: string;
  assets: ReleaseAsset[];
}

export interface CheckState {
  /** When the releases page last answered (or failed, moved so the next try is in an hour). */
  checkedAt: number;
  latest: ReleaseFacts | null;
  /** The version whose notice the person closed; a later version shows again. */
  dismissed: string | null;
}

const EMPTY_STATE: CheckState = { checkedAt: 0, latest: null, dismissed: null };

/** owner and repository of a https://github.com/<owner>/<repository> address; null for anything else or the placeholder. */
export function githubRepository(projectUrl: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(projectUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null;
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  const name = /^[A-Za-z0-9_.-]+$/;
  if (!name.test(owner) || !name.test(repo) || (owner === 'OWNER' && repo === 'REPOSITORY')) return null;
  return { owner, repo: repo.replace(/\.git$/, '') };
}

/** The GitHub API address of the newest published (not draft, not pre-release) release. */
export function releasesApiUrl(projectUrl: string): string | null {
  const repository = githubRepository(projectUrl);
  return repository ? `https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/latest` : null;
}

/** 1.2.10 > 1.2.9; 1.0.0 > 1.0.0-rc.1; a leading v is ignored. Anything unreadable compares as equal. */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(value.trim());
    return match ? { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? null } : null;
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i++) {
    if (left.core[i] !== right.core[i]) return left.core[i] > right.core[i] ? 1 : -1;
  }
  if (left.pre === right.pre) return 0;
  if (left.pre === null) return 1;
  if (right.pre === null) return -1;
  return left.pre.localeCompare(right.pre, 'en', { numeric: true });
}

/** A link the notice may open: only pages and files of this project's releases, never another address. */
function releaseLink(value: unknown, projectUrl: string): string | null {
  if (typeof value !== 'string') return null;
  const base = `${projectUrl.replace(/\/+$/, '')}/releases/`;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.toString().startsWith(base) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** What the notice needs from the API answer, or null when the answer is not a usable release of this project. */
export function parseRelease(answer: unknown, projectUrl: string): ReleaseFacts | null {
  if (!answer || typeof answer !== 'object') return null;
  const release = answer as { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown };
  if (release.draft === true || release.prerelease === true || typeof release.tag_name !== 'string') return null;
  const version = release.tag_name.trim().replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+([-+][0-9A-Za-z.+-]+)?$/.test(version)) return null;
  const pageUrl = releaseLink(release.html_url, projectUrl);
  if (!pageUrl) return null;
  const assets: ReleaseAsset[] = [];
  if (Array.isArray(release.assets)) {
    for (const asset of release.assets as Array<{ name?: unknown; browser_download_url?: unknown }>) {
      const url = releaseLink(asset?.browser_download_url, projectUrl);
      if (url && typeof asset.name === 'string') assets.push({ name: asset.name, url });
    }
  }
  return { version, pageUrl, assets };
}

/** The release file for this kind of install (x64 only: the only architecture built), or null. */
export function pickDownload(assets: readonly ReleaseAsset[], kind: InstallKind | null, arch: string = process.arch): string | null {
  if (!kind || arch !== 'x64') return null;
  const ending = { deb: /_amd64\.deb$/, rpm: /\.x86_64\.rpm$/, appimage: /-x86_64\.AppImage$/, tarball: /-linux-x64\.tar\.gz$/ }[kind];
  return assets.find((asset) => ending.test(asset.name))?.url ?? null;
}

/**
 * How this copy was installed, so "download" can fetch the same kind of file: the AppImage runtime sets APPIMAGE;
 * install.sh and the tar.gz keep run.sh and uninstall.sh beside the program; a package lives under /usr/lib, and
 * dpkg keeps a file list for the .deb.
 */
export function installKind(
  execPath: string,
  env: NodeJS.ProcessEnv,
  exists: (file: string) => boolean,
  packageName: string,
): InstallKind | null {
  if (env.APPIMAGE) return 'appimage';
  const dir = path.dirname(execPath);
  if (exists(path.join(dir, 'run.sh')) && exists(path.join(dir, 'uninstall.sh'))) return 'tarball';
  if (dir === `/usr/lib/${packageName}`) return exists(`/var/lib/dpkg/info/${packageName}.list`) ? 'deb' : 'rpm';
  return null;
}

export function readCheckState(file: string): CheckState {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<CheckState>;
    const latest = parsed.latest && typeof parsed.latest.version === 'string' && typeof parsed.latest.pageUrl === 'string'
      ? { version: parsed.latest.version, pageUrl: parsed.latest.pageUrl, assets: Array.isArray(parsed.latest.assets) ? parsed.latest.assets : [] }
      : null;
    return {
      checkedAt: typeof parsed.checkedAt === 'number' && Number.isFinite(parsed.checkedAt) ? parsed.checkedAt : 0,
      latest,
      dismissed: typeof parsed.dismissed === 'string' ? parsed.dismissed : null,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function writeCheckState(file: string, state: CheckState): void {
  try {
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(temp, file);
  } catch {
    // A notice that cannot be remembered is asked again tomorrow; nothing else depends on it.
  }
}

export interface UpdateCheckerOptions {
  projectUrl: string;
  currentVersion: string;
  /** The person's choice (Settings ▸ Privacy), read at every question. */
  enabled: () => boolean;
  stateFile: string;
  fetch: typeof fetch;
  userAgent: string;
  kind: InstallKind | null;
  now?: () => number;
  log?: (line: string) => void;
}

export interface UpdateChecker {
  /** The notice to show; asks the releases page first when the check is on and a day has passed. */
  status(): Promise<UpdateStatus>;
  /** Close the notice of this version; a later version shows again. */
  dismiss(version: string): void;
  /** The address a link of the notice opens, or null when there is no notice. */
  linkFor(link: UpdateLink): string | null;
}

export function createUpdateChecker(options: UpdateCheckerOptions): UpdateChecker {
  const now = options.now ?? (() => Date.now());
  const api = releasesApiUrl(options.projectUrl);
  let pending: Promise<void> | null = null;

  async function ask(): Promise<void> {
    const state = readCheckState(options.stateFile);
    try {
      const response = await options.fetch(api as string, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': options.userAgent },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: 'follow',
      });
      if (response.status === 404) {
        // No release published yet: nothing newer, ask again tomorrow.
        writeCheckState(options.stateFile, { ...state, checkedAt: now(), latest: null });
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const latest = parseRelease(await response.json(), options.projectUrl);
      writeCheckState(options.stateFile, { ...state, checkedAt: now(), latest });
      options.log?.(`[Updates] Checked latest=${latest?.version ?? 'none'} current=${options.currentVersion}`);
    } catch (error) {
      writeCheckState(options.stateFile, { ...state, checkedAt: now() - CHECK_INTERVAL_MS + RETRY_AFTER_FAILURE_MS });
      options.log?.(`[Updates] Check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function noticeOf(state: CheckState): UpdateStatus {
    const latest = state.latest;
    if (!latest || compareVersions(latest.version, options.currentVersion) <= 0) return { state: 'current' };
    if (state.dismissed && compareVersions(latest.version, state.dismissed) <= 0) return { state: 'current' };
    return { state: 'available', notice: { version: latest.version } };
  }

  return {
    async status() {
      if (!api || !options.enabled()) return { state: 'off' };
      const state = readCheckState(options.stateFile);
      if (now() - state.checkedAt >= CHECK_INTERVAL_MS || state.checkedAt > now()) {
        pending ??= ask().finally(() => {
          pending = null;
        });
        await pending;
      }
      return noticeOf(readCheckState(options.stateFile));
    },
    dismiss(version) {
      const state = readCheckState(options.stateFile);
      writeCheckState(options.stateFile, { ...state, dismissed: version });
    },
    linkFor(link) {
      if (!api || !options.enabled()) return null;
      const state = readCheckState(options.stateFile);
      if (noticeOf(state).state !== 'available' || !state.latest) return null;
      if (link === 'notes') return state.latest.pageUrl;
      return pickDownload(state.latest.assets, options.kind) ?? state.latest.pageUrl;
    },
  };
}
