/**
 * Settings > About, the last section of SettingsPanel. It reuses shell/AboutContent so the About text and links live
 * in one place for both the Help menu and Settings.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import AboutContent from '../../shell/AboutContent';
import { SectionHead } from './common';

/** Settings ▸ About: the same view as Help ▸ About. */
export default function AboutSection() {
  const { t } = useTranslation();
  return (
    <>
      <SectionHead title={String(t('preferences.nav.about'))} />
      <AboutContent />
    </>
  );
}
