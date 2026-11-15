import { INTERFACE_SCALE } from '../../../../shared/config/preferences';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { NonSecretSettings } from '../../../../shared/config/schema';
import type { Preferences } from '../../../../shared/config/preferences';
import type { AppLanguage } from '../../../../shared/i18n';
import { applyLanguage } from '../../../i18n';
import Button from '../../../ui/Button';
import RadioCards from '../../../ui/RadioCards';
import SelectField from '../../../ui/SelectField';
import Switch from '../../../ui/Switch';
import { cx } from '../../../ui/cx';
import styles from '../SettingsPanel.module.css';
import { hintClass, patchSection, SectionHead, type DraftProps } from './common';

const ACCENTS: Array<Preferences['appearance']['accent']> = ['cyan', 'violet', 'mint', 'amber'];
const ACCENT_KEYS: Record<Preferences['appearance']['accent'], string> = {
  cyan: 'preferences.accentCyan',
  violet: 'preferences.accentViolet',
  mint: 'preferences.accentMint',
  amber: 'preferences.accentAmber',
};

/** Settings ▸ Appearance & Motion. Language switches at once; motion, density, accent and glow apply on Save. */
export default function AppearanceSection({ values, setValues, prefs, setPrefs, container }: DraftProps) {
  const { t } = useTranslation();
  const appearance = prefs.appearance;
  const set = (patch: Partial<Preferences['appearance']>) => patchSection(setPrefs, 'appearance', patch);
  return (
    <>
      <SectionHead title={String(t('settings.appearance'))} lead={String(t('preferences.lead.appearance'))} />
      <SelectField
        label={String(t('settings.motion'))}
        value={values.motion}
        options={[
          { value: 'system', label: String(t('settings.motionSystem')) },
          { value: 'on', label: String(t('settings.motionOn')) },
          { value: 'reduced', label: String(t('settings.motionReduced')) },
          { value: 'off', label: String(t('settings.motionOff')) },
        ]}
        container={container}
        onChange={(motion) => setValues((current) => ({ ...current, motion: motion as NonSecretSettings['motion'] }))}
      />
      <p className={hintClass}>{t('settings.motionHint')}</p>
      <SelectField
        id="settings-language"
        label={String(t('settings.language'))}
        value={values.language}
        options={[
          { value: 'en', label: String(t('settings.languageEnglish')) },
          { value: 'ru', label: String(t('settings.languageRussian')) },
        ]}
        container={container}
        onChange={(language) => {
          const next = language as AppLanguage;
          setValues((current) => ({ ...current, language: next }));
          applyLanguage(next);
        }}
      />
      <p className={hintClass}>{t('settings.languageHint')}</p>
      <SelectField
        label={String(t('preferences.density'))}
        value={appearance.density}
        options={[
          { value: 'comfortable', label: String(t('preferences.densityComfortable')) },
          { value: 'compact', label: String(t('preferences.densityCompact')) },
        ]}
        container={container}
        onChange={(density) => set({ density: density as Preferences['appearance']['density'] })}
      />
      {/* Accessibility: the whole interface larger or smaller (the canvas zoom stays its own). */}
      <SelectField
        label={String(t('a11y.interfaceScale'))}
        value={String(appearance.interfaceScale)}
        options={INTERFACE_SCALE.steps.map((step) => ({ value: String(step), label: `${step}%` }))}
        container={container}
        onChange={(scale) => set({ interfaceScale: Number(scale) })}
      />
      <p className={hintClass}>{t('a11y.interfaceScaleHint')}</p>
      <RadioCards
        label={String(t('preferences.accent'))}
        value={appearance.accent}
        onChange={(accent) => set({ accent: accent as Preferences['appearance']['accent'] })}
        columns={4}
        compact
        options={ACCENTS.map((accent) => ({
          value: accent,
          title: String(t(ACCENT_KEYS[accent])),
          leading: <span className={cx(styles.swatch, styles[`swatch-${accent}`])} />,
        }))}
      />
      <Switch label={t('preferences.reduceGlow')} checked={appearance.reduceGlow} onCheckedChange={(reduceGlow) => set({ reduceGlow })} />
      <p className={hintClass}>{t('preferences.reduceGlowHint')}</p>
      <div className={styles.previewBlock}>
        <span className={hintClass}>{t('preferences.preview')}</span>
        <div className={styles.preview} data-accent-scope={appearance.accent} aria-hidden="true">
          <div
            className={styles.previewInner}
            data-density-scope={appearance.density}
            data-glow-scope={appearance.reduceGlow ? 'reduced' : undefined}
          >
            <div className={styles.previewNode}>
              <span className={styles.previewTitle}>{t('preferences.previewNode')}</span>
              <span className={styles.previewText}>{t('preferences.previewText')}</span>
              <span className={styles.previewPorts}>
                <span className={styles.previewPort} />
                <span className={styles.previewLine} />
                <span className={styles.previewPort} />
              </span>
            </div>
            <Button variant="primary" size="sm" tabIndex={-1}>{t('preferences.previewAction')}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
