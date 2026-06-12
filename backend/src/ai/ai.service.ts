import { Injectable, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

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
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    });

    const summary = completion.choices[0]?.message?.content || '';
    return { summary };
  }
}
