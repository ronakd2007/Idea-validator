import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ZodType } from 'zod';

/**
 * Claude access for the AI Deep Dive agent.
 *
 * Two shapes, deliberately kept separate:
 *
 *   research() lets Claude search the live web and answer in prose. The search
 *   runs on Anthropic's infrastructure, so the URLs come back as real result
 *   blocks - the model never gets to author a link.
 *
 *   extract() turns that prose into JSON against a schema, with no tools and
 *   no web access. It is shown a numbered list of the sources research()
 *   actually collected, so a citation can only ever point at a real one.
 *
 * Splitting them is what keeps the evidence guarantee: the half that can
 * search cannot invent structure, and the half that emits structure cannot
 * reach the internet.
 */

export const CLAUDE_MODEL = 'claude-opus-5';

/** Anthropic bills per search, so a run is capped the same way it was before. */
export const MAX_SEARCHES_PER_RUN = 8;

export type SourceUse = 'competitors' | 'market' | 'customers';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface WebSource {
  title: string;
  url: string;
  usedFor: SourceUse;
}

/** Per-run research state: the search budget and every real source seen. */
export interface ResearchState {
  searchCount: number;
  sources: WebSource[];
  webSearchFailed: boolean;
}

export function createResearchState(): ResearchState {
  return { searchCount: 0, sources: [], webSearchFailed: false };
}

export function webSearchUsed(state: ResearchState): boolean {
  return state.sources.length > 0;
}

const MAX_SOURCES = 20;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Pulls the real search hits out of a response.
 *
 * A web_search_tool_result carries a LIST of results on success and a single
 * error OBJECT on failure - indexing without checking is how that difference
 * turns into a crash.
 */
function collectSources(content: any[], state: ResearchState, usedFor: SourceUse) {
  for (const block of content || []) {
    if (block?.type !== 'web_search_tool_result') continue;

    const results = block.content;
    if (!Array.isArray(results)) {
      state.webSearchFailed = true;
      continue;
    }

    for (const result of results) {
      if (result?.type !== 'web_search_result') continue;
      if (!isHttpUrl(result.url)) continue;
      if (state.sources.length >= MAX_SOURCES) return;
      if (state.sources.some(s => s.url === result.url)) continue;
      state.sources.push({
        title: String(result.title || result.url).trim().slice(0, 150),
        url: result.url,
        usedFor,
      });
    }
  }
}

function textOf(content: any[]): string {
  return (content || [])
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n')
    .trim();
}

export class ClaudeClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  static isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  static fromEnv(): ClaudeClient {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
    return new ClaudeClient(apiKey);
  }

  /**
   * One research pass: Claude searches the web and reports what it found.
   *
   * A long server-tool turn can stop with `pause_turn` rather than finishing.
   * That is not an error and not a final answer - the turn is resumed by
   * handing the paused assistant message back, or the answer silently arrives
   * truncated.
   */
  async research(
    prompt: string,
    state: ResearchState,
    usedFor: SourceUse,
    opts: { maxSearches: number; effort?: Effort } = { maxSearches: 3 },
  ): Promise<{ text: string; searched: boolean }> {
    const budget = Math.max(0, Math.min(opts.maxSearches, MAX_SEARCHES_PER_RUN - state.searchCount));
    if (budget === 0) return { text: '', searched: false };

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];
    const before = state.sources.length;
    let text = '';

    // Bounded: each pass either finishes or resumes a paused turn, and a
    // runaway loop would burn both search credits and the founder's patience.
    for (let turn = 0; turn < 6; turn++) {
      const response = await this.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        output_config: { effort: opts.effort ?? 'medium' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: budget }],
        messages,
      });

      collectSources(response.content as any[], state, usedFor);
      const turnText = textOf(response.content as any[]);
      if (turnText) text = turnText;

      if (response.stop_reason === 'refusal') {
        throw new Error(`Claude declined this research request (${response.stop_details?.category ?? 'unspecified'}).`);
      }
      if (response.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: response.content });
        continue;
      }
      break;
    }

    const found = state.sources.length - before;
    state.searchCount = Math.min(MAX_SEARCHES_PER_RUN, state.searchCount + budget);
    return { text, searched: found > 0 };
  }

  /**
   * Prose in, validated JSON out. No tools: this call cannot reach the web,
   * so everything it writes has to come from the text it was handed.
   */
  async extract<T>(prompt: string, schema: ZodType<T>, opts: { effort?: Effort; maxTokens?: number } = {}): Promise<T> {
    const response = await this.client.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      output_config: {
        effort: opts.effort ?? 'low',
        format: zodOutputFormat(schema),
      },
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(`Claude declined to produce this section (${response.stop_details?.category ?? 'unspecified'}).`);
    }
    // parsed_output is null when the model could not satisfy the schema.
    if (response.parsed_output == null) {
      throw new Error('Claude returned a response that did not match the expected structure.');
    }
    return response.parsed_output as T;
  }
}

/** Turns an SDK error into something a founder reading the dashboard can act on. */
export function describeClaudeError(err: any): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'The AI service rejected the API key — check ANTHROPIC_API_KEY on the server.';
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return 'The AI service denied this request — check the API key’s permissions.';
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'The AI service is rate limited right now — try again in a minute.';
  }
  if (err instanceof Anthropic.NotFoundError) {
    return 'The configured AI model is unavailable — the model name needs updating.';
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the AI service — check the server’s network connection.';
  }
  if (err instanceof Anthropic.APIError) {
    return `AI Deep Dive could not finish: ${err.message}`;
  }
  return err?.message ? `AI Deep Dive could not finish: ${err.message}` : 'AI Deep Dive could not finish — try again shortly.';
}
