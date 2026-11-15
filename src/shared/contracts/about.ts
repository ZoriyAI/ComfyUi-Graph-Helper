/**
 * What Help ▸ About, the help reader and "Report a problem" exchange with main: app and system facts, the shipped
 * components, the wiki tree, pages and search hits. Main answers in main/ipc/aboutIpc.ts; the renderer shows it in
 * AboutContent.tsx and HelpReader.tsx through renderer/services/help.ts and the preload bridge.
 */
/** Help ▸ About and Settings ▸ About: facts main knows (src/main/ipc/aboutIpc.ts). */
export interface AboutInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  /** "Linux 6.8.0 x64" and the distribution when /etc/os-release names it. */
  system: string;
  /** The profile folder: database, logs, saved window, key files. */
  dataFolder: string;
  /** Chromium's own licence file sits next to the executable. */
  chromiumLicences: boolean;
  /** The project address is set (identity.ts PROJECT_URL is not the placeholder): project links can open. */
  projectLinks: boolean;
}

/** One package that ships with the app, from dist/notices/third-party.json (scripts/build-assets.js). */
export interface ThirdPartyComponent {
  name: string;
  version: string;
  license: string;
  text: string;
}

/** The languages the wiki is written in. */
export type HelpLanguage = 'en' | 'ru';

/** The section tree of the help reader, in the order Home and the folder indexes list it. */
export interface HelpTree {
  home: { ref: string; title: string };
  folders: Array<{ folder: string; ref: string; title: string; pages: Array<{ ref: string; title: string }> }>;
}

/** One wiki page in the asked language (or English when that language has none). */
export type HelpPage =
  | { ok: true; ref: string; language: HelpLanguage; title: string; text: string }
  | { ok: false; error: 'unknown' | 'missing' };

/** One page that matched a help search. */
export interface HelpSearchHit {
  ref: string;
  title: string;
  /** A few words around the first match. */
  snippet: string;
}

/** Pages of the project the app can open in the browser. */
export const PROJECT_LINK_KINDS = ['site', 'releases', 'issue'] as const;
export type ProjectLinkKind = typeof PROJECT_LINK_KINDS[number];

/** What "Report a problem" will put into the new issue; shown to the person before anything opens. */
export interface IssueDraft {
  title: string;
  details: string;
}
