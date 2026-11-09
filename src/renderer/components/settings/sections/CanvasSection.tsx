import React from 'react';
import { useTranslation } from 'react-i18next';
import { BUILD_PACE, GRID_SIZE } from '../../../../shared/config/preferences';
import NumberField from '../../../ui/NumberField';
import Switch from '../../../ui/Switch';
import { hintClass, patchSection, SectionHead, type DraftProps } from './common';

/** Settings ▸ Canvas: what the canvas shows and how fast a live build plays. */
export default function CanvasSection({ prefs, setPrefs }: DraftProps) {
  const { t } = useTranslation();
  const canvas = prefs.canvas;
  const set = (patch: Partial<typeof canvas>) => patchSection(setPrefs, 'canvas', patch);
  const number = (key: string) => ({
    decreaseLabel: String(t('preferences.decrease', { label: t(key) })),
    increaseLabel: String(t('preferences.increase', { label: t(key) })),
  });
  return (
    <>
      <SectionHead title={String(t('preferences.nav.canvas'))} lead={String(t('preferences.lead.canvas'))} />
      <Switch label={t('preferences.showDescriptions')} checked={canvas.showDescriptions} onCheckedChange={(next) => set({ showDescriptions: next })} />
      <p className={hintClass}>{t('preferences.showDescriptionsHint')}</p>
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
