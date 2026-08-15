import type { ReactNode } from 'react';

// A small, dependency-free markdown renderer for AI chat messages — headings,
// bold/italic/inline-code, bullet + numbered lists, pipe tables, fenced code
// blocks, paragraphs with soft line breaks. Mirrors the codebase's existing
// hand-rolled text parsing (lib/parseAiSummary.ts) rather than pulling in a
// full markdown library for a bounded, LLM-generated input shape.

interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (m.index > lastIndex) tokens.push({ text: text.slice(lastIndex, m.index) });
    const chunk = m[0];
    if (chunk.startsWith('**')) tokens.push({ text: chunk.slice(2, -2), bold: true });
    else if (chunk.startsWith('`')) tokens.push({ text: chunk.slice(1, -1), code: true });
    else tokens.push({ text: chunk.slice(1, -1), italic: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) });
  return tokens;
}

function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => {
        if (t.code) return <code key={i} className="bg-slate-100 text-slate-800 rounded px-1 py-0.5 text-[0.85em] font-mono">{t.text}</code>;
        if (t.bold) return <strong key={i} className="font-semibold text-slate-900">{t.text}</strong>;
        if (t.italic) return <em key={i}>{t.text}</em>;
        return <span key={i}>{t.text}</span>;
      })}
    </>
  );
}

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const splitRow = (line: string) =>
  line.split('|').map((c) => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));

export function renderMarkdown(source: string): ReactNode {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { codeLines.push(lines[i]); i++; }
      i++;
      blocks.push(
        <pre key={key++} className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto text-xs my-2">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const cls = level <= 2 ? 'text-sm font-bold text-slate-900 mt-3 mb-1.5' : 'text-sm font-semibold text-slate-800 mt-2 mb-1';
      blocks.push(<p key={key++} className={cls}><InlineText text={heading[2]} /></p>);
      i++;
      continue;
    }

    if (line.includes('|') && lines[i + 1] && TABLE_SEPARATOR.test(lines[i + 1])) {
      const headerCells = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto my-2">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr>{headerCells.map((c, ci) => <th key={ci} className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-700"><InlineText text={c} /></th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-slate-200 px-2 py-1 text-slate-600"><InlineText text={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-1.5 space-y-1 text-sm">
          {items.map((it, ii) => <li key={ii}><InlineText text={it} /></li>)}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 my-1.5 space-y-1 text-sm">
          {items.map((it, ii) => <li key={ii}><InlineText text={it} /></li>)}
        </ol>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !/^#{1,4}\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) && !lines[i].trim().startsWith('```')
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="text-sm leading-relaxed my-1.5">
        {paraLines.map((l, li) => (
          <span key={li}>
            <InlineText text={l} />
            {li < paraLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return <>{blocks}</>;
}
