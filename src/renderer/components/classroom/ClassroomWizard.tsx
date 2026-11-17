/** A result-first classroom material editor, available before ComfyUI or a model is configured. */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, FileUp, Plus, Sparkles, X } from 'lucide-react';
import { MATERIAL_FILE_LIMIT, MATERIAL_KINDS, MATERIAL_TEMPLATES, classroomRequest, materialHtml, materialScaffold, readClassroomMaterial, type ClassroomMaterial } from '../../../shared/education/material';
import { useProviderStore } from '../../state/providerState';
import { useUiStore } from '../../state/uiState';
import { requestAsk } from '../../services/ask';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import { useClassroomStore } from './classroomState';
import styles from './ClassroomWizard.module.css';

function download(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function ClassroomWizard() {
  const { t, i18n } = useTranslation();
  const state = useClassroomStore(); const { brief, material } = state;
  const language = i18n.language.startsWith('ru') ? 'ru' : 'en';
  const provider = useProviderStore(s => s.provider);
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(''); const [confirmNew, setConfirmNew] = useState(false); const [preview, setPreview] = useState(false);
  const words = MATERIAL_TEMPLATES[brief.kind][language];
  const create = () => {
    const draft = materialScaffold(brief.kind, brief.language, brief.topic, brief.age, brief.objective);
    state.setMaterial(draft); state.setStep(2); return draft;
  };
  const ask = () => {
    if (!provider) { state.close(); useUiStore.getState().openSettings('assistant'); return; }
    const draft = material ?? create();
    requestAsk({ context: { intent: 'ask', language: brief.language, selection: [] }, message: classroomRequest(draft, brief.source) });
    state.close();
  };
  const importFile = async (selected?: File) => {
    if (!selected) return;
    try {
      if (selected.size > MATERIAL_FILE_LIMIT) throw new Error('Too large');
      const incoming = readClassroomMaterial(JSON.parse(await selected.text()));
      state.show(incoming); setError('');
    } catch { setError(String(t('classroom.importError'))); }
  };
  const update = (patch: Partial<ClassroomMaterial>) => {
    if (!material) return;
    try { state.setMaterial({ ...material, ...patch }); setError(''); }
    catch { setError(String(t('classroom.editError'))); }
  };
  const updateBlock = (id: string, patch: Partial<ClassroomMaterial['blocks'][number]>) => {
    if (material) update({ blocks: material.blocks.map(block => block.id === id ? { ...block, ...patch } : block) });
  };
  const save = (audience?: 'pupil' | 'teacher') => {
    if (!material) return;
    if (audience) download(materialHtml(material, audience), `nodewise-${audience}.html`, 'text/html;charset=utf-8');
    else download(JSON.stringify(material, null, 2), 'nodewise-material.json', 'application/json');
  };
  const filled = Boolean(material?.title.trim() && material.blocks.some(block => block.text.trim()));
  return <DialogRoot open={state.open} onOpenChange={open => { if (!open) state.close(); }}><DialogPortal><DialogOverlay /><DialogContent className={styles.dialog} aria-describedby="classroom-lead" data-classroom-wizard>
    <header className={styles.header}><DialogTitle><BookOpen size={20} aria-hidden="true" />{t('classroom.open')}</DialogTitle><IconButton label={String(t('classroom.close'))} onClick={state.close}><X size={20} /></IconButton><DialogDescription id="classroom-lead">{t('classroom.lead')}</DialogDescription></header>
    <div className={styles.body}>
      <p className={styles.hint} role="status">{t(state.saved ? 'classroom.retained' : 'classroom.notSaved')}</p>
      <input ref={file} hidden type="file" accept=".json,application/json" onChange={event => { const selected = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void importFile(selected); }} />
      <Button size="sm" icon={<FileUp size={16} />} onClick={() => file.current?.click()}>{t('classroom.import')}</Button>
      {error ? <p role="alert">{error}</p> : null}
      {state.incoming ? <section className={styles.notice}><h3>{state.incoming.title}</h3><p>{t('classroom.importReview')}</p><p>{t('classroom.incomingHint')}</p><div className={styles.actions}>{material ? <Button onClick={() => save()}>{t('classroom.save')}</Button> : null}<Button variant="primary" onClick={state.acceptIncoming}>{t('classroom.useIncoming')}</Button><Button onClick={state.discardIncoming}>{t('classroom.discardIncoming')}</Button></div></section> : null}
      {state.step === 0 ? <><h3>{t('classroom.choose')}</h3><div className={styles.templates}>{MATERIAL_KINDS.map(kind => <button type="button" key={kind} aria-pressed={brief.kind === kind} onClick={() => state.setBrief({ kind })}><strong>{MATERIAL_TEMPLATES[kind][language].title}</strong><span>{MATERIAL_TEMPLATES[kind][language].outcome}</span></button>)}</div></> : null}
      {state.step === 1 ? <><h3>{words.title}</h3><p>{words.outcome}</p><label>{t('classroom.language')}<select value={brief.language} onChange={event => state.setBrief({ language: event.target.value as 'en' | 'ru' })}><option value="ru">Русский</option><option value="en">English</option></select></label><label>{t('classroom.topic')}<input maxLength={180} value={brief.topic} placeholder={String(t('classroom.topicHint'))} onChange={event => state.setBrief({ topic: event.target.value })} /></label><label>{t('classroom.age')}<input maxLength={120} value={brief.age} placeholder={String(t('classroom.ageHint'))} onChange={event => state.setBrief({ age: event.target.value })} /></label><label>{t('classroom.objective')}<textarea aria-label={String(t('classroom.objective'))} rows={2} maxLength={1200} value={brief.objective} placeholder={String(t('classroom.objectiveHint'))} onChange={event => state.setBrief({ objective: event.target.value })} /></label><label>{t('classroom.source')}<textarea aria-label={String(t('classroom.source'))} rows={4} maxLength={8000} value={brief.source} placeholder={String(t('classroom.sourceHint'))} onChange={event => state.setBrief({ source: event.target.value })} /></label><p className={styles.hint}>{t('classroom.setupHint')}</p></> : null}
      {state.step === 2 && material ? <><p>{t('classroom.draftHint')}</p><label>{t('classroom.topic')}<input maxLength={180} value={material.title} onChange={event => { update({ title: event.target.value }); }} /></label><label>{t('classroom.age')}<input maxLength={120} value={material.age} onChange={event => update({ age: event.target.value })} /></label><label>{t('classroom.objective')}<textarea aria-label={String(t('classroom.objective'))} rows={2} maxLength={1200} value={material.objective} onChange={event => update({ objective: event.target.value })} /></label>
        <Button onClick={() => setPreview(!preview)} aria-pressed={preview}>{t('classroom.preview')}</Button>
        {preview ? <section className={styles.preview} aria-label={String(t('classroom.preview'))}><h2>{material.title}</h2><p>{material.objective}</p>{material.blocks.map(block => <article key={block.id}><h3>{block.heading}</h3><p>{block.text || t('classroom.previewEmpty')}</p></article>)}</section> : null}
        {material.blocks.map((block, index) => <fieldset key={block.id}><legend>{t('classroom.blockCount', { current: index + 1, total: material.blocks.length })}</legend><label>{t('classroom.heading')}<input maxLength={200} value={block.heading} onChange={event => updateBlock(block.id, { heading: event.target.value })} /></label><label>{t('classroom.text')}<textarea aria-label={String(t('classroom.text'))} rows={4} maxLength={4000} value={block.text} placeholder={MATERIAL_TEMPLATES[material.kind][material.language].prompts[index] ?? ''} onChange={event => updateBlock(block.id, { text: event.target.value })} /></label><details><summary>{t('classroom.teacherFields')}</summary><label>{t('classroom.answer')}<textarea aria-label={String(t('classroom.answer'))} rows={2} maxLength={2000} value={block.answer} onChange={event => updateBlock(block.id, { answer: event.target.value })} /></label><label>{t('classroom.notes')}<textarea aria-label={String(t('classroom.notes'))} rows={2} maxLength={2000} value={block.teacherNotes} onChange={event => updateBlock(block.id, { teacherNotes: event.target.value })} /></label></details><Button size="sm" disabled={material.blocks.length <= 1} onClick={() => update({ blocks: material.blocks.filter(item => item.id !== block.id) })}>{t('classroom.remove')}</Button></fieldset>)}
        <Button icon={<Plus size={16} />} disabled={material.blocks.length >= 24} onClick={() => update({ blocks: [...material.blocks, { id: crypto.randomUUID(), heading: '', text: '', answer: '', teacherNotes: '' }] })}>{t('classroom.add')}</Button><label>{t('classroom.sources')}<textarea aria-label={String(t('classroom.sources'))} rows={2} maxLength={4000} value={material.sources} onChange={event => update({ sources: event.target.value })} /></label><p className={styles.hint}>{t('classroom.fileHint')}</p>{!filled ? <p>{t('classroom.blank')}</p> : null}<div className={styles.actions}><Button disabled={!filled} onClick={() => save('pupil')}>{t('classroom.pupil')}</Button><Button disabled={!filled} onClick={() => save('teacher')}>{t('classroom.teacher')}</Button><Button variant="primary" onClick={() => save()}>{t('classroom.save')}</Button></div>
        <Button icon={<Sparkles size={16} />} onClick={ask}>{t(provider ? 'classroom.agent' : 'classroom.setup')}</Button>
        <div className={styles.new}>{confirmNew ? <><p>{t('classroom.newHint')}</p><Button onClick={() => { state.reset(); setConfirmNew(false); setPreview(false); }}>{t('classroom.newConfirm')}</Button><Button onClick={() => setConfirmNew(false)}>{t('classroom.cancel')}</Button></> : <Button onClick={() => setConfirmNew(true)}>{t('classroom.new')}</Button>}</div>
      </> : null}
    </div>
    <footer className={styles.footer}><Button onClick={state.close}>{t('classroom.close')}</Button>{state.step === 0 ? <Button variant="primary" onClick={() => state.setStep(1)}>{t('classroom.next')}</Button> : null}{state.step === 1 ? <><Button onClick={() => state.setStep(0)}>{t('classroom.back')}</Button><Button onClick={create}>{t('classroom.manual')}</Button><Button variant="primary" icon={<Sparkles size={16} />} onClick={ask}>{t(provider ? 'classroom.agent' : 'classroom.setup')}</Button></> : null}</footer>
  </DialogContent></DialogPortal></DialogRoot>;
}
