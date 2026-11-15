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
}

/** One package that ships with the app, from dist/notices/third-party.json (scripts/build-assets.js). */
export interface ThirdPartyComponent {
  name: string;
  version: string;
  license: string;
  text: string;
}

/** The pages Help opens in the app's own reader. */
export const HELP_TOPICS = ['guide', 'troubleshooting', 'whatsnew', 'content'] as const;
export type HelpTopic = typeof HELP_TOPICS[number];

export type HelpPage = { ok: true; text: string } | { ok: false; error: string };
