/** A structured agent draft opens as a reviewable copy instead of overwriting the teacher's work. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { readClassroomMaterial } from '../../../shared/education/material';
import Button from '../../ui/Button';
import { openClassroom } from './classroomState';

export default function ClassroomDraftCard({ value }: { value: unknown }) {
  const { t } = useTranslation();
  try {
    const material = readClassroomMaterial(value);
    return <div><p><strong>{material.title}</strong></p><p>{t('classroom.draftHint')}</p><Button onClick={() => openClassroom(material)}>{t('classroom.openDraft')}</Button></div>;
  } catch { return <p role="status">{t('classroom.importError')}</p>; }
}
