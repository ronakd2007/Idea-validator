// ---------------------------------------------------------------------------
// Validation Weakness Detector — deterministic, zero-AI, zero-fetch.
//
// Input is exactly what the dashboard already has in memory:
//   - `aggregated`      from GET /ideas/:id/dashboard  (expert evidence)
//   - `surveyAnalytics` from GET /surveys/:id/analytics (customer evidence)
// Every number shown to the founder is read from those objects; explanation
// strings are templates interpolating them. Nothing is estimated or invented.
//
// This is an insight layer ONLY: it never touches the score, the scoring
// formula, or any backend behavior.
// ---------------------------------------------------------------------------

export type GapConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface EvidenceRow {
  label: string;
  value: string;
  source: 'Survey respondents' | 'Expert validators' | 'Derived';
}

export interface GapFinding {
  key: string;
  title: string;
  headline: string;
  detail?: string;
  evidence: EvidenceRow[];
  confidence: GapConfidence;
  confidenceNote: string;
  nextStep: string;
  nextStepHref?: string;
  /** gap = a real weakness; info = missing evidence; ok = no dominant gap */
  tone: 'gap' | 'info' | 'ok';
}

// Expert categories eligible for the "weakest category" rule. Social Impact
// and Investor Attractiveness are deliberately excluded: neither is a
// validation gap in the product's sense (and IA is not part of the overall
// score at all).
const EXPERT_CATEGORIES: { key: string; label: string; gapKey: string; nextStep: string; href?: string }[] = [
  { key: 'marketOpportunityAvg', label: 'Market Opportunity', gapKey: 'MARKET_OPPORTUNITY', nextStep: 'Survey more target customers about how severe and frequent the problem really is.', href: '/founder/surveys/generate' },
  { key: 'feasibilityAvg', label: 'Feasibility', gapKey: 'FEASIBILITY', nextStep: 'Get additional expert validation focused on execution complexity and time to launch.' },
  { key: 'founderFitAvg', label: 'Founder Fit', gapKey: 'FOUNDER_FIT', nextStep: 'Strengthen the team or advisors in the areas experts rated weakest, then re-validate.' },
  { key: 'revenuePotentialAvg', label: 'Revenue Potential', gapKey: 'REVENUE_POTENTIAL', nextStep: 'Run a willingness-to-pay survey to test monetization with real customers.', href: '/founder/surveys/generate' },
  { key: 'scalabilityAvg', label: 'Scalability', gapKey: 'SCALABILITY', nextStep: 'Get expert input on operations, automation and growth mechanics.' },
  { key: 'innovationAvg', label: 'Differentiation', gapKey: 'DIFFERENTIATION', nextStep: 'Ask respondents to compare your solution directly with the alternatives they use today.', href: '/founder/surveys/generate' },
];

const RISK_META: Record<string, { label: string; nextStep: string }> = {
  competition: { label: 'Competition Risk', nextStep: 'Conduct competitor comparison research and sharpen your differentiation.' },
  regulatory: { label: 'Regulatory Risk', nextStep: 'Get expert or legal input on the regulatory hurdles validators flagged.' },
  technology: { label: 'Technology Risk', nextStep: 'Prototype the riskiest technical assumption before building further.' },
  funding: { label: 'Funding Risk', nextStep: 'Pressure-test your funding plan — validators rated funding the most likely risk to materialize.' },
  marketAdoption: { label: 'Market Adoption Risk', nextStep: 'Survey target customers about switching barriers and adoption triggers.' },
};

const CONF_ORDER: GapConfidence[] = ['INSUFFICIENT', 'LOW', 'MEDIUM', 'HIGH'];
const bump = (c: GapConfidence): GapConfidence => CONF_ORDER[Math.min(CONF_ORDER.indexOf(c) + 1, CONF_ORDER.length - 1)];

// Same bands the survey analytics already uses for sample-size labeling,
// applied to quality-filtered response counts.
function surveyConfidence(validN: number): GapConfidence {
  if (validN >= 30) return 'HIGH';
  if (validN >= 10) return 'MEDIUM';
  if (validN > 0) return 'LOW';
  return 'INSUFFICIENT';
}

function expertConfidence(validators: number): GapConfidence {
  if (validators >= 3) return 'MEDIUM';
  if (validators > 0) return 'LOW';
  return 'INSUFFICIENT';
}

interface YesNoSignal { pct: number; questionText: string; answered: number }

// Mirrors the regexes the existing survey analytics/insights already use to
// recognize pricing- and usage-style questions.
function yesNoSignal(questions: any[], regex: RegExp): YesNoSignal | null {
  const q = (questions || []).find(
    (x: any) => x.type === 'YES_NO' && regex.test(x.questionText || '') && Array.isArray(x.distribution)
  );
  if (!q) return null;
  const yes = q.distribution.find((d: any) => d.label === 'Yes');
  if (!yes || !q.answeredCount) return null;
  return { pct: Math.round(yes.pct), questionText: q.questionText, answered: q.answeredCount };
}

function primaryOutcomePct(surveyAnalytics: any): number | null {
  const primary = surveyAnalytics?.eligibleOutcomeQuestions?.[0];
  if (!primary) return null;
  const qa = (surveyAnalytics.questions || []).find((q: any) => q.id === primary.id);
  if (!qa) return null;
  if (primary.type === 'YES_NO') {
    const yes = qa.distribution?.find((d: any) => d.label === 'Yes');
    return yes ? Math.round(yes.pct) : null;
  }
  if (qa.average != null && qa.max) return Math.round((qa.average / qa.max) * 100);
  return null;
}

const dominantHigh = (counts: { LOW?: number; MEDIUM?: number; HIGH?: number }) => {
  const l = counts.LOW || 0, m = counts.MEDIUM || 0, h = counts.HIGH || 0;
  const total = l + m + h;
  return total > 0 && h > total / 2 ? { high: h, total } : null;
};

interface Candidate { severity: number; finding: GapFinding }

export function detectValidationGap(aggregated: any, surveyAnalytics: any, surveyCount: number): GapFinding | null {
  const a = aggregated || {};
  const validators: number = a.totalValidations || 0;

  const n: number = surveyAnalytics?.summary?.totalResponses ?? 0;
  const lowQuality: number = surveyAnalytics?.quality?.buckets?.POTENTIALLY_LOW ?? 0;
  const validN = Math.max(0, n - lowQuality);
  const questions = surveyAnalytics?.questions || [];

  if (validators === 0 && n === 0) return null; // nothing to analyze — dashboard's own empty states handle this

  const useSig = yesNoSignal(questions, /\b(use|try|buy|purchase)\b/i);
  const paySig = yesNoSignal(questions, /pay|price|pricing|afford/i);
  const primaryPct = primaryOutcomePct(surveyAnalytics);
  const catPct = (key: string) => (a[key] > 0 ? Math.round((a[key] / 50) * 100) : null);

  const validResponsesRow: EvidenceRow = {
    label: 'Valid responses',
    value: lowQuality > 0 ? `${validN} (${n} total, ${lowQuality} quality-flagged excluded)` : `${validN}`,
    source: 'Survey respondents',
  };
  const validatorsRow: EvidenceRow = { label: 'Expert validators', value: `${validators}`, source: 'Expert validators' };

  // ---- Missing-evidence states (checked before weakness ranking) ----

  if (surveyCount === 0 || n === 0) {
    return {
      key: 'CUSTOMER_EVIDENCE',
      title: 'Customer Validation',
      headline: 'Customer evidence has not been collected yet.',
      detail:
        validators > 0
          ? `Your idea has ${validators} expert validation${validators !== 1 ? 's' : ''}, but no real customers have weighed in — expert opinion alone can't confirm demand.`
          : undefined,
      evidence: [
        { label: 'Survey responses', value: '0', source: 'Survey respondents' },
        ...(validators > 0 ? [validatorsRow] : []),
      ],
      confidence: 'INSUFFICIENT',
      confidenceNote: 'No customer data to analyze yet',
      nextStep: 'Run a customer validation survey.',
      nextStepHref: '/founder/surveys/generate',
      tone: 'info',
    };
  }

  // Severe expert outlier can still be reported when the survey is too small —
  // computed here so the insufficient-evidence state can defer to it.
  const severeExpert = (() => {
    if (validators === 0) return null;
    const cats = EXPERT_CATEGORIES.map((c) => ({ ...c, pct: catPct(c.key) })).filter((c) => c.pct != null) as
      (typeof EXPERT_CATEGORIES[number] & { pct: number })[];
    if (cats.length < 3) return null;
    const sorted = [...cats].sort((x, y) => x.pct - y.pct);
    const weakest = sorted[0];
    const meanOthers = sorted.slice(1).reduce((s, c) => s + c.pct, 0) / (sorted.length - 1);
    if (weakest.pct < 50 && meanOthers - weakest.pct >= 10) return { weakest, meanOthers: Math.round(meanOthers) };
    return null;
  })();

  if (validN < 10) {
    if (!severeExpert || validators === 0) {
      return {
        key: 'INSUFFICIENT_EVIDENCE',
        title: 'Insufficient Customer Evidence',
        headline: `Only ${n} survey response${n !== 1 ? 's are' : ' is'} available${lowQuality > 0 ? ` (${validN} after excluding quality-flagged ones)` : ''}.`,
        detail: 'Collect more responses before drawing strong conclusions from customer data.',
        evidence: [validResponsesRow, ...(validators > 0 ? [validatorsRow] : [])],
        confidence: 'INSUFFICIENT',
        confidenceNote: 'Fewer than 10 usable responses',
        nextStep: 'Collect more survey responses — share your survey link or QR code.',
        nextStepHref: '/founder/surveys',
        tone: 'info',
      };
    }
    // fall through: the expert outlier below will win the ranking
  }

  // ---- Weakness candidates (deterministic severity ranking) ----

  const candidates: Candidate[] = [];
  const surveyUsable = validN >= 10;

  // 1) Pricing / willingness to pay: a meaningful gap between interest and
  //    paying — never fires when demand itself is the weaker story.
  if (surveyUsable && useSig && paySig && useSig.pct - paySig.pct >= 25 && paySig.pct < 50) {
    const revPct = catPct('revenuePotentialAvg');
    const corroborated = revPct != null && revPct < 50;
    const conflicted = revPct != null && revPct >= 60;
    let confidence = surveyConfidence(validN);
    if (corroborated && validators > 0) confidence = bump(confidence);

    const evidence: EvidenceRow[] = [
      { label: 'Would use', value: `${useSig.pct}%`, source: 'Survey respondents' },
      { label: 'Would pay', value: `${paySig.pct}%`, source: 'Survey respondents' },
      { label: 'Difference', value: `${useSig.pct - paySig.pct} percentage points`, source: 'Derived' },
      validResponsesRow,
    ];
    if (revPct != null) {
      evidence.push({ label: 'Revenue Potential', value: `${(a.revenuePotentialAvg as number).toFixed(1)}/50`, source: 'Expert validators' });
    }

    candidates.push({
      severity: (useSig.pct - paySig.pct) + (50 - paySig.pct) + (corroborated ? 15 : 0),
      finding: {
        key: 'PRICING',
        title: 'Willingness to Pay',
        headline: `Only ${paySig.pct}% of survey respondents said they would pay, while ${useSig.pct}% said they would use it.`,
        detail: corroborated
          ? 'Both customer responses and expert validation indicate that monetization is currently the weakest validated area.'
          : conflicted
            ? `Expert validators rated revenue potential higher (${(a.revenuePotentialAvg as number).toFixed(1)}/50) — real customers disagree, which makes pricing the key question to resolve.`
            : 'Customer interest is relatively strong, but willingness to pay is the biggest unresolved question.',
        evidence,
        confidence,
        confidenceNote: `${validN} usable responses${corroborated ? ' + expert agreement' : ''}`,
        nextStep: 'Test pricing with a dedicated willingness-to-pay survey.',
        nextStepHref: '/founder/surveys/generate',
        tone: 'gap',
      },
    });
  }

  // 2) Customer demand: the core interest signal itself is weak.
  const demandSig = useSig ?? (primaryPct != null ? { pct: primaryPct, questionText: 'primary outcome question', answered: n } : null);
  if (surveyUsable && demandSig && demandSig.pct < 40) {
    candidates.push({
      severity: (40 - demandSig.pct) * 2,
      finding: {
        key: 'CUSTOMER_DEMAND',
        title: 'Customer Demand',
        headline: `Only ${demandSig.pct}% of survey respondents responded positively to the core demand question.`,
        detail: paySig && paySig.pct < 40
          ? `Willingness to pay is also low (${paySig.pct}%), but overall demand is the more fundamental issue to resolve first.`
          : 'Before refining pricing or features, the core value proposition needs stronger customer interest.',
        evidence: [
          { label: 'Positive response', value: `${demandSig.pct}%`, source: 'Survey respondents' },
          ...(paySig ? [{ label: 'Would pay', value: `${paySig.pct}%`, source: 'Survey respondents' as const }] : []),
          validResponsesRow,
        ],
        confidence: surveyConfidence(validN),
        confidenceNote: `${validN} usable responses`,
        nextStep: 'Survey more target customers — and revisit how the problem and solution are framed.',
        nextStepHref: '/founder/surveys/generate',
        tone: 'gap',
      },
    });
  }

  // 3) Differentiation: experts (answering as customers) see a real problem
  //    being solved but no edge over alternatives.
  const cv = a.customerValidation;
  if (validators > 0 && cv && cv.betterThanAlternatives < 50 && cv.solvesRealProblem >= 65) {
    candidates.push({
      severity: (50 - cv.betterThanAlternatives) + (cv.solvesRealProblem - 65) / 2,
      finding: {
        key: 'DIFFERENTIATION',
        title: 'Differentiation',
        headline: `${Math.round(cv.solvesRealProblem)}% of expert validators say this solves a real problem, but only ${Math.round(cv.betterThanAlternatives)}% consider it better than existing alternatives.`,
        detail: 'The problem is validated — the edge over current solutions is not.',
        evidence: [
          { label: 'Solves a real problem', value: `${Math.round(cv.solvesRealProblem)}%`, source: 'Expert validators' },
          { label: 'Better than alternatives', value: `${Math.round(cv.betterThanAlternatives)}%`, source: 'Expert validators' },
          validatorsRow,
        ],
        confidence: expertConfidence(validators),
        confidenceNote: `Based on ${validators} expert validation${validators !== 1 ? 's' : ''}`,
        nextStep: 'Ask respondents to compare your solution directly with the alternatives they use today.',
        nextStepHref: '/founder/surveys/generate',
        tone: 'gap',
      },
    });
  }

  // 4) Weakest expert category — only when it is a meaningful outlier, never
  //    just "the lowest number".
  if (severeExpert) {
    const { weakest, meanOthers } = severeExpert;
    candidates.push({
      severity: (50 - weakest.pct) + (meanOthers - weakest.pct),
      finding: {
        key: weakest.gapKey,
        title: weakest.label,
        headline: `Experts scored ${weakest.label} at ${(a[weakest.key] as number).toFixed(1)}/50 — well below the ${meanOthers}% average of your other categories.`,
        detail: 'A single category this far behind the rest is where your validation is weakest.',
        evidence: [
          { label: weakest.label, value: `${(a[weakest.key] as number).toFixed(1)}/50 (${weakest.pct}%)`, source: 'Expert validators' },
          { label: 'Average of other categories', value: `${meanOthers}%`, source: 'Derived' },
          validatorsRow,
        ],
        confidence: expertConfidence(validators),
        confidenceNote: `Based on ${validators} expert validation${validators !== 1 ? 's' : ''}`,
        nextStep: weakest.nextStep,
        nextStepHref: weakest.href,
        tone: 'gap',
      },
    });
  }

  // 5) Risk types where a majority of validators voted HIGH probability.
  if (validators > 0 && a.riskSummary) {
    for (const [riskKey, counts] of Object.entries(a.riskSummary as Record<string, any>)) {
      const meta = RISK_META[riskKey];
      const high = dominantHigh(counts);
      if (!meta || !high) continue;
      candidates.push({
        severity: 15 + (high.high / high.total) * 20,
        finding: {
          key: `RISK_${riskKey.toUpperCase()}`,
          title: meta.label,
          headline: `${high.high} of ${high.total} expert validators rated ${meta.label.replace(' Risk', '').toLowerCase()} risk as HIGH probability.`,
          detail: 'No other metric shows a larger unresolved weakness, so this risk is the biggest open question.',
          evidence: [
            { label: `${meta.label} — HIGH votes`, value: `${high.high} of ${high.total}`, source: 'Expert validators' },
            validatorsRow,
          ],
          confidence: expertConfidence(validators),
          confidenceNote: `Based on ${validators} expert validation${validators !== 1 ? 's' : ''}`,
          nextStep: meta.nextStep,
          tone: 'gap',
        },
      });
    }
  }

  const best = candidates.sort((x, y) => y.severity - x.severity)[0];
  if (best) return best.finding;

  // ---- Nothing fired: evidence is consistent ----
  if (validators === 0) {
    return {
      key: 'EXPERT_EVIDENCE',
      title: 'Expert Validation',
      headline: 'No expert has scored this idea yet.',
      detail: `Customer evidence exists (${validN} usable responses), but there is no expert perspective to compare it against.`,
      evidence: [validResponsesRow, { label: 'Expert validators', value: '0', source: 'Expert validators' }],
      confidence: 'INSUFFICIENT',
      confidenceNote: 'No expert evidence yet',
      nextStep: 'Expert validations arrive as validators review your idea — meanwhile, keep deepening customer evidence.',
      tone: 'info',
    };
  }

  return {
    key: 'NO_DOMINANT_GAP',
    title: 'No Dominant Gap Identified',
    headline: 'Your validation evidence is consistent — no single area stands out as significantly weaker than the rest.',
    detail: 'That makes the size of your evidence base the next thing to strengthen.',
    evidence: [
      ...(n > 0 ? [validResponsesRow] : []),
      validatorsRow,
      ...(a.overallScore ? [{ label: 'Overall score', value: `${Math.round(a.overallScore)}/100`, source: 'Expert validators' as const }] : []),
    ],
    confidence: n > 0 ? surveyConfidence(validN) : expertConfidence(validators),
    confidenceNote: n > 0 ? `${validN} usable responses, ${validators} expert validation${validators !== 1 ? 's' : ''}` : `${validators} expert validation${validators !== 1 ? 's' : ''}`,
    nextStep: validN < 30 ? 'Collect more survey responses to raise confidence in these results.' : 'Keep collecting evidence as the idea evolves — especially after any pivot.',
    nextStepHref: validN < 30 ? '/founder/surveys' : undefined,
    tone: 'ok',
  };
}
