// ---------------------------------------------------------------------------
// Assumption Checker evaluator — deterministic, zero-AI, zero-fetch.
//
// Consumes the SAME two objects the Weakness Detector reads (`aggregated`
// from the dashboard endpoint + `surveyAnalytics` from the primary survey),
// so the two features can never cite different numbers for the same thing.
// The signal extractors and regexes below MUST mirror validationGap.ts —
// the test suite includes a consistency case that fails if they drift.
//
// Statuses are computed at render time and never stored: as new responses or
// validations arrive, every assumption re-evaluates automatically.
// ---------------------------------------------------------------------------

export type AssumptionStatus = 'SUPPORTED' | 'PARTIAL' | 'NOT_SUPPORTED' | 'INSUFFICIENT';

export interface Assumption {
  statement: string;
  category?: string | null;
}

export interface AssumptionEvidenceRow {
  label: string;
  value: string;
  source: 'Survey respondents' | 'Expert validators' | 'Derived';
}

export interface AssumptionResult {
  statement: string;
  category: string | null; // effective category (chosen or inferred from wording)
  status: AssumptionStatus;
  headline: string;
  target: string | null;
  actual: string | null;
  delta: string | null;
  recommendation: string;
  evidence: AssumptionEvidenceRow[];
  /** True when the Weakness Detector's current top gap covers this same area. */
  isBiggestGap?: boolean;
}

export const ASSUMPTION_CATEGORY_LABELS: Record<string, string> = {
  PRICING: 'Pricing / Business Model',
  CUSTOMER: 'Customer / Product',
  PROBLEM: 'Problem / Market',
  COMPETITION: 'Competition',
  TECHNOLOGY: 'Technology',
  OTHER: 'Other',
};

// Maps Weakness Detector gap keys onto assumption categories, so a "pricing
// gap" and a "pricing assumption" recognize each other.
export const GAP_KEY_TO_CATEGORY: Record<string, string> = {
  PRICING: 'PRICING',
  REVENUE_POTENTIAL: 'PRICING',
  CUSTOMER_DEMAND: 'CUSTOMER',
  CUSTOMER_EVIDENCE: 'CUSTOMER',
  DIFFERENTIATION: 'COMPETITION',
  MARKET_OPPORTUNITY: 'PROBLEM',
  FEASIBILITY: 'TECHNOLOGY',
};

// ---- extractors (MUST mirror validationGap.ts) ----

const PAY_REGEX = /pay|price|pricing|afford/i;
const USE_REGEX = /\b(use|try|buy|purchase)\b/i;
const RECOMMEND_REGEX = /recommend/i;
const FREQUENCY_Q_REGEX = /how often|frequen|per week|per month|daily|weekly|times/i;

function yesNoSignal(questions: any[], regex: RegExp): { pct: number; questionText: string; answered: number } | null {
  const q = (questions || []).find(
    (x: any) => x.type === 'YES_NO' && regex.test(x.questionText || '') && Array.isArray(x.distribution)
  );
  if (!q) return null;
  const yes = q.distribution.find((d: any) => d.label === 'Yes');
  if (!yes || !q.answeredCount) return null;
  return { pct: Math.round(yes.pct), questionText: q.questionText, answered: q.answeredCount };
}

// ---- statement parsing ----

/** Explicit numeric target ("at least 60%", "60% of...") or quantifier ("most"/"majority" → >50). */
export function parseTarget(statement: string): { pct: number; kind: 'explicit' | 'quantifier' } | null {
  const m = statement.match(/(\d{1,3})\s*%/);
  if (m) {
    const pct = Number(m[1]);
    if (pct >= 1 && pct <= 100) return { pct, kind: 'explicit' };
  }
  if (/\b(most|majority)\b/i.test(statement)) return { pct: 50, kind: 'quantifier' };
  return null;
}

/** Wording decides the evidence kind first; the chosen category is fallback. */
export function inferKind(statement: string, category?: string | null): string | null {
  const s = statement.toLowerCase();
  if (/pay|price|pricing|₹|\$|subscription|charge|afford/.test(s)) return 'PRICING';
  // \brefer\b so "prefer" never routes here — that's a competition claim.
  if (/recommend|\brefer\b|referral/.test(s)) return 'RECOMMEND';
  if (/prefer|alternativ|competitor|better than|switch/.test(s)) return 'COMPETITION';
  if (/frequen|often|per week|weekly|daily|every day|per month|once a|twice a|a week\b|a day\b|a month\b|times a/.test(s)) return 'FREQUENCY';
  if (/problem|pain|struggle|need/.test(s)) return 'PROBLEM';
  if (/\buse\b|usage|adopt|try|sign up|download|would want/.test(s)) return 'CUSTOMER';
  if (/build|technical|technolog|feasib|develop/.test(s)) return 'TECHNOLOGY';
  if (category && category !== 'OTHER') return category;
  return null;
}

// ---- evaluation ----

interface Signal {
  type: 'percent' | 'expertScore';
  pct: number; // normalized 0-100 for expertScore
  headlinePart: string;
  rows: AssumptionEvidenceRow[];
}

const RECOMMENDATIONS: Record<string, string> = {
  PRICING: 'Run a pricing-focused survey to test willingness to pay.',
  CUSTOMER: 'Survey more target customers about whether they would actually use this.',
  RECOMMEND: 'Ask respondents directly whether they would recommend this to someone like them.',
  COMPETITION: 'Ask customers which existing alternatives they use today and what would make them switch.',
  PROBLEM: 'Add questions about how often and how painfully customers experience this problem.',
  TECHNOLOGY: 'Get additional expert validation focused on technical feasibility.',
  FREQUENCY: 'Add a question about how frequently customers experience this to your next survey.',
};

export function evaluateAssumptions(
  assumptions: Assumption[],
  aggregated: any,
  surveyAnalytics: any,
  gapKey?: string | null
): AssumptionResult[] {
  const a = aggregated || {};
  const validators: number = a.totalValidations || 0;
  const cv = a.customerValidation || null;

  const n: number = surveyAnalytics?.summary?.totalResponses ?? 0;
  const lowQuality: number = surveyAnalytics?.quality?.buckets?.POTENTIALLY_LOW ?? 0;
  const validN = Math.max(0, n - lowQuality);
  const questions = surveyAnalytics?.questions || [];
  const surveyUsable = validN >= 10;

  const surveyRow = (label: string, pct: number, qText: string): AssumptionEvidenceRow[] => [
    { label: `Survey question`, value: `“${qText}”`, source: 'Survey respondents' },
    { label, value: `${pct}%`, source: 'Survey respondents' },
    { label: 'Usable responses', value: `${validN}${lowQuality > 0 ? ` (${lowQuality} quality-flagged excluded)` : ''}`, source: 'Survey respondents' },
  ];
  const cvRow = (label: string, pct: number): AssumptionEvidenceRow[] => [
    { label: `${label} (experts answering as customers)`, value: `${Math.round(pct)}%`, source: 'Expert validators' },
    { label: 'Expert validators', value: `${validators}`, source: 'Expert validators' },
  ];
  const scoreRow = (label: string, avg: number): AssumptionEvidenceRow[] => [
    { label, value: `${avg.toFixed(1)}/50 (${Math.round((avg / 50) * 100)}%)`, source: 'Expert validators' },
    { label: 'Expert validators', value: `${validators}`, source: 'Expert validators' },
  ];

  // Percent-first resolution per kind; expert scores are the fallback and are
  // clearly labeled as expert-derived.
  const resolveSignal = (kind: string): Signal | null => {
    const surveyPct = (regex: RegExp, label: string): Signal | null => {
      const sig = yesNoSignal(questions, regex);
      if (!sig || !surveyUsable) return null;
      return { type: 'percent', pct: sig.pct, headlinePart: `${sig.pct}% of survey respondents ${label}`, rows: surveyRow(label, sig.pct, sig.questionText) };
    };
    const cvPct = (key: string, label: string): Signal | null => {
      if (!cv || validators === 0 || cv[key] == null) return null;
      const pct = Math.round(cv[key]);
      return { type: 'percent', pct, headlinePart: `${pct}% of expert validators (answering as customers) ${label}`, rows: cvRow(label, cv[key]) };
    };
    const expert = (key: string, label: string): Signal | null => {
      if (validators === 0 || !(a[key] > 0)) return null;
      const pct = Math.round((a[key] / 50) * 100);
      return { type: 'expertScore', pct, headlinePart: `experts scored ${label} at ${a[key].toFixed(1)}/50 (${pct}%)`, rows: scoreRow(label, a[key]) };
    };

    switch (kind) {
      case 'PRICING':
        return surveyPct(PAY_REGEX, 'said they would pay') || cvPct('wouldPay', 'said customers would pay') || expert('revenuePotentialAvg', 'Revenue Potential');
      case 'CUSTOMER':
        return surveyPct(USE_REGEX, 'said they would use it') || cvPct('wouldUse', 'said customers would use it');
      case 'RECOMMEND':
        return surveyPct(RECOMMEND_REGEX, 'said they would recommend it') || cvPct('wouldRecommend', 'said customers would recommend it');
      case 'COMPETITION':
        return cvPct('betterThanAlternatives', 'rated it better than existing alternatives') || expert('innovationAvg', 'Innovation / Differentiation');
      case 'PROBLEM':
        return cvPct('solvesRealProblem', 'said it solves a real problem') || expert('marketOpportunityAvg', 'Market Opportunity');
      case 'TECHNOLOGY':
        return expert('feasibilityAvg', 'Feasibility');
      default:
        return null;
    }
  };

  const gapCategory = gapKey ? GAP_KEY_TO_CATEGORY[gapKey] || null : null;

  return (assumptions || [])
    .filter((asm) => asm?.statement?.trim())
    .map((asm) => {
      const statement = asm.statement.trim();
      const kind = inferKind(statement, asm.category);
      const target = parseTarget(statement);
      const base: AssumptionResult = {
        statement,
        category: kind && kind !== 'FREQUENCY' && kind !== 'RECOMMEND' ? kind : asm.category || null,
        status: 'INSUFFICIENT',
        headline: '',
        target: null,
        actual: null,
        delta: null,
        recommendation: '',
        evidence: [],
      };

      // Frequency claims: brackets can't be honestly auto-compared. Show the
      // distribution as context if one exists; never issue a verdict.
      if (kind === 'FREQUENCY') {
        const freqQ = questions.find((q: any) => FREQUENCY_Q_REGEX.test(q.questionText || '') && Array.isArray(q.distribution));
        if (freqQ) {
          base.headline = 'Frequency answers can’t be automatically compared to your threshold — review the distribution below.';
          base.evidence = [
            { label: 'Survey question', value: `“${freqQ.questionText}”`, source: 'Survey respondents' },
            ...freqQ.distribution.slice(0, 3).map((d: any) => ({
              label: d.label ?? String(d.value), value: `${Math.round(d.pct)}%`, source: 'Survey respondents' as const,
            })),
          ];
          base.recommendation = 'Review the frequency distribution and judge this one yourself.';
        } else {
          base.headline = 'Your current validation did not measure frequency.';
          base.recommendation = RECOMMENDATIONS.FREQUENCY;
        }
        return { ...base, isBiggestGap: false };
      }

      if (!kind) {
        base.headline = 'This assumption couldn’t be matched to any evidence the platform collects.';
        base.recommendation = 'Pick a category for it, or add a survey question that tests it directly.';
        return { ...base, isBiggestGap: false };
      }

      const signal = resolveSignal(kind);

      if (!signal) {
        base.headline =
          kind === 'TECHNOLOGY'
            ? 'No expert validation yet — feasibility is assessed by expert review, not surveys.'
            : validN > 0 && !surveyUsable
              ? `Only ${validN} usable survey response${validN !== 1 ? 's' : ''} — not enough to test this yet.`
              : `Your current validation has no evidence about ${ASSUMPTION_CATEGORY_LABELS[kind]?.toLowerCase() || 'this'}.`;
        base.recommendation = RECOMMENDATIONS[kind] || 'Add a survey question that directly tests this assumption.';
        return { ...base, isBiggestGap: false };
      }

      // Honesty rule: an explicit numeric target ("60% of customers…") is only
      // ever compared against a real percentage — never a normalized expert score.
      if (target && signal.type === 'expertScore') {
        base.headline = `Your surveys never measured this directly — ${signal.headlinePart} is shown as context only.`;
        base.evidence = signal.rows;
        base.recommendation = RECOMMENDATIONS[kind] || 'Add a survey question that directly tests this assumption.';
        return { ...base, isBiggestGap: false };
      }

      let status: AssumptionStatus;
      if (target) {
        const meets = target.kind === 'quantifier' ? signal.pct > target.pct : signal.pct >= target.pct;
        status = meets ? 'SUPPORTED' : signal.pct >= target.pct - 15 ? 'PARTIAL' : 'NOT_SUPPORTED';
        base.target = target.kind === 'quantifier' ? '> 50% (“most”)' : `≥ ${target.pct}%`;
        base.actual = `${signal.pct}%`;
        base.delta = `${signal.pct - target.pct >= 0 ? '+' : ''}${signal.pct - target.pct} percentage points vs your assumption`;
      } else {
        status = signal.pct >= 60 ? 'SUPPORTED' : signal.pct >= 40 ? 'PARTIAL' : 'NOT_SUPPORTED';
        base.actual = signal.type === 'percent' ? `${signal.pct}%` : `${signal.pct}% of max`;
      }

      base.status = status;
      base.headline = signal.headlinePart.charAt(0).toUpperCase() + signal.headlinePart.slice(1) + '.';
      base.evidence = signal.rows;
      base.recommendation =
        status === 'SUPPORTED'
          ? 'Keep collecting evidence as you grow — assumptions can drift over time.'
          : RECOMMENDATIONS[kind] || 'Add a survey question that directly tests this assumption.';

      const effectiveCategory = kind === 'RECOMMEND' ? 'CUSTOMER' : kind;
      return {
        ...base,
        category: effectiveCategory,
        isBiggestGap: !!gapCategory && gapCategory === effectiveCategory && (status === 'NOT_SUPPORTED' || status === 'PARTIAL'),
      };
    });
}

export function summarizeAssumptions(results: AssumptionResult[]) {
  return {
    total: results.length,
    supported: results.filter((r) => r.status === 'SUPPORTED').length,
    partial: results.filter((r) => r.status === 'PARTIAL').length,
    notSupported: results.filter((r) => r.status === 'NOT_SUPPORTED').length,
    insufficient: results.filter((r) => r.status === 'INSUFFICIENT').length,
  };
}
