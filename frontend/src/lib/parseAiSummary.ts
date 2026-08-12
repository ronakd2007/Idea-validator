// Shared with the dashboard's inline rendering — splits the raw AI summary
// string (from GET /ai/summary/:ideaId) into its four labeled sections.
const SECTIONS = ['VERDICT', "WHAT'S WORKING", 'WHAT NEEDS WORK', 'NEXT STEPS'] as const;

export function parseAiSummary(text: string): { heading: string; body: string }[] {
  const result: { heading: string; body: string }[] = [];
  for (let i = 0; i < SECTIONS.length; i++) {
    const start = text.indexOf(SECTIONS[i]);
    if (start === -1) continue;
    const contentStart = start + SECTIONS[i].length;
    const end = i < SECTIONS.length - 1
      ? SECTIONS.slice(i + 1).map((s) => text.indexOf(s, contentStart)).filter((p) => p > -1).reduce((a, b) => Math.min(a, b), text.length)
      : text.length;
    result.push({ heading: SECTIONS[i], body: text.slice(contentStart, end).trim() });
  }
  return result;
}

export function toSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Condenses a section body to its first N sentences, stripped of markdown
// bold markers — used by the compact "Conclusion" page, which quotes the
// existing AI summary rather than regenerating or paraphrasing it.
export function firstSentences(text: string, n = 1): string {
  return toSentences(text).slice(0, n).join(' ').replace(/\*\*/g, '');
}

// Splits "some **bold** text" into typed runs so each renderer (DOM span vs
// PDF Text) can apply its own bold treatment without re-parsing.
export function splitBoldRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false }
    );
}
