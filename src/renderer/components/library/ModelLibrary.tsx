import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, MessageCircleQuestion, SearchX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { BaseModelFamily, ModelSummary } from '../../../shared/contracts';
import { familyLabelKey } from '../../../shared/knowledge/labels';
import { requestAsk } from '../../services/ask';
import { useDockStore } from '../../state/dockState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useUiStore } from '../../state/uiState';
import { FamilyBadge, KindBadge } from '../../ui/Badge';
import Button from '../../ui/Button';
import { ContextMenuContent, ContextMenuItem, ContextMenuRoot, ContextMenuTrigger } from '../../ui/ContextMenu';
import EmptyState from '../../ui/EmptyState';
import IconButton from '../../ui/IconButton';
import SearchField from '../../ui/SearchField';
import SelectField from '../../ui/SelectField';
import Skeleton from '../../ui/Skeleton';
import { runSyncNow } from '../sync/SyncIndicator';
import { clearModelDetailCache, useTriggerCounts } from './modelDetails';
import {
  filterModels,
  fittingLoras,
  formatBytes,
  inKindGroup,
  KIND_GROUPS,
  kindGroupCounts,
  MODEL_DRAG_TYPE,
  modelFacets,
  modelKey,
  sortModels,
  type KindGroup,
  type ModelSort,
} from './libraryModel';
import ModelCard from './ModelCard';
import VirtualList from './VirtualList';
import styles from './Library.module.css';

const ROW_HEIGHT = 52;
const SEARCH_LIMIT = 10000;

/** Sends a question about one model file to the chat, with the model as the turn's object. */
export function askAboutModel(model: Pick<ModelSummary, 'directory' | 'name'>, message: string, language: 'en' | 'ru') {
  useDockStore.getState().show('chat');
  requestAsk({
    context: {
      intent: 'ask',
      objectRef: { kind: 'model', id: modelKey(model), directory: model.directory, name: model.name },
      selection: [],
      language,
    },
    message,
  });
}

/**
 * Model files from the synced catalog: kind chips with counts, a family select and an order, then the list.
 * A click (or Enter) opens the model card next to the rail; the card explains the file and puts it to work.
 */
export default function ModelLibrary() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<BaseModelFamily | ''>('');
  const [group, setGroup] = useState<KindGroup>('all');
  const [sort, setSort] = useState<ModelSort>('name');
  /** "LoRAs that fit this base model", set from a checkpoint's card; replaces the kind and family filters. */
  const [fitsFor, setFitsFor] = useState<ModelSummary | null>(null);
  const [open, setOpen] = useState<ModelSummary | null>(null);
  const [all, setAll] = useState<ModelSummary[] | null>(null);
  const [found, setFound] = useState<ModelSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState<ModelSummary[]>([]);
  const syncPart = useKnowledgeStore((state) => `${state.sync?.lastSyncAt ?? 0}:${state.sync?.counts.models ?? 0}:${state.sync?.counts.enrichedModels ?? 0}`);
  const catalogVersion = useUiStore((state) => state.catalogVersion);
  const syncStamp = `${syncPart}:${catalogVersion}`;

  useEffect(() => {
    clearModelDetailCache();
    let cancelled = false;
    window.electronAPI.searchModels({ query: '', limit: SEARCH_LIMIT })
      .then((list) => {
        if (cancelled) return;
        setAll(list);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAll([]);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [syncStamp]);

  // The catalog search ranks by the query and narrows by family; kind chips and the order apply on top,
  // so the chips can show how many files of each kind the query and family leave.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      window.electronAPI.searchModels({ query: query.trim(), baseModel: family || undefined, limit: SEARCH_LIMIT })
        .then((list) => {
          if (!cancelled) setFound(list);
        })
        .catch(() => {
          if (!cancelled) setFound([]);
        });
    }, query ? 120 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, family, syncStamp]);

  // A card whose file left the catalog after a sync closes.
  useEffect(() => {
    if (open && all && !all.some((model) => modelKey(model) === modelKey(open))) setOpen(null);
  }, [all, open]);

  const facets = useMemo(() => modelFacets(all ?? []), [all]);
  const counts = useMemo(() => kindGroupCounts(found ?? []), [found]);
  const rows = useMemo(() => {
    if (fitsFor) return sortModels(filterModels(fittingLoras(fitsFor, all ?? []), query, { directory: '', baseModel: '', kind: '' }), sort);
    return sortModels((found ?? []).filter((model) => inKindGroup(model, group)), sort);
  }, [fitsFor, all, found, query, group, sort]);
  const triggerCounts = useTriggerCounts(visible);
  const allLabel = String(t('library.filterAll'));
  const filtered = family !== '' || group !== 'all' || fitsFor !== null;
  const openKey = open ? modelKey(open) : null;

  const ask = (model: ModelSummary, message: string) => askAboutModel(model, message, language);
  const resetFilters = () => {
    setFamily('');
    setGroup('all');
    setFitsFor(null);
  };

  if (all !== null && all.length === 0) {
    return (
      <div className={styles.pane}>
        <EmptyState
          icon={<Boxes size={20} />}
          title={String(t('library.emptyModelsTitle'))}
          actions={<Button variant="subtle" size="sm" onClick={() => void runSyncNow()}>{t('sync.now')}</Button>}
        >
          {failed ? t('library.loadFailed') : t('library.emptyModelsBody')}
        </EmptyState>
      </div>
    );
  }

  let empty: React.ReactNode = null;
  if (found !== null && rows.length === 0) {
    empty = query.trim() !== '' && (found.length === 0 || !filtered)
      ? (
        <EmptyState
          icon={<SearchX size={20} />}
          title={String(t('library.noMatchTitle'))}
          actions={<Button variant="subtle" size="sm" onClick={() => setQuery('')}>{t('library.clear')}</Button>}
        >
          {t('library.noMatchBody', { query: query.trim() })}
        </EmptyState>
      )
      : (
        <EmptyState
          icon={<SearchX size={20} />}
          title={String(t('library.filteredTitle'))}
          actions={<Button variant="subtle" size="sm" onClick={resetFilters}>{t('library.resetFilters')}</Button>}
        >
          {t('library.filteredBody')}
        </EmptyState>
      );
  }

  return (
    <div className={styles.pane}>
      <div className={styles.controls}>
        <SearchField
          value={query}
          onValueChange={setQuery}
          label={String(t('library.searchModels'))}
          placeholder={String(t('library.searchModels'))}
          clearLabel={String(t('library.clear'))}
        />
        {fitsFor ? (
          <div className={styles.fitsBanner} role="status">
            <span className={styles.fitsText} title={fitsFor.name}>{t('library.fitsFilter', { name: fitsFor.name })}</span>
            <IconButton size="sm" label={String(t('library.fitsFilterClear'))} onClick={() => setFitsFor(null)}>
              <X size={14} aria-hidden="true" />
            </IconButton>
          </div>
        ) : (
          <>
            <div className={styles.kindChips} role="radiogroup" aria-label={String(t('library.kindChips'))}>
              {KIND_GROUPS.filter((item) => item === 'all' || item === group || counts[item] > 0).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={group === item}
                  className={styles.kindChip}
                  data-on={group === item ? 'true' : 'false'}
                  onClick={() => setGroup(item)}
                >
                  {t(`library.kindGroup.${item}`)}
                  <span className={styles.kindCount}>{counts[item]}</span>
                </button>
              ))}
            </div>
            <div className={styles.filters}>
              <SelectField
                label={String(t('library.filterFamily'))}
                value={family}
                options={[{ value: '', label: allLabel }, ...facets.families.map((facet) => ({ value: facet.value, label: `${String(t(familyLabelKey(facet.value)))} (${facet.count})` }))]}
                onChange={(next) => setFamily(next as BaseModelFamily | '')}
              />
              <SelectField
                label={String(t('library.sort'))}
                value={sort}
                options={[{ value: 'name', label: String(t('library.sortName')) }, { value: 'size', label: String(t('library.sortSize')) }]}
                onChange={(next) => setSort(next === 'size' ? 'size' : 'name')}
              />
            </div>
          </>
        )}
      </div>
      {found === null || all === null ? (
        <div className={styles.controls} aria-busy="true">
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : empty ?? (
        <>
          <div className={styles.meta}>
            <span role="status">{t('library.results', { count: rows.length })}</span>
          </div>
          {!open ? <p className={styles.metaHint}>{t('library.cardHint')}</p> : null}
          <VirtualList<ModelSummary>
            id="model-library-list"
            className={styles.list}
            rows={rows}
            rowHeight={ROW_HEIGHT}
            label={String(t('library.modelList'))}
            getKey={modelKey}
            onActivate={(model) => setOpen(model)}
            onRowKey={(_model, event) => {
              // Escape in the list closes the card the keyboard opened with Enter.
              if (event.key !== 'Escape' || !open) return false;
              setOpen(null);
              return true;
            }}
            onRangeChange={(start, end) => setVisible(rows.slice(start, end))}
            renderRow={(model, { active }) => {
              const triggers = triggerCounts.get(modelKey(model));
              const isOpen = modelKey(model) === openKey;
              return (
                <ContextMenuRoot>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`${styles.row} ${styles.modelRow}`}
                      data-active={active ? 'true' : 'false'}
                      data-open={isOpen ? 'true' : 'false'}
                      draggable
                      title={`${model.directory}/${model.name}`}
                      onClick={() => setOpen(isOpen ? null : model)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(MODEL_DRAG_TYPE, JSON.stringify({ directory: model.directory, name: model.name }));
                        event.dataTransfer.setData('text/plain', model.name);
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <span
                        className={styles.detailDot}
                        data-on={model.enriched ? 'true' : 'false'}
                        role="img"
                        aria-label={String(t(model.enriched ? 'library.enriched' : 'library.notEnriched'))}
                        title={String(t(model.enriched ? 'library.enriched' : 'library.notEnriched'))}
                      />
                      <span className={styles.text}>
                        <span className={styles.name}>{model.name}</span>
                        <span className={styles.badges}>
                          <KindBadge kind={model.kind} short />
                          {model.baseModel !== 'unknown' ? <FamilyBadge family={model.baseModel} /> : null}
                          <span className={styles.meta2}>
                            {formatBytes(model.sizeBytes, language)}
                            {triggers ? ` · ${String(t('library.triggerWords', { count: triggers }))}` : ''}
                          </span>
                          {/* Quiet and last: an unknown family is a gap in the data, not a fact to badge. */}
                          {model.baseModel === 'unknown'
                            ? <span className={styles.familyUnknown}>{t('library.familyUnknownShort')}</span>
                            : null}
                        </span>
                      </span>
                      <IconButton
                        className={styles.ask}
                        size="sm"
                        tabIndex={-1}
                        label={String(t('library.askModel'))}
                        onClick={(event) => {
                          event.stopPropagation();
                          ask(model, String(t('library.askModelMessage', { name: model.name })));
                        }}
                      >
                        <MessageCircleQuestion size={14} aria-hidden="true" />
                      </IconButton>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem icon={<MessageCircleQuestion size={14} />} onSelect={() => ask(model, String(t('library.askModelMessage', { name: model.name })))}>
                      {t('library.askModel')}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => ask(model, String(t('library.askCompatibleMessage', { name: model.name })))}>
                      {t('library.askCompatible')}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenuRoot>
              );
            }}
          />
        </>
      )}
      {open && all ? (
        <ModelCard
          model={open}
          all={all}
          onClose={() => setOpen(null)}
          onShowLoras={(base) => {
            setFitsFor(base);
            setOpen(null);
          }}
          onAsk={(message) => ask(open, message)}
        />
      ) : null}
    </div>
  );
}
