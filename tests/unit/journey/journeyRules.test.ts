/**
 * Rules of the first steps in the app: what the first screen shows (library open, right panel on the assistant), the
 * single import message that also says where a workflow came from (shell/notices), and when the window tour starts by
 * itself (journey/WindowTour). A newcomer should land on a usable screen and see the tour once, never in an
 * automated run.
 */
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../../src/shared/i18n';
import { describeNote } from '../../../src/renderer/components/shell/notices';
import { holdsBothPanels } from '../../../src/renderer/state/frame';
import { RAIL_AUTO_COLLAPSE } from '../../../src/renderer/state/uiState';
import { normalizeDockTab, useDockStore } from '../../../src/renderer/state/dockState';
import { shouldAutoStartTour } from '../../../src/renderer/components/journey/WindowTour';

describe('first-screen defaults', () => {
  it('the library starts open in any window that holds both panels, the 1400 px the app opens at included', () => {
    expect(holdsBothPanels(RAIL_AUTO_COLLAPSE, false)).toBe(true);
    expect(holdsBothPanels(RAIL_AUTO_COLLAPSE - 1, false)).toBe(false);
    expect(RAIL_AUTO_COLLAPSE).toBeLessThanOrEqual(1400);
  });

  it('the right panel starts on the assistant', () => {
    expect(useDockStore.getState().tab).toBe('assistant');
    expect(normalizeDockTab('assistant')).toBe('assistant');
  });
});

describe('the one merged import message', () => {
  const t = createTranslator('ru');
  it('says where the workflow came from inside the same message', () => {
    const note = describeNote({ kind: 'imported', version: '1', missingNodes: [], missingModels: [], from: 'picture' }, t);
    expect(note.id).toBe('workflow-note');
    expect(String(note.description)).toContain('из картинки');
    const api = describeNote({ kind: 'imported', version: '1', missingNodes: ['X'], missingModels: [], from: 'api' }, t, { openCheck: () => undefined });
    expect(String(api.description)).toContain('формате API');
    expect(api.action?.label).toBe(t('workflow.openCheck'));
  });

  it('the save-for-ComfyUI message offers how to run it', () => {
    const note = describeNote({ kind: 'exported' }, t, { howToRun: () => undefined });
    expect(note.action?.label).toBe('Как запустить');
  });
});

describe('the window tour', () => {
  it('starts by itself once, on a first start, with no dialog open, never in an automated run', () => {
    expect(shouldAutoStartTour({ seen: false, dialogOpen: false, automated: false })).toBe(true);
    expect(shouldAutoStartTour({ seen: true, dialogOpen: false, automated: false })).toBe(false);
    expect(shouldAutoStartTour({ seen: false, dialogOpen: true, automated: false })).toBe(false);
    expect(shouldAutoStartTour({ seen: false, dialogOpen: false, automated: true })).toBe(false);
  });
});
