// Helpers shared by the rich-text description editor and its renderers.

// True when a stored description was authored in the rich editor (HTML),
// false for legacy plain-text descriptions typed into the old textarea.
export function isRichHtml(text: string): boolean {
  return /<(p|h[1-6]|ul|ol|li|br|img|a|strong|b|em|i|u|hr|blockquote)[\s>/]/i.test(text);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Converts a legacy plain-text description into editor HTML so opening an
// old survey in the rich editor keeps its lines: every newline becomes its
// own paragraph, blank lines become empty paragraphs (visible blank lines).
export function plainToEditorHtml(text: string): string {
  if (!text) return '';
  if (isRichHtml(text)) return text;
  return text
    .split('\n')
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p></p>'))
    .join('');
}
