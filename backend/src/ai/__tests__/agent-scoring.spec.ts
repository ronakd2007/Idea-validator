import { DIMENSIONS, DimensionKey, overallFromDimensions } from '../../ideas/score.util';
import { compareAiToExperts } from '../agent-scoring';

/** A validation row where every sub-criterion of every dimension scores `per`. */
function validationAt(per: number) {
  const row: any = {};
  for (const dim of DIMENSIONS) {
    row[dim.key] = Object.fromEntries(dim.fields.map(f => [f, per]));
  }
  return row;
}

const aiScores = (value: number) =>
  Object.fromEntries(DIMENSIONS.map(d => [d.key, value])) as Record<DimensionKey, number>;

describe('compareAiToExperts', () => {
  it('returns null when no expert has reviewed yet', () => {
    expect(compareAiToExperts(aiScores(40), [])).toBeNull();
  });

  it('reports ALIGNED when both land in the same place', () => {
    // Experts: 8/10 on each of 5 criteria = 40/50 per dimension.
    const out = compareAiToExperts(aiScores(40), [validationAt(8)])!;

    expect(out.expertOverall).toBe(80);
    expect(out.aiOverall).toBe(80);
    expect(out.agreement).toBe('ALIGNED');
    expect(out.expertValidations).toBe(1);
  });

  it('excludes investor attractiveness from both overall scores', () => {
    const ai = { ...aiScores(40), investorAttractiveness: 0 };
    const out = compareAiToExperts(ai, [validationAt(8)])!;

    // Dropping the excluded dimension to zero must not move the overall.
    expect(out.aiOverall).toBe(80);
    expect(out.aiOverall).toBe(overallFromDimensions(ai));
  });

  it('flags the AI as more optimistic when it scores well above the experts', () => {
    const out = compareAiToExperts(aiScores(45), [validationAt(4)])!;

    expect(out.agreement).toBe('AI_MORE_OPTIMISTIC');
    expect(out.headline).toContain('AI research suggests stronger');
  });

  it('flags the AI as more cautious when it scores well below', () => {
    const out = compareAiToExperts(aiScores(10), [validationAt(9)])!;

    expect(out.agreement).toBe('AI_MORE_CAUTIOUS');
    expect(out.headline).toContain('more cautiously');
  });

  it('classifies per-dimension agreement by how far apart the two are', () => {
    const ai = { ...aiScores(40), feasibility: 43, founderFit: 48, innovation: 20 };
    const out = compareAiToExperts(ai, [validationAt(8)])!;
    const byKey = Object.fromEntries(out.dimensions.map(d => [d.key, d]));

    expect(byKey.marketOpportunity.agreement).toBe('HIGH');   // delta 0
    expect(byKey.feasibility.agreement).toBe('HIGH');         // delta 3
    expect(byKey.founderFit.agreement).toBe('MODERATE');      // delta 8
    expect(byKey.innovation.agreement).toBe('LOW');           // delta -20
    expect(byKey.innovation.delta).toBe(-20);
  });

  it('averages across multiple expert reviews', () => {
    const out = compareAiToExperts(aiScores(30), [validationAt(4), validationAt(6)])!;

    expect(out.expertValidations).toBe(2);
    expect(out.dimensions[0].expert).toBe(25); // (20 + 30) / 2
  });

  it('leaves a dimension uncompared when no expert scored it', () => {
    const partial: any = { marketOpportunity: { problemSeverity: 10, marketSize: 10, willingnessToPay: 10, marketGrowthRate: 10, competitionGap: 10 } };
    const out = compareAiToExperts(aiScores(40), [partial])!;
    const feasibility = out.dimensions.find(d => d.key === 'feasibility')!;

    expect(feasibility.expert).toBeNull();
    expect(feasibility.delta).toBeNull();
    expect(feasibility.agreement).toBeNull();
  });

  it('surfaces a shared weakness when the two broadly agree', () => {
    const ai = { ...aiScores(40), revenuePotential: 12 };
    const experts = validationAt(8);
    experts.revenuePotential = Object.fromEntries(DIMENSIONS.find(d => d.key === 'revenuePotential')!.fields.map(f => [f, 2]));

    const out = compareAiToExperts(ai, [experts])!;

    expect(out.headline).toContain('agree');
    expect(out.headline).toContain('Revenue Potential');
  });
});
