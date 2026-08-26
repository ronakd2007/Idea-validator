import { z } from 'zod';

/**
 * The shapes each pipeline step must return.
 *
 * These are handed to Claude as a structured-output format, so the response is
 * schema-valid by construction - no "return ONLY JSON" pleading, no reparse
 * retry. That is a guarantee about SHAPE only. It says nothing about whether
 * the content is true, so every one of these still goes through the whitelist
 * and clamps in agent-report.ts before it is stored or shown.
 *
 * `.nullable()` is used deliberately throughout: a null here is the model
 * saying "the evidence did not support this", which is the answer the product
 * wants when that is the case.
 */

const citation = z.object({
  n: z.number().int().describe('The number of the source that supports this, from the numbered list provided'),
  finding: z.string().describe('What that source actually says'),
});

export const FrameSchema = z.object({
  oneLiner: z.string().describe('One plain sentence describing the idea'),
  industry: z.string(),
  targetCustomer: z.string().describe('Who specifically buys or uses this'),
  geography: z.string().describe("Primary market, or 'Global' if unclear"),
  keyUnknowns: z.array(z.string()).describe('The 3-5 things that most need evidence before this idea is credible'),
  queries: z.object({
    competitors: z.array(z.string()).describe('Up to 3 plain web searches that would surface real competing products'),
    market: z.array(z.string()).describe('Up to 2 searches for market size, growth or trends'),
    customers: z.array(z.string()).describe('Up to 2 searches for what these customers complain about'),
  }),
});

export const CompetitorsSchema = z.object({
  direct: z.array(
    z.object({
      name: z.string(),
      url: z.string().nullable().describe('Only a URL from the numbered sources; null if none of them covers this company'),
      whatTheyDo: z.string(),
      pricing: z.string().nullable().describe('Only if a source states it. Null if pricing was not publicly verifiable'),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      threat: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe('How directly this competes with the idea being researched'),
    }),
  ),
  indirect: z.array(z.object({ name: z.string(), description: z.string() })),
  substitutes: z.array(z.string()).describe('What customers do today instead of buying any product'),
  differentiationInference: z.string().nullable().describe('Your own reasoning about where this idea could differentiate - an inference, not a fact'),
  summary: z.string(),
  citations: z.array(citation),
});

export const MarketSchema = z.object({
  size: z.object({
    tam: z.string().nullable().describe('Only if a source states it, with its year. Null otherwise - never estimate'),
    sam: z.string().nullable(),
    som: z.string().nullable(),
  }),
  growth: z.string().nullable(),
  trends: z.array(z.string()),
  headwinds: z.array(z.string()),
  regulation: z.string().nullable(),
  summary: z.string(),
  citations: z.array(citation),
});

export const CustomersSchema = z.object({
  segments: z.array(
    z.object({
      name: z.string(),
      painPoints: z.array(z.string()),
      jobsToBeDone: z.array(z.string()),
      intensity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    }),
  ),
  currentAlternatives: z.array(z.string()),
  buyingBehavior: z.string().nullable(),
  webEvidence: z.array(z.string()).describe('What the sources actually show about these customers - paraphrase, never a fabricated quote'),
  inferences: z.array(z.string()).describe('What you reason from the above, clearly your own reasoning'),
  unknowns: z.array(z.string()).describe('What remains unknown and would need direct customer research'),
  summary: z.string(),
  citations: z.array(citation),
});

const GAP_KEYS = ['PRICING', 'REVENUE_POTENTIAL', 'CUSTOMER_DEMAND', 'DIFFERENTIATION', 'MARKET_OPPORTUNITY', 'RISK_MARKETADOPTION'] as const;

export const SynthesisSchema = z.object({
  biggestOpportunity: z.string().describe('The single strongest thing this idea has going for it, in one sentence'),
  biggestRisk: z.string().describe('The single thing most likely to kill it, in one sentence'),
  swot: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }),
  risks: z.array(
    z.object({
      risk: z.string(),
      category: z.enum(['MARKET', 'EXECUTION', 'FINANCIAL', 'REGULATORY', 'TECHNOLOGY', 'COMPETITION', 'OTHER']),
      likelihood: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      impact: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      whyItMatters: z.string(),
      mitigation: z.string(),
      missingEvidence: z.string().nullable().describe('What nobody has checked yet. Null only when the risk is genuinely well evidenced'),
    }),
  ),
  businessModel: z.object({
    revenueModelFit: z.string(),
    pricingLogic: z.string(),
    costDrivers: z.array(z.string()),
    monetizationRisks: z.array(z.string()),
    keyAssumptions: z.array(z.string()),
  }),
  gtm: z.object({
    initialCustomer: z.string(),
    channels: z.array(z.string()),
    adoptionBarriers: z.array(z.string()),
    earlyExperiment: z.string().nullable(),
  }),
  experiments: z.array(
    z.object({
      title: z.string(),
      hypothesis: z.string(),
      whatToTest: z.string(),
      targetUsers: z.string(),
      successMetric: z.string(),
      sampleThreshold: z.string().nullable(),
      decisionInformed: z.string().describe('What decision the result would inform'),
      gapKey: z.enum(GAP_KEYS).nullable().describe('Set when this experiment is testable with a customer survey, else null'),
    }),
  ),
});

const dimensionScores = z.object({
  marketOpportunity: z.number(),
  feasibility: z.number(),
  founderFit: z.number(),
  revenuePotential: z.number(),
  scalability: z.number(),
  innovation: z.number(),
  socialImpact: z.number(),
  investorAttractiveness: z.number(),
});

const dimensionRationale = z.object({
  marketOpportunity: z.string(),
  feasibility: z.string(),
  founderFit: z.string(),
  revenuePotential: z.string(),
  scalability: z.string(),
  innovation: z.string(),
  socialImpact: z.string(),
  investorAttractiveness: z.string(),
});

export const ScoreSchema = z.object({
  dimensions: dimensionScores.describe('Each dimension 0-50, the sum of its five 0-10 criteria'),
  rationale: dimensionRationale.describe('One sentence per dimension citing what in the research drove the score'),
  verdict: z.enum(['GO', 'GO_WITH_CHANGES', 'PIVOT', 'NO_GO']),
  verdictSummary: z.string().describe('2-4 sentences explaining the verdict to the founder'),
  keyEvidence: z.array(z.string()),
  biggestUncertainty: z.string().nullable(),
  nextValidationStep: z.string().nullable(),
  confidence: z.number().describe('0-100, reflecting EVIDENCE QUALITY rather than how decisive the assessment feels'),
});

export type FrameOutput = z.infer<typeof FrameSchema>;
export type CompetitorsOutput = z.infer<typeof CompetitorsSchema>;
export type MarketOutput = z.infer<typeof MarketSchema>;
export type CustomersOutput = z.infer<typeof CustomersSchema>;
export type SynthesisOutput = z.infer<typeof SynthesisSchema>;
export type ScoreOutput = z.infer<typeof ScoreSchema>;
