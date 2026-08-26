import { IdeasService } from '../ideas.service';
import { DIMENSIONS, OVERALL_DIMENSIONS, overallFromDimensions, sum5 } from '../score.util';

/**
 * The scoring rubric moved out of ideas.service into score.util so the AI Deep
 * Dive could share it. These lock the refactor: the aggregation the dashboard
 * has always shown must produce exactly the same numbers, and the two overall
 * score paths (aggregateScores and leanOverallScore) must not drift apart.
 */

function validationAt(per: number) {
  const row: any = { id: 'v1' };
  for (const dim of DIMENSIONS) row[dim.key] = Object.fromEntries(dim.fields.map(f => [f, per]));
  return row;
}

const service = new IdeasService({} as any, {} as any, {} as any);
const aggregate = (validations: any[]) => (service as any).aggregateScores(validations) as any;
const lean = (validations: any[]) => (service as any).leanOverallScore(validations) as number | null;

describe('score.util', () => {
  it('sums five sub-criteria into a 0-50 dimension score', () => {
    expect(sum5({ a: 10, b: 10, c: 10, d: 10, e: 10 }, ['a', 'b', 'c', 'd', 'e'])).toBe(50);
    expect(sum5({ a: 10, b: 8, c: 6, d: 4, e: 2 }, ['a', 'b', 'c', 'd', 'e'])).toBe(30);
    expect(sum5({ a: 5 }, ['a', 'missing'])).toBe(5);
  });

  it('leaves investor attractiveness out of the overall score', () => {
    expect(OVERALL_DIMENSIONS).not.toContain('investorAttractiveness');

    const base = Object.fromEntries(DIMENSIONS.map(d => [d.key, 40])) as any;
    const withZeroedInvestor = { ...base, investorAttractiveness: 0 };

    expect(overallFromDimensions(base)).toBe(80);
    expect(overallFromDimensions(withZeroedInvestor)).toBe(80);
  });

  it('skips unscored dimensions rather than counting them as zero', () => {
    expect(overallFromDimensions({ marketOpportunity: 50, feasibility: null })).toBe(100);
    expect(overallFromDimensions({})).toBe(0);
  });
});

describe('aggregateScores after the extraction', () => {
  it('produces the same per-dimension averages and overall score as before', () => {
    const out = aggregate([validationAt(8)]);

    expect(out.totalValidations).toBe(1);
    expect(out.overallScore).toBe(80);
    expect(out.marketOpportunityAvg).toBe(40);
    expect(out.feasibilityAvg).toBe(40);
    expect(out.investorAttractivenessAvg).toBe(40);
  });

  it('averages a dimension across validators', () => {
    const out = aggregate([validationAt(4), validationAt(8)]);
    expect(out.marketOpportunityAvg).toBe(30); // (20 + 40) / 2
    expect(out.overallScore).toBe(60);
  });

  it('still returns just the count when there are no validations', () => {
    expect(aggregate([])).toEqual({ totalValidations: 0 });
  });

  it('ignores dimensions no validator scored', () => {
    const partial: any = { id: 'v1', marketOpportunity: { problemSeverity: 10, marketSize: 10, willingnessToPay: 10, marketGrowthRate: 10, competitionGap: 10 } };
    const out = aggregate([partial]);

    expect(out.overallScore).toBe(100); // the one scored dimension, not diluted by seven zeroes
    expect(out.feasibilityAvg).toBe(0);
  });
});

describe('leanOverallScore', () => {
  it('matches aggregateScores exactly — the benchmark depends on it', () => {
    for (const per of [2, 5, 7, 9]) {
      const validations = [validationAt(per)];
      expect(lean(validations)).toBe(aggregate(validations).overallScore);
    }
  });

  it('matches on mixed validator scores too', () => {
    const validations = [validationAt(3), validationAt(7), validationAt(10)];
    expect(lean(validations)).toBe(aggregate(validations).overallScore);
  });

  it('returns null with nothing to score', () => {
    expect(lean([])).toBeNull();
    expect(lean([{ id: 'v1' }])).toBeNull();
  });
});
