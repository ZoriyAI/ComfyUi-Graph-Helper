/**
 * The update notice (src/main/updates/updateCheck.ts). Off by default: only when the person turns on
 * Settings ▸ Privacy ▸ "Check for new versions" does the app ask the project's releases page, at most once a day.
 * Nothing is downloaded by the app: the links open in the browser.
 */
export interface UpdateNotice {
  /** The newer version, without a leading "v". */
  version: string;
}

export type UpdateStatus =
  /** The check is off (the default), or this build has no project address to ask. */
  | { state: 'off' }
  /** Asked, and this is the newest version; or not asked yet today and nothing newer is known. */
  | { state: 'current' }
  /** A newer version exists and the person has not closed its notice. */
  | { state: 'available'; notice: UpdateNotice };

/** What the notice's links open: the release page (what is new) or the file for this kind of install. */
export type UpdateLink = 'notes' | 'download';
