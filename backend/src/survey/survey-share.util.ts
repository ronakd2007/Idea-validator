/**
 * Which sections a founder exposes on a survey's public results page.
 * Every key here maps 1:1 to a block the server actually omits from the
 * payload — a section toggled off is never sent, not merely hidden in CSS.
 */
export const REPORT_SHARE_DEFAULTS = {
  showSummary: true, // headline counts, completion rate, time
  showCharts: true, // per-question breakdown, trend, drop-off
  showResponses: true, // individual response browser + open-text answers
  showQuality: true, // response-quality scoring and flags
};

export type ReportShareSettings = typeof REPORT_SHARE_DEFAULTS;

export function parseReportShareSettings(raw: string | null | undefined): ReportShareSettings {
  try {
    return { ...REPORT_SHARE_DEFAULTS, ...(JSON.parse(raw || '{}') || {}) };
  } catch {
    return { ...REPORT_SHARE_DEFAULTS };
  }
}

// Only the keys above survive, and only as booleans — a crafted payload can't
// smuggle extra data into the stored settings JSON.
export function sanitizeReportShareSettings(input: any): Partial<ReportShareSettings> {
  const clean: Record<string, boolean> = {};
  for (const key of Object.keys(REPORT_SHARE_DEFAULTS)) {
    if (input && typeof input[key] === 'boolean') clean[key] = input[key];
  }
  return clean as Partial<ReportShareSettings>;
}
