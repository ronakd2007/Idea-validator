// The 12 real validation dimensions, matching the Prisma schema's score
// models (MarketOpportunityScore, FeasibilityScore, ...) and the wizard
// steps in /validator/ideas/[id]/validate. Keep this in sync by hand with
// the FRAMEWORKS array in components/landing/sceneConfig.ts — that one
// carries extra narrative-only fields (weak/improvedScore) that don't
// belong here, so the lists are kept separate rather than shared.
export interface FrameworkMeta {
  name: string;
  stepIndex: number; // index into the validate wizard's `steps` array
  maxScore: number | null; // null = not a simple 1-10-per-metric sum
}

export const FRAMEWORKS: FrameworkMeta[] = [
  { name: 'Market Opportunity', stepIndex: 1, maxScore: 50 },
  { name: 'Feasibility', stepIndex: 1, maxScore: 50 },
  { name: 'Founder Fit', stepIndex: 2, maxScore: 50 },
  { name: 'Revenue Potential', stepIndex: 2, maxScore: 50 },
  { name: 'Scalability', stepIndex: 3, maxScore: 50 },
  { name: 'Risk Assessment', stepIndex: 3, maxScore: null },
  { name: 'Investor Attractiveness', stepIndex: 4, maxScore: 50 },
  { name: 'Innovation', stepIndex: 4, maxScore: 50 },
  { name: 'Social Impact', stepIndex: 5, maxScore: 50 },
  { name: 'Customer Validation', stepIndex: 5, maxScore: null },
  { name: 'Shark Tank Score', stepIndex: 6, maxScore: 100 },
  { name: 'Startup Success', stepIndex: 6, maxScore: 100 },
];
