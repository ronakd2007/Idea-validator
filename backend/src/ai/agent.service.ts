import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
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
import {
  ClaudeClient,
  ResearchState,
  SourceUse,
  createResearchState,
  describeClaudeError,
  webSearchUsed,
} from './claude.client';
import {
  CompetitorsSchema,
  CustomersSchema,
  FrameSchema,
  MarketSchema,
  ScoreSchema,
  SynthesisSchema,
} from './agent-schemas';

/**
 * A QUEUED/RUNNING row untouched for this long belongs to a process that is
 * gone: the pipeline writes progress every few seconds, so it can only go
 * quiet if the server restarted mid-run.
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
    if (!ClaudeClient.isConfigured()) {
      if (trigger === 'auto') {
        this.logger.warn(`Skipping AI Deep Dive for idea ${ideaId}: ANTHROPIC_API_KEY is not configured`);
        return { runId: null, alreadyRunning: false };
      }
      throw new ServiceUnavailableException('AI Deep Dive is not configured — ANTHROPIC_API_KEY is missing on the server.');
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
      const claude = ClaudeClient.fromEnv();

      await this.prisma.aiValidationRun.update({
        where: { id: runId },
        data: { status: 'RUNNING', startedAt: new Date(), steps: JSON.stringify(steps) },
      });

      const idea = await this.prisma.idea.findUnique({ where: { id: ideaId }, include: { selfAssessment: true } });
      if (!idea) throw new Error('Idea no longer exists');

      const [surveyEvidence, expertValidations] = await Promise.all([
        this.buildSurveyEvidence(ideaId),
        this.loadExpertScores(ideaId),
      ]);

      const ideaBlock = this.buildIdeaBlock(idea);

      // --- 1. FRAME -------------------------------------------------------
      await setStep('frame', 'RUNNING', 'Reading your idea and planning the research');
      const frameRaw = await claude.extract(this.framePrompt(ideaBlock), FrameSchema, { effort: 'medium', maxTokens: 4000 });
      const brief = normalizeBrief(frameRaw);
      await setStep('frame', 'DONE', brief.oneLiner || 'Research brief ready');
      const queries = this.normalizeQueries(frameRaw, brief, idea.title);

      // --- 2. COMPETITORS -------------------------------------------------
      const competitorStep = await this.researchAndExtract(claude, research, {
        usedFor: 'competitors',
        stepKey: 'competitors',
        setStep,
        queries: queries.competitors,
        maxSearches: 3,
        researchPrompt: this.competitorsResearchPrompt(brief, queries.competitors),
        extractPrompt: findings => this.competitorsExtractPrompt(brief, findings, research),
        schema: CompetitorsSchema,
      });
      const competitors = normalizeCompetitors(competitorStep.data, research.sources);
      const competitorCitations = competitorStep.citations;
      await setStep(
        'competitors',
        'DONE',
        competitors.direct.length
          ? `Found ${competitors.direct.length} direct competitor${competitors.direct.length === 1 ? '' : 's'}`
          : 'No clear direct competitors identified',
      );

      // --- 3. MARKET ------------------------------------------------------
      const marketStep = await this.researchAndExtract(claude, research, {
        usedFor: 'market',
        stepKey: 'market',
        setStep,
        queries: queries.market,
        maxSearches: 2,
        researchPrompt: this.marketResearchPrompt(brief, queries.market),
        extractPrompt: findings => this.marketExtractPrompt(brief, findings, research),
        schema: MarketSchema,
      });
      const market = normalizeMarket(marketStep.data);
      const marketCitations = marketStep.citations;
      await setStep('market', 'DONE', market.size.tam ? 'Market sizing found in public sources' : 'No reliable public market sizing found');

      // --- 4. CUSTOMERS ---------------------------------------------------
      const customerStep = await this.researchAndExtract(claude, research, {
        usedFor: 'customers',
        stepKey: 'customers',
        setStep,
        queries: queries.customers,
        maxSearches: 2,
        researchPrompt: this.customersResearchPrompt(brief, queries.customers),
        extractPrompt: findings => this.customersExtractPrompt(brief, findings, research, surveyEvidence.text),
        schema: CustomersSchema,
      });
      const customers = normalizeCustomers(customerStep.data, surveyEvidence.text);
      const customerCitations = customerStep.citations;
      await setStep(
        'customers',
        'DONE',
        customers.segments.length ? `Profiled ${customers.segments.length} customer segment${customers.segments.length === 1 ? '' : 's'}` : 'Customer research complete',
      );

      // --- 5. SYNTHESIS ---------------------------------------------------
      await setStep('synthesis', 'RUNNING', 'Building SWOT, risks and experiments');
      const synthesis = normalizeSynthesis(
        await claude.extract(
          this.synthesisPrompt(ideaBlock, competitors, market, customers, surveyEvidence.text),
          SynthesisSchema,
          { effort: 'high', maxTokens: 12000 },
        ),
      );
      await setStep('synthesis', 'DONE', `${synthesis.risks.length} risks, ${synthesis.experiments.length} experiments`);

      // --- 6. SCORE -------------------------------------------------------
      await setStep('score', 'RUNNING', 'Scoring against the validation rubric');
      const scored = normalizeScores(
        await claude.extract(
          this.scorePrompt(ideaBlock, competitors, market, customers, synthesis, surveyEvidence.text),
          ScoreSchema,
          { effort: 'high', maxTokens: 8000 },
        ),
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
        searchCount: research.searchCount,

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
          searchCount: research.searchCount,
          completedAt: new Date(),
          error: null,
        },
      });
    } catch (err: any) {
      const message = describeClaudeError(err);
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
            searchCount: research.searchCount,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
      this.logger.error(`AI Deep Dive run ${runId} failed: ${message}`);
    }
  }

  /**
   * One research step: search the live web, then turn the findings into
   * structured data in a separate, tool-less call that can only cite the
   * sources the search actually returned.
   *
   * Returns the citations alongside the data rather than stashing them on the
   * service — this is a singleton, so per-run state kept on `this` would leak
   * between two founders' runs happening at once.
   */
  private async researchAndExtract<T>(
    claude: ClaudeClient,
    research: ResearchState,
    opts: {
      usedFor: SourceUse;
      stepKey: StepKey;
      setStep: (key: StepKey, status: RunStep['status'], detail?: string) => Promise<void>;
      queries: string[];
      maxSearches: number;
      researchPrompt: string;
      extractPrompt: (findings: string) => string;
      schema: any;
    },
  ): Promise<{ data: T; citations: { title: string; url: string; finding: string | null; usedFor: string }[] }> {
    await opts.setStep(opts.stepKey, 'RUNNING', `Searching: "${opts.queries[0]}"`);

    let findings = '';
    let searched = false;
    try {
      const result = await claude.research(opts.researchPrompt, research, opts.usedFor, {
        maxSearches: opts.maxSearches,
        effort: 'medium',
      });
      findings = result.text;
      searched = result.searched;
    } catch (err: any) {
      // Losing the web is not losing the run: the extraction below still
      // happens, with nothing to cite, and the report says so.
      this.logger.warn(`Web research failed for ${opts.usedFor}: ${err?.message}`);
      research.webSearchFailed = true;
    }

    await opts.setStep(
      opts.stepKey,
      'RUNNING',
      searched
        ? `Found ${this.sourcesFor(research, opts.usedFor).length} source${this.sourcesFor(research, opts.usedFor).length === 1 ? '' : 's'} — reading`
        : 'No web results — continuing with model knowledge',
    );

    const extracted = await claude.extract<T>(opts.extractPrompt(findings), opts.schema, { effort: 'low', maxTokens: 10000 });
    return {
      data: extracted,
      citations: mapCitations((extracted as any)?.citations, this.sourcesFor(research, opts.usedFor), opts.usedFor),
    };
  }

  private sourcesFor(research: ResearchState, usedFor: SourceUse) {
    return research.sources.filter(s => s.usedFor === usedFor);
  }

  /** The numbered source list an extraction step is allowed to cite. */
  private sourceBlock(research: ResearchState, usedFor: SourceUse): string {
    const list = this.sourcesFor(research, usedFor);
    if (!list.length) {
      return 'NO WEB SOURCES WERE AVAILABLE. Return an empty citations array, set every source-dependent field to null, and mark anything you cannot stand behind as unknown.';
    }
    return `NUMBERED SOURCES (cite only by these numbers, and copy URLs only from this list):\n${list
      .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}`)
      .join('\n')}`;
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
      const lines: string[] = [`Survey "${survey.title}" — ${analytics.summary.totalResponses} responses.`];
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

  private mergeSources(research: ResearchState, citations: { title: string; url: string; finding: string | null; usedFor: string }[]) {
    const byUrl = new Map<string, { title: string; url: string; finding: string | null; usedFor: string }>();
    for (const source of research.sources) byUrl.set(source.url, { title: source.title, url: source.url, finding: null, usedFor: source.usedFor });
    // A citation only ever enriches a source the search really returned.
    for (const cite of citations) {
      const existing = byUrl.get(cite.url);
      if (existing && !existing.finding) existing.finding = cite.finding;
    }
    return [...byUrl.values()].slice(0, 20);
  }

  // ---------- prompts ----------
  //
  // The research method is fixed here in code; the model only fills it in.
  // That is the same division of labour the gap-survey generator uses — it
  // decides wording, never the methodology.

  private readonly EVIDENCE_RULES = `EVIDENCE RULES (these override everything else):
- A fact may only come from the numbered sources above. Cite it as { "n": <source number>, "finding": "<what that source says>" }.
- Never invent a URL, a price, a statistic or a company. If it is not in the sources and you are not certain, say it is unknown.
- Anything you reason yourself is an INFERENCE and belongs in an inference field, never presented as an observed fact.
- Unknown is a valid, valuable answer. A null field is better than a plausible guess.`;

  private framePrompt(ideaBlock: string): string {
    return `You are the research planner for a startup evidence agent. Turn this idea into a research brief and the web searches that would test it.

THE IDEA
${ideaBlock}

RULES:
1. Queries are plain search phrases under 100 characters — no operators, no site: filters, no quotes.
2. Queries must target current information a search engine can actually find.
3. keyUnknowns are gaps in evidence, not tasks.`;
  }

  private competitorsResearchPrompt(brief: any, queries: string[]): string {
    return `Research the competitive landscape for this idea using web search.

THE IDEA: ${brief.oneLiner}
INDUSTRY: ${brief.industry}
TARGET CUSTOMER: ${brief.targetCustomer}

Search for these, and follow up if the results are thin:
${queries.map(q => `- ${q}`).join('\n')}

Report what you actually found: which real products compete directly, which are indirect alternatives, what customers do instead of buying anything, and any pricing a source explicitly states. Name the source for each claim.

If the searches turn up no real competitors, say so plainly. Do not fill the gap with companies you are not confident exist.`;
  }

  private competitorsExtractPrompt(brief: any, findings: string, research: ResearchState): string {
    return `Structure these competitor research findings for the founder of: ${brief.oneLiner}

RESEARCH FINDINGS
${findings || 'No findings were produced — no web research was available.'}

${this.sourceBlock(research, 'competitors')}

${this.EVIDENCE_RULES}

ADDITIONAL RULES:
1. Up to 6 direct competitors. A URL is allowed ONLY if it appears in the numbered sources; otherwise null.
2. pricing must be null unless a source states it. Never estimate a price.
3. threat is how directly that company competes with THIS idea.
4. differentiationInference is your reasoning, not a fact.`;
  }

  private marketResearchPrompt(brief: any, queries: string[]): string {
    return `Research the market for this idea using web search.

THE IDEA: ${brief.oneLiner}
INDUSTRY: ${brief.industry}
GEOGRAPHY: ${brief.geography}

Search for these, and follow up if the results are thin:
${queries.map(q => `- ${q}`).join('\n')}

Report what you actually found about market size, growth, trends, headwinds and any relevant regulation. Quote figures only where a source states them, with the year and the source. If no credible sizing exists in the results, say so — do not derive one from assumptions.`;
  }

  private marketExtractPrompt(brief: any, findings: string, research: ResearchState): string {
    return `Structure these market research findings for the founder of: ${brief.oneLiner}

RESEARCH FINDINGS
${findings || 'No findings were produced — no web research was available.'}

${this.sourceBlock(research, 'market')}

${this.EVIDENCE_RULES}

ADDITIONAL RULES:
1. A market size figure may ONLY appear if a source states it. Include the year and source context, e.g. "$4.2B (2024, per [2])".
2. If the sources do not support a size, that field MUST be null. Never derive TAM/SAM/SOM from assumptions or round numbers.
3. Growth rates and percentages follow the same rule.`;
  }

  private customersResearchPrompt(brief: any, queries: string[]): string {
    return `Research the customers for this idea using web search.

THE IDEA: ${brief.oneLiner}
TARGET CUSTOMER: ${brief.targetCustomer}

Search for these, and follow up if the results are thin:
${queries.map(q => `- ${q}`).join('\n')}

Report what these customers actually say and do: their pain points, what they use today, how they buy. Paraphrase what sources say — never invent a quote. Where the evidence is thin, say what remains unknown.`;
  }

  private customersExtractPrompt(brief: any, findings: string, research: ResearchState, surveyEvidence: string | null): string {
    return `Structure these customer research findings for the founder of: ${brief.oneLiner}

RESEARCH FINDINGS
${findings || 'No findings were produced — no web research was available.'}

${this.sourceBlock(research, 'customers')}

THE FOUNDER'S OWN SURVEY EVIDENCE (collected on this platform)
${surveyEvidence || 'None yet — no customer survey responses have been collected for this idea.'}

${this.EVIDENCE_RULES}

ADDITIONAL RULES:
1. webEvidence comes only from the numbered sources. Do not restate the founder's survey data there — it is recorded separately.
2. Never present an inference as observed customer behaviour.
3. If there is no real evidence for a pain point, list it under unknowns instead of asserting it.`;
  }

  private synthesisPrompt(ideaBlock: string, competitors: any, market: any, customers: any, surveyEvidence: string | null): string {
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

RULES:
1. Never claim the business model works. Say what would have to be true and what evidence is missing.
2. missingEvidence names what nobody has checked yet; use null only when the risk is genuinely well evidenced.
3. Give 3-5 experiments, ordered by what would change the founder's decision most. At least 2 must be testable with a customer survey — set gapKey on those.
4. Prefer specific, cheap experiments a solo founder could run in two weeks.
5. Every claim must trace back to the research above or to the founder's own inputs.`;
  }

  private scorePrompt(ideaBlock: string, competitors: any, market: any, customers: any, synthesis: any, surveyEvidence: string | null): string {
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

RULES:
1. Score against the evidence gathered, not against how appealing the idea sounds.
2. founderFit may only be scored from the founder background, team and assumptions given. If that information is thin, score it conservatively and say so in its rationale.
3. Do not output an overall score — it is computed from your dimension scores.
4. confidence (0-100) must reflect EVIDENCE QUALITY, not how decisive you feel. Little or no evidence means low confidence even if the idea reads well.
5. A low score is acceptable. A flattering score the evidence does not support is not.`;
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
