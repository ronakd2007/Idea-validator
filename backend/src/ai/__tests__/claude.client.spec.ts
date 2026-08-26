import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ClaudeClient, MAX_SEARCHES_PER_RUN, createResearchState, describeClaudeError, webSearchUsed } from '../claude.client';

/**
 * The client's job is to harvest REAL sources out of Claude's web-search
 * blocks and to resume a paused research turn. Both are exercised here against
 * a stubbed transport, so no API key and no network are needed.
 */

function searchResultBlock(results: any) {
  return { type: 'web_search_tool_result', content: results };
}
const textBlock = (text: string) => ({ type: 'text', text });

function clientWith(responses: any[]) {
  const claude = new ClaudeClient('test-key');
  const create = jest.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  (claude as any).client = { messages: { create, parse: jest.fn() } };
  return { claude, create };
}

describe('research', () => {
  it('collects sources from real search results only', async () => {
    const { claude } = clientWith([
      {
        stop_reason: 'end_turn',
        content: [
          searchResultBlock([
            { type: 'web_search_result', url: 'https://a.example.com', title: 'A' },
            { type: 'web_search_result', url: 'https://b.example.com', title: 'B' },
          ]),
          textBlock('Two competitors found.'),
        ],
      },
    ]);
    const state = createResearchState();

    const out = await claude.research('find competitors', state, 'competitors', { maxSearches: 3 });

    expect(out.text).toBe('Two competitors found.');
    expect(out.searched).toBe(true);
    expect(state.sources).toEqual([
      { title: 'A', url: 'https://a.example.com', usedFor: 'competitors' },
      { title: 'B', url: 'https://b.example.com', usedFor: 'competitors' },
    ]);
  });

  it('drops results whose URL is missing or not http', async () => {
    const { claude } = clientWith([
      {
        stop_reason: 'end_turn',
        content: [
          searchResultBlock([
            { type: 'web_search_result', url: 'javascript:alert(1)', title: 'Bad' },
            { type: 'web_search_result', title: 'No url' },
            { type: 'web_search_result', url: 'https://good.example.com', title: 'Good' },
          ]),
        ],
      },
    ]);
    const state = createResearchState();

    await claude.research('q', state, 'market', { maxSearches: 2 });

    expect(state.sources).toEqual([{ title: 'Good', url: 'https://good.example.com', usedFor: 'market' }]);
  });

  it('treats a search error block as no evidence instead of crashing', async () => {
    // On failure the API returns a single error OBJECT here, not a list.
    const { claude } = clientWith([
      { stop_reason: 'end_turn', content: [searchResultBlock({ type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' })] },
    ]);
    const state = createResearchState();

    const out = await claude.research('q', state, 'market', { maxSearches: 2 });

    expect(out.searched).toBe(false);
    expect(state.webSearchFailed).toBe(true);
    expect(webSearchUsed(state)).toBe(false);
  });

  it('resumes a paused turn instead of returning a truncated answer', async () => {
    const { claude, create } = clientWith([
      { stop_reason: 'pause_turn', content: [searchResultBlock([{ type: 'web_search_result', url: 'https://a.example.com', title: 'A' }])] },
      { stop_reason: 'end_turn', content: [textBlock('Finished after resuming.')] },
    ]);
    const state = createResearchState();

    const out = await claude.research('q', state, 'competitors', { maxSearches: 3 });

    expect(create).toHaveBeenCalledTimes(2);
    expect(out.text).toBe('Finished after resuming.');
    // The resumed request must carry the paused assistant turn back.
    expect(create.mock.calls[1][0].messages).toHaveLength(2);
    expect(create.mock.calls[1][0].messages[1].role).toBe('assistant');
  });

  it('surfaces a refusal rather than reporting an empty result', async () => {
    const { claude } = clientWith([{ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] }]);

    await expect(claude.research('q', createResearchState(), 'market', { maxSearches: 1 })).rejects.toThrow(/declined/i);
  });

  it('never exceeds the per-run search budget', async () => {
    const { claude, create } = clientWith([]);
    const state = createResearchState();
    state.searchCount = MAX_SEARCHES_PER_RUN;

    const out = await claude.research('q', state, 'market', { maxSearches: 3 });

    expect(create).not.toHaveBeenCalled();
    expect(out.searched).toBe(false);
  });

  it('caps the requested searches to what the budget still allows', async () => {
    const { claude, create } = clientWith([{ stop_reason: 'end_turn', content: [] }]);
    const state = createResearchState();
    state.searchCount = MAX_SEARCHES_PER_RUN - 2;

    await claude.research('q', state, 'market', { maxSearches: 5 });

    const tool = create.mock.calls[0][0].tools[0];
    expect(tool.type).toBe('web_search_20260209');
    expect(tool.max_uses).toBe(2);
    expect(state.searchCount).toBe(MAX_SEARCHES_PER_RUN);
  });

  it('does not record the same URL twice', async () => {
    const dupe = searchResultBlock([{ type: 'web_search_result', url: 'https://a.example.com', title: 'A' }]);
    const { claude } = clientWith([
      { stop_reason: 'end_turn', content: [dupe] },
      { stop_reason: 'end_turn', content: [dupe] },
    ]);
    const state = createResearchState();

    await claude.research('one', state, 'competitors', { maxSearches: 1 });
    await claude.research('two', state, 'market', { maxSearches: 1 });

    expect(state.sources).toHaveLength(1);
  });
});

describe('extract', () => {
  const schema = z.object({ ok: z.boolean() });

  it('rejects a response that did not satisfy the schema', async () => {
    const claude = new ClaudeClient('test-key');
    (claude as any).client = { messages: { parse: jest.fn().mockResolvedValue({ stop_reason: 'end_turn', parsed_output: null }) } };

    await expect(claude.extract('prompt', schema)).rejects.toThrow(/did not match/i);
  });

  it('surfaces a refusal instead of returning an empty section', async () => {
    const claude = new ClaudeClient('test-key');
    (claude as any).client = {
      messages: { parse: jest.fn().mockResolvedValue({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, parsed_output: null }) },
    };

    await expect(claude.extract('prompt', schema)).rejects.toThrow(/declined/i);
  });

  it('runs without tools so the extraction step cannot reach the web', async () => {
    const parse = jest.fn().mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { ok: true } });
    const claude = new ClaudeClient('test-key');
    (claude as any).client = { messages: { parse } };

    const out = await claude.extract('prompt', schema);

    expect(out).toEqual({ ok: true });
    expect(parse.mock.calls[0][0].tools).toBeUndefined();
    expect(parse.mock.calls[0][0].output_config.format).toBeDefined();
  });
});

describe('describeClaudeError', () => {
  const headers = new Headers();

  it('names the missing credential on an auth failure', () => {
    const err = new Anthropic.AuthenticationError(401, {}, 'unauthorized', headers);
    expect(describeClaudeError(err)).toContain('ANTHROPIC_API_KEY');
  });

  it('explains a rate limit as temporary', () => {
    const err = new Anthropic.RateLimitError(429, {}, 'slow down', headers);
    expect(describeClaudeError(err)).toContain('rate limited');
  });

  it('falls back to a readable message for an unknown failure', () => {
    expect(describeClaudeError(new Error('socket hang up'))).toContain('socket hang up');
    expect(describeClaudeError({})).toContain('try again');
  });
});
