/**
 * The scoring rubric, extracted so there is exactly ONE definition of it.
 *
 * Both the expert aggregation (IdeasService.aggregateScores) and the AI Deep
 * Dive agent score the same eight dimensions on the same 0-50 scale. Before
 * this file the sub-criteria lists and the overall-score rule lived inline in
 * ideas.service.ts, so an AI score computed anywhere else would have silently
 * drifted from the expert one it is compared against.
 *
 * Pure functions only — no Nest DI, no Prisma. The agent imports these
 * directly, which keeps IdeasModule and AiModule free of a circular import.
 */

export type DimensionKey =
  | 'marketOpportunity'
  | 'feasibility'
  | 'founderFit'
  | 'revenuePotential'
  | 'scalability'
  | 'innovation'
  | 'socialImpact'
  | 'investorAttractiveness';

/**
 * Each dimension is the sum of its five 0-10 sub-criteria, so 0-50.
 * The field names must match the Prisma score sub-models exactly.
 */
export const DIMENSIONS: { key: DimensionKey; label: string; fields: string[] }[] = [
  { key: 'marketOpportunity', label: 'Market Opportunity', fields: ['problemSeverity', 'marketSize', 'willingnessToPay', 'marketGrowthRate', 'competitionGap'] },
  { key: 'feasibility', label: 'Feasibility', fields: ['technicalComplexity', 'capitalRequirement', 'regulatoryDifficulty', 'talentAvailability', 'timeToLaunch'] },
  { key: 'founderFit', label: 'Founder Fit', fields: ['industryKnowledge', 'relevantExperience', 'networkAccess', 'passion', 'skillAlignment'] },
  { key: 'revenuePotential', label: 'Revenue Potential', fields: ['pricingPower', 'recurringRevenuePotential', 'profitMarginPotential', 'upsellOpportunities', 'customerLifetimeValue'] },
  { key: 'scalability', label: 'Scalability', fields: ['geographicExpansion', 'automationPotential', 'operationalComplexity', 'dependenceOnFounder', 'networkEffects'] },
  { key: 'innovation', label: 'Innovation', fields: ['uniqueness', 'patentability', 'competitiveAdvantage', 'disruptionPotential', 'defensibility'] },
  { key: 'socialImpact', label: 'Social Impact', fields: ['jobCreation', 'environmentalBenefit', 'communityBenefit', 'inclusion', 'sustainability'] },
  { key: 'investorAttractiveness', label: 'Investor Attractiveness', fields: ['marketSize', 'growthPotential', 'scalability', 'exitPotential', 'defensibility'] },
];

/**
 * The seven dimensions that make up the headline score. Investor
 * Attractiveness is deliberately NOT one of them — it is reported on its own
 * so the overall score reflects the idea, not its fundraising appeal. Changing
 * this list changes every score on the platform.
 */
export const OVERALL_DIMENSIONS: DimensionKey[] = [
  'marketOpportunity',
  'feasibility',
  'founderFit',
  'revenuePotential',
  'scalability',
  'innovation',
  'socialImpact',
];

export const MAX_DIMENSION_SCORE = 50;

/** Sum of the named 0-10 fields on one score sub-model. Missing fields count 0. */
export function sum5(obj: any, fields: string[]): number {
  return fields.reduce((s, f) => s + (obj?.[f] || 0), 0);
}

export function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * The headline 0-100 score: each of the seven overall dimensions rescaled from
 * 0-50 to 0-100, then averaged. Dimensions with no score at all are skipped
 * rather than counted as zero, so a partially-scored idea is not penalised.
 */
export function overallFromDimensions(scores: Partial<Record<DimensionKey, number | null>>): number {
  const normalized = OVERALL_DIMENSIONS
    .map(key => scores[key])
    .filter((s): s is number => s !== null && s !== undefined)
    .map(s => (s / MAX_DIMENSION_SCORE) * 100);
  return average(normalized);
}
