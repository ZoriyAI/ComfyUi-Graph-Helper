import React, { useMemo } from 'react';
import { parseMarkdownLite, type InlineToken } from './markdownLite';
import styles from './MarkdownLite.module.css';

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'code') return <code key={index} className={styles.code}>{token.text}</code>;
        if (token.type === 'strong') return <strong key={index}>{token.text}</strong>;
        return <React.Fragment key={index}>{token.text}</React.Fragment>;
      })}
    </>
  );
}

/** Chat text with paragraphs, lists, and code. Rendered as elements; the text is never parsed as HTML. */
export default function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdownLite(text), [text]);
  return (
    <div className={`${styles.root}${className ? ` ${className}` : ''}`}>
      {blocks.map((block, index) => {
        if (block.type === 'code') return <pre key={index} className={styles.pre}>{block.text}</pre>;
        if (block.type === 'list') {
          const items = block.items.map((item, itemIndex) => <li key={itemIndex}><Inline tokens={item} /></li>);
          return block.ordered
            ? <ol key={index} start={block.start}>{items}</ol>
            : <ul key={index}>{items}</ul>;
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                <Inline tokens={line} />
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
