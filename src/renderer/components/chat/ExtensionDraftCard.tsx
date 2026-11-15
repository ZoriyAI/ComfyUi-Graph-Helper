/** Escaped source review and explicit ZIP download work in both desktop and a paired phone browser. */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExtensionDraft } from '../../../shared/contracts/extensions';
import Button from '../../ui/Button';
import styles from './ExtensionDraftCard.module.css';

export default function ExtensionDraftCard({ draftId, draft: initial }: { draftId?: string; draft?: ExtensionDraft }) {
  const { t } = useTranslation(); const [draft, setDraft] = useState<ExtensionDraft | null>(initial ?? null); const [loading, setLoading] = useState(!initial);
  const [path, setPath] = useState('README.md');
  useEffect(() => { if (initial || !draftId) return; let alive = true; void window.electronAPI.extensionDraft(draftId).catch(() => null).then((value) => { if (alive) { setDraft(value); setLoading(false); } }); return () => { alive = false; }; }, [draftId, initial]);
  const download = () => {
    if (!draft) return;
    const bytes = Uint8Array.from(atob(draft.archiveBase64), (c) => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const link = document.createElement('a'); link.href = url; link.download = `${draft.slug}.zip`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  if (!draft) return loading ? null : <p role="status">{t('extension.gone')}</p>;
  const file = draft.files.find((f) => f.path === path) ?? draft.files[0];
  return <section className={styles.card} data-extension-draft={draft.id}>
    <h3>{draft.name}</h3><p>{draft.purpose}</p><p className={styles.note}>{t('extension.sourceOnly')}</p>
    <details><summary>{t('extension.ports')}</summary><ul>{[...draft.inputs.map((p) => `${t('subgraphWizard.input')}: ${p.name} · ${p.type}`), ...draft.outputs.map((p) => `${t('subgraphWizard.output')}: ${p.name} · ${p.type}`)].map((p, i) => <li key={i}>{p}</li>)}</ul><ul>{draft.dependencies.map((d) => <li key={d}>{d}</li>)}</ul></details>
    <label>{t('extension.file')}<select value={file.path} onChange={(e) => setPath(e.target.value)}>{draft.files.map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}</select></label>
    <pre tabIndex={0}>{file.content}</pre><p className={styles.note}>{t('extension.install')}</p>
    <Button onClick={download}>{t('extension.download')}</Button>
  </section>;
}
