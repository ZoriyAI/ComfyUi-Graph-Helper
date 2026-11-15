/**
 * The Help dialog: reads the bundled wiki through main (helpTree, helpPage, helpSearch) and shows it with
 * MarkdownLite, so help works offline and matches the installed version. CommandDialogs renders it; menus, About and
 * links in the app open a page through uiState's helpRequest. tests/unit/aboutHelp.test.ts covers readerText.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search } from 'lucide-react';
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import { cx } from '../../ui/cx';
import MarkdownLite from '../chat/MarkdownLite';
import { useUiStore } from '../../state/uiState';
import { resolveWikiLink, WHATS_NEW_PAGE } from '../../../shared/help/contextHelp';
import type { HelpPage, HelpSearchHit, HelpTree } from '../../../shared/contracts/about';
import styles from './HelpReader.module.css';

/**
 * What the reader shows of a page: no language link (the reader follows the interface language), no comments for
 * writers, and no first `#` title (the dialog shows it).
 */
export function readerText(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  // The first line of a wiki page may be the link to the same page in the other language.
  if (/^\[(English|Русский)\]\([^)]*\)\s*$/.test(lines[0] ?? '')) lines.shift();
  return lines.join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#\s+.*\n+/m, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Help: the wiki in the interface language, with the sections on the left, links between pages and a search. */
export default function HelpReader({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  // The wiki exists in English and Russian only; any other interface language reads the Russian pages.
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const request = useUiStore((state) => state.helpRequest);
  const [tree, setTree] = useState<HelpTree | null>(null);
  const [page, setPage] = useState<HelpPage | null>(null);
  const [current, setCurrent] = useState<string>('Home');
  // The pages visited before the current one, for the Back button.
  const [back, setBack] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<HelpSearchHit[] | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const api = window.electronAPI;

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    void api?.helpTree?.(language).then((value) => { if (alive) setTree(value); }).catch(() => undefined);
    return () => { alive = false; };
  }, [open, language, api]);

  // A new request (menu, About, a link in the app) starts a fresh trail.
  useEffect(() => {
    if (!request) return;
    setCurrent(request.page);
    setBack([]);
    setQuery('');
    setHits(null);
  }, [request]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setPage(null);
    void api?.helpPage?.(current, language).then((value) => {
      if (!alive) return;
      setPage(value);
      body.current?.scrollTo({ top: 0 });
    }).catch(() => { if (alive) setPage({ ok: false, error: 'missing' }); });
    return () => { alive = false; };
  }, [open, current, language, api]);

  useEffect(() => {
    const words = query.trim();
    if (!words) {
      setHits(null);
      return undefined;
    }
    let alive = true;
    // Wait for a short pause in typing (180 ms) before asking main to search.
    const timer = setTimeout(() => {
      void api?.helpSearch?.(words, language).then((value) => { if (alive) setHits(value); }).catch(() => { if (alive) setHits([]); });
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, language, api]);

  const go = useCallback((ref: string) => {
    setBack((trail) => (ref === current ? trail : [...trail, current]));
    setCurrent(ref);
  }, [current]);

  const onLink = useCallback((target: string) => {
    const ref = resolveWikiLink(current, target);
    if (ref) go(ref);
  }, [current, go]);

  const goBack = () => {
    setBack((trail) => {
      const previous = trail[trail.length - 1];
      if (previous) setCurrent(previous);
      return trail.slice(0, -1);
    });
  };

  // Only the folder of the open page shows its pages in the side list.
  const folderOfCurrent = current.includes('/') ? current.split('/')[0] : null;
  const text = useMemo(() => (page && page.ok ? readerText(page.text) : ''), [page]);
  const title = current === WHATS_NEW_PAGE
    ? String(t('helpReader.whatsNew'))
    : page && page.ok ? page.title : String(t('helpReader.title'));

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, 'help-reader-dialog')} aria-describedby={undefined} data-help-page={current}>
          <header className={styles.header}>
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={goBack} disabled={back.length === 0} aria-label={String(t('helpReader.back'))} className={styles.back} />
            <DialogTitle className={styles.title}>{title}</DialogTitle>
          </header>
          <div className={styles.columns}>
            <nav className={styles.side} aria-label={String(t('helpReader.sections'))}>
              <label className={styles.search}>
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  placeholder={String(t('helpReader.searchPlaceholder'))}
                  aria-label={String(t('helpReader.searchPlaceholder'))}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className={styles.list} data-help-list>
                {hits !== null ? (
                  hits.length === 0 ? <p className={styles.note}>{t('helpReader.noResults')}</p> : (
                    <ul className={styles.hits} data-help-results>
                      {hits.map((hit) => (
                        <li key={hit.ref}>
                          <button type="button" className={cx(styles.item, hit.ref === current && styles.active)} onClick={() => go(hit.ref)}>
                            <span className={styles.itemTitle}>{hit.title}</span>
                            <span className={styles.snippet}>{hit.snippet}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : tree ? (
                  <ul className={styles.tree}>
                    <li>
                      <button type="button" className={cx(styles.item, current === 'Home' && styles.active)} onClick={() => go('Home')}>{tree.home.title}</button>
                    </li>
                    {tree.folders.map((folder) => {
                      const expanded = folderOfCurrent === folder.folder;
                      return (
                        <li key={folder.folder}>
                          <button
                            type="button"
                            className={cx(styles.item, styles.folder, current === folder.ref && styles.active)}
                            aria-expanded={expanded}
                            onClick={() => go(folder.ref)}
                          >
                            {folder.title}
                          </button>
                          {expanded ? (
                            <ul className={styles.pages}>
                              {folder.pages.map((item) => (
                                <li key={item.ref}>
                                  <button type="button" className={cx(styles.item, styles.page, current === item.ref && styles.active)} onClick={() => go(item.ref)}>{item.title}</button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                    <li>
                      <button type="button" className={cx(styles.item, current === WHATS_NEW_PAGE && styles.active)} onClick={() => go(WHATS_NEW_PAGE)}>{t('helpReader.whatsNew')}</button>
                    </li>
                  </ul>
                ) : null}
              </div>
            </nav>
            <div className={styles.body} ref={body} tabIndex={0} data-help-body>
              {page === null
                ? <p className={styles.note}>{t('helpReader.loading')}</p>
                : !page.ok
                  ? <p className={styles.note}>{t('helpReader.missing')}</p>
                  : <MarkdownLite text={text} onLink={onLink} />}
            </div>
          </div>
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('menu.close')}</Button>
            </DialogClose>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
