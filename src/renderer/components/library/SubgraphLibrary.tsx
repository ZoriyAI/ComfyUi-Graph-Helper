import React, { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SubgraphDefinition } from '../../../shared/contracts';
import { useGraphStore } from '../../state/graphState';
import { submitManual } from '../../services/commands/projection';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
import SearchField from '../../ui/SearchField';
import { showToast } from '../../ui/toastStore';
import { insertableSubgraphs } from './libraryModel';
import { placeNewNode } from '../graph/placeNode';
import { subgraphSummary } from '../graph/SubgraphSummary';
import styles from './Library.module.css';

/** The canvas workstream adds `subgraphs` to the graph store; read it defensively until then. */
const NONE: SubgraphDefinition[] = [];

function readSubgraphs(state: object): SubgraphDefinition[] {
  const value = (state as { subgraphs?: SubgraphDefinition[] }).subgraphs;
  return Array.isArray(value) ? value : NONE;
}

/** Subgraph definitions of this project, each insertable as an instance at the canvas centre. */
export default function SubgraphLibrary() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const subgraphs = useGraphStore((state) => readSubgraphs(state));
  const list = useMemo(() => insertableSubgraphs(subgraphs, query), [subgraphs, query]);

  const insert = async (definition: SubgraphDefinition) => {
    // The centre of the view, moved to the nearest spot where the new node covers nothing.
    const position = placeNewNode(null);
    try {
      const result = await submitManual(`library-insert-${crypto.randomUUID()}`, {
        type: 'insert-subgraph',
        definitionId: definition.id,
        x: position.x,
        y: position.y,
      });
      showToast(result.status === 'applied'
        ? { id: 'library-add', tone: 'success', title: String(t('library.inserted', { name: definition.name })), duration: 4000 }
        : { id: 'library-add', tone: 'error', title: String(t('library.insertFailed')) });
    } catch {
      showToast({ id: 'library-add', tone: 'error', title: String(t('library.insertFailed')) });
    }
  };

  if (subgraphs.length === 0) {
    return (
      <div className={styles.pane}>
        <EmptyState icon={<Layers size={20} />} title={String(t('library.emptySubgraphsTitle'))}>
          {t('library.emptySubgraphsBody')}
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
          label={String(t('library.searchSubgraphs'))}
          placeholder={String(t('library.searchSubgraphs'))}
          clearLabel={String(t('library.clear'))}
        />
      </div>
      <div className={styles.meta}><span role="status">{t('library.results', { count: list.length })}</span></div>
      <ul className={styles.subgraphs} aria-label={String(t('library.subgraphList'))}>
        {list.map((definition) => (
          <li key={definition.id} className={styles.subgraph}>
            <span className={styles.subgraphIcon} aria-hidden="true"><Layers size={16} /></span>
            <span className={styles.text}>
              <span className={styles.name}>{definition.name}</span>
              <span className={styles.sub}>{subgraphSummary((key, options) => (options ? String(t(key, options)) : String(t(key))), definition)}</span>
            </span>
            <Button
              variant="subtle"
              size="sm"
              aria-label={String(t('library.insertNamed', { name: definition.name }))}
              onClick={() => void insert(definition)}
            >
              {t('library.insert')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
