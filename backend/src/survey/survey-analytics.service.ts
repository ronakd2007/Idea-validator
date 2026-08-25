import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseReportShareSettings } from './survey-share.util';

/**
 * Response Quality thresholds — product guidance, not statistical law.
 * A response is only ever classified POTENTIALLY_LOW when 2+ independent
 * signals fire together; a single signal (including raw speed) caps at MEDIUM.
 */
const QUALITY = {
  FAST_RESPONSE_RATIO: 0.3, // flagged if duration < 30% of the survey's own median duration
  MIN_RESPONSES_FOR_DURATION_SIGNAL: 5, // need enough peers before "fast" is meaningful
  MIN_OPTIONAL_QUESTIONS_FOR_SIGNAL: 2,
  OPTIONAL_ANSWERED_RATIO_FLAG: 0.5,
  MIN_NUMERIC_QUESTIONS_FOR_STRAIGHTLINE: 3,
  MIN_QUESTIONS_FOR_DUPLICATE_CHECK: 5,
  CONSISTENCY_DIFF_RATIO_FLAG: 0.4, // flagged if |a-b| exceeds 40% of the scale range
};

// Legacy sessions (recorded before active-time heartbeats existed) only have
// wall-clock duration. Under this limit wall-clock is a fair proxy for effort;
// beyond it the tab almost certainly sat abandoned, and reporting the number
// would be reporting the idle — so the duration counts as unmeasurable instead
// and drops out of every stat (average, median, fastest/longest, quality
// flags, CSV). The session row itself is untouched.
const LEGACY_WALLCLOCK_TRUST_LIMIT_SECONDS = 30 * 60;

const MIN_SAMPLE_FOR_ASSOCIATION = 10;
const MIN_SAMPLE_FOR_AB = 10; // per variant

const CHOICE_TYPES = ['MULTIPLE_CHOICE', 'DROPDOWN', 'YES_NO', 'IMAGE_CHOICE'];
const NUMERIC_TYPES = ['RATING', 'LINEAR_SCALE'];

@Injectable()
export class SurveyAnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * `ownerId` is the founder the survey must belong to. Passing exactly `null`
   * means an admin context where authorization has already been enforced by the
   * ADMIN role guard on the route — the check is skipped only for that exact
   * value, so a missing/undefined id still fails closed.
   */
  private async loadFullSurvey(id: string, ownerId: string | null) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: {
        idea: { select: { title: true } },
        questions: { include: { options: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } },
        sessions: true,
        responses: { include: { answers: true, session: true } },
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    if (ownerId !== null && survey.founderId !== ownerId) throw new ForbiddenException('Access denied');
    return survey;
  }

  // ---------- small numeric helpers ----------

  private parseValue(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private isEmptyValue(v: any) {
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  }

  private avg(arr: number[]): number | null {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  }

  private median(arr: number[]): number | null {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private durationSeconds(session: any): number | null {
    if (!session || !session.submittedAt) return null;
    // Sessions recorded since heartbeat tracking know the time the tab was
    // actually visible. Legacy sessions only have wall-clock, trusted only
    // while plausible — see LEGACY_WALLCLOCK_TRUST_LIMIT_SECONDS.
    if (session.activeSeconds > 0) return session.activeSeconds;
    const wallClock = (new Date(session.submittedAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
    return wallClock <= LEGACY_WALLCLOCK_TRUST_LIMIT_SECONDS ? wallClock : null;
  }

  /**
   * Average of the durations we actually trust, used to stand in for a legacy
   * session whose wall-clock is unusable. Substituting the mean is deliberate:
   * it leaves the mean unchanged, so an abandoned tab stops distorting the
   * summary while its response still carries a usable number everywhere else.
   * Always an ESTIMATE — never let it read as a measurement.
   */
  private imputedDuration(sessions: any[]): number | null {
    const trusted = sessions
      .filter((s) => s?.submittedAt)
      .map((s) => this.durationSeconds(s))
      .filter((d): d is number => d != null);
    return this.avg(trusted);
  }

  /** True measured duration when there is one, otherwise the imputed average. */
  private effectiveDuration(session: any, imputed: number | null): number | null {
    if (!session || !session.submittedAt) return null;
    return this.durationSeconds(session) ?? imputed;
  }

  /** Whether this session's reported duration is imputed rather than measured. */
  private isEstimatedDuration(session: any, imputed: number | null): boolean {
    if (!session || !session.submittedAt) return false;
    return this.durationSeconds(session) == null && imputed != null;
  }

  private formatDuration(seconds: number | null): string {
    if (seconds == null || Number.isNaN(seconds)) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  private sampleSizeLabel(n: number): string {
    if (n === 0) return 'No responses yet';
    if (n < 10) return 'Very limited data';
    if (n < 30) return 'Early signal';
    return 'Moderate sample';
  }

  private pearson(xs: number[], ys: number[]): number | null {
    const n = xs.length;
    if (n < 2) return null;
    const mx = this.avg(xs)!;
    const my = this.avg(ys)!;
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    const denom = Math.sqrt(dx2 * dy2);
    return denom === 0 ? null : num / denom;
  }

  private strengthFromR(absR: number): string {
    if (absR >= 0.5) return 'Strong association';
    if (absR >= 0.3) return 'Moderate association';
    if (absR >= 0.1) return 'Weak association';
    return 'No meaningful association';
  }

  private strengthFromSpread(spread: number): string {
    if (spread >= 0.4) return 'Strong association';
    if (spread >= 0.2) return 'Moderate association';
    if (spread >= 0.08) return 'Weak association';
    return 'No meaningful association';
  }

  // Converts an answer into a 0/1 or numeric outcome value. Returns null when
  // the question type can't sensibly serve as an outcome measure.
  private outcomeValue(q: any, rawValue: any): number | null {
    if (q.type === 'YES_NO') return rawValue === 'Yes' ? 1 : rawValue === 'No' ? 0 : null;
    if (NUMERIC_TYPES.includes(q.type)) return typeof rawValue === 'number' ? rawValue : null;
    return null;
  }

  private categoryLabel(q: any, rawValue: any): string | null {
    if (q.type === 'YES_NO') return typeof rawValue === 'string' ? rawValue : null;
    const opt = q.options.find((o: any) => o.id === rawValue);
    return opt ? opt.label : typeof rawValue === 'string' ? rawValue : null;
  }

  // ---------- response trend ----------

  private computeTrend(responses: any[], range?: string) {
    const now = new Date();
    const r = range || '30d';
    let bucketMs: number;
    let bucketCount: number;
    let labelFn: (d: Date) => string;

    if (r === '24h') {
      bucketMs = 60 * 60 * 1000; bucketCount = 24;
      labelFn = (d) => `${d.getHours()}:00`;
    } else if (r === '7d') {
      bucketMs = 24 * 60 * 60 * 1000; bucketCount = 7;
      labelFn = (d) => d.toLocaleDateString(undefined, { weekday: 'short' });
    } else if (r === 'all') {
      if (!responses.length) return [];
      const earliest = Math.min(...responses.map((x) => new Date(x.submittedAt).getTime()));
      const days = Math.min(90, Math.max(1, Math.ceil((now.getTime() - earliest) / (24 * 60 * 60 * 1000)) + 1));
      bucketMs = 24 * 60 * 60 * 1000; bucketCount = days;
      labelFn = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
      bucketMs = 24 * 60 * 60 * 1000; bucketCount = 30;
      labelFn = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    const buckets: { label: string; count: number }[] = [];
    for (let i = bucketCount - 1; i >= 0; i--) {
      buckets.push({ label: labelFn(new Date(now.getTime() - i * bucketMs)), count: 0 });
    }
    const rangeStart = now.getTime() - bucketCount * bucketMs;
    responses.forEach((resp) => {
      const t = new Date(resp.submittedAt).getTime();
      if (t < rangeStart) return;
      const idx = bucketCount - 1 - Math.floor((now.getTime() - t) / bucketMs);
      if (buckets[idx]) buckets[idx].count++;
    });
    return buckets;
  }

  // ---------- response quality ----------

  /**
   * Every response gets independently checked against several unrelated
   * signals. A single signal firing (even "answered very fast") only ever
   * caps a response at MEDIUM — POTENTIALLY_LOW requires 2+ signals to agree,
   * per the product requirement that no one signal should condemn a response.
   */
  private computeQuality(questions: any[], responses: any[], medianDuration: number | null) {
    const numericQuestions = questions.filter((q) => NUMERIC_TYPES.includes(q.type));
    const optionalQuestions = questions.filter((q) => !q.required);
    const controlPairs = questions.filter((q) => q.consistencyPairQuestionId);

    const signatureOf = (resp: any) =>
      questions.map((q) => resp.answers.find((a: any) => a.questionId === q.id)?.value ?? '').join('|');
    const signatureCounts = new Map<string, number>();
    responses.forEach((r) => {
      const sig = signatureOf(r);
      signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
    });

    const result = new Map<string, { label: string; flags: string[] }>();

    for (const resp of responses) {
      const flags: string[] = [];
      const duration = resp.session ? this.durationSeconds(resp.session) : null;

      if (medianDuration != null && duration != null && responses.length >= QUALITY.MIN_RESPONSES_FOR_DURATION_SIGNAL) {
        if (duration < medianDuration * QUALITY.FAST_RESPONSE_RATIO) {
          flags.push('Completed unusually quickly compared to other respondents');
        }
      }

      if (optionalQuestions.length >= QUALITY.MIN_OPTIONAL_QUESTIONS_FOR_SIGNAL) {
        const answeredOptional = optionalQuestions.filter((q) => {
          const a = resp.answers.find((x: any) => x.questionId === q.id);
          return a && !this.isEmptyValue(this.parseValue(a.value));
        }).length;
        if (answeredOptional / optionalQuestions.length < QUALITY.OPTIONAL_ANSWERED_RATIO_FLAG) {
          flags.push('Left most optional questions blank');
        }
      }

      if (numericQuestions.length >= QUALITY.MIN_NUMERIC_QUESTIONS_FOR_STRAIGHTLINE) {
        const vals = numericQuestions
          .map((q) => {
            const a = resp.answers.find((x: any) => x.questionId === q.id);
            return a ? this.parseValue(a.value) : null;
          })
          .filter((v) => typeof v === 'number');
        if (vals.length === numericQuestions.length && new Set(vals).size === 1) {
          flags.push('Gave the identical rating to every scale question');
        }
      }

      if (questions.length >= QUALITY.MIN_QUESTIONS_FOR_DUPLICATE_CHECK) {
        if ((signatureCounts.get(signatureOf(resp)) || 0) > 1) {
          flags.push('Answers are identical to another response');
        }
      }

      for (const pairQ of controlPairs) {
        const other = questions.find((q) => q.id === pairQ.consistencyPairQuestionId);
        if (!other || !NUMERIC_TYPES.includes(pairQ.type) || !NUMERIC_TYPES.includes(other.type)) continue;
        const av = resp.answers.find((x: any) => x.questionId === pairQ.id);
        const bv = resp.answers.find((x: any) => x.questionId === other.id);
        if (!av || !bv) continue;
        const an = this.parseValue(av.value), bn = this.parseValue(bv.value);
        if (typeof an !== 'number' || typeof bn !== 'number') continue;
        const aSettings = JSON.parse(pairQ.settings || '{}');
        const bSettings = JSON.parse(other.settings || '{}');
        const range = Math.max(aSettings.max || (pairQ.type === 'RATING' ? 5 : 10), bSettings.max || (other.type === 'RATING' ? 5 : 10));
        if (Math.abs(an - bn) > range * QUALITY.CONSISTENCY_DIFF_RATIO_FLAG) {
          flags.push('Potential inconsistency between related questions');
        }
      }

      const uniqueFlags = Array.from(new Set(flags));
      const label = uniqueFlags.length >= 2 ? 'POTENTIALLY_LOW' : uniqueFlags.length === 1 ? 'MEDIUM' : 'HIGH';
      result.set(resp.id, { label, flags: uniqueFlags });
    }

    return result;
  }

  // ---------- per-question analytics ----------

  private analyzeQuestion(q: any, responses: any[]) {
    const answered = responses
      .map((r) => r.answers.find((a: any) => a.questionId === q.id))
      .filter(Boolean)
      .map((a: any) => this.parseValue(a.value));
    const answeredCount = answered.length;
    const base = { id: q.id, type: q.type, questionText: q.questionText, required: q.required, isControlQuestion: q.isControlQuestion, answeredCount, mediaUrl: q.mediaUrl, mediaType: q.mediaType };

    if (CHOICE_TYPES.includes(q.type)) {
      const counts = new Map<string, number>();
      answered.forEach((v: any) => { if (typeof v === 'string') counts.set(v, (counts.get(v) || 0) + 1); });
      const optionFor = (key: string) => q.options.find((o: any) => o.id === key);
      const distribution = Array.from(counts.entries())
        .map(([key, count]) => ({
          label: q.type === 'YES_NO' ? key : optionFor(key)?.label || key,
          imageUrl: q.type === 'IMAGE_CHOICE' ? optionFor(key)?.imageUrl || null : undefined,
          count,
          pct: answeredCount ? (count / answeredCount) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);
      return { ...base, distribution };
    }

    if (q.type === 'CHECKBOXES') {
      const counts = new Map<string, number>();
      answered.forEach((v: any) => { if (Array.isArray(v)) v.forEach((id: string) => counts.set(id, (counts.get(id) || 0) + 1)); });
      const distribution = Array.from(counts.entries())
        .map(([id, count]) => ({ label: q.options.find((o: any) => o.id === id)?.label || id, count, pct: answeredCount ? (count / answeredCount) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);
      return { ...base, distribution };
    }

    if (NUMERIC_TYPES.includes(q.type)) {
      const nums = answered.filter((v: any) => typeof v === 'number');
      const settings = JSON.parse(q.settings || '{}');
      const min = q.type === 'LINEAR_SCALE' ? settings.min ?? 1 : 1;
      const max = settings.max ?? (q.type === 'RATING' ? 5 : 10);
      const distribution = [];
      for (let n = min; n <= max; n++) {
        const count = nums.filter((v: number) => v === n).length;
        distribution.push({ value: n, count, pct: nums.length ? (count / nums.length) * 100 : 0 });
      }
      return { ...base, average: this.avg(nums), min, max, distribution };
    }

    // SHORT_ANSWER / PARAGRAPH — counts only; full text is browsed via getResponsesPage
    return { ...base, isText: true };
  }

  // ---------- drop-off ----------

  private computeDropOff(questions: any[], sessions: any[]) {
    // Only sessions where the respondent actually answered something (or
    // submitted). A bare open-and-close never reached Q1 — counting it made
    // one bounce look like a 100-point drop at Question 2.
    //
    // lastQuestionIndex > 0 is the legacy equivalent of `engaged`: progress was
    // only ever reported once an answer existed, so a non-zero index proves
    // engagement. Sessions predating the `engaged` column have it false, and
    // without this clause every partial attempt from before that deploy
    // silently vanished from the chart.
    const active = sessions.filter((s) => s.completed || s.engaged || s.lastQuestionIndex > 0);
    const started = active.length;
    if (!started) return [];
    return questions.map((q, i) => {
      const reached = active.filter((s) => s.completed || s.lastQuestionIndex >= i).length;
      return { questionText: q.questionText, index: i, reachedCount: reached, reachedPct: (reached / started) * 100 };
    });
  }

  // ---------- segmentation ----------

  private computeSegmentation(questions: any[], responses: any[], segmentQuestionId: string, outcomeQuestionId?: string) {
    const segmentQ = questions.find((q) => q.id === segmentQuestionId);
    if (!segmentQ) return null;
    const outcomeQ = outcomeQuestionId ? questions.find((q) => q.id === outcomeQuestionId) : null;

    const groups = new Map<string, any[]>();
    responses.forEach((r) => {
      const a = r.answers.find((x: any) => x.questionId === segmentQuestionId);
      if (!a) return;
      const label = this.categoryLabel(segmentQ, this.parseValue(a.value));
      if (!label) return;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(r);
    });

    const segments = Array.from(groups.entries())
      .map(([label, resps]) => {
        let outcome:
          | { type: 'percent' | 'average'; value: number | null; max?: number }
          | { type: 'distribution'; items: { label: string; count: number; pct: number }[] }
          | null = null;
        // Same question on both axes is a degenerate cross-tab (every segment
        // is 100% itself) — treat it as no outcome selected.
        if (outcomeQ && outcomeQ.id !== segmentQ.id) {
          if (outcomeQ.type === 'YES_NO' || NUMERIC_TYPES.includes(outcomeQ.type)) {
            const values = resps
              .map((r) => {
                const a = r.answers.find((x: any) => x.questionId === outcomeQ.id);
                return a ? this.outcomeValue(outcomeQ, this.parseValue(a.value)) : null;
              })
              .filter((v): v is number => v != null);
            if (outcomeQ.type === 'YES_NO') {
              outcome = { type: 'percent', value: values.length ? (values.reduce((a, b) => a + b, 0) / values.length) * 100 : null };
            } else {
              const settings = JSON.parse(outcomeQ.settings || '{}');
              outcome = { type: 'average', value: this.avg(values), max: settings.max ?? (outcomeQ.type === 'RATING' ? 5 : 10) };
            }
          } else {
            // Choice-type outcome: how this segment answered the other
            // question — one cross-tab cell per option.
            const counts = new Map<string, number>();
            let answered = 0;
            resps.forEach((r) => {
              const a = r.answers.find((x: any) => x.questionId === outcomeQ.id);
              if (!a) return;
              const optLabel = this.categoryLabel(outcomeQ, this.parseValue(a.value));
              if (!optLabel) return;
              counts.set(optLabel, (counts.get(optLabel) || 0) + 1);
              answered++;
            });
            const items = Array.from(counts.entries())
              .map(([optLabel, count]) => ({ label: optLabel, count, pct: answered ? (count / answered) * 100 : 0 }))
              .sort((a, b) => b.count - a.count);
            outcome = { type: 'distribution', items };
          }
        }
        return { label, responseCount: resps.length, outcome };
      })
      .sort((a, b) => b.responseCount - a.responseCount);

    return { segmentQuestionText: segmentQ.questionText, outcomeQuestionText: outcomeQ?.questionText ?? null, segments };
  }

  // ---------- question impact ----------

  private computeImpact(questions: any[], responses: any[], outcomeQuestionId: string) {
    const outcomeQ = questions.find((q) => q.id === outcomeQuestionId);
    if (!outcomeQ) return null;

    const outcomeByResponse = new Map<string, number>();
    responses.forEach((r) => {
      const a = r.answers.find((x: any) => x.questionId === outcomeQuestionId);
      if (!a) return;
      const v = this.outcomeValue(outcomeQ, this.parseValue(a.value));
      if (v != null) outcomeByResponse.set(r.id, v);
    });

    const factors = questions.filter((q) => q.id !== outcomeQuestionId && !['SHORT_ANSWER', 'PARAGRAPH', 'CHECKBOXES'].includes(q.type));

    const results = factors.map((fq) => {
      if (NUMERIC_TYPES.includes(fq.type)) {
        const xy: { x: number; y: number }[] = [];
        responses.forEach((r) => {
          const y = outcomeByResponse.get(r.id);
          if (y == null) return;
          const a = r.answers.find((x: any) => x.questionId === fq.id);
          if (!a) return;
          const raw = this.parseValue(a.value);
          if (typeof raw === 'number') xy.push({ x: raw, y });
        });
        if (xy.length < MIN_SAMPLE_FOR_ASSOCIATION) {
          return { questionText: fq.questionText, sampleSize: xy.length, result: 'Not enough responses to identify a reliable association.' };
        }
        const r = this.pearson(xy.map((p) => p.x), xy.map((p) => p.y));
        if (r == null) return { questionText: fq.questionText, sampleSize: xy.length, result: 'Not enough variation to identify an association.' };
        return { questionText: fq.questionText, sampleSize: xy.length, strength: this.strengthFromR(Math.abs(r)), direction: r >= 0 ? 'positive' : 'negative', r: +r.toFixed(2) };
      }

      if (CHOICE_TYPES.includes(fq.type)) {
        const byCat = new Map<string, number[]>();
        responses.forEach((r) => {
          const y = outcomeByResponse.get(r.id);
          if (y == null) return;
          const a = r.answers.find((x: any) => x.questionId === fq.id);
          if (!a) return;
          const cat = this.categoryLabel(fq, this.parseValue(a.value));
          if (!cat) return;
          if (!byCat.has(cat)) byCat.set(cat, []);
          byCat.get(cat)!.push(y);
        });
        const n = Array.from(byCat.values()).reduce((sum, v) => sum + v.length, 0);
        if (n < MIN_SAMPLE_FOR_ASSOCIATION) return { questionText: fq.questionText, sampleSize: n, result: 'Not enough responses to identify a reliable association.' };
        if (byCat.size < 2) return { questionText: fq.questionText, sampleSize: n, result: 'Not enough variation to identify an association.' };
        const means = Array.from(byCat.values()).map((vals) => this.avg(vals)!);
        const allY = Array.from(byCat.values()).flat();
        const outcomeRange = Math.max(...allY) - Math.min(...allY) || 1;
        const spread = (Math.max(...means) - Math.min(...means)) / outcomeRange;
        return { questionText: fq.questionText, sampleSize: n, strength: this.strengthFromSpread(spread), spread: +spread.toFixed(2) };
      }

      return null;
    }).filter(Boolean);

    return { outcomeQuestionText: outcomeQ.questionText, factors: results };
  }

  // ---------- A/B results ----------

  private computeABResults(questions: any[], responses: any[]) {
    const groups = new Map<string, any[]>();
    questions.forEach((q) => {
      if (!q.abGroupKey) return;
      if (!groups.has(q.abGroupKey)) groups.set(q.abGroupKey, []);
      groups.get(q.abGroupKey)!.push(q);
    });

    const summarize = (q: any) => {
      const answered = responses.map((r) => r.answers.find((a: any) => a.questionId === q.id)).filter(Boolean).map((a: any) => this.parseValue(a.value));
      const n = answered.length;
      if (q.type === 'YES_NO') {
        const yes = answered.filter((v: any) => v === 'Yes').length;
        return { questionText: q.questionText, n, positivePct: n ? (yes / n) * 100 : null, average: null, max: null };
      }
      if (NUMERIC_TYPES.includes(q.type)) {
        const nums = answered.filter((v: any) => typeof v === 'number');
        const settings = JSON.parse(q.settings || '{}');
        return { questionText: q.questionText, n, positivePct: null, average: this.avg(nums), max: settings.max ?? (q.type === 'RATING' ? 5 : 10) };
      }
      return { questionText: q.questionText, n, positivePct: null, average: null, max: null };
    };

    const results: any[] = [];
    groups.forEach((qs, key) => {
      const variantA = qs.find((q) => q.abVariant === 'A');
      const variantB = qs.find((q) => q.abVariant === 'B');
      if (!variantA || !variantB) return;
      const a = summarize(variantA);
      const b = summarize(variantB);
      const minN = Math.min(a.n, b.n);
      const note = minN < MIN_SAMPLE_FOR_AB ? 'Early result — more responses needed.' : 'Observed difference — not a statistical significance test.';
      results.push({ groupKey: key, variantA: a, variantB: b, note });
    });

    return results;
  }

  // ---------- insights ----------

  private generateInsights(ctx: {
    totalResponses: number;
    eligibleOutcomeQuestions: any[];
    questionAnalytics: any[];
    questions: any[];
    dropOff: { reachedPct: number }[];
    qualityBuckets: Record<string, number>;
    segmentation: any;
  }) {
    const insights: { tone: 'positive' | 'warning' | 'neutral'; title: string; body: string }[] = [];
    const { totalResponses } = ctx;

    if (totalResponses < 5) {
      insights.push({ tone: 'neutral', title: 'Limited data so far', body: `Only ${totalResponses} response${totalResponses !== 1 ? 's' : ''} collected — insights will become more reliable as more responses arrive.` });
      return insights;
    }

    const primary = ctx.eligibleOutcomeQuestions[0];
    if (primary) {
      const qa = ctx.questionAnalytics.find((q: any) => q.id === primary.id);
      if (qa) {
        if (primary.type === 'YES_NO') {
          const yes = qa.distribution?.find((d: any) => d.label === 'Yes');
          if (yes) {
            if (yes.pct >= 70) insights.push({ tone: 'positive', title: 'Strong interest', body: `${yes.pct.toFixed(0)}% of respondents answered "Yes" to "${primary.questionText}".` });
            else if (yes.pct < 40) insights.push({ tone: 'warning', title: 'Limited interest', body: `Only ${yes.pct.toFixed(0)}% of respondents answered "Yes" to "${primary.questionText}".` });
          }
        } else if (qa.average != null) {
          const pct = (qa.average / qa.max) * 100;
          if (pct >= 70) insights.push({ tone: 'positive', title: 'Strong interest', body: `Average response to "${primary.questionText}" was ${qa.average.toFixed(1)}/${qa.max}.` });
          else if (pct < 40) insights.push({ tone: 'warning', title: 'Limited interest', body: `Average response to "${primary.questionText}" was only ${qa.average.toFixed(1)}/${qa.max}.` });
        }
      }
    }

    const pricingQ = ctx.questions.find((q: any) => q.type === 'YES_NO' && /pay|price|pricing|afford/i.test(q.questionText));
    if (pricingQ) {
      const qa = ctx.questionAnalytics.find((q: any) => q.id === pricingQ.id);
      const yes = qa?.distribution?.find((d: any) => d.label === 'Yes');
      if (yes && qa.answeredCount >= 10 && yes.pct < 60) {
        insights.push({ tone: 'warning', title: 'Pricing concern', body: `Only ${yes.pct.toFixed(0)}% indicated willingness to pay on "${pricingQ.questionText}".` });
      }
    }

    if (ctx.segmentation && ctx.segmentation.segments.length >= 2) {
      const withOutcome = ctx.segmentation.segments.filter((s: any) => s.outcome?.value != null && s.responseCount >= 5);
      if (withOutcome.length >= 2) {
        const best = [...withOutcome].sort((a: any, b: any) => b.outcome.value - a.outcome.value)[0];
        const displayVal = best.outcome.type === 'percent' ? `${best.outcome.value.toFixed(0)}%` : `${best.outcome.value.toFixed(1)}/${best.outcome.max}`;
        insights.push({ tone: 'neutral', title: 'Strongest segment', body: `"${best.label}" showed the highest response at ${displayVal}${ctx.segmentation.outcomeQuestionText ? ` on "${ctx.segmentation.outcomeQuestionText}"` : ''}.` });
      }
    }

    if (ctx.dropOff.length >= 2) {
      let worstIdx = -1, worstDrop = 0;
      for (let i = 1; i < ctx.dropOff.length; i++) {
        const drop = ctx.dropOff[i - 1].reachedPct - ctx.dropOff[i].reachedPct;
        if (drop > worstDrop) { worstDrop = drop; worstIdx = i; }
      }
      if (worstIdx > 0 && worstDrop >= 15) {
        insights.push({ tone: 'warning', title: 'Survey drop-off', body: `The largest drop-off occurred after Question ${worstIdx} (a ${worstDrop.toFixed(0)} percentage-point drop).` });
      }
    }

    const lowPct = totalResponses ? ((ctx.qualityBuckets.POTENTIALLY_LOW || 0) / totalResponses) * 100 : 0;
    if (totalResponses >= 10 && lowPct >= 20) {
      insights.push({ tone: 'warning', title: 'Response quality', body: `${lowPct.toFixed(0)}% of responses show multiple unusual patterns — consider reviewing them before drawing conclusions.` });
    }

    return insights;
  }

  // ---------- public entry points ----------

  async getAnalytics(id: string, ownerId: string | null, opts: { range?: string; outcomeQuestionId?: string; segmentQuestionId?: string }) {
    const survey = await this.loadFullSurvey(id, ownerId);
    const { questions, sessions, responses } = survey;

    const trend = this.computeTrend(responses, opts.range);

    const started = sessions.length;
    const completedCount = sessions.filter((s) => s.completed).length;
    const abandoned = started - completedCount;
    const completionRate = started ? (completedCount / started) * 100 : null;

    const completedSessions = sessions.filter((s) => s.completed);
    const imputed = this.imputedDuration(completedSessions);
    const durations = completedSessions.map((s) => this.effectiveDuration(s, imputed)).filter((d): d is number => d != null);
    const avgDuration = this.avg(durations);
    const medianDuration = this.median(durations);
    const fastest = durations.length ? Math.min(...durations) : null;
    const longest = durations.length ? Math.max(...durations) : null;

    const qualityMap = this.computeQuality(questions, responses, medianDuration);
    const qualityBuckets: Record<string, number> = { HIGH: 0, MEDIUM: 0, POTENTIALLY_LOW: 0 };
    qualityMap.forEach((q) => { qualityBuckets[q.label] = (qualityBuckets[q.label] || 0) + 1; });

    const questionAnalytics = questions.map((q) => this.analyzeQuestion(q, responses));
    const dropOff = this.computeDropOff(questions, sessions);

    // Measurable outcomes (binary/numeric) come first so [0] stays a real
    // metric for insights and AI evidence; other single-choice questions
    // follow so any two closed questions can be cross-compared.
    const eligibleOutcomeQuestions = [
      ...questions.filter((q) => q.type === 'YES_NO' || NUMERIC_TYPES.includes(q.type)),
      ...questions.filter((q) => CHOICE_TYPES.includes(q.type) && q.type !== 'YES_NO'),
    ].map((q) => ({ id: q.id, questionText: q.questionText, type: q.type }));
    const eligibleSegmentQuestions = questions.filter((q) => CHOICE_TYPES.includes(q.type)).map((q) => ({ id: q.id, questionText: q.questionText, type: q.type }));

    const segmentation = opts.segmentQuestionId ? this.computeSegmentation(questions, responses, opts.segmentQuestionId, opts.outcomeQuestionId) : null;
    // Correlation math is only meaningful against a binary/numeric outcome;
    // choice-type outcomes get the segment cross-tab instead.
    const outcomeQForImpact = opts.outcomeQuestionId ? questions.find((q) => q.id === opts.outcomeQuestionId) : null;
    const impact = outcomeQForImpact && (outcomeQForImpact.type === 'YES_NO' || NUMERIC_TYPES.includes(outcomeQForImpact.type))
      ? this.computeImpact(questions, responses, outcomeQForImpact.id)
      : null;
    const abResults = this.computeABResults(questions, responses);

    const insights = this.generateInsights({
      totalResponses: responses.length,
      eligibleOutcomeQuestions,
      questionAnalytics,
      questions,
      dropOff,
      qualityBuckets,
      segmentation,
    });

    return {
      survey: { id: survey.id, title: survey.title, status: survey.status, ideaTitle: survey.idea?.title ?? null },
      summary: {
        totalResponses: responses.length,
        completionRate,
        avgCompletionTime: this.formatDuration(medianDuration), // median — one abandoned-tab outlier must not define the headline
        qualityHighPct: responses.length ? (qualityBuckets.HIGH / responses.length) * 100 : null,
      },
      trend,
      activity: { started, completed: completedCount, abandoned, completionRate },
      time: {
        average: this.formatDuration(avgDuration),
        median: this.formatDuration(medianDuration),
        fastest: this.formatDuration(fastest),
        longest: this.formatDuration(longest),
      },
      questions: questionAnalytics,
      dropOff,
      quality: { buckets: qualityBuckets, total: responses.length, sampleSizeLabel: this.sampleSizeLabel(responses.length) },
      eligibleOutcomeQuestions,
      eligibleSegmentQuestions,
      segmentation,
      impact,
      abResults,
      insights,
      sampleSizeLabel: this.sampleSizeLabel(responses.length),
    };
  }

  async getResponsesPage(id: string, ownerId: string | null, opts: { page?: number; pageSize?: number; quality?: string; search?: string; questionId?: string }) {
    const survey = await this.loadFullSurvey(id, ownerId);
    const medianDuration = this.median(
      survey.responses.filter((r) => r.session?.completed).map((r) => this.durationSeconds(r.session)).filter((d): d is number => d != null)
    );
    const qualityMap = this.computeQuality(survey.questions, survey.responses, medianDuration);
    const imputed = this.imputedDuration(survey.responses.map((r) => r.session));

    let filtered = survey.responses.map((r) => ({ ...r, quality: qualityMap.get(r.id)! }));
    if (opts.quality && opts.quality !== 'ALL') filtered = filtered.filter((r) => r.quality.label === opts.quality);
    if (opts.questionId) {
      filtered = filtered.filter((r) => r.answers.some((a: any) => a.questionId === opts.questionId));
    }
    if (opts.search) {
      const term = opts.search.toLowerCase();
      filtered = filtered.filter((r) =>
        r.answers.some((a: any) => {
          if (opts.questionId && a.questionId !== opts.questionId) return false;
          const v = this.parseValue(a.value);
          return typeof v === 'string' && v.toLowerCase().includes(term);
        })
      );
    }
    filtered.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const total = filtered.length;
    const page = Math.max(1, opts.page || 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize || 20));
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize).map((r) => ({
      id: r.id,
      submittedAt: r.submittedAt,
      startedAt: r.session?.startedAt ?? null,
      respondentEmail: r.respondentEmail,
      respondentEmailVerified: (r as any).respondentEmailVerified ?? false,
      duration: r.session ? this.effectiveDuration(r.session, imputed) : null,
      durationEstimated: this.isEstimatedDuration(r.session, imputed),
      quality: r.quality,
      answers: r.answers.map((a: any) => ({ questionId: a.questionId, value: a.value })),
    }));

    return { responses: pageRows, total, page, pageSize };
  }

  // ---------- public results link ----------

  /**
   * Resolves a share token to a survey the owner has explicitly published
   * results for. Anything not shared — or unshared since — is a 404, never a
   * hint that the survey exists.
   */
  private async loadShared(shareId: string) {
    const survey = await this.prisma.survey.findFirst({
      where: { shareId, shareEnabled: true },
      select: { id: true, title: true, status: true, shareSettings: true, idea: { select: { title: true } } },
    });
    if (!survey) throw new NotFoundException('This results page is not available');
    return { survey, settings: parseReportShareSettings(survey.shareSettings) };
  }

  /**
   * Public results payload. Sections the founder switched off are deleted
   * from the response rather than hidden client-side, and respondent
   * identities never appear here at all.
   */
  async getPublicReport(shareId: string, opts: { range?: string } = {}) {
    const { survey, settings } = await this.loadShared(shareId);
    const full = await this.getAnalytics(survey.id, null, { range: opts.range });

    const payload: any = {
      survey: { title: full.survey.title, status: full.survey.status, ideaTitle: full.survey.ideaTitle },
      settings,
      sampleSizeLabel: full.sampleSizeLabel,
      // Response count is the one number that frames everything else, so it
      // stays even when the summary block is hidden.
      totalResponses: full.summary.totalResponses,
    };

    if (settings.showSummary) {
      payload.summary = full.summary;
      payload.activity = full.activity;
      payload.time = full.time;
    }
    if (settings.showCharts) {
      payload.trend = full.trend;
      payload.questions = full.questions;
      payload.dropOff = full.dropOff;
      payload.insights = full.insights;
      payload.abResults = full.abResults;
      payload.eligibleOutcomeQuestions = full.eligibleOutcomeQuestions;
      payload.eligibleSegmentQuestions = full.eligibleSegmentQuestions;
    }
    if (settings.showQuality) {
      payload.quality = full.quality;
    }
    return payload;
  }

  /**
   * Public response browser. Mirrors getResponsesPage but strips every
   * respondent identifier: emails are personal data of third parties who
   * answered a private survey, and must never appear on a public link.
   */
  async getPublicResponses(shareId: string, opts: { page?: number; pageSize?: number; quality?: string; search?: string; questionId?: string }) {
    const { survey, settings } = await this.loadShared(shareId);
    if (!settings.showResponses) throw new NotFoundException('Individual responses are not shared for this survey');

    const page = await this.getResponsesPage(survey.id, null, opts);
    return {
      ...page,
      responses: page.responses.map((r) => {
        const { respondentEmail, respondentEmailVerified, ...rest } = r as any;
        return settings.showQuality ? rest : { ...rest, quality: undefined };
      }),
    };
  }

  // Questions without answer data — the public response browser needs labels
  // and option text to render answers, but nothing owner-only.
  async getPublicQuestions(shareId: string) {
    const { survey } = await this.loadShared(shareId);
    const questions = await this.prisma.surveyQuestion.findMany({
      where: { surveyId: survey.id },
      orderBy: { order: 'asc' },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return questions.map((q) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      description: q.description,
      settings: q.settings,
      options: q.options.map((o) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl })),
    }));
  }

  async exportCsv(id: string, ownerId: string | null): Promise<string> {
    const survey = await this.loadFullSurvey(id, ownerId);
    const medianDuration = this.median(
      survey.responses.filter((r) => r.session?.completed).map((r) => this.durationSeconds(r.session)).filter((d): d is number => d != null)
    );
    const qualityMap = this.computeQuality(survey.questions, survey.responses, medianDuration);

    // Email columns only exist when the survey actually collects emails, so
    // anonymous-survey exports stay exactly as before.
    const emailCols = survey.collectEmail ? ['Respondent Email', 'Email Verified'] : [];
    const headers = ['Response ID', 'Survey Version', 'Submitted At', 'Duration (s)', 'Duration Estimated', 'Quality', ...emailCols, ...survey.questions.map((q) => `${q.questionText} [${q.type}]`)];
    const imputed = this.imputedDuration(survey.responses.map((r) => r.session));
    const escape = (v: any) => {
      let s = v == null ? '' : String(v);
      // Formula-injection guard: respondent text starting with =, +, -, @ or a
      // tab/CR would otherwise execute as a formula when opened in Excel/Sheets.
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = survey.responses.map((r) => {
      const duration = r.session ? this.effectiveDuration(r.session, imputed) : null;
      const durationEstimated = this.isEstimatedDuration(r.session, imputed);
      const quality = qualityMap.get(r.id)?.label || '';
      const answerCells = survey.questions.map((q) => {
        const a = r.answers.find((x: any) => x.questionId === q.id);
        if (!a) return '';
        const v = this.parseValue(a.value);
        if (Array.isArray(v)) return v.map((id: string) => q.options.find((o: any) => o.id === id)?.label || id).join('; ');
        if (['MULTIPLE_CHOICE', 'DROPDOWN', 'IMAGE_CHOICE'].includes(q.type)) return q.options.find((o: any) => o.id === v)?.label || v;
        return v;
      });
      const emailCells = survey.collectEmail
        ? [r.respondentEmail || '', (r as any).respondentEmailVerified ? 'Yes (Google)' : r.respondentEmail ? 'No (typed)' : '']
        : [];
      return [r.id, survey.versionNumber, new Date(r.submittedAt).toISOString(), duration != null ? Math.round(duration) : '', durationEstimated ? 'Yes' : 'No', quality, ...emailCells, ...answerCells];
    });

    return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  }
}
