/**
 * The ways into the in-app help: the help reader on a wiki page, What's new, and the project's web links.
 *
 * Who uses it: appCommands.ts (the Help menu), components/shell/AboutContent.tsx, components/lessons (MyLessons,
 * LessonDraftCard), components/settings/sections/PrivacySection.tsx and components/journey/NoComfyDialog.tsx.
 */
import { useUiStore } from '../state/uiState';
import { pageForHelpId, WHATS_NEW_PAGE, type HelpId } from '../../shared/help/contextHelp';
import { showToast } from '../ui/Toast';
import { i18n } from '../i18n';
import type { ProjectLinkKind } from '../../shared/contracts/about';

/**
 * Opens the help reader on the wiki page a context help id names (shared/help/contextHelp.ts). Use the id, never a
 * file name, so the wiki can move pages without touching the app.
 */
export function openHelp(id: HelpId): void {
  useUiStore.getState().showHelp(pageForHelpId(id) ?? 'Home');
}

/** Help ▸ What's new: the notes of the running version. */
export function openWhatsNew(): void {
  useUiStore.getState().showHelp(WHATS_NEW_PAGE);
}

/** Opens the project page or its releases; says so when the project address is not set in this build. */
export async function openProjectLink(kind: Exclude<ProjectLinkKind, 'issue'>): Promise<void> {
  const result = await window.electronAPI?.openProjectLink?.(kind).catch(() => ({ ok: false as const, error: 'failed' }));
  if (!result || !result.ok) showToast({ id: 'project-link', tone: 'error', title: String(i18n.t('projectLinks.unavailable')) });
}

/** main's answer about the project links; null until asked. */
let linksAvailable: boolean | null = null;

/**
 * Whether this build knows the project address (About and Help grey the project links out when not). Asked once;
 * false until main has answered.
 */
export function projectLinksAvailable(): boolean {
  if (linksAvailable === null) {
    linksAvailable = false;
    void window.electronAPI?.aboutInfo?.().then((info) => { linksAvailable = info.projectLinks; }).catch(() => undefined);
  }
  return linksAvailable;
}
