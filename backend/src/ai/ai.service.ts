import { Injectable, Logger, NotFoundException, ForbiddenException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

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
    if (status === 400 && /model|decommission/i.test(err?.message || '')) {
      return new ServiceUnavailableException('The configured AI model is no longer available — the model name needs updating.');
    }
    return new ServiceUnavailableException('AI service is temporarily unavailable — try again shortly.');
  }

  async generateDashboardSummary(ideaId: string, founderId: string): Promise<{ summary: string }> {
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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Groq API key not configured');

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

Write the summary in this exact format — use plain text, no markdown, no bullet symbols:

VERDICT
[One bold honest sentence about the overall potential of this idea based on the data.]

WHAT'S WORKING
[2-3 sentences about the strongest areas backed by the scores and feedback.]

WHAT NEEDS WORK
[2-3 sentences about the weakest areas, referencing specific low scores and repeated concerns from validators.]

NEXT STEPS
[2-3 concrete, specific actions the founder should take based on this validation data.]`;

    const groq = new Groq({ apiKey });
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
      });
    } catch (err) {
      throw this.toAiError(err);
    }

    const summary = completion.choices[0]?.message?.content || '';
    return { summary };
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
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: attempt === 0 ? prompt : `${prompt}\n\nReturn ONLY the JSON object. No commentary, no markdown fences.` }],
          temperature: 0.3,
          max_tokens: 3000,
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
