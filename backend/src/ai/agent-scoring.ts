/**
 * AI vs expert comparison — pure server-side math over score rows.
 *
 * The point of this comparison is NOT to decide who is right. The AI scores
 * without ever seeing the expert scores, so where the two land in the same
 * place a founder has corroboration, and where they diverge the founder has a
 * question worth investigating. The copy generated here says exactly that and
 * never claims the AI is the more accurate of the two.
 *
 * Expert score rows go in; no validator name, contact detail or written
 * feedback is read here, and none of it ever reaches a prompt.
 */

import { DIMENSIONS, DimensionKey, average, overallFromDimensions, sum5 } from '../ideas/score.util';
import { AiVsExpert } from './agent-report';

/** Per-dimension agreement on the shared 0-50 scale. */
const HIGH_AGREEMENT_DELTA = 5;
const MODERATE_AGREEMENT_DELTA = 10;
/** Overall agreement on the 0-100 scale. */
const ALIGNED_OVERALL_DELTA = 10;

export function compareAiToExperts(
  aiDimensions: Record<DimensionKey, number>,
  validations: any[],
): AiVsExpert | null {
  if (!validations.length) return null;

  const expertScores: Partial<Record<DimensionKey, number | null>> = {};
  for (const dim of DIMENSIONS) {
    const scored = validations.filter(v => v[dim.key]).map(v => sum5(v[dim.key], dim.fields));
    expertScores[dim.key] = scored.length ? average(scored) : null;
  }

  const dimensions = DIMENSIONS.map(dim => {
    const ai = round1(aiDimensions[dim.key] ?? 0);
    const expertRaw = expertScores[dim.key];
    const expert = expertRaw === null || expertRaw === undefined ? null : round1(expertRaw);
    const delta = expert === null ? null : round1(ai - expert);
    return {
      key: dim.key,
      label: dim.label,
      ai,
      expert,
      delta,
      agreement: delta === null ? null : agreementFor(Math.abs(delta)),
    };
  });

  const aiOverall = round1(overallFromDimensions(aiDimensions));
  const expertOverall = round1(overallFromDimensions(expertScores));
  const overallDelta = aiOverall - expertOverall;

  const agreement: AiVsExpert['agreement'] =
    Math.abs(overallDelta) <= ALIGNED_OVERALL_DELTA
      ? 'ALIGNED'
      : overallDelta > 0
        ? 'AI_MORE_OPTIMISTIC'
        : 'AI_MORE_CAUTIOUS';

  return {
    expertValidations: validations.length,
    expertOverall,
    aiOverall,
    agreement,
    headline: headlineFor(agreement, dimensions),
    dimensions,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function agreementFor(absDelta: number): 'HIGH' | 'MODERATE' | 'LOW' {
  if (absDelta <= HIGH_AGREEMENT_DELTA) return 'HIGH';
  if (absDelta <= MODERATE_AGREEMENT_DELTA) return 'MODERATE';
  return 'LOW';
}

/**
 * One sentence a founder can act on: the sharpest disagreement if there is one,
 * otherwise the shared weakness both sides found. Framed as a prompt to
 * investigate, never as a scoreboard.
 */
function headlineFor(agreement: AiVsExpert['agreement'], dimensions: AiVsExpert['dimensions']): string {
  const compared = dimensions.filter(d => d.delta !== null);
  if (!compared.length) return 'No overlapping dimensions to compare yet.';

  const widest = compared.reduce((a, b) => (Math.abs(b.delta!) > Math.abs(a.delta!) ? b : a));

  if (Math.abs(widest.delta!) > MODERATE_AGREEMENT_DELTA) {
    return widest.delta! > 0
      ? `AI research suggests stronger ${widest.label} than experts scored. Additional validation in this area is recommended.`
      : `AI research reads ${widest.label} more cautiously than experts scored. Worth investigating which view your own evidence supports.`;
  }

  // Broad agreement — surface where both sides are weakest, that is the signal.
  const weakest = compared.reduce((a, b) => (b.ai + (b.expert ?? 0) < a.ai + (a.expert ?? 0) ? b : a));
  if (weakest.ai <= 30) {
    return `AI and experts agree that ${weakest.label} is the weakest area of this idea.`;
  }

  return agreement === 'ALIGNED'
    ? 'AI research and expert judgement broadly agree across the scored dimensions.'
    : 'AI research and expert judgement differ moderately — treat the gaps below as areas to test further.';
}
