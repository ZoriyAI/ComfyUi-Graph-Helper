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
