import { AgentService } from '../agent.service';
import { createResearchState } from '../tavily.client';

/**
 * The seam between live search and the model: what the prompt is shown, and how
 * a citation index becomes a real source. A keyless run exercises none of this,
 * so it is covered here with a stubbed fetch.
 */
const service = new AgentService({} as any, {} as any);
const runSearches = (state: any, queries: string[], onProgress: (detail: string) => Promise<void> = async () => {}) =>
  (service as any).runSearches(state, queries, 'competitors', onProgress);
const mergeSources = (state: any, citations: any[]) => (service as any).mergeSources(state, citations);

const body = {
  answer: 'Two products dominate.',
  results: [
    { title: 'Acme', url: 'https://acme.example.com', content: 'Acme charges $29/mo.' },
    { title: 'Globex', url: 'https://globex.example.com', content: 'Globex is free.' },
  ],
};
const ok = () => ({ ok: true, status: 200, json: async () => body });

describe('runSearches', () => {
  it('numbers results so the model can only cite what it was shown', async () => {
    const state = createResearchState('key', jest.fn().mockResolvedValue(ok()) as any);

    const { block, results } = await runSearches(state, ['acme competitors']);

    expect(block).toContain('[1] Acme');
    expect(block).toContain('[2] Globex');
    expect(block).toContain('https://acme.example.com');
    expect(block).toContain('SEARCH ENGINE SUMMARY');
    expect(results).toHaveLength(2);
  });

  it('tells the model to claim nothing when there is no web evidence', async () => {
    const state = createResearchState(undefined, jest.fn() as any);

    const { block, results } = await runSearches(state, ['acme competitors']);

    expect(block).toContain('NO WEB RESULTS AVAILABLE');
    expect(block).toContain('mark anything you cannot stand behind as unknown');
    expect(results).toEqual([]);
  });

  it('reports the real search activity as progress', async () => {
    const state = createResearchState('key', jest.fn().mockResolvedValue(ok()) as any);
    const seen: string[] = [];

    await runSearches(state, ['crm tools for freelancers'], async (d: string) => { seen.push(d); });

    expect(seen[0]).toBe('Searching: "crm tools for freelancers"');
    expect(seen[seen.length - 1]).toContain('Found 2 relevant results');
  });

  it('says so honestly when a search comes back empty', async () => {
    const state = createResearchState('key', jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [] }) }) as any);
    const seen: string[] = [];

    await runSearches(state, ['nothing here'], async (d: string) => { seen.push(d); });

    expect(seen[seen.length - 1]).toContain('No web results');
  });

  it('does not show the same URL to the model twice across queries', async () => {
    const state = createResearchState('key', jest.fn().mockResolvedValue(ok()) as any);

    const { results } = await runSearches(state, ['query one', 'query two']);

    expect(results).toHaveLength(2);
  });
});

describe('normalizeQueries', () => {
  const normalizeQueries = (frameRaw: any, industry = 'SaaS', title = 'My Idea') =>
    (service as any).normalizeQueries(frameRaw, { industry }, title);

  it('uses the queries the framing step planned', () => {
    const out = normalizeQueries({
      queries: {
        competitors: ['crm tools for freelancers competitors'],
        market: ['freelance software market size 2025'],
        customers: ['freelancer invoicing complaints'],
      },
    });

    expect(out.competitors).toEqual(['crm tools for freelancers competitors']);
    expect(out.market).toEqual(['freelance software market size 2025']);
    expect(out.customers).toEqual(['freelancer invoicing complaints']);
  });

  it('caps how many searches each topic can request', () => {
    const many = Array.from({ length: 9 }, (_, i) => `query number ${i}`);
    const out = normalizeQueries({ queries: { competitors: many, market: many, customers: many } });

    expect(out.competitors).toHaveLength(3);
    expect(out.market).toHaveLength(2);
    expect(out.customers).toHaveLength(2);
  });

  it('falls back to the idea itself rather than skipping a research area', () => {
    const out = normalizeQueries({ queries: { competitors: ['', 'ab'] } });

    expect(out.competitors).toEqual(['My Idea SaaS competitors']);
    expect(out.market).toEqual(['My Idea SaaS market size growth']);
    expect(out.customers).toEqual(['My Idea SaaS customer problems complaints']);
  });

  it('falls back when the framing step returned nothing at all', () => {
    const out = normalizeQueries({});
    expect(out.competitors[0]).toContain('competitors');
  });
});

describe('mergeSources', () => {
  it('builds the source list from real search hits, not from the model', async () => {
    const state = createResearchState('key', jest.fn().mockResolvedValue(ok()) as any);
    await runSearches(state, ['q']);

    const merged = mergeSources(state, [
      { title: 'Acme', url: 'https://acme.example.com', finding: 'charges $29/mo', usedFor: 'competitors' },
      { title: 'Fake', url: 'https://invented.example.com', finding: 'made up', usedFor: 'competitors' },
    ]);

    expect(merged.map((s: any) => s.url)).toEqual(['https://acme.example.com', 'https://globex.example.com']);
    expect(merged[0].finding).toBe('charges $29/mo');
    expect(merged[1].finding).toBeNull();
  });

  it('returns nothing when no search ever succeeded', () => {
    const state = createResearchState(undefined, jest.fn() as any);
    expect(mergeSources(state, [{ title: 'X', url: 'https://x.example.com', finding: 'x', usedFor: 'market' }])).toEqual([]);
  });
});
