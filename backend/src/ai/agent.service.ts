import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { SurveyAnalyticsService } from '../survey/survey-analytics.service';
import { DIMENSIONS } from '../ideas/score.util';
import { compareAiToExperts } from './agent-scoring';
import {
  AiValidationReport,
  EvidenceSignals,
  applyConfidenceCap,
  buildCouldNotVerify,
  buildEvidenceCoverage,
  buildLimitations,
  mapCitations,
  normalizeBrief,
  normalizeCompetitors,
  normalizeCustomers,
  normalizeMarket,
  normalizeScores,
  normalizeSynthesis,
  strList,
} from './agent-report';
import { ResearchState, TavilyResult, createResearchState, tavilySearch, webSearchUsed } from './tavily.client';

const MODEL = 'openai/gpt-oss-120b';
// Groq's free tier enforces a per-request token budget and max_tokens counts
// toward it — same constraint the survey generator works within.
const GROQ_TPM_BUDGET = 7500;
/** Spacing between calls so one run cannot trip the per-minute rate limit on its own. */
const GROQ_CALL_GAP_MS = 2500;
const GROQ_429_RETRY_WAIT_MS = 25_000;
/**
 * A QUEUED/RUNNING row untouched for this long belongs to a process that is
 * gone: the pipeline writes progress every few seconds, so it can only go quiet
 * if the server restarted mid-run.
 */
const STALE_RUN_MS = 3 * 60_000;

type StepKey = 'frame' | 'competitors' | 'market' | 'customers' | 'synthesis' | 'score';

const STEP_LABELS: { key: StepKey; label: string }[] = [
  { key: 'frame', label: 'Framing the idea' },
  { key: 'competitors', label: 'Researching competitors' },
  { key: 'market', label: 'Researching the market' },
  { key: 'customers', label: 'Researching customers' },
  { key: 'synthesis', label: 'Synthesizing evidence' },
  { key: 'score', label: 'Scoring and verdict' },
];

export interface RunStep {
  key: StepKey;
  label: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  detail?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  /** Same-process guard against two runs for one idea; the DB check is the real one. */
  private readonly inFlight = new Set<string>();

  constructor(private prisma: PrismaService, private surveyAnalytics: SurveyAnalyticsService) {}

  // ---------- public API ----------

  /**
   * Starts a run, or reports the one already going.
   *
   * `auto` is the paid-submission path: it must never throw, because a failure
   * to start research is not a reason to fail the payment that triggered it.
   */
  async startRun(
    ideaId: string,
    founderId: string,
    trigger: 'auto' | 'manual',
  ): Promise<{ runId: string | null; alreadyRunning: boolean }> {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      select: { id: true, founderId: true, paymentStatus: true },
    });

    if (!idea) {
      if (trigger === 'auto') return { runId: null, alreadyRunning: false };
      throw new NotFoundException('Idea not found');
    }
    if (idea.founderId !== founderId) {
      if (trigger === 'auto') return { runId: null, alreadyRunning: false };
      throw new ForbiddenException('Access denied');
    }
    if (trigger === 'manual' && idea.paymentStatus !== 'COMPLETED') {
      throw new BadRequestException('AI Deep Dive is available once your idea is submitted.');
    }
    if (!process.env.GROQ_API_KEY) {
      if (trigger === 'auto') {
        this.logger.warn(`Skipping AI Deep Dive for idea ${ideaId}: GROQ_API_KEY is not configured`);
        return { runId: null, alreadyRunning: false };
      }
      throw new ServiceUnavailableException('Groq API key not configured');
    }

    const active = await this.reconcileActiveRun(ideaId);
    if (active) return { runId: active.id, alreadyRunning: true };
    if (this.inFlight.has(ideaId)) return { runId: null, alreadyRunning: true };

    const run = await this.prisma.aiValidationRun.create({
      data: {
        ideaId,
        status: 'QUEUED',
        steps: JSON.stringify(STEP_LABELS.map(s => ({ ...s, status: 'PENDING' }) as RunStep)),
      },
      select: { id: true },
    });

    this.inFlight.add(ideaId);
    // Fire-and-forget: the run row is the state, so nothing is lost by not
    // awaiting, and the caller (a payment or a button click) returns at once.
    void this.runPipeline(run.id, ideaId)
      .catch(err => this.logger.error(`AI Deep Dive run ${run.id} crashed: ${err?.message}`))
      .finally(() => this.inFlight.delete(ideaId));

    return { runId: run.id, alreadyRunning: false };
  }

  async getLatest(ideaId: string, founderId: string, opts: { readOnly?: boolean } = {}) {
    await this.assertOwner(ideaId, founderId);
    // In View-as-User mode this GET must stay side-effect free — an admin
    // looking at a founder's dashboard should never write to their data.
    if (!opts.readOnly) await this.reconcileActiveRun(ideaId);

    const run = await this.prisma.aiValidationRun.findFirst({
      where: { ideaId },
      orderBy: { createdAt: 'desc' },
    });
    if (!run) return { run: null };

    return {
      run: {
        id: run.id,
        status: run.status,
        steps: parseJson(run.steps, [] as RunStep[]),
        report: parseJson<AiValidationReport | null>(run.report, null),
        error: run.error,
        webSearchUsed: run.webSearchUsed,
        searchCount: run.searchCount,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        createdAt: run.createdAt,
      },
    };
  }

  async listRuns(ideaId: string, founderId: string) {
    await this.assertOwner(ideaId, founderId);
    const runs = await this.prisma.aiValidationRun.findMany({
      where: { ideaId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, status: true, createdAt: true, completedAt: true, webSearchUsed: true, report: true },
    });
    return runs.map(r => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      webSearchUsed: r.webSearchUsed,
      verdict: parseJson<AiValidationReport | null>(r.report, null)?.verdict ?? null,
    }));
  }

  // ---------- lifecycle helpers ----------

  private async assertOwner(ideaId: string, founderId: string) {
    const idea = await this.prisma.idea.findUnique({ where: { id: ideaId }, select: { founderId: true } });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');
  }

  /**
   * Returns the genuinely active run, and repairs abandoned ones on the way
   * past. This is the whole crash-recovery story: there is no queue to ask, so
   * a row that stopped being written to is how an interrupted run is detected.
   */
  private async reconcileActiveRun(ideaId: string): Promise<{ id: string } | null> {
    const active = await this.prisma.aiValidationRun.findFirst({
      where: { ideaId, status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, updatedAt: true },
    });
    if (!active) return null;

    if (Date.now() - active.updatedAt.getTime() < STALE_RUN_MS) return active;

    await this.prisma.aiValidationRun
      .update({
        where: { id: active.id },
        data: { status: 'FAILED', error: 'This run was interrupted (the server restarted). Retry to run it again.', completedAt: new Date() },
      })
      .catch(() => undefined);
    return null;
  }

  private async persistSteps(runId: string, steps: RunStep[]) {
    // Every step write doubles as the heartbeat that keeps this run from
    // looking stale to reconcileActiveRun.
    await this.prisma.aiValidationRun.update({ where: { id: runId }, data: { steps: JSON.stringify(steps) } }).catch(() => undefined);
  }

  // ---------- the pipeline ----------

  private async runPipeline(runId: string, ideaId: string) {
    const steps: RunStep[] = STEP_LABELS.map(s => ({ ...s, status: 'PENDING' }));
    const research = createResearchState();

    const setStep = async (key: StepKey, status: RunStep['status'], detail?: string) => {
      const step = steps.find(s => s.key === key);
      if (step) {
        step.status = status;
        if (detail !== undefined) step.detail = detail;
      }
      await this.persistSteps(runId, steps);
    };

    try {
      await this.prisma.aiValidationRun.update({
        where: { id: runId },
        data: { status: 'RUNNING', startedAt: new Date(), steps: JSON.stringify(steps) },
      });

      const idea = await this.prisma.idea.findUnique({
        where: { id: ideaId },
        include: { selfAssessment: true },
      });
      if (!idea) throw new Error('Idea no longer exists');

      const [surveyEvidence, expertValidations] = await Promise.all([
        this.buildSurveyEvidence(ideaId),
        this.loadExpertScores(ideaId),
      ]);

      const ideaBlock = this.buildIdeaBlock(idea);

      // --- 1. FRAME -------------------------------------------------------
      await setStep('frame', 'RUNNING', 'Reading your idea and planning the research');
      const frameRaw = await this.groqJson(this.framePrompt(ideaBlock), 800);
      const brief = normalizeBrief(frameRaw);
      await setStep('frame', 'DONE', brief.oneLiner || 'Research brief ready');
      // Queries come off the raw frame output: the normalized brief is the
      // shape the report stores, and search queries are not part of it.
      const queries = this.normalizeQueries(frameRaw, brief, idea.title);

      // --- 2. COMPETITORS -------------------------------------------------
      await setStep('competitors', 'RUNNING', 'Looking for competitors');
      const competitorSearch = await this.runSearches(research, queries.competitors, 'competitors', detail => setStep('competitors', 'RUNNING', detail));
      await sleep(GROQ_CALL_GAP_MS);
      const competitorsRaw = await this.groqJson(this.competitorsPrompt(brief, competitorSearch.block), 2000);
      const competitors = normalizeCompetitors(competitorsRaw, research.sources);
      const competitorCitations = mapCitations(competitorsRaw?.citations, competitorSearch.results, 'competitors');
      await setStep('competitors', 'DONE', competitors.direct.length ? `Found ${competitors.direct.length} direct competitor${competitors.direct.length === 1 ? '' : 's'}` : 'No clear direct competitors identified');

      // --- 3. MARKET ------------------------------------------------------
      await setStep('market', 'RUNNING', 'Researching market size and trends');
      const marketSearch = await this.runSearches(research, queries.market, 'market', detail => setStep('market', 'RUNNING', detail));
      await sleep(GROQ_CALL_GAP_MS);
      const marketRaw = await this.groqJson(this.marketPrompt(brief, marketSearch.block), 1300);
      const market = normalizeMarket(marketRaw);
      const marketCitations = mapCitations(marketRaw?.citations, marketSearch.results, 'market');
      await setStep('market', 'DONE', market.size.tam ? 'Market sizing found in public sources' : 'No reliable public market sizing found');

      // --- 4. CUSTOMERS ---------------------------------------------------
      await setStep('customers', 'RUNNING', 'Researching customer pain points');
      const customerSearch = await this.runSearches(research, queries.customers, 'customers', detail => setStep('customers', 'RUNNING', detail));
      await sleep(GROQ_CALL_GAP_MS);
      const customersRaw = await this.groqJson(this.customersPrompt(brief, customerSearch.block, surveyEvidence.text), 1300);
      const customers = normalizeCustomers(customersRaw, surveyEvidence.text);
      const customerCitations = mapCitations(customersRaw?.citations, customerSearch.results, 'customers');
      await setStep('customers', 'DONE', customers.segments.length ? `Profiled ${customers.segments.length} customer segment${customers.segments.length === 1 ? '' : 's'}` : 'Customer research complete');

      // --- 5. SYNTHESIS ---------------------------------------------------
      await setStep('synthesis', 'RUNNING', 'Building SWOT, risks and experiments');
      await sleep(GROQ_CALL_GAP_MS);
      const synthesis = normalizeSynthesis(
        await this.groqJson(this.synthesisPrompt(ideaBlock, brief, competitors, market, customers, surveyEvidence.text), 2500),
      );
      await setStep('synthesis', 'DONE', `${synthesis.risks.length} risks, ${synthesis.experiments.length} experiments`);

      // --- 6. SCORE -------------------------------------------------------
      await setStep('score', 'RUNNING', 'Scoring against the validation rubric');
      await sleep(GROQ_CALL_GAP_MS);
      const scored = normalizeScores(
        await this.groqJson(this.scorePrompt(ideaBlock, brief, competitors, market, customers, synthesis, surveyEvidence.text), 1800),
      );

      // --- assemble (everything below is server-computed) -----------------
      const usedWeb = webSearchUsed(research);
      const signals: EvidenceSignals = {
        webSearchUsed: usedWeb,
        sourceCount: research.sources.length,
        surveyResponses: surveyEvidence.responses,
        expertValidations: expertValidations.length,
        founderInfoComplete: this.hasFounderContext(idea),
      };

      const capped = applyConfidenceCap(scored.confidence, signals);
      const sources = this.mergeSources(research, [...competitorCitations, ...marketCitations, ...customerCitations]);

      const report: AiValidationReport = {
        version: 1,
        generatedAt: new Date().toISOString(),
        webSearchUsed: usedWeb,
        searchCount: research.count,

        verdict: scored.verdict,
        verdictSummary: scored.verdictSummary,
        keyEvidence: scored.keyEvidence,
        biggestUncertainty: scored.biggestUncertainty,
        nextValidationStep: scored.nextValidationStep,
        confidence: capped.confidence,
        confidenceRationale: capped.rationale,

        evidenceCoverage: buildEvidenceCoverage(signals),
        biggestOpportunity: synthesis.biggestOpportunity ?? synthesis.swot.opportunities[0] ?? null,
        biggestRisk: synthesis.biggestRisk ?? synthesis.risks[0]?.risk ?? null,

        brief,
        competitors,
        market,
        customers,
        swot: synthesis.swot,
        risks: synthesis.risks,
        businessModel: synthesis.businessModel,
        gtm: synthesis.gtm,
        experiments: synthesis.experiments,

        scores: { dimensions: scored.dimensions, rationale: scored.rationale, overall: scored.overall },
        aiVsExpert: compareAiToExperts(scored.dimensions, expertValidations),

        sources,
        limitations: buildLimitations(signals, capped.capReason),
        couldNotVerify: buildCouldNotVerify({ competitors, market, customers, risks: synthesis.risks }, signals),
      };

      await setStep('score', 'DONE', scored.verdict ? `Assessment: ${scored.verdict.replace(/_/g, ' ')}` : 'Assessment complete');

      await this.prisma.aiValidationRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          report: JSON.stringify(report),
          webSearchUsed: usedWeb,
          searchCount: research.count,
          completedAt: new Date(),
          error: null,
        },
      });
    } catch (err: any) {
      const message = this.describeFailure(err);
      const running = steps.find(s => s.status === 'RUNNING');
      if (running) running.status = 'FAILED';
      // The idea may have been deleted mid-run, taking the run row with it —
      // in that case there is nothing left to mark, and that is fine.
      await this.prisma.aiValidationRun
        .update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            error: message,
            steps: JSON.stringify(steps),
            webSearchUsed: webSearchUsed(research),
            searchCount: research.count,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
      this.logger.error(`AI Deep Dive run ${runId} failed: ${message}`);
    }
  }

  // ---------- research + model plumbing ----------

  private async runSearches(
    state: ResearchState,
    queries: string[],
    usedFor: 'competitors' | 'market' | 'customers',
    onProgress: (detail: string) => Promise<void>,
  ): Promise<{ block: string; results: TavilyResult[] }> {
    const results: TavilyResult[] = [];
    const answers: string[] = [];

    for (const query of queries) {
      await onProgress(`Searching: "${query}"`);
      const hit = await tavilySearch(state, query, usedFor);
      if (!hit) continue;
      if (hit.answer) answers.push(hit.answer);
      for (const r of hit.results) {
        if (results.length >= 10) break;
        if (!results.some(existing => existing.url === r.url)) results.push(r);
      }
    }

    if (!results.length) {
      await onProgress('No web results — continuing with model knowledge');
      return {
        block: 'NO WEB RESULTS AVAILABLE. Use only what you already know with high confidence, and mark anything you cannot stand behind as unknown. Return an empty citations array.',
        results: [],
      };
    }

    await onProgress(`Found ${results.length} relevant result${results.length === 1 ? '' : 's'}`);
    const numbered = results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`).join('\n\n');
    const answerBlock = answers.length ? `\n\nSEARCH ENGINE SUMMARY:\n${answers.join('\n')}` : '';
    return { block: `SEARCH RESULTS (cite by number):\n${numbered}${answerBlock}`, results };
  }

  /**
   * Structured model call. Two attempts at valid JSON (the second says so more
   * bluntly), and one wait-and-retry on a rate limit — the same shape the rest
   * of the AI features use.
   */
  private async groqJson(prompt: string, maxTokens: number): Promise<any> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Groq API key not configured');

    const promptTokens = Math.ceil(prompt.length / 4) + 250;
    const budgeted = Math.max(800, Math.min(maxTokens, GROQ_TPM_BUDGET - promptTokens));
    const groq = new Groq({ apiKey });

    let rateLimitRetried = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const content = attempt === 0 ? prompt : `${prompt}\n\nReturn ONLY the JSON object. No commentary, no markdown fences.`;
      try {
        const completion = await groq.chat.completions.create({
          model: MODEL,
          messages: [{ role: 'user', content }],
          temperature: 0.3,
          max_tokens: budgeted,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
        });
        return JSON.parse(completion.choices[0]?.message?.content || '{}');
      } catch (err: any) {
        if (err instanceof SyntaxError) continue;
        const status = err?.status ?? err?.response?.status;
        if (status === 429 && !rateLimitRetried) {
          rateLimitRetried = true;
          attempt--; // the rate limit was not a bad-JSON attempt
          await sleep(GROQ_429_RETRY_WAIT_MS);
          continue;
        }
        throw err;
      }
    }
    throw new Error('The AI returned an unreadable response.');
  }

  /** Same failure vocabulary as the rest of the AI features, kept as text for the run row. */
  private describeFailure(err: any): string {
    const status = err?.status ?? err?.response?.status;
    if (status === 401 || status === 403) return 'The AI service rejected the API key — check GROQ_API_KEY on the server.';
    if (status === 429) return 'The AI service is rate limited right now — try again in a minute.';
    if (status === 413) return 'This idea produced too much research text for the AI service in one go.';
    if ((status === 400 || status === 404) && /model|decommission/i.test(err?.message || '')) {
      return 'The configured AI model is no longer available — the model name needs updating.';
    }
    return err?.message ? `AI Deep Dive could not finish: ${err.message}` : 'AI Deep Dive could not finish — try again shortly.';
  }

  // ---------- context builders ----------

  private buildIdeaBlock(idea: any): string {
    const team = parseJson<any[]>(idea.teamMembers, []);
    const assumptions = parseJson<any[]>(idea.assumptions, [])
      .map(a => String(a?.statement || '').trim())
      .filter(Boolean)
      .slice(0, 8);

    const lines = [
      `Title: ${String(idea.title || '').slice(0, 200)}`,
      `Industry: ${String(idea.industryCategory || '').slice(0, 80)}`,
      `Stage: ${String(idea.stage || '').slice(0, 80)}`,
      `Problem: ${String(idea.problemStatement || '').slice(0, 1500)}`,
      `Solution: ${String(idea.solutionDescription || '').slice(0, 1500)}`,
      `Target customer: ${String(idea.targetCustomer || '').slice(0, 800)}`,
      `Revenue model: ${String(idea.revenueModel || '').slice(0, 300)}`,
    ];
    if (idea.founderContext) lines.push(`Founder background: ${String(idea.founderContext).slice(0, 800)}`);
    if (team.length) lines.push(`Team size: ${team.length}`);
    if (assumptions.length) lines.push(`Founder's own assumptions to test:\n- ${assumptions.join('\n- ')}`);
    return lines.join('\n');
  }

  private hasFounderContext(idea: any): boolean {
    const team = parseJson<any[]>(idea.teamMembers, []);
    const assumptions = parseJson<any[]>(idea.assumptions, []);
    return Boolean(idea.founderContext?.trim()) || team.length > 0 || assumptions.length > 0 || Boolean(idea.selfAssessment);
  }

  /**
   * The founder's own survey numbers, formatted for a prompt — aggregates only,
   * never an individual response, and never a respondent's identity. Returns
   * null text when there is no survey evidence, so the prompt can say so
   * instead of letting the model imagine customer data.
   */
  private async buildSurveyEvidence(ideaId: string): Promise<{ text: string | null; responses: number }> {
    const survey = await this.prisma.survey.findFirst({
      where: { ideaId, responses: { some: {} } },
      orderBy: { responses: { _count: 'desc' } },
      select: { id: true, title: true },
    });
    if (!survey) return { text: null, responses: 0 };

    try {
      const analytics: any = await this.surveyAnalytics.getAnalytics(survey.id, null, {});
      const lines: string[] = [
        `Survey "${survey.title}" — ${analytics.summary.totalResponses} responses.`,
      ];
      const primary = analytics.eligibleOutcomeQuestions?.[0];
      if (primary) {
        const qa: any = analytics.questions.find((q: any) => q.id === primary.id);
        if (primary.type === 'YES_NO') {
          const yes = qa?.distribution?.find((d: any) => d.label === 'Yes');
          if (yes) lines.push(`"${primary.questionText}": ${yes.pct.toFixed(0)}% answered Yes.`);
        } else if (qa?.average != null) {
          lines.push(`"${primary.questionText}": average ${qa.average.toFixed(1)}/${qa.max}.`);
        }
      }
      for (const insight of (analytics.insights || []).slice(0, 3)) lines.push(`${insight.title}: ${insight.body}`);
      return { text: lines.join('\n'), responses: analytics.summary.totalResponses || 0 };
    } catch {
      return { text: null, responses: 0 };
    }
  }

  /**
   * Expert score rows for the comparison. Only the numeric sub-scores are
   * selected — no validator identity, contact detail or written feedback, none
   * of which may ever reach a prompt.
   */
  private async loadExpertScores(ideaId: string) {
    return this.prisma.validationResponse.findMany({
      where: { ideaId },
      select: {
        marketOpportunity: true,
        feasibility: true,
        founderFit: true,
        revenuePotential: true,
        scalability: true,
        innovation: true,
        socialImpact: true,
        investorAttractiveness: true,
      },
    });
  }

  /**
   * The searches this run will actually make. If the model gave nothing usable
   * for a topic, a plain query built from the idea itself stands in — a run
   * should never silently skip a whole area of research.
   */
  private normalizeQueries(frameRaw: any, brief: { industry: string }, title: string) {
    const fallback = `${title} ${brief.industry}`.trim().slice(0, 100);
    const clean = (v: unknown, cap: number) => strList(v, cap, 100).filter(q => q.length > 3);
    const withFallback = (list: string[], suffix: string) => (list.length ? list : [`${fallback} ${suffix}`.trim().slice(0, 100)]);
    return {
      competitors: withFallback(clean(frameRaw?.queries?.competitors, 3), 'competitors'),
      market: withFallback(clean(frameRaw?.queries?.market, 2), 'market size growth'),
      customers: withFallback(clean(frameRaw?.queries?.customers, 2), 'customer problems complaints'),
    };
  }

  private mergeSources(state: ResearchState, citations: { title: string; url: string; finding: string | null; usedFor: string }[]) {
    const byUrl = new Map<string, { title: string; url: string; finding: string | null; usedFor: string }>();
    for (const source of state.sources) byUrl.set(source.url, { title: source.title, url: source.url, finding: null, usedFor: source.usedFor });
    // A citation only ever enriches a source that was really returned.
    for (const cite of citations) {
      const existing = byUrl.get(cite.url);
      if (existing && !existing.finding) existing.finding = cite.finding;
    }
    return [...byUrl.values()].slice(0, 20);
  }

  // ---------- prompts ----------
  //
  // The research method is fixed here in code; the model only fills it in. That
  // is the same division of labour the gap-survey generator uses — it decides
  // wording, never the methodology.

  private readonly EVIDENCE_RULES = `EVIDENCE RULES (these override everything else):
- A fact may only come from the numbered search results. Cite it as { "n": <result number>, "finding": "<what that source says>" }.
- Never invent a URL, a price, a statistic or a company. If it is not in the results and you are not certain, say it is unknown.
- Anything you reason yourself is an INFERENCE and must go in an inference field, never presented as an observed fact.
- Unknown is a valid, valuable answer. A missing field is better than a plausible guess.
- Citations belong ONLY in the citations array. Never write a { "n": ... } object inside a sentence — every other field is plain prose a founder reads.`;

  private framePrompt(ideaBlock: string): string {
    return `You are the research planner for a startup evidence agent. Turn this idea into a research brief and the web searches that would test it.

THE IDEA
${ideaBlock}

Return ONLY a single JSON object:
{
  "oneLiner": "one sentence describing the idea plainly",
  "industry": "short industry label",
  "targetCustomer": "who specifically buys or uses this",
  "geography": "primary market, or 'Global' if unclear",
  "keyUnknowns": ["the 3-5 things that most need evidence before this idea is credible"],
  "queries": {
    "competitors": ["up to 3 plain web searches that would surface real competing products"],
    "market": ["up to 2 searches for market size, growth or trends"],
    "customers": ["up to 2 searches for what these customers actually complain about"]
  }
}

RULES:
1. Queries are plain search phrases under 100 characters — no operators, no site: filters, no quotes.
2. Queries must target current information a search engine can actually find.
3. keyUnknowns are gaps in evidence, not tasks.`;
  }

  private competitorsPrompt(brief: any, searchBlock: string): string {
    return `You are researching the competitive landscape for this idea.

THE IDEA: ${brief.oneLiner}
INDUSTRY: ${brief.industry}
TARGET CUSTOMER: ${brief.targetCustomer}

${searchBlock}

${this.EVIDENCE_RULES}

Return ONLY a single JSON object:
{
  "direct": [ { "name": string, "url": string|null, "whatTheyDo": string, "pricing": string|null, "strengths": [string], "weaknesses": [string], "threat": "LOW"|"MEDIUM"|"HIGH" } ],
  "indirect": [ { "name": string, "description": string } ],
  "substitutes": ["what customers do today instead of buying any product"],
  "differentiationInference": "where this idea could differentiate — your reasoning, not a fact",
  "summary": "what the competitive picture means for this founder",
  "citations": [ { "n": number, "finding": string } ]
}

RULES:
1. Up to 6 direct competitors. A URL is allowed ONLY if it appears in the results above; otherwise null.
2. pricing must be null unless a result states it. Do not estimate prices.
3. threat is how directly that company competes with THIS idea.
4. If the results show no real competitors, return empty lists and say so in summary — do not invent plausible companies.`;
  }

  private marketPrompt(brief: any, searchBlock: string): string {
    return `You are researching the market for this idea.

THE IDEA: ${brief.oneLiner}
INDUSTRY: ${brief.industry}
GEOGRAPHY: ${brief.geography}

${searchBlock}

${this.EVIDENCE_RULES}

Return ONLY a single JSON object:
{
  "size": { "tam": string|null, "sam": string|null, "som": string|null },
  "growth": string|null,
  "trends": ["trends that change this idea's odds"],
  "headwinds": ["what is working against it"],
  "regulation": string|null,
  "summary": "what the market picture means for this founder",
  "citations": [ { "n": number, "finding": string } ]
}

RULES:
1. A market size figure may ONLY appear if a result states it. Include the figure with its year and source context, e.g. "$4.2B (2024, per [2])".
2. If the results do not support a size, that field MUST be null. Never derive TAM/SAM/SOM from assumptions or round numbers.
3. Percentages and growth rates follow the same rule.`;
  }

  private customersPrompt(brief: any, searchBlock: string, surveyEvidence: string | null): string {
    return `You are researching the customers for this idea.

THE IDEA: ${brief.oneLiner}
TARGET CUSTOMER: ${brief.targetCustomer}

${searchBlock}

THE FOUNDER'S OWN SURVEY EVIDENCE (collected on this platform):
${surveyEvidence || 'None yet — no customer survey responses have been collected for this idea.'}

${this.EVIDENCE_RULES}

Return ONLY a single JSON object:
{
  "segments": [ { "name": string, "painPoints": [string], "jobsToBeDone": [string], "intensity": "LOW"|"MEDIUM"|"HIGH" } ],
  "currentAlternatives": ["what they use today"],
  "buyingBehavior": string|null,
  "webEvidence": ["what the search results actually show about these customers — paraphrase, never a fabricated quote"],
  "inferences": ["what you reason from the above, clearly your own reasoning"],
  "unknowns": ["what remains unknown about these customers and would need direct research"],
  "summary": "what the customer picture means for this founder",
  "citations": [ { "n": number, "finding": string } ]
}

RULES:
1. webEvidence comes only from the search results. Do not restate the founder's survey data there — it is already recorded separately.
2. Never present an inference as observed customer behaviour.
3. If there is no real evidence of a pain point, list it under unknowns instead of asserting it.`;
  }

  private synthesisPrompt(ideaBlock: string, brief: any, competitors: any, market: any, customers: any, surveyEvidence: string | null): string {
    return `You are the senior analyst on a startup evidence team. The research below is already gathered. Synthesise it into a decision-focused assessment.

THE IDEA
${ideaBlock}

COMPETITIVE RESEARCH
${competitors.summary || 'No competitor summary available.'}
Direct competitors: ${competitors.direct.map((c: any) => c.name).join(', ') || 'none identified'}
Substitutes: ${competitors.substitutes.join('; ') || 'none identified'}

MARKET RESEARCH
${market.summary || 'No market summary available.'}
Size: TAM ${market.size.tam || 'unknown'}, SAM ${market.size.sam || 'unknown'}, SOM ${market.size.som || 'unknown'}
Trends: ${market.trends.join('; ') || 'none identified'}
Headwinds: ${market.headwinds.join('; ') || 'none identified'}

CUSTOMER RESEARCH
${customers.summary || 'No customer summary available.'}
Segments: ${customers.segments.map((s: any) => s.name).join(', ') || 'none identified'}
Open unknowns: ${customers.unknowns.join('; ') || 'none recorded'}

THE FOUNDER'S OWN SURVEY EVIDENCE
${surveyEvidence || 'None yet — no customer survey responses have been collected for this idea.'}

Return ONLY a single JSON object:
{
  "biggestOpportunity": "the single strongest thing this idea has going for it, in one sentence",
  "biggestRisk": "the single thing most likely to kill it, in one sentence",
  "swot": { "strengths": [string], "weaknesses": [string], "opportunities": [string], "threats": [string] },
  "risks": [ { "risk": string, "category": "MARKET"|"EXECUTION"|"FINANCIAL"|"REGULATORY"|"TECHNOLOGY"|"COMPETITION"|"OTHER", "likelihood": "LOW"|"MEDIUM"|"HIGH", "impact": "LOW"|"MEDIUM"|"HIGH", "whyItMatters": string, "mitigation": string, "missingEvidence": string|null } ],
  "businessModel": { "revenueModelFit": string, "pricingLogic": string, "costDrivers": [string], "monetizationRisks": [string], "keyAssumptions": [string] },
  "gtm": { "initialCustomer": string, "channels": [string], "adoptionBarriers": [string], "earlyExperiment": string|null },
  "experiments": [ { "title": string, "hypothesis": string, "whatToTest": string, "targetUsers": string, "successMetric": string, "sampleThreshold": string|null, "decisionInformed": string, "gapKey": "PRICING"|"REVENUE_POTENTIAL"|"CUSTOMER_DEMAND"|"DIFFERENTIATION"|"MARKET_OPPORTUNITY"|"RISK_MARKETADOPTION"|null } ]
}

RULES:
1. Never claim the business model works. Say what would have to be true and what evidence is missing.
2. missingEvidence names what nobody has checked yet; use null only when the risk is genuinely well evidenced.
3. Give 3-5 experiments, ordered by what would change the founder's decision most. At least 2 must be testable with a customer survey — set gapKey on those.
4. Prefer specific, cheap experiments a solo founder could run in two weeks.
5. Every claim must trace back to the research above or to the founder's own inputs.`;
  }

  private scorePrompt(ideaBlock: string, brief: any, competitors: any, market: any, customers: any, synthesis: any, surveyEvidence: string | null): string {
    const rubric = DIMENSIONS.map(d => `- ${d.key} (${d.label}): ${d.fields.join(', ')} — each 0-10, so 0-50 total.`).join('\n');

    return `Score this idea on the SAME rubric human expert validators use on this platform. You are scoring independently: you have not seen any expert's scores.

THE IDEA
${ideaBlock}

RESEARCH FINDINGS
Competitors: ${competitors.summary || 'none'}
Market: ${market.summary || 'none'}
Customers: ${customers.summary || 'none'}
Biggest opportunity: ${synthesis.biggestOpportunity || 'not identified'}
Biggest risk: ${synthesis.biggestRisk || 'not identified'}
Key risks: ${synthesis.risks.map((r: any) => r.risk).join('; ') || 'none identified'}

THE FOUNDER'S OWN SURVEY EVIDENCE
${surveyEvidence || 'None yet — no customer survey responses have been collected for this idea.'}

THE RUBRIC (score each dimension 0-50 as the sum of its five 0-10 criteria)
${rubric}

Return ONLY a single JSON object:
{
  "dimensions": { ${DIMENSIONS.map(d => `"${d.key}": number`).join(', ')} },
  "rationale": { ${DIMENSIONS.map(d => `"${d.key}": "one sentence citing what in the research drove this score"`).join(', ')} },
  "verdict": "GO"|"GO_WITH_CHANGES"|"PIVOT"|"NO_GO",
  "verdictSummary": "2-4 sentences explaining the verdict to the founder",
  "keyEvidence": ["the specific findings that most support this verdict"],
  "biggestUncertainty": "the one thing that could most change this assessment",
  "nextValidationStep": "the single most useful thing the founder should do next to test this",
  "confidence": number
}

RULES:
1. Score against the evidence gathered, not against how appealing the idea sounds.
2. founderFit may only be scored from the founder background, team and assumptions given. If that information is thin, score it conservatively and say so in its rationale.
3. Do not output an overall score — it is computed from your dimension scores.
4. confidence (0-100) must reflect EVIDENCE QUALITY, not how decisive you feel. Little or no evidence means low confidence even if the idea reads well.
5. A low score is acceptable. A flattering score that the evidence does not support is not.`;
  }
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
