/**
 * Tavily web search for the AI Deep Dive agent.
 *
 * Deliberately dependency-free: Node 20's global fetch is enough, and adding an
 * SDK for one POST would be a new supply-chain surface for no gain.
 *
 * The contract every caller relies on: THIS NEVER THROWS. Live research is a
 * bonus, not a precondition — a missing key, a dead provider or an exhausted
 * quota degrades the run to model knowledge (flagged webSearchUsed=false in the
 * report) instead of failing it. Callers treat `null` as "no web evidence".
 */

const TAVILY_URL = 'https://api.tavily.com/search';
const TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
/** Hard credit cap per run. Tavily's free tier is ~1000 basic searches/month. */
export const MAX_SEARCHES_PER_RUN = 8;
/** Each result is trimmed before it ever reaches a prompt — Groq's per-request token budget is small. */
const RESULT_CONTENT_CHARS = 800;
const MAX_SOURCES = 20;

export type SourceUse = 'competitors' | 'market' | 'customers';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export interface CollectedSource {
  title: string;
  url: string;
  usedFor: SourceUse;
}

/**
 * Per-run research state. Holds the credit budget, the provider's health and
 * the real sources seen — the agent builds its citation list from THIS, never
 * from anything the model returned, so a hallucinated URL cannot reach a report.
 */
export interface ResearchState {
  count: number;
  down: boolean;
  consecutiveFailures: number;
  sources: CollectedSource[];
  apiKey?: string;
  fetchImpl: typeof fetch;
}

export function createResearchState(
  apiKey = process.env.TAVILY_API_KEY,
  fetchImpl: typeof fetch = fetch,
): ResearchState {
  return { count: 0, down: false, consecutiveFailures: 0, sources: [], apiKey: apiKey || undefined, fetchImpl };
}

/** True when the run produced at least one real web source. */
export function webSearchUsed(state: ResearchState): boolean {
  return state.sources.length > 0;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function collectSources(state: ResearchState, results: TavilyResult[], usedFor: SourceUse) {
  for (const r of results) {
    if (state.sources.length >= MAX_SOURCES) return;
    if (state.sources.some(s => s.url === r.url)) continue;
    state.sources.push({ title: r.title, url: r.url, usedFor });
  }
}

/**
 * One search. Returns null whenever there is no usable web evidence — no key,
 * budget spent, provider down, request failed, or nothing came back.
 *
 * A single timeout does not disable the provider: one slow request is normal
 * and the run still has queries worth trying. Two consecutive failures, or any
 * auth/quota rejection, do — at that point retrying just burns wall-clock time
 * the founder is watching.
 */
export async function tavilySearch(
  state: ResearchState,
  query: string,
  usedFor: SourceUse,
): Promise<{ answer: string | null; results: TavilyResult[] } | null> {
  if (!state.apiKey || state.down) return null;
  if (state.count >= MAX_SEARCHES_PER_RUN) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await state.fetchImpl(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.apiKey}` },
      body: JSON.stringify({
        query: String(query || '').slice(0, 300),
        search_depth: 'basic',
        max_results: MAX_RESULTS,
        include_answer: true,
      }),
      signal: controller.signal,
    });

    // A search that reached the provider counts against the budget either way:
    // rejected requests can still be billed, and pretending otherwise would let
    // a failing run loop far past the cap.
    state.count++;

    if (!res.ok) {
      // 401/403 = bad key, 432 = quota exhausted. None of those fix themselves
      // inside one run, so stop asking.
      if (res.status === 401 || res.status === 403 || res.status === 432) state.down = true;
      else state.consecutiveFailures++;
      if (state.consecutiveFailures >= 2) state.down = true;
      return null;
    }

    state.consecutiveFailures = 0;
    const body: any = await res.json();

    const results: TavilyResult[] = (Array.isArray(body?.results) ? body.results : [])
      .filter((r: any) => isHttpUrl(r?.url))
      .map((r: any) => ({
        title: String(r.title || '').trim().slice(0, 150) || r.url,
        url: r.url as string,
        content: String(r.content || '').trim().slice(0, RESULT_CONTENT_CHARS),
      }));

    if (!results.length) return null;

    collectSources(state, results, usedFor);
    const answer = typeof body?.answer === 'string' && body.answer.trim() ? body.answer.trim().slice(0, 800) : null;
    return { answer, results };
  } catch {
    // Timeout, DNS, malformed JSON — all the same to the caller.
    state.count++;
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= 2) state.down = true;
    return null;
  } finally {
    clearTimeout(timer);
  }
}
