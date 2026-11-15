/**
 * The model picker body of a model field: the person's files for that field, compared with the base model the node
 * is fed from, with family, kind and size. FieldControl.tsx (ComboControl) renders it when the field has a model
 * folder. The list and the fit marks come from main each time the picker opens.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { BaseModelFamily, FieldModelOption, FieldModelsResult } from '../../../shared/contracts/knowledge';
import { familyLabelKey } from '../../../shared/knowledge/labels';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import { FamilyBadge, KindBadge } from '../../ui/Badge';
import { cx } from '../../ui/cx';
import { formatBytes } from '../library/libraryModel';
import { baseName, folderOf } from './fieldModel';
import styles from './FieldControl.module.css';

/** Folders of base models; the same set main uses to pick the reference (main/knowledge/fieldModels.ts). */
const BASE_DIRECTORIES = new Set(['checkpoints', 'diffusion_models', 'unet']);

/** The load state of the picker's files; `ready` carries main's answer. */
export type FieldModelsState =
  | { state: 'idle' | 'loading' | 'error' }
  | { state: 'ready'; result: FieldModelsResult };

/**
 * The person's files for one model field, asked from main each time the list opens (the graph upstream may have
 * changed since). Nothing is asked while the list is closed.
 */
export function useFieldModels(nodeId: string, input: string, enabled: boolean): FieldModelsState {
  const [state, setState] = useState<FieldModelsState>({ state: 'idle' });
  useEffect(() => {
    if (!enabled) return undefined;
    const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!bridge?.fieldModels) {
      setState({ state: 'error' });
      return undefined;
    }
    let live = true;
    setState({ state: 'loading' });
    bridge.fieldModels({ projectId: DESKTOP_PROJECT_ID, nodeId, input })
      .then((result) => { if (live) setState({ state: 'ready', result }); })
      .catch(() => { if (live) setState({ state: 'error' }); });
    return () => { live = false; };
  }, [enabled, nodeId, input]);
  return state;
}

interface ModelListProps {
  listId: string;
  listRef: React.RefObject<HTMLUListElement>;
  state: FieldModelsState;
  /** Values after the filter, in display order. */
  shown: string[];
  /** The plain options, used while the files load or when main could not join them. */
  fallback: string[];
  current: string;
  /** The catalog folder of the field (spec.modelDirectory): a base-model field is compared with LoRAs below it. */
  directory?: string;
  active: number;
  name: string;
  onHover: (index: number) => void;
  onChoose: (value: string) => void;
}

/**
 * The model picker body: what the files are compared with, then one row per file with its name, folder, family and
 * kind badges, size and a fit mark. Files that do not fit are already last (main orders them) and say why.
 */
export function ModelList({ listId, listRef, state, shown, fallback, current, directory, active, name, onHover, onChoose }: ModelListProps) {
  const { t, i18n } = useTranslation();
  const result = state.state === 'ready' && state.result.models ? state.result : null;
  const rows = new Map<string, FieldModelOption>((result?.options ?? []).map((row) => [row.value, row]));
  const family = (value: BaseModelFamily) => String(t(familyLabelKey(value)));
  // The same size format as the model library, so a file reads the same in both places.
  const language = (i18n.language || 'ru').toLowerCase().startsWith('en') ? 'en' : 'ru';
  const reference = result?.reference ?? null;
  const baseField = BASE_DIRECTORIES.has(directory ?? '');
  const fitText = (row: FieldModelOption): { text: string; tone: 'ok' | 'warn' | 'bad' | 'faint' } | null => {
    if (!reference) return null;
    if (row.fit === 'fits') return { text: String(t('field.models.fits')), tone: 'ok' };
    if (row.fit === 'related') return { text: String(t('field.models.related', { family: family(row.baseModel) })), tone: 'warn' };
    if (row.fit === 'differs') return { text: String(t('field.models.differs', { model: family(row.baseModel), reference: family(reference.baseModel) })), tone: 'bad' };
    return { text: String(t('field.models.unknown')), tone: 'faint' };
  };
  return (
    <>
      <p className={styles.modelHead} role="status">
        {state.state === 'loading' ? t('field.models.loading')
          : reference ? t('field.models.reference', { name: baseName(reference.name), family: family(reference.baseModel) })
            : result ? t(baseField ? 'field.models.noReferenceBase' : 'field.models.noReference') : null}
      </p>
      <ul ref={listRef} id={listId} role="listbox" tabIndex={-1} aria-label={name} className={cx(styles.list, styles.modelList)}>
        {shown.length === 0 ? (
          <li className={styles.empty}>{fallback.length === 0 ? t('field.models.empty') : t('field.noMatch')}</li>
        ) : shown.map((value, index) => {
          const row = rows.get(value);
          const fit = row ? fitText(row) : null;
          const folder = folderOf(value);
          return (
            <li
              key={value}
              id={`${listId}-${index}`}
              data-index={index}
              data-fit={row?.fit}
              role="option"
              aria-selected={value === current}
              className={cx(styles.option, styles.modelOption, index === active && styles.optionActive, row?.fit === 'differs' && styles.optionDiffers)}
              onMouseMove={() => onHover(index)}
              onClick={() => onChoose(value)}
            >
              <span className={styles.modelMain}>
                <span className={styles.modelName} title={value}>{baseName(value)}</span>
                {folder ? <span className={styles.modelFolder}>{folder}</span> : null}
                {fit ? <span className={cx(styles.fit, styles[`fit_${fit.tone}`])}>{fit.text}</span> : null}
              </span>
              {row ? (
                <span className={styles.modelMeta}>
                  {row.baseModel !== 'unknown' ? <FamilyBadge family={row.baseModel} /> : null}
                  {row.kind !== 'other' ? <KindBadge kind={row.kind} short /> : null}
                  {row.sizeBytes ? <span className={styles.size}>{formatBytes(row.sizeBytes, language)}</span> : null}
                </span>
              ) : null}
              {value === current ? <Check size={14} aria-hidden="true" className={styles.check} /> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
