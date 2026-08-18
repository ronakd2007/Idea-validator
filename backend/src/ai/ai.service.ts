import { Injectable, Logger, NotFoundException, ForbiddenException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { SurveyAnalyticsService } from '../survey/survey-analytics.service';

const CHOICE_TYPES = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'];
const KNOWN_TYPES = ['SHORT_ANSWER', 'PARAGRAPH', 'MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'YES_NO', 'RATING', 'LINEAR_SCALE'];
const MAX_INPUT_LINES = 40;

export interface GeneratedQuestion {
  questionText: string;
  type: string;
  options: string[];
  required: boolean;
  settings: { min?: number; max?: number; minLabel?: string; maxLabel?: string };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private prisma: PrismaService, private surveyAnalytics: SurveyAnalyticsService) {}

  /**
   * Real numbers from the idea's best-answered survey, formatted for the
   * prompt. Returns null when there is no survey evidence yet — the prompt
   * says so explicitly instead of letting the model invent customer data.
   */
  private async buildSurveyEvidence(ideaId: string): Promise<string | null> {
    const survey = await this.prisma.survey.findFirst({
      where: { ideaId, responses: { some: {} } },
      orderBy: { responses: { _count: 'desc' } },
      select: { id: true, title: true },
    });
    if (!survey) return null;

    try {
      const analytics = await this.surveyAnalytics.getAnalytics(survey.id, null, {});
      const lines: string[] = [
        `Survey "${survey.title}" — ${analytics.summary.totalResponses} responses, completion rate ${analytics.activity.completionRate != null ? Math.round(analytics.activity.completionRate) + '%' : 'n/a'}.`,
      ];
      const primary = analytics.eligibleOutcomeQuestions[0];
      if (primary) {
        const qa: any = analytics.questions.find((q: any) => q.id === primary.id);
        if (primary.type === 'YES_NO') {
          const yes = qa?.distribution?.find((d: any) => d.label === 'Yes');
          if (yes) lines.push(`"${primary.questionText}": ${yes.pct.toFixed(0)}% answered Yes.`);
        } else if (qa?.average != null) {
          lines.push(`"${primary.questionText}": average ${qa.average.toFixed(1)}/${qa.max}.`);
        }
      }
      for (const insight of analytics.insights.slice(0, 3)) {
        lines.push(`${insight.title}: ${insight.body}`);
      }
      return lines.join('\n');
    } catch {
      return null;
    }
  }

  // Groq failures used to escape as bare 500 "Internal server error", which
  // made a bad/revoked GROQ_API_KEY in production undiagnosable from the UI.
  // This logs the real cause server-side and returns a message that says
  // which kind of failure it was.
  private toAiError(err: any): ServiceUnavailableException {
    const status = err?.status ?? err?.response?.status;
    this.logger.error(`Groq request failed (status ${status ?? 'n/a'}): ${err?.message}`);
    if (status === 401 || status === 403) {
      return new ServiceUnavailableException('AI service rejected the API key — check GROQ_API_KEY on the server.');
    }
    if (status === 429) {
      return new ServiceUnavailableException('AI service is rate limited right now — try again in a minute.');
    }
    if ((status === 400 || status === 404) && /model|decommission/i.test(err?.message || '')) {
      return new ServiceUnavailableException('The configured AI model is no longer available — the model name needs updating.');
    }
    return new ServiceUnavailableException('AI service is temporarily unavailable — try again shortly.');
  }

  async generateDashboardSummary(ideaId: string, founderId: string, refresh = false, readOnly = false): Promise<{ summary: string; generatedAt: Date | null; cached: boolean }> {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        validations: {
          include: {
            marketOpportunity: true,
            feasibility: true,
            founderFit: true,
            revenuePotential: true,
            scalability: true,
            riskAssessment: true,
            investorAttractiveness: true,
            innovation: true,
            socialImpact: true,
            customerValidation: true,
            sharkTank: true,
            startupSuccess: true,
            openFeedback: true,
          },
        },
      },
    });

    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');
    if (!idea.validations.length) throw new ForbiddenException('No validations yet to summarise');

    // Persisted summary is served unless the founder explicitly regenerates —
    // the dashboard, public page and report all read the same stored text.
    if (!refresh && idea.aiSummary) {
      return { summary: idea.aiSummary, generatedAt: idea.aiSummaryAt, cached: true };
    }

    // Read-only callers (View as User) never trigger generation: no Groq
    // bill, no write to the idea. Empty summary just renders as "not
    // generated yet" on the dashboard.
    if (readOnly) {
      return { summary: idea.aiSummary || '', generatedAt: idea.aiSummaryAt, cached: true };
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Groq API key not configured');

    const surveyEvidence = await this.buildSurveyEvidence(ideaId);

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const sum5 = (obj: any, keys: string[]) =>
      obj ? keys.reduce((s: number, k: string) => s + (obj[k] || 0), 0) : 0;

    const v = idea.validations;
    const scores = {
      marketOpportunity: avg(v.filter(x => x.marketOpportunity).map(x =>
        sum5(x.marketOpportunity, ['problemSeverity','marketSize','willingnessToPay','marketGrowthRate','competitionGap']))),
      feasibility: avg(v.filter(x => x.feasibility).map(x =>
        sum5(x.feasibility, ['technicalComplexity','capitalRequirement','regulatoryDifficulty','talentAvailability','timeToLaunch']))),
      founderFit: avg(v.filter(x => x.founderFit).map(x =>
        sum5(x.founderFit, ['industryKnowledge','relevantExperience','networkAccess','passion','skillAlignment']))),
      revenuePotential: avg(v.filter(x => x.revenuePotential).map(x =>
        sum5(x.revenuePotential, ['pricingPower','recurringRevenuePotential','profitMarginPotential','upsellOpportunities','customerLifetimeValue']))),
      scalability: avg(v.filter(x => x.scalability).map(x =>
        sum5(x.scalability, ['geographicExpansion','automationPotential','operationalComplexity','dependenceOnFounder','networkEffects']))),
      innovation: avg(v.filter(x => x.innovation).map(x =>
        sum5(x.innovation, ['uniqueness','patentability','competitiveAdvantage','disruptionPotential','defensibility']))),
      socialImpact: avg(v.filter(x => x.socialImpact).map(x =>
        sum5(x.socialImpact, ['jobCreation','environmentalBenefit','communityBenefit','inclusion','sustainability']))),
      investorAttractiveness: avg(v.filter(x => x.investorAttractiveness).map(x =>
        sum5(x.investorAttractiveness, ['marketSize','growthPotential','scalability','exitPotential','defensibility']))),
      sharkTank: avg(v.filter(x => x.sharkTank).map(x =>
        (x.sharkTank.problemImportance / 10) * 25 + (x.sharkTank.marketSize / 10) * 20 +
        (x.sharkTank.revenuePotential / 10) * 20 + (x.sharkTank.executionEase / 10) * 15 +
        (x.sharkTank.scalability / 10) * 20)),
      validationScore: avg(v.filter(x => x.startupSuccess).map(x =>
        (x.startupSuccess.founderTeam / 10) * 25 + (x.startupSuccess.marketSize / 10) * 20 +
        (x.startupSuccess.productDifferentiation / 10) * 15 + (x.startupSuccess.traction / 10) * 15 +
        (x.startupSuccess.businessModel / 10) * 10 + (x.startupSuccess.competition / 10) * 5 +
        (x.startupSuccess.timing / 10) * 5 + (x.startupSuccess.fundingReadiness / 10) * 5)),
    };

    const cvList = v.filter(x => x.customerValidation);
    const pct = (arr: boolean[]) => arr.length ? (arr.filter(Boolean).length / arr.length) * 100 : 0;
    const customerValidation = {
      wouldUse: pct(cvList.map(x => x.customerValidation.wouldUse)),
      wouldPay: pct(cvList.map(x => x.customerValidation.wouldPay)),
      wouldRecommend: pct(cvList.map(x => x.customerValidation.wouldRecommend)),
    };

    const feedbacks = v.filter(x => x.openFeedback).map(x => ({
      strength: x.openFeedback.biggestStrength,
      weakness: x.openFeedback.biggestWeakness,
      improvement: x.openFeedback.suggestedImprovement,
    }));

    const prompt = `You are an expert startup analyst reviewing a business idea validation report. Write a clear, honest, and actionable AI summary for the founder. Be specific — reference actual numbers and recurring themes from the feedback.

IDEA: "${idea.title}"
INDUSTRY: ${idea.industryCategory} | STAGE: ${idea.stage.replace('_', ' ')}
PROBLEM: ${idea.problemStatement}
SOLUTION: ${idea.solutionDescription}
TOTAL VALIDATORS: ${v.length}

SCORES (all out of 50 unless noted):
- Market Opportunity: ${scores.marketOpportunity.toFixed(1)}/50
- Feasibility: ${scores.feasibility.toFixed(1)}/50
- Founder Fit: ${scores.founderFit.toFixed(1)}/50
- Revenue Potential: ${scores.revenuePotential.toFixed(1)}/50
- Scalability: ${scores.scalability.toFixed(1)}/50
- Innovation: ${scores.innovation.toFixed(1)}/50
- Social Impact: ${scores.socialImpact.toFixed(1)}/50
- Investor Attractiveness: ${scores.investorAttractiveness.toFixed(1)}/50
- Shark Tank Score: ${scores.sharkTank.toFixed(1)}/100
- Validation Score: ${scores.validationScore.toFixed(1)}/100

CUSTOMER VALIDATION:
- Would Use: ${customerValidation.wouldUse.toFixed(0)}%
- Would Pay: ${customerValidation.wouldPay.toFixed(0)}%
- Would Recommend: ${customerValidation.wouldRecommend.toFixed(0)}%

VALIDATOR FEEDBACK (${feedbacks.length} responses):
${feedbacks.map((f, i) => `[${i + 1}] Strength: "${f.strength}" | Weakness: "${f.weakness}" | Suggestion: "${f.improvement}"`).join('\n')}

RISK ASSESSMENT (validator votes, HIGH probability counts per risk):
${['competition', 'regulatory', 'technology', 'funding', 'marketAdoption'].map((r) => {
  const highs = v.filter(x => x.riskAssessment && (x.riskAssessment as any)[`${r}Probability`] === 'HIGH').length;
  return `- ${r}: ${highs}/${v.filter(x => x.riskAssessment).length} rated HIGH`;
}).join('\n')}

CUSTOMER SURVEY EVIDENCE (real responses from the public, separate from expert opinion):
${surveyEvidence || 'None yet — this founder has not collected any public survey responses.'}

Write the summary in this exact format — use plain text, no markdown, no bullet symbols:

VERDICT
[One bold honest sentence about the overall potential of this idea based on the data.]

WHAT'S WORKING
[2-3 sentences about the strongest areas backed by the scores and feedback.]

WHAT NEEDS WORK
[2-3 sentences about the weakest areas, referencing specific low scores and repeated concerns from validators.]

NEXT STEPS
[Exactly 3 actions, each as one sentence. Every action MUST cite a specific number from the data above (a score, a percentage, or a count) as its justification. Never give generic advice a founder could get without this data. If there is no customer survey evidence yet, one of the 3 actions must be running a survey with 20-30 target customers to test the weakest scored area.]`;

    const groq = new Groq({ apiKey });
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        reasoning_effort: 'low',
      });
    } catch (err) {
      throw this.toAiError(err);
    }

    const summary = completion.choices[0]?.message?.content || '';
    const generatedAt = new Date();
    // Persist so subsequent dashboard visits, the public page and the report
    // reuse this text instead of re-billing Groq.
    await this.prisma.idea.update({ where: { id: ideaId }, data: { aiSummary: summary, aiSummaryAt: generatedAt } });
    return { summary, generatedAt, cached: false };
  }

  // ---------- assumption suggestions ----------

  private static readonly ASSUMPTION_CATEGORIES = ['PRICING', 'CUSTOMER', 'PROBLEM', 'COMPETITION', 'TECHNOLOGY', 'OTHER'];

  /**
   * Suggests up to 5 testable assumptions for the founder to REVIEW — nothing
   * is ever saved here; the founder ticks the ones they agree with. Works from
   * a saved idea (ideaId) or from in-progress form fields (draft), since the
   * submit flow offers suggestions before the idea exists.
   */
  async suggestAssumptions(
    founderId: string,
    input: { ideaId?: string; draft?: { title?: string; problemStatement?: string; solutionDescription?: string; targetCustomer?: string; industryCategory?: string } }
  ): Promise<{ suggestions: { statement: string; category: string }[] }> {
    let idea: { title: string; industryCategory: string; problemStatement: string; solutionDescription: string; targetCustomer: string };

    if (input.ideaId) {
      const found = await this.prisma.idea.findUnique({
        where: { id: input.ideaId },
        select: { founderId: true, title: true, industryCategory: true, problemStatement: true, solutionDescription: true, targetCustomer: true },
      });
      if (!found) throw new NotFoundException('Idea not found');
      if (found.founderId !== founderId) throw new ForbiddenException('Access denied');
      idea = found;
    } else {
      const d = input.draft || {};
      if (!d.title?.trim() || !d.problemStatement?.trim()) {
        throw new BadRequestException('Fill in at least the idea title and problem statement first.');
      }
      idea = {
        title: String(d.title).slice(0, 200),
        industryCategory: String(d.industryCategory || 'General').slice(0, 80),
        problemStatement: String(d.problemStatement).slice(0, 2000),
        solutionDescription: String(d.solutionDescription || '').slice(0, 2000),
        targetCustomer: String(d.targetCustomer || '').slice(0, 1000),
      };
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Groq API key not configured');

    const prompt = `A founder is defining ASSUMPTIONS — beliefs that must be true for their idea to succeed, which will later be tested against real survey and expert-validation evidence.

THE IDEA
Title: ${idea.title}
Industry: ${idea.industryCategory}
Problem: ${idea.problemStatement}
Solution: ${idea.solutionDescription}
Target customer: ${idea.targetCustomer}

Suggest exactly 5 assumptions this founder should test. RULES:
1. Each is a BELIEF/HYPOTHESIS about this specific idea — phrased as something to verify, never stated as a fact.
2. Each must be testable with a customer survey or expert review (demand, willingness to pay, problem frequency, preference over alternatives, buildability).
3. Where a threshold makes the assumption sharper, use a plain generic one ("at least half", "at least 60%") — never invent specific market data.
4. Max 140 characters each. No numbering inside the statement.
5. Category must be one of: PRICING, CUSTOMER, PROBLEM, COMPETITION, TECHNOLOGY, OTHER.

Return ONLY a single JSON object: { "assumptions": [ { "statement": string, "category": string } ] }`;

    const groq = new Groq({ apiKey });
    let raw: any;
    try {
      const completion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1000,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
      });
      raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch (err: any) {
      if (err instanceof SyntaxError) throw new ServiceUnavailableException("Couldn't generate suggestions — please try again.");
      throw this.toAiError(err);
    }

    // Whitelist + clamp — the model's output is never trusted as-is.
    const suggestions = (Array.isArray(raw?.assumptions) ? raw.assumptions : [])
      .map((a: any) => ({
        statement: String(a?.statement || '').trim().slice(0, 300),
        category: AiService.ASSUMPTION_CATEGORIES.includes(a?.category) ? a.category : 'OTHER',
      }))
      .filter((a: any) => a.statement.length >= 5)
      .slice(0, 5);

    if (!suggestions.length) throw new ServiceUnavailableException("Couldn't generate suggestions — please try again.");
    return { suggestions };
  }

  // ---------- gap-to-survey generator ----------

  // Question archetypes per validation gap. The model adapts these to the
  // specific idea — it decides wording, never the research methodology.
  private static readonly GAP_PLAYBOOKS: Record<string, { label: string; goal: string; archetypes: string[] }> = {
    PRICING: {
      label: 'Willingness to Pay',
      goal: 'find out whether target customers would actually pay, at what price, and what blocks them from paying',
      archetypes: [
        'Would you pay for a solution to this problem? (YES_NO)',
        'What is the most you would pay per month for this? (MULTIPLE_CHOICE with realistic price brackets for this product category)',
        'At what price would this feel too expensive to consider? (SHORT_ANSWER)',
        'What would make this worth paying for? (PARAGRAPH)',
        'How do you solve this problem today, and does it cost you anything? (PARAGRAPH)',
        'How disappointed would you be if this product did not exist? (MULTIPLE_CHOICE: Very / Somewhat / Not disappointed)',
      ],
    },
    REVENUE_POTENTIAL: { label: 'Willingness to Pay', goal: 'test whether real customers would pay and what pricing model fits', archetypes: [
      'Would you pay for this? (YES_NO)',
      'Which pricing model would you prefer? (MULTIPLE_CHOICE: monthly subscription / yearly / one-time / free with paid extras)',
      'What is the most you would pay? (MULTIPLE_CHOICE with price brackets)',
      'What would stop you from paying for this? (PARAGRAPH)',
    ]},
    CUSTOMER_DEMAND: {
      label: 'Customer Demand',
      goal: 'test whether the core problem matters to people and whether they want this solution',
      archetypes: [
        'How often do you experience this problem? (MULTIPLE_CHOICE: Never / Rarely / Monthly / Weekly / Daily)',
        'How do you deal with it today? (SHORT_ANSWER)',
        'How painful is this problem for you? (RATING max 5)',
        'Would you use this product if it existed? (YES_NO)',
        'What almost-solution have you tried and abandoned? (PARAGRAPH)',
      ],
    },
    DIFFERENTIATION: {
      label: 'Differentiation',
      goal: 'learn what alternatives people use and whether this idea is meaningfully better',
      archetypes: [
        'What do you currently use to solve this problem? (SHORT_ANSWER)',
        'What do you like most about your current solution? (PARAGRAPH)',
        'What frustrates you most about it? (PARAGRAPH)',
        'How likely would you be to switch to a new solution? (LINEAR_SCALE 1-10)',
        'What would a new product need to do to make you switch? (PARAGRAPH)',
      ],
    },
    MARKET_OPPORTUNITY: {
      label: 'Problem Severity',
      goal: 'measure how real, frequent and costly the problem is for the target customer',
      archetypes: [
        'Have you experienced this problem in the last month? (YES_NO)',
        'How often does it happen? (MULTIPLE_CHOICE frequency brackets)',
        'What does this problem cost you (time, money, stress)? (PARAGRAPH)',
        'How urgent is solving it for you? (RATING max 5)',
      ],
    },
    RISK_MARKETADOPTION: {
      label: 'Adoption Barriers',
      goal: 'uncover what would stop the target customer from adopting this product',
      archetypes: [
        'What would stop you from trying a product like this? (PARAGRAPH)',
        'How do you usually discover new products in this category? (MULTIPLE_CHOICE)',
        'What would you need to see before trusting it? (PARAGRAPH)',
        'Would you try this if a friend recommended it? (YES_NO)',
      ],
    },
    DEFAULT: {
      label: 'Customer Validation',
      goal: 'test overall demand: problem reality, interest in the solution, and willingness to pay',
      archetypes: [
        'How often do you experience this problem? (MULTIPLE_CHOICE frequency brackets)',
        'How do you solve it today? (SHORT_ANSWER)',
        'Would you use this product? (YES_NO)',
        'Would you pay for it? (YES_NO)',
        'How useful does this sound? (RATING max 5)',
        'What is the one thing that would make this a must-have for you? (PARAGRAPH)',
      ],
    },
  };

  /**
   * The Weakness Detector names the gap; this turns it into the survey that
   * closes it. Same output contract and normalization as the paste-your-
   * questions builder, so the frontend consumes both identically.
   */
  async generateGapSurvey(ideaId: string, founderId: string, gapKey: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      select: { id: true, founderId: true, title: true, industryCategory: true, problemStatement: true, solutionDescription: true, targetCustomer: true },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Groq API key not configured');

    const playbook = AiService.GAP_PLAYBOOKS[(gapKey || '').toUpperCase()] || AiService.GAP_PLAYBOOKS.DEFAULT;

    const prompt = `You are the survey engine of a startup-validation product. A founder's idea has one specific validation gap, and you must produce the customer survey that closes it.

THE IDEA
Title: ${idea.title}
Industry: ${idea.industryCategory}
Problem: ${idea.problemStatement}
Solution: ${idea.solutionDescription}
Target customer: ${idea.targetCustomer}

THE GAP TO CLOSE: ${playbook.label}
Research goal: ${playbook.goal}

QUESTION ARCHETYPES (adapt each to THIS idea's wording and audience; keep the research intent and the suggested type):
${playbook.archetypes.map((a, i) => `${i + 1}. ${a}`).join('\n')}

RULES
1. Produce 5 to 8 questions: adapt the archetypes above to this specific idea and audience. You may drop an archetype that doesn't fit and may add ONE extra question if clearly valuable.
2. Never mention "the idea", "the founder" or "this startup" — phrase questions the way the target customer talks, referring to the product plainly (e.g. "a tool that forecasts restaurant demand").
3. Question types must be exactly one of: SHORT_ANSWER, PARAGRAPH, MULTIPLE_CHOICE, CHECKBOXES, DROPDOWN, YES_NO, RATING, LINEAR_SCALE.
4. Only generate options that are common knowledge (frequencies, price brackets sensible for this product category, agreement levels). Never invent brand names or facts.
5. Keep questions neutral — no leading wording that begs for a yes.
6. "title": a short survey title naming the product area (not the internal gap label). "description": one sentence for respondents.

Return ONLY a single JSON object, no commentary, matching exactly:
{
  "title": string,
  "description": string,
  "questions": [
    { "questionText": string, "type": string, "options": string[], "required": boolean, "min": number, "max": number }
  ]
}`;

    const groq = new Groq({ apiKey });
    let raw: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      let completion;
      try {
        completion = await groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: attempt === 0 ? prompt : `${prompt}\n\nReturn ONLY the JSON object. No commentary, no markdown fences.` }],
          temperature: 0.4,
          max_tokens: 2500,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
        });
      } catch (err) {
        throw this.toAiError(err);
      }
      try {
        raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
        break;
      } catch {
        if (attempt === 1) throw new ServiceUnavailableException("Couldn't generate the survey — please try again.");
      }
    }

    const normalized = this.normalizeGeneratedSurvey(raw, false);
    return { ...normalized, gapKey: (gapKey || 'DEFAULT').toUpperCase(), gapLabel: playbook.label };
  }

  // Powers the "AI Builder" entry point on the existing survey creation flow —
  // reads pasted/uploaded questions and returns a normalized draft the founder
  // lands in the same survey editor with. This never touches Prisma: text in,
  // validated JSON out.
  async generateSurveyFromText(rawText: string): Promise<{ title: string; description: string; questions: GeneratedQuestion[]; truncated: boolean }> {
    if (!rawText || !rawText.trim()) throw new BadRequestException('Paste or upload at least one question');

    const lines = rawText
      .split('\n')
      .map((l) => l.replace(/^[\s•\-*\d.)]+/, '').trim())
      .filter(Boolean);
    if (!lines.length) throw new BadRequestException('No questions found in that text');

    const truncated = lines.length > MAX_INPUT_LINES;
    const usedLines = lines.slice(0, MAX_INPUT_LINES);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Groq API key not configured');

    const prompt = this.buildSurveyPrompt(usedLines.join('\n'));
    const groq = new Groq({ apiKey });

    let raw: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      let completion;
      try {
        completion = await groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: attempt === 0 ? prompt : `${prompt}\n\nReturn ONLY the JSON object. No commentary, no markdown fences.` }],
          temperature: 0.3,
          max_tokens: 3500,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
        });
      } catch (err) {
        throw this.toAiError(err);
      }
      try {
        raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
        break;
      } catch {
        if (attempt === 1) throw new ServiceUnavailableException("Couldn't generate a form from that text — try rephrasing or paste fewer questions.");
      }
    }

    return this.normalizeGeneratedSurvey(raw, truncated);
  }

  private buildSurveyPrompt(questionLines: string): string {
    return `You are the form-building engine behind an existing survey product. A user has pasted a list of survey questions. Read each one and decide the single best field type for it — the user should never have to pick a type themselves.

SUPPORTED TYPES (use exactly these names):
- SHORT_ANSWER    one line of free text
- PARAGRAPH       multiple lines of free text
- MULTIPLE_CHOICE one answer from a small closed list (2-6 options)
- CHECKBOXES      multiple answers from a closed list
- DROPDOWN        one answer from a longer closed list (6+ options)
- YES_NO          binary yes/no question
- LINEAR_SCALE     a numbered scale ("rate 1 to 10")
- RATING          a satisfaction/star-style rating with no stated numbers

RULES
1. Prefer the narrowest type you are CONFIDENT about. If nothing structured clearly fits, use SHORT_ANSWER for a single fact or PARAGRAPH for open reasoning ("why", "describe", "explain").
2. Only generate "options" when they are common-knowledge or clearly implied by the question (e.g. social platforms, frequency ranges, age brackets). NEVER invent options requiring specific facts you cannot know (restaurant names, product names, people's names). When in doubt, use SHORT_ANSWER instead of guessing options.
3. For LINEAR_SCALE, read min/max directly from the question if stated ("...from 1 to 10" -> min 1, max 10). Otherwise default to min 1, max 10.
4. For RATING, default max to 5 unless the question implies otherwise.
5. Mark a question "required" true unless it is clearly optional in tone ("if any", "optional", "feel free to skip").
6. Skip lines that are not actually questions (section headers, instructions). Do not return a row for them.
7. Write a short survey "title" and one-sentence "description" summarizing the set of questions as a whole.

EXAMPLE
Input: "How often do you order food online?"
Output type: DROPDOWN, options: ["Never", "Less than once a month", "1-3 times a month", "1-2 times a week", "3+ times a week"]

Input: "What's your favorite restaurant in the city?"
Output type: SHORT_ANSWER, options: [] (never guess restaurant names)

Return ONLY a single JSON object, no commentary, matching exactly:
{
  "title": string,
  "description": string,
  "questions": [
    {
      "questionText": string,
      "type": "SHORT_ANSWER" | "PARAGRAPH" | "MULTIPLE_CHOICE" | "CHECKBOXES" | "DROPDOWN" | "YES_NO" | "LINEAR_SCALE" | "RATING",
      "options": string[],
      "required": boolean,
      "min": number,
      "max": number
    }
  ]
}

QUESTIONS:
${questionLines}`;
  }

  // Defense in depth — the model's JSON is never trusted as-is. Every field is
  // whitelisted, clamped, or defaulted before it reaches the survey builder.
  private normalizeGeneratedSurvey(raw: any, truncated: boolean) {
    const title = String(raw?.title || 'Untitled Survey').slice(0, 80);
    const description = String(raw?.description || '').slice(0, 200);

    const questions: GeneratedQuestion[] = (Array.isArray(raw?.questions) ? raw.questions : [])
      .map((q: any): GeneratedQuestion | null => {
        const questionText = String(q?.questionText || '').trim();
        if (!questionText) return null;

        let type = KNOWN_TYPES.includes(q?.type) ? q.type : 'PARAGRAPH';
        let options: string[] = Array.isArray(q?.options)
          ? [...new Set<string>(q.options.map((o: any) => String(o || '').trim()).filter(Boolean))]
          : [];

        if (CHOICE_TYPES.includes(type)) {
          if (options.length < 2) type = 'SHORT_ANSWER';
          else if (type === 'MULTIPLE_CHOICE' && options.length > 6) type = 'DROPDOWN';
        }
        if (!CHOICE_TYPES.includes(type)) options = [];

        const settings: GeneratedQuestion['settings'] = {};
        if (type === 'LINEAR_SCALE') {
          const min = Number.isFinite(q?.min) ? q.min : 1;
          const max = Number.isFinite(q?.max) && q.max > min ? q.max : 10;
          settings.min = min;
          settings.max = max;
          settings.minLabel = '';
          settings.maxLabel = '';
        }
        if (type === 'RATING') {
          settings.max = Number.isFinite(q?.max) && q.max > 0 ? q.max : 5;
        }

        return { questionText: questionText.slice(0, 300), type, options: options.slice(0, 12), required: q?.required !== false, settings };
      })
      .filter((q: GeneratedQuestion | null): q is GeneratedQuestion => q !== null)
      .slice(0, MAX_INPUT_LINES);

    if (!questions.length) throw new ServiceUnavailableException("Couldn't generate a form from that text — try rephrasing or paste fewer questions.");

    return { title, description, questions, truncated };
  }
}
