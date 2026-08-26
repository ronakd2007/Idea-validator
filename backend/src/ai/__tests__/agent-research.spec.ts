import { AgentService } from '../agent.service';
import { createResearchState, webSearchUsed } from '../claude.client';

/**
 * The seam between Claude's server-side web search and the report: which
 * sources a run is allowed to cite, and what an extraction step is shown.
 * Sources come out of real `web_search_tool_result` blocks, so this is what
 * stops an invented link from reaching a founder.
 */
const service = new AgentService({} as any, {} as any);
const sourceBlock = (state: any, usedFor: string) => (service as any).sourceBlock(state, usedFor);
const sourcesFor = (state: any, usedFor: string) => (service as any).sourcesFor(state, usedFor);
const mergeSources = (state: any, citations: any[]) => (service as any).mergeSources(state, citations);

function stateWithSources() {
  const state = createResearchState();
  state.sources.push(
    { title: 'Acme pricing', url: 'https://acme.example.com', usedFor: 'competitors' },
    { title: 'Globex review', url: 'https://globex.example.com', usedFor: 'competitors' },
    { title: 'Market report', url: 'https://market.example.com', usedFor: 'market' },
  );
  return state;
}

describe('sourceBlock', () => {
  it('numbers only the sources gathered for that topic', () => {
    const block = sourceBlock(stateWithSources(), 'competitors');

    expect(block).toContain('[1] Acme pricing');
    expect(block).toContain('[2] Globex review');
    expect(block).not.toContain('Market report');
  });

  it('tells the model to claim nothing when no source was found', () => {
    const block = sourceBlock(createResearchState(), 'competitors');

    expect(block).toContain('NO WEB SOURCES WERE AVAILABLE');
    expect(block).toContain('empty citations array');
    expect(block).toContain('null');
  });

  it('exposes the real URLs so a citation can be checked against them', () => {
    const block = sourceBlock(stateWithSources(), 'market');
    expect(block).toContain('https://market.example.com');
  });
});

describe('research state', () => {
  it('reports no web research until a real source is collected', () => {
    const empty = createResearchState();
    expect(webSearchUsed(empty)).toBe(false);
    expect(webSearchUsed(stateWithSources())).toBe(true);
  });

  it('partitions sources by the topic they were gathered for', () => {
    const state = stateWithSources();
    expect(sourcesFor(state, 'competitors')).toHaveLength(2);
    expect(sourcesFor(state, 'market')).toHaveLength(1);
    expect(sourcesFor(state, 'customers')).toHaveLength(0);
  });
});

describe('mergeSources', () => {
  it('builds the list from real search hits and ignores invented ones', () => {
    const merged = mergeSources(stateWithSources(), [
      { title: 'Acme pricing', url: 'https://acme.example.com', finding: 'charges $29/mo', usedFor: 'competitors' },
      { title: 'Fabricated', url: 'https://invented.example.com', finding: 'made up', usedFor: 'competitors' },
    ]);

    expect(merged.map((s: any) => s.url)).toEqual([
      'https://acme.example.com',
      'https://globex.example.com',
      'https://market.example.com',
    ]);
    expect(merged[0].finding).toBe('charges $29/mo');
    expect(merged[1].finding).toBeNull();
  });

  it('returns nothing when the run never got a search result', () => {
    const merged = mergeSources(createResearchState(), [
      { title: 'X', url: 'https://x.example.com', finding: 'x', usedFor: 'market' },
    ]);
    expect(merged).toEqual([]);
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
