import { MAX_SEARCHES_PER_RUN, createResearchState, tavilySearch, webSearchUsed } from '../tavily.client';

const ok = (body: any) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });

const sampleBody = {
  answer: 'A short summary.',
  results: [
    { title: 'Competitor A', url: 'https://a.example.com', content: 'x'.repeat(2000) },
    { title: 'Competitor B', url: 'https://b.example.com', content: 'B does things.' },
  ],
};

describe('tavilySearch', () => {
  it('returns results and collects them as sources', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok(sampleBody));
    const state = createResearchState('key', fetchImpl as any);

    const res = await tavilySearch(state, 'competitors', 'competitors');

    expect(res!.results).toHaveLength(2);
    expect(res!.answer).toBe('A short summary.');
    expect(state.count).toBe(1);
    expect(state.sources.map(s => s.url)).toEqual(['https://a.example.com', 'https://b.example.com']);
    expect(webSearchUsed(state)).toBe(true);
  });

  it('truncates result content so one search cannot blow the model token budget', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok(sampleBody));
    const state = createResearchState('key', fetchImpl as any);

    const res = await tavilySearch(state, 'q', 'market');

    expect(res!.results[0].content.length).toBe(800);
  });

  it('returns null without an API key and never calls out', async () => {
    const fetchImpl = jest.fn();
    const state = createResearchState(undefined, fetchImpl as any);

    expect(await tavilySearch(state, 'q', 'market')).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(webSearchUsed(state)).toBe(false);
  });

  it('stops immediately on an auth or quota rejection', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fail(401));
    const state = createResearchState('bad-key', fetchImpl as any);

    expect(await tavilySearch(state, 'q', 'market')).toBeNull();
    expect(state.down).toBe(true);

    expect(await tavilySearch(state, 'another', 'market')).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('tolerates one transient failure but gives up after two in a row', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(ok(sampleBody))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));
    const state = createResearchState('key', fetchImpl as any);

    expect(await tavilySearch(state, 'a', 'market')).toBeNull();
    expect(state.down).toBe(false);

    expect(await tavilySearch(state, 'b', 'market')).not.toBeNull();
    expect(state.consecutiveFailures).toBe(0);

    await tavilySearch(state, 'c', 'market');
    await tavilySearch(state, 'd', 'market');
    expect(state.down).toBe(true);
  });

  it('refuses to spend more than the per-run search budget', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok(sampleBody));
    const state = createResearchState('key', fetchImpl as any);

    for (let i = 0; i < MAX_SEARCHES_PER_RUN + 3; i++) await tavilySearch(state, `q${i}`, 'market');

    expect(state.count).toBe(MAX_SEARCHES_PER_RUN);
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_SEARCHES_PER_RUN);
  });

  it('drops results with a missing or non-http URL', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      ok({
        results: [
          { title: 'Bad scheme', url: 'javascript:alert(1)', content: 'nope' },
          { title: 'No url', content: 'nope' },
          { title: 'Good', url: 'https://good.example.com', content: 'yes' },
        ],
      }),
    );
    const state = createResearchState('key', fetchImpl as any);

    const res = await tavilySearch(state, 'q', 'competitors');

    expect(res!.results).toHaveLength(1);
    expect(state.sources).toEqual([{ title: 'Good', url: 'https://good.example.com', usedFor: 'competitors' }]);
  });

  it('treats a malformed body as no evidence rather than throwing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => 'not json at all' });
    const state = createResearchState('key', fetchImpl as any);

    expect(await tavilySearch(state, 'q', 'market')).toBeNull();
    expect(webSearchUsed(state)).toBe(false);
  });

  it('does not record the same URL twice across searches', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok(sampleBody));
    const state = createResearchState('key', fetchImpl as any);

    await tavilySearch(state, 'one', 'competitors');
    await tavilySearch(state, 'two', 'market');

    expect(state.sources).toHaveLength(2);
  });
});
