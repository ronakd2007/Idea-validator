'use client';
import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { isRichHtml } from '@/lib/richText';

// Legacy plain-text descriptions: pasted URLs become real links instead of
// dead text (split keeps the captured URLs in the array).
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{part}</a>
      : part
  );
}

// Mirrors the backend whitelist in survey/rich-text.util.ts — the server
// sanitizes on write, this sanitizes on render, so content that never went
// through the new write path (or a compromised value) still can't script.
const PURIFY_OPTS = {
  ALLOWED_TAGS: ['p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'img', 'hr', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'start'],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
};

/**
 * Renders a survey description. Rich (editor-authored HTML) content renders
 * as structured text via the shared .rich-desc styles; legacy plain text
 * keeps line breaks and linkified URLs. Renders nothing for empty input.
 */
export default function RichDescription({ text, className = '' }: { text: string; className?: string }) {
  const rich = !!text && isRichHtml(text);
  const clean = useMemo(() => (rich ? DOMPurify.sanitize(text, PURIFY_OPTS) : ''), [rich, text]);

  if (!text) return null;
  if (rich) {
    return <div className={`rich-desc text-left ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
  }
  return <p className={`text-left whitespace-pre-line leading-relaxed break-words ${className}`}>{linkify(text)}</p>;
}
