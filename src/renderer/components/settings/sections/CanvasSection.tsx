/**
 * Settings > Canvas, one section of SettingsPanel: description labels, minimap, following the agent, the tour's
 * autoplay, the build pace and the grid size. All values are draft preferences, saved with the dialog's Save.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BUILD_PACE, DESCRIPTION_MODES, GRID_SIZE, descriptionsModeOf, descriptionsPatch, type DescriptionsMode } from '../../../../shared/config/preferences';
import SelectField from '../../../ui/SelectField';
import NumberField from '../../../ui/NumberField';
import Switch from '../../../ui/Switch';
import { hintClass, patchSection, SectionHead, type DraftProps } from './common';

/** The catalog key of each description mode's name in the select. */
const MODE_KEYS: Record<DescriptionsMode, string> = {
  own: 'canvas.descriptionsOwn',
  all: 'canvas.descriptionsAll',
  off: 'canvas.descriptionsOff',
};

/** Settings ▸ Canvas: what the canvas shows and how fast a live build plays. */
export default function CanvasSection({ prefs, setPrefs, container }: DraftProps) {
  const { t } = useTranslation();
  const canvas = prefs.canvas;
  const set = (patch: Partial<typeof canvas>) => patchSection(setPrefs, 'canvas', patch);
  const mode = descriptionsModeOf(canvas);
  // The accessible names of a number field's minus and plus buttons.
  const number = (key: string) => ({
    decreaseLabel: String(t('preferences.decrease', { label: t(key) })),
    increaseLabel: String(t('preferences.increase', { label: t(key) })),
  });
  return (
    <>
      <SectionHead title={String(t('preferences.nav.canvas'))} lead={String(t('preferences.lead.canvas'))} />
      <Switch
        // A shortcut for the mode select below: on sets "own", off sets "off".
        label={t('preferences.showDescriptions')} checked={mode !== 'off'} onCheckedChange={(next) => set(descriptionsPatch(next ? 'own' : 'off'))} />
      <p className={hintClass}>{t('preferences.showDescriptionsHint')}</p>
      <SelectField
        id="settings-descriptions-mode"
        label={String(t('canvas.descriptionsMode'))}
        value={mode}
        options={DESCRIPTION_MODES.map((value) => ({ value, label: String(t(MODE_KEYS[value])) }))}
        container={container}
        onChange={(next) => set(descriptionsPatch(next as DescriptionsMode))}
      />
      <p className={hintClass}>{t('canvas.descriptionsModeHint')}</p>
      <Switch label={t('preferences.showMinimap')} checked={canvas.showMinimap} onCheckedChange={(next) => set({ showMinimap: next })} />
      <p className={hintClass}>{t('preferences.showMinimapHint')}</p>
      <Switch label={t('preferences.followAgent')} checked={canvas.followAgent} onCheckedChange={(next) => set({ followAgent: next })} />
      <p className={hintClass}>{t('preferences.followAgentHint')}</p>
      <Switch label={t('preferences.tourAutoplay')} checked={canvas.tourAutoplay} onCheckedChange={(next) => set({ tourAutoplay: next })} />
      <p className={hintClass}>{t('preferences.tourAutoplayHint')}</p>
      <NumberField
        label={String(t('preferences.buildPace'))}
        value={canvas.buildPaceMs}
        min={BUILD_PACE.min}
        max={BUILD_PACE.max}
        step={BUILD_PACE.step}
        hint={String(t('preferences.buildPaceHint'))}
        onChange={(next) => set({ buildPaceMs: next })}
        {...number('preferences.buildPace')}
      />
      <NumberField
        label={String(t('preferences.gridSize'))}
        value={canvas.gridSize}
        min={GRID_SIZE.min}
        max={GRID_SIZE.max}
        step={GRID_SIZE.step}
        hint={String(t('preferences.gridSizeHint'))}
        onChange={(next) => set({ gridSize: next })}
        {...number('preferences.gridSize')}
      />
    </>
  );
}
