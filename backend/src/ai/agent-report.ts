/**
 * The AI Deep Dive report: its shape, and the normalizer every piece of model
 * output must pass through before it is stored or shown.
 *
 * Nothing here trusts the model. Enums are whitelisted, strings and arrays are
 * clamped, URLs are re-derived from the real search results, and every number
 * that carries meaning (the overall score, the evidence coverage, the deltas)
 * is computed server-side. The report is assembled as an explicit object, so a
 * key the model invented cannot travel into the database or the UI.
 *
 * The product rule this file enforces: unknown is better than invented. Where
 * evidence is missing the field stays null and the gap is reported as a gap.
 */

import { DIMENSIONS, DimensionKey, overallFromDimensions } from '../ideas/score.util';

export const VERDICTS = ['GO', 'GO_WITH_CHANGES', 'PIVOT', 'NO_GO'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Level = (typeof LEVELS)[number];

export const RISK_CATEGORIES = ['MARKET', 'EXECUTION', 'FINANCIAL', 'REGULATORY', 'TECHNOLOGY', 'COMPETITION', 'OTHER'] as const;

/** Must match GAP_PLAYBOOKS in ai.service.ts — an unknown key would dead-link the survey generator. */
export const GAP_KEYS = ['PRICING', 'REVENUE_POTENTIAL', 'CUSTOMER_DEMAND', 'DIFFERENTIATION', 'MARKET_OPPORTUNITY', 'RISK_MARKETADOPTION'] as const;

export const COVERAGE_LEVELS = ['LIMITED', 'MODERATE', 'STRONG'] as const;
export type CoverageLevel = (typeof COVERAGE_LEVELS)[number];

export const UNVERIFIED_MARKET = 'Insufficient public evidence to estimate this reliably.';
export const UNVERIFIED_PRICING = 'Pricing not publicly verified.';
export const NO_WEB_RESEARCH_NOTE =
  'Live web research was unavailable for this run. Some findings are based on available model knowledge and existing IdeaValidator data.';

export interface AiValidationReport {
  version: 1;
  generatedAt: string;
  webSearchUsed: boolean;
  searchCount: number;

  verdict: Verdict | null;
  verdictSummary: string;
  keyEvidence: string[];
  biggestUncertainty: string | null;
  nextValidationStep: string | null;
  confidence: number;
  confidenceRationale: string;

  evidenceCoverage: { level: CoverageLevel; explanation: string; signals: string[] };
  biggestOpportunity: string | null;
  biggestRisk: string | null;

  brief: { oneLiner: string; industry: string; targetCustomer: string; geography: string; keyUnknowns: string[] };

  competitors: {
    direct: { name: string; url: string | null; whatTheyDo: string; pricing: string | null; strengths: string[]; weaknesses: string[]; threat: Level }[];
    indirect: { name: string; description: string }[];
    substitutes: string[];
    differentiationInference: string | null;
    summary: string;
  };

  market: {
    size: { tam: string | null; sam: string | null; som: string | null };
    growth: string | null;
    trends: string[];
    headwinds: string[];
    regulation: string | null;
    summary: string;
  };

  customers: {
    segments: { name: string; painPoints: string[]; jobsToBeDone: string[]; intensity: Level }[];
    currentAlternatives: string[];
    buyingBehavior: string | null;
    webEvidence: string[];
    surveyEvidence: string | null;
    inferences: string[];
    unknowns: string[];
    summary: string;
  };

  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };

  risks: { risk: string; category: string; likelihood: Level; impact: Level; whyItMatters: string; mitigation: string; missingEvidence: string | null }[];

  businessModel: { revenueModelFit: string; pricingLogic: string; costDrivers: string[]; monetizationRisks: string[]; keyAssumptions: string[] };

  gtm: { initialCustomer: string; channels: string[]; adoptionBarriers: string[]; earlyExperiment: string | null };

  experiments: { title: string; hypothesis: string; whatToTest: string; targetUsers: string; successMetric: string; sampleThreshold: string | null; decisionInformed: string; gapKey: string | null }[];

  scores: {
    dimensions: Record<DimensionKey, number>;
    rationale: Partial<Record<DimensionKey, string>>;
    overall: number;
  };

  aiVsExpert: AiVsExpert | null;

  sources: { title: string; url: string; finding: string | null; usedFor: string }[];
  limitations: string[];
  couldNotVerify: { item: string; note: string; kind: 'UNKNOWN' | 'UNVERIFIED' }[];
}

export interface AiVsExpert {
  expertValidations: number;
  expertOverall: number;
  aiOverall: number;
  agreement: 'ALIGNED' | 'AI_MORE_OPTIMISTIC' | 'AI_MORE_CAUTIOUS';
  headline: string;
  dimensions: { key: DimensionKey; label: string; ai: number; expert: number | null; delta: number | null; agreement: 'HIGH' | 'MODERATE' | 'LOW' | null }[];
}

// ---------- primitive guards ----------

/**
 * Models sometimes inline their citation objects into the prose instead of
 * keeping them in the citations array. Left alone, the length clamp then cuts
 * one in half and a founder reads `{"n":1,"finding":"An AI business idea`
 * in the middle of a sentence. Citations are resolved server-side from real
 * search results, so any that turn up inside text are noise by definition.
 */
function stripCitationNoise(value: string): string {
  return value
    .replace(/\{\s*"n"\s*:\s*\d+[^{}]*\}/g, '')
    // A clamp in an earlier pass can leave one unterminated at the end.
    .replace(/\{\s*"n"\s*:[\s\S]*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function str(v: unknown, max: number): string {
  // Strip before clamping: cutting first is what creates the broken fragment.
  return stripCitationNoise(String(v ?? '')).slice(0, max).trim();
}

export function strOrNull(v: unknown, max: number): string | null {
  const s = str(v, max);
  return s.length ? s : null;
}

export function arr<T>(v: unknown, cap: number, map: (item: any) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    if (out.length >= cap) break;
    const mapped = map(item);
    if (mapped !== null && mapped !== undefined) out.push(mapped);
  }
  return out;
}

export function strList(v: unknown, cap: number, max: number): string[] {
  return arr(v, cap, (item) => strOrNull(item, max));
}

export function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T | null): T | null {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** A dimension score is 0-50, one decimal. Anything unparseable scores 0 rather than guessing. */
export function score50(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(50, Math.max(0, n)) * 10) / 10;
}

export function httpUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const parsed = new URL(v);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A URL is only allowed into the report if it is one the search provider
 * actually returned. The model sees numbered results and may echo a URL back;
 * this is what stops it from echoing back one that does not exist.
 */
export function urlFromSources(v: unknown, sources: { url: string }[]): string | null {
  const candidate = httpUrl(v);
  if (!candidate) return null;
  return sources.some(s => s.url === candidate || s.url === v) ? candidate : null;
}

/**
 * Model citations arrive as indexes into the numbered result list it was shown.
 * Out-of-range indexes are dropped, and the URL/title always come from the real
 * result — the model only gets to say WHICH source said something, never what
 * the source is.
 */
export function mapCitations(
  raw: unknown,
  results: { title: string; url: string }[],
  usedFor: string,
): { title: string; url: string; finding: string | null; usedFor: string }[] {
  return arr(raw, 12, (c: any) => {
    const idx = Number(c?.n);
    if (!Number.isInteger(idx) || idx < 1 || idx > results.length) return null;
    const source = results[idx - 1];
    return { title: source.title, url: source.url, finding: strOrNull(c?.finding, 300), usedFor };
  });
}

// ---------- section normalizers ----------

export function normalizeBrief(raw: any) {
  return {
    oneLiner: str(raw?.oneLiner, 220),
    industry: str(raw?.industry, 80),
    targetCustomer: str(raw?.targetCustomer, 200),
    geography: str(raw?.geography, 80),
    keyUnknowns: strList(raw?.keyUnknowns, 5, 200),
  };
}

export function normalizeCompetitors(raw: any, sources: { url: string }[]): AiValidationReport['competitors'] {
  return {
    direct: arr(raw?.direct, 6, (c: any) => {
      const name = str(c?.name, 80);
      if (!name) return null;
      return {
        name,
        url: urlFromSources(c?.url, sources),
        whatTheyDo: str(c?.whatTheyDo ?? c?.description, 300),
        // Never inferred: an unverified price presented as fact is exactly the
        // kind of claim a founder would act on.
        pricing: strOrNull(c?.pricing, 140),
        strengths: strList(c?.strengths, 3, 160),
        weaknesses: strList(c?.weaknesses, 3, 160),
        threat: pickEnum(c?.threat, LEVELS, 'MEDIUM')!,
      };
    }),
    indirect: arr(raw?.indirect, 4, (c: any) => {
      const name = str(c?.name, 80);
      return name ? { name, description: str(c?.description, 200) } : null;
    }),
    substitutes: strList(raw?.substitutes, 4, 160),
    differentiationInference: strOrNull(raw?.differentiationInference, 320),
    summary: str(raw?.summary, 600),
  };
}

export function normalizeMarket(raw: any): AiValidationReport['market'] {
  return {
    size: {
      tam: strOrNull(raw?.size?.tam, 160),
      sam: strOrNull(raw?.size?.sam, 160),
      som: strOrNull(raw?.size?.som, 160),
    },
    growth: strOrNull(raw?.growth, 240),
    trends: strList(raw?.trends, 5, 220),
    headwinds: strList(raw?.headwinds, 4, 220),
    regulation: strOrNull(raw?.regulation, 300),
    summary: str(raw?.summary, 600),
  };
}

export function normalizeCustomers(raw: any, surveyEvidence: string | null): AiValidationReport['customers'] {
  return {
    segments: arr(raw?.segments, 4, (s: any) => {
      const name = str(s?.name, 80);
      if (!name) return null;
      return {
        name,
        painPoints: strList(s?.painPoints, 3, 180),
        jobsToBeDone: strList(s?.jobsToBeDone, 3, 180),
        intensity: pickEnum(s?.intensity, LEVELS, 'MEDIUM')!,
      };
    }),
    currentAlternatives: strList(raw?.currentAlternatives, 5, 160),
    buyingBehavior: strOrNull(raw?.buyingBehavior, 300),
    webEvidence: strList(raw?.webEvidence, 5, 260),
    // The founder's own survey data is server-supplied: it is real platform
    // evidence and must never be blended with, or invented by, the model.
    surveyEvidence,
    inferences: strList(raw?.inferences, 4, 240),
    unknowns: strList(raw?.unknowns, 5, 200),
    summary: str(raw?.summary, 500),
  };
}

export function normalizeSynthesis(raw: any) {
  return {
    swot: {
      strengths: strList(raw?.swot?.strengths, 5, 200),
      weaknesses: strList(raw?.swot?.weaknesses, 5, 200),
      opportunities: strList(raw?.swot?.opportunities, 5, 200),
      threats: strList(raw?.swot?.threats, 5, 200),
    },
    risks: arr(raw?.risks, 6, (r: any) => {
      const risk = str(r?.risk, 180);
      if (!risk) return null;
      return {
        risk,
        category: pickEnum(r?.category, RISK_CATEGORIES, 'OTHER')!,
        likelihood: pickEnum(r?.likelihood, LEVELS, 'MEDIUM')!,
        impact: pickEnum(r?.impact, LEVELS, 'MEDIUM')!,
        whyItMatters: str(r?.whyItMatters, 260),
        mitigation: str(r?.mitigation, 260),
        missingEvidence: strOrNull(r?.missingEvidence, 200),
      };
    }),
    businessModel: {
      revenueModelFit: str(raw?.businessModel?.revenueModelFit, 400),
      pricingLogic: str(raw?.businessModel?.pricingLogic, 300),
      costDrivers: strList(raw?.businessModel?.costDrivers, 5, 160),
      monetizationRisks: strList(raw?.businessModel?.monetizationRisks, 4, 200),
      keyAssumptions: strList(raw?.businessModel?.keyAssumptions, 4, 200),
    },
    gtm: {
      initialCustomer: str(raw?.gtm?.initialCustomer, 260),
      channels: strList(raw?.gtm?.channels, 5, 160),
      adoptionBarriers: strList(raw?.gtm?.adoptionBarriers, 4, 200),
      earlyExperiment: strOrNull(raw?.gtm?.earlyExperiment, 260),
    },
    experiments: arr(raw?.experiments, 5, (e: any) => {
      const title = str(e?.title, 140);
      if (!title) return null;
      return {
        title,
        hypothesis: str(e?.hypothesis, 220),
        whatToTest: str(e?.whatToTest, 260),
        targetUsers: str(e?.targetUsers, 180),
        successMetric: str(e?.successMetric, 180),
        sampleThreshold: strOrNull(e?.sampleThreshold, 140),
        decisionInformed: str(e?.decisionInformed, 220),
        gapKey: pickEnum(e?.gapKey, GAP_KEYS, null),
      };
    }),
    biggestOpportunity: strOrNull(raw?.biggestOpportunity, 300),
    biggestRisk: strOrNull(raw?.biggestRisk, 300),
  };
}

export function normalizeScores(raw: any) {
  const dimensions = {} as Record<DimensionKey, number>;
  const rationale: Partial<Record<DimensionKey, string>> = {};
  for (const dim of DIMENSIONS) {
    dimensions[dim.key] = score50(raw?.dimensions?.[dim.key]);
    const why = strOrNull(raw?.rationale?.[dim.key], 220);
    if (why) rationale[dim.key] = why;
  }
  return {
    dimensions,
    rationale,
    // The model's own overall is ignored on purpose — the server recomputes it
    // from the dimensions with the same rule the expert score uses.
    overall: Math.round(overallFromDimensions(dimensions) * 10) / 10,
    verdict: pickEnum(raw?.verdict, VERDICTS, null),
    verdictSummary: str(raw?.verdictSummary, 700),
    keyEvidence: strList(raw?.keyEvidence, 4, 240),
    biggestUncertainty: strOrNull(raw?.biggestUncertainty, 260),
    nextValidationStep: strOrNull(raw?.nextValidationStep, 260),
    confidence: clampInt(raw?.confidence, 0, 100, 50),
  };
}

// ---------- server-computed evidence framing ----------

export interface EvidenceSignals {
  webSearchUsed: boolean;
  sourceCount: number;
  surveyResponses: number;
  expertValidations: number;
  founderInfoComplete: boolean;
}

/**
 * How much real evidence this run actually stands on — deliberately separate
 * from the model's confidence, and never model-supplied. Confidence is how sure
 * the assessment is; coverage is how much was there to be sure about.
 */
export function buildEvidenceCoverage(signals: EvidenceSignals): AiValidationReport['evidenceCoverage'] {
  let points = 0;
  const have: string[] = [];
  const missing: string[] = [];

  if (signals.webSearchUsed) {
    points += 2;
    have.push('live web research');
  } else {
    missing.push('live web research was unavailable');
  }

  if (signals.sourceCount >= 5) {
    points += 1;
    have.push(`${signals.sourceCount} web sources`);
  } else if (signals.webSearchUsed) {
    missing.push('only limited source coverage');
  }

  if (signals.surveyResponses > 0) {
    points += 2;
    have.push(`${signals.surveyResponses} customer survey responses`);
  } else {
    missing.push('no customer survey data has been collected yet');
  }

  if (signals.expertValidations > 0) {
    points += 1;
    have.push(`${signals.expertValidations} expert validation${signals.expertValidations === 1 ? '' : 's'}`);
  } else {
    missing.push('no expert validations yet');
  }

  if (signals.founderInfoComplete) points += 1;
  else missing.push('limited background on the founder and team');

  const level: CoverageLevel = points >= 5 ? 'STRONG' : points >= 3 ? 'MODERATE' : 'LIMITED';
  const word = level === 'STRONG' ? 'Strong' : level === 'MODERATE' ? 'Moderate' : 'Limited';
  const havePart = have.length ? `based on ${have.join(', ')}` : 'based on very little hard evidence';
  const missingPart = missing.length ? `, but ${missing.join('; ')}` : '';

  return { level, explanation: `${word} — ${havePart}${missingPart}.`, signals: [...have, ...missing] };
}

/**
 * Confidence has to answer to the evidence. A run with no web research and no
 * customer data cannot come back "90% sure", however decisive the model sounds,
 * so the cap is applied server-side and the reason is always shown.
 */
export function applyConfidenceCap(
  confidence: number,
  signals: EvidenceSignals,
): { confidence: number; rationale: string; capReason: string | null } {
  const noWeb = !signals.webSearchUsed;
  const noSurvey = signals.surveyResponses === 0;

  let cap = 100;
  let capReason: string | null = null;

  if (noWeb && noSurvey) {
    cap = 50;
    capReason =
      'Neither live web research nor customer survey data was available for this run, so confidence is capped regardless of how the findings read.';
  } else if (noWeb) {
    cap = 60;
    capReason = 'Live web research was unavailable, so these findings could not be checked against current public sources.';
  } else if (noSurvey) {
    cap = 75;
    capReason = 'No customer survey data exists, so confidence is limited despite the available market signals.';
  }

  const capped = Math.min(confidence, cap);
  const rationale = capReason
    ? `${capped}% — ${capReason}`
    : `${capped}% — based on live web research and your existing IdeaValidator evidence.`;

  return { confidence: capped, rationale, capReason };
}

export function buildLimitations(signals: EvidenceSignals, capReason: string | null): string[] {
  const out: string[] = [];
  if (!signals.webSearchUsed) out.push(NO_WEB_RESEARCH_NOTE);
  else if (signals.sourceCount < 3) out.push(`Only ${signals.sourceCount} usable web source${signals.sourceCount === 1 ? '' : 's'} were found, so external evidence is thin.`);
  if (signals.surveyResponses === 0) out.push('No customer survey responses exist yet, so nothing here is confirmed by your actual target customers.');
  if (signals.expertValidations === 0) out.push('No expert validations have been submitted yet, so there is no human judgement to compare this research against.');
  if (!signals.founderInfoComplete) out.push('Founder background, team and assumptions were sparse, so Founder Fit is the least evidenced dimension in this report.');
  if (capReason) out.push(capReason);
  return out;
}

/**
 * The gaps, stated as gaps. Everything in here is a place the run refused to
 * guess — assembled from what the sections actually left null rather than from
 * anything the model volunteered.
 */
export function buildCouldNotVerify(
  report: Pick<AiValidationReport, 'competitors' | 'market' | 'customers' | 'risks'>,
  signals: EvidenceSignals,
): AiValidationReport['couldNotVerify'] {
  const out: AiValidationReport['couldNotVerify'] = [];
  const push = (item: string, note: string, kind: 'UNKNOWN' | 'UNVERIFIED') => {
    if (out.length >= 12) return;
    if (out.some(e => e.item === item)) return;
    out.push({ item, note, kind });
  };

  if (!signals.webSearchUsed) {
    push('External facts', 'Live web research was unavailable, so no claim here is backed by a current public source.', 'UNVERIFIED');
  }

  const unpriced = report.competitors.direct.filter(c => !c.pricing).map(c => c.name);
  if (unpriced.length) {
    push('Competitor pricing', `Public pricing could not be verified for ${unpriced.slice(0, 3).join(', ')}${unpriced.length > 3 ? ` and ${unpriced.length - 3} more` : ''}.`, 'UNVERIFIED');
  }

  const { tam, sam, som } = report.market.size;
  if (!tam && !sam && !som) push('Market size', 'Insufficient source-backed evidence to estimate TAM, SAM or SOM.', 'UNKNOWN');
  else if (!som) push('Obtainable market', 'No source-backed basis for what share of this market is realistically reachable.', 'UNKNOWN');

  if (signals.surveyResponses === 0) {
    push('Customer willingness to pay', 'No direct customer evidence — no survey responses have been collected for this idea.', 'UNKNOWN');
  }

  for (const unknown of report.customers.unknowns) push(unknown, 'Raised by the research as an open question with no supporting evidence found.', 'UNKNOWN');
  for (const risk of report.risks) {
    if (risk.missingEvidence) push(risk.risk, risk.missingEvidence, 'UNKNOWN');
  }

  return out;
}
