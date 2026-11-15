import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { showToast } from '../../ui/toastStore';
import { parseMarkdownLite, type InlineToken } from './markdownLite';
import styles from './MarkdownLite.module.css';

/** Characters of code that fit one line of the narrowest panel the app has. */
const SHORT_CODE = 28;

/** A link's words; a click copies its address (the app opens no page). */
function LinkWords({ text, address }: { text: string; address: string }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.link}
      title={String(t('chat.linkCopyHint', { address }))}
      onClick={() => {
        void navigator.clipboard?.writeText(address).then(
          () => showToast({ id: 'chat-link-copied', title: String(t('explain.copied')), description: address, tone: 'success', duration: 2500 }),
          () => undefined,
        );
      }}
    >
      {text}
      <Link2 size={12} aria-hidden="true" />
    </button>
  );
}

/** Set by MarkdownLite when the text may carry relative links (the help reader). */
const LinkContext = React.createContext<((target: string) => void) | null>(null);

function Inline({ tokens }: { tokens: InlineToken[] }) {
  const onLink = React.useContext(LinkContext);
  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'link') return <LinkWords key={index} text={token.text} address={token.address} />;
        if (token.type === 'page') {
          return onLink
            ? <button key={index} type="button" className={styles.link} data-link={token.target} onClick={() => onLink(token.target)}>{token.text}</button>
            : <React.Fragment key={index}>{token.text}</React.Fragment>;
        }
        // A short piece of code (a field name, a weight) is marked: where there is room for it, a panel may keep it whole.
        if (token.type === 'code') return <code key={index} className={styles.code} data-short={token.text.length <= SHORT_CODE ? 'true' : undefined}>{token.text}</code>;
        if (token.type === 'strong') return <strong key={index}>{token.text}</strong>;
        if (token.type === 'em') return <em key={index}>{token.text}</em>;
        return <React.Fragment key={index}>{token.text}</React.Fragment>;
      })}
    </>
  );
}

function Lines({ lines }: { lines: InlineToken[][] }) {
  return (
    <>
      {lines.map((line, lineIndex) => (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 ? <br /> : null}
          <Inline tokens={line} />
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * Chat text with paragraphs, headings, lists, quotes, tables and code. Rendered as elements; the text is never
 * parsed as HTML. A table keeps to the width of the panel: its cells wrap.
 */
export default function MarkdownLite({ text, className, onLink }: { text: string; className?: string; /** Relative links become buttons that call this (help reader only). */ onLink?: (target: string) => void }) {
  const links = Boolean(onLink);
  const blocks = useMemo(() => parseMarkdownLite(text, { links }), [text, links]);
  return (
    <LinkContext.Provider value={onLink ?? null}>
    <div className={`${styles.root}${className ? ` ${className}` : ''}`}>
      {blocks.map((block, index) => {
        if (block.type === 'code') return <pre key={index} className={styles.pre}>{block.text}</pre>;
        if (block.type === 'heading') return <p key={index} className={styles.heading} data-level={block.level} role="heading" aria-level={block.level + 2}><Inline tokens={block.tokens} /></p>;
        if (block.type === 'rule') return <hr key={index} className={styles.rule} />;
        if (block.type === 'quote') return <blockquote key={index} className={styles.quote}><Lines lines={block.lines} /></blockquote>;
        if (block.type === 'table') {
          return (
            <div key={index} className={styles.tableWrap}>
              {/* Three columns and more do not fit a narrow chat as columns: there each row becomes a small card. */}
              <table className={styles.table} data-wide={block.header.length >= 3 ? 'true' : undefined}>
                <thead>
                  <tr>{block.header.map((cell, cellIndex) => <th key={cellIndex} scope="col"><Inline tokens={cell} /></th>)}</tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} data-label={block.header[cellIndex]?.map((token) => token.text).join('') ?? ''}><Inline tokens={cell} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'list') {
          const items = block.items.map((item, itemIndex) => <li key={itemIndex}><Inline tokens={item} /></li>);
          return block.ordered
            ? <ol key={index} start={block.start}>{items}</ol>
            : <ul key={index}>{items}</ul>;
        }
        return <p key={index}><Lines lines={block.lines} /></p>;
      })}
    </div>
    </LinkContext.Provider>
  );
}
