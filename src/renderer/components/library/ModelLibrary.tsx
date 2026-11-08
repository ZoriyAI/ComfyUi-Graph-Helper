import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, MessageCircleQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { BaseModelFamily, ModelKind, ModelSummary } from '../../../shared/contracts';
import { familyLabelKey, kindLabelKey } from '../../../shared/knowledge/labels';
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
import { formatBytes, MODEL_DRAG_TYPE, modelFacets, modelKey, type ModelFilters } from './libraryModel';
import VirtualList from './VirtualList';
import styles from './Library.module.css';

const ROW_HEIGHT = 52;
const SEARCH_LIMIT = 10000;
const NO_FILTERS: ModelFilters = { directory: '', baseModel: '', kind: '' };

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

/** Model files from the synced catalog with folder / family / kind filters. Enter asks about a model. */
export default function ModelLibrary() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ModelFilters>(NO_FILTERS);
  const [all, setAll] = useState<ModelSummary[] | null>(null);
  const [models, setModels] = useState<ModelSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState<ModelSummary[]>([]);
  const syncPart = useKnowledgeStore((state) => `${state.sync?.lastSyncAt ?? 0}:${state.sync?.counts.models ?? 0}:${state.sync?.counts.enrichedModels ?? 0}`);
  const catalogVersion = useUiStore((state) => state.catalogVersion);
  const syncStamp = `${syncPart}:${catalogVersion}`;

  useEffect(() => {
    clearModelDetailCache();
    let cancelled = false;
    window.electronAPI.searchModels({ query: '', limit: SEARCH_LIMIT })
      .then((found) => {
        if (!cancelled) setAll(found);
      })
      .catch(() => {
        if (!cancelled) setAll([]);
      });
    return () => {
      cancelled = true;
    };
  }, [syncStamp]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      window.electronAPI.searchModels({
        query: query.trim(),
        directory: filters.directory || undefined,
        baseModel: filters.baseModel || undefined,
        kind: filters.kind || undefined,
        limit: SEARCH_LIMIT,
      })
        .then((found) => {
          if (cancelled) return;
          setModels(found);
          setFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          setModels([]);
          setFailed(true);
        });
    }, query ? 120 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, filters, syncStamp]);

  const facets = useMemo(() => modelFacets(all ?? []), [all]);
  const triggerCounts = useTriggerCounts(visible);
  const allLabel = String(t('library.filterAll'));
  const count = models?.length ?? 0;

  const ask = (model: ModelSummary, key: 'library.askModelMessage' | 'library.askCompatibleMessage') => {
    askAboutModel(model, String(t(key, { name: model.name })), language);
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
        <div className={styles.filters}>
          <SelectField
            label={String(t('library.filterDirectory'))}
            value={filters.directory}
            options={[{ value: '', label: allLabel }, ...facets.directories.map((facet) => ({ value: facet.value, label: `${facet.value} (${facet.count})` }))]}
            onChange={(directory) => setFilters((current) => ({ ...current, directory }))}
          />
          <SelectField
            label={String(t('library.filterFamily'))}
            value={filters.baseModel}
            options={[{ value: '', label: allLabel }, ...facets.families.map((facet) => ({ value: facet.value, label: `${String(t(familyLabelKey(facet.value)))} (${facet.count})` }))]}
            onChange={(baseModel) => setFilters((current) => ({ ...current, baseModel: baseModel as BaseModelFamily | '' }))}
          />
          <SelectField
            label={String(t('library.filterKind'))}
            value={filters.kind}
            options={[{ value: '', label: allLabel }, ...facets.kinds.map((facet) => ({ value: facet.value, label: `${String(t(kindLabelKey(facet.value)))} (${facet.count})` }))]}
            onChange={(kind) => setFilters((current) => ({ ...current, kind: kind as ModelKind | '' }))}
          />
        </div>
      </div>
      {models === null ? (
        <div className={styles.controls} aria-busy="true">
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : (
        <>
          <div className={styles.meta}>
            <span role="status">{t('library.results', { count })}</span>
          </div>
          {count === 0 ? <p className={styles.meta}>{t('knowledge.noResults')}</p> : (
            <VirtualList<ModelSummary>
              id="model-library-list"
              className={styles.list}
              rows={models}
              rowHeight={ROW_HEIGHT}
              label={String(t('library.modelList'))}
              getKey={modelKey}
              onActivate={(model) => ask(model, 'library.askModelMessage')}
              onRangeChange={(start, end) => setVisible(models.slice(start, end))}
              renderRow={(model, { active }) => {
                const triggers = triggerCounts.get(modelKey(model));
                return (
                  <ContextMenuRoot>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`${styles.row} ${styles.modelRow}`}
                        data-active={active ? 'true' : 'false'}
                        draggable
                        title={`${model.directory}/${model.name}`}
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
                            <FamilyBadge family={model.baseModel} />
                            <KindBadge kind={model.kind} />
                            <span className={styles.meta2}>
                              {formatBytes(model.sizeBytes, language)}
                              {triggers ? ` · ${String(t('library.triggerWords', { count: triggers }))}` : ''}
                            </span>
                          </span>
                        </span>
                        <IconButton
                          className={styles.ask}
                          size="sm"
                          tabIndex={-1}
                          label={String(t('library.askModel'))}
                          onClick={(event) => {
                            event.stopPropagation();
                            ask(model, 'library.askModelMessage');
                          }}
                        >
                          <MessageCircleQuestion size={14} aria-hidden="true" />
                        </IconButton>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem icon={<MessageCircleQuestion size={14} />} onSelect={() => ask(model, 'library.askModelMessage')}>
                        {t('library.askModel')}
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => ask(model, 'library.askCompatibleMessage')}>
                        {t('library.askCompatible')}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenuRoot>
                );
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
