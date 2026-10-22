import { Fragment } from 'react';

/**
 * A tiny, safe Markdown renderer for the assistant's answers.
 *
 * The model writes markdown (**bold**, *italic*, `code`, bullet lists) and
 * the app used to render the raw asterisks, which read like a broken API
 * dump. This turns the common inline markers into React elements - no
 * dangerouslySetInnerHTML, so a model can never inject markup.
 *
 * Supported: **bold**, *italic*, `code`, bullet lists ("- " / "* "),
 * and numbered lists ("1. ").
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;

const renderInline = (text, keyPrefix) => {
  const parts = String(text).split(INLINE).filter((p) => p !== '' && p !== undefined);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} style={{
          fontFamily: 'ui-monospace, "Cascadia Mono", monospace',
          fontSize: '0.92em',
          background: 'var(--bg-card-hover)',
          border: '1px solid var(--border)',
          borderRadius: 5,
          padding: '1px 5px',
        }}>{part.slice(1, -1)}</code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
};

export function Markdown({ text }) {
  const lines = String(text ?? '').split('\n');
  const blocks = [];
  let list = null;
  let listType = 'ul';

  const flush = () => {
    if (!list) return;
    blocks.push(
      listType === 'ol'
        ? { type: 'ol', items: list }
        : { type: 'ul', items: list }
    );
    list = null;
  };

  lines.forEach((line) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (bullet) {
      if (listType !== 'ul' || !list) { flush(); list = []; listType = 'ul'; }
      list.push(bullet[1]);
      return;
    }
    if (numbered) {
      if (listType !== 'ol' || !list) { flush(); list = []; listType = 'ol'; }
      list.push(numbered[2]);
      return;
    }
    flush();
    if (line.trim() === '') {
      blocks.push({ type: 'spacer' });
    } else {
      blocks.push({ type: 'p', text: line });
    }
  });
  flush();

  return (
    <div>
      {blocks.map((b, i) => {
        if (b.type === 'spacer') return <div key={i} style={{ height: 8 }} />;
        if (b.type === 'ul' || b.type === 'ol') {
          const Tag = b.type === 'ol' ? 'ol' : 'ul';
          return (
            <Tag key={i} style={{ margin: '4px 0 8px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {b.items.map((item, j) => (
                <li key={j} style={{ fontSize: 14, lineHeight: 1.6 }}>{renderInline(item, `${i}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i} style={{ margin: '0 0 2px', fontSize: 14, lineHeight: 1.65 }}>{renderInline(b.text, i)}</p>
        );
      })}
    </div>
  );
}

export default Markdown;
