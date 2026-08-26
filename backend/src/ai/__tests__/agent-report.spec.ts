import {
  EvidenceSignals,
  applyConfidenceCap,
  buildCouldNotVerify,
  buildEvidenceCoverage,
  buildLimitations,
  mapCitations,
  normalizeCompetitors,
  normalizeCustomers,
  normalizeMarket,
  normalizeScores,
  normalizeSynthesis,
  urlFromSources,
} from '../agent-report';

const signals = (over: Partial<EvidenceSignals> = {}): EvidenceSignals => ({
  webSearchUsed: true,
  sourceCount: 6,
  surveyResponses: 25,
  expertValidations: 3,
  founderInfoComplete: true,
  ...over,
});

describe('untrusted model output', () => {
  const sources = [{ url: 'https://real.example.com' }];

  it('rejects a URL the search never returned', () => {
    expect(urlFromSources('https://invented.example.com', sources)).toBeNull();
    expect(urlFromSources('https://real.example.com', sources)).toBe('https://real.example.com/');
  });

  it('rejects a non-http URL outright', () => {
    expect(urlFromSources('javascript:alert(1)', sources)).toBeNull();
    expect(urlFromSources('', sources)).toBeNull();
  });

  it('drops a fabricated competitor URL but keeps the competitor', () => {
    const out = normalizeCompetitors(
      { direct: [{ name: 'Acme', url: 'https://fake.example.com', whatTheyDo: 'Things', threat: 'HIGH' }] },
      sources,
    );

    expect(out.direct[0].name).toBe('Acme');
    expect(out.direct[0].url).toBeNull();
  });

  it('keeps pricing null when the model did not supply it', () => {
    const out = normalizeCompetitors({ direct: [{ name: 'Acme', pricing: '   ' }] }, sources);
    expect(out.direct[0].pricing).toBeNull();
  });

  it('falls back on an invalid enum instead of storing it', () => {
    const out = normalizeCompetitors({ direct: [{ name: 'Acme', threat: 'CATASTROPHIC' }] }, sources);
    expect(out.direct[0].threat).toBe('MEDIUM');
  });

  it('clamps oversized arrays and strings', () => {
    const out = normalizeCompetitors(
      {
        direct: Array.from({ length: 20 }, (_, i) => ({ name: `C${i}`, strengths: ['a', 'b', 'c', 'd', 'e'] })),
        indirect: Array.from({ length: 20 }, (_, i) => ({ name: `I${i}` })),
      },
      sources,
    );

    expect(out.direct).toHaveLength(6);
    expect(out.direct[0].strengths).toHaveLength(3);
    expect(out.indirect).toHaveLength(4);
  });

  it('strips citation objects the model inlined into prose', () => {
    const out = normalizeMarket({
      trends: [
        'Vertical SaaS is growing fast {"n":7,"finding":"valued at $94.86 billion"}',
        // The clamp in an earlier pass can leave one unterminated.
        'AI validation tools are emerging {"n":1,"finding":"An AI business idea validator pulls',
      ],
      summary: 'Solid demand {"n":2,"finding":"CAGR ~10%"} across the segment.',
    });

    expect(out.trends[0]).toBe('Vertical SaaS is growing fast');
    expect(out.trends[1]).toBe('AI validation tools are emerging');
    expect(out.summary).toBe('Solid demand across the segment.');
    expect(JSON.stringify(out)).not.toContain('"n":');
  });

  it('leaves ordinary prose untouched', () => {
    const out = normalizeMarket({ summary: 'Growth of 10% (2024) per industry reports.' });
    expect(out.summary).toBe('Growth of 10% (2024) per industry reports.');
  });

  it('survives a completely malformed payload', () => {
    const out = normalizeCompetitors('garbage' as any, sources);
    expect(out.direct).toEqual([]);
    expect(out.summary).toBe('');
    expect(normalizeMarket(null).size).toEqual({ tam: null, sam: null, som: null });
  });

  it('ignores a model-supplied overall score and recomputes it', () => {
    const out = normalizeScores({
      dimensions: {
        marketOpportunity: 40, feasibility: 40, founderFit: 40, revenuePotential: 40,
        scalability: 40, innovation: 40, socialImpact: 40, investorAttractiveness: 10,
      },
      overall: 99,
      confidence: 80,
    });

    // Seven dimensions at 40/50 = 80/100; investorAttractiveness is excluded.
    expect(out.overall).toBe(80);
    expect((out as any).overall).not.toBe(99);
  });

  it('clamps out-of-range dimension scores rather than trusting them', () => {
    const out = normalizeScores({ dimensions: { marketOpportunity: 900, feasibility: -20, founderFit: 'high' } });
    expect(out.dimensions.marketOpportunity).toBe(50);
    expect(out.dimensions.feasibility).toBe(0);
    expect(out.dimensions.founderFit).toBe(0);
  });

  it('keeps only gap keys the survey generator understands', () => {
    const out = normalizeSynthesis({
      experiments: [
        { title: 'A', gapKey: 'PRICING' },
        { title: 'B', gapKey: 'MADE_UP_KEY' },
      ],
    });
    expect(out.experiments[0].gapKey).toBe('PRICING');
    expect(out.experiments[1].gapKey).toBeNull();
  });

  it('maps citations back to real results and drops out-of-range indexes', () => {
    const results = [
      { title: 'One', url: 'https://one.example.com' },
      { title: 'Two', url: 'https://two.example.com' },
    ];
    const out = mapCitations(
      [{ n: 1, finding: 'says X' }, { n: 7, finding: 'invented' }, { n: 'two', finding: 'bad index' }],
      results,
      'market',
    );

    expect(out).toEqual([{ title: 'One', url: 'https://one.example.com', finding: 'says X', usedFor: 'market' }]);
  });

  it('takes survey evidence from the server, never from the model', () => {
    const out = normalizeCustomers({ surveyEvidence: 'the model made this up' }, '42 real responses');
    expect(out.surveyEvidence).toBe('42 real responses');
  });
});

describe('evidence coverage', () => {
  it('is STRONG only with web research, sources, survey and expert data', () => {
    expect(buildEvidenceCoverage(signals()).level).toBe('STRONG');
  });

  it('is MODERATE when web research exists but customers have not been surveyed', () => {
    const coverage = buildEvidenceCoverage(signals({ surveyResponses: 0, expertValidations: 0 }));
    expect(coverage.level).toBe('MODERATE');
    expect(coverage.explanation).toContain('no customer survey data has been collected yet');
  });

  it('is LIMITED with no web research and no customer data', () => {
    const coverage = buildEvidenceCoverage(
      signals({ webSearchUsed: false, sourceCount: 0, surveyResponses: 0, expertValidations: 0, founderInfoComplete: false }),
    );
    expect(coverage.level).toBe('LIMITED');
  });
});

describe('confidence caps', () => {
  it('leaves confidence alone when the evidence supports it', () => {
    const out = applyConfidenceCap(88, signals());
    expect(out.confidence).toBe(88);
    expect(out.capReason).toBeNull();
  });

  it('caps at 75 when no customer survey exists', () => {
    const out = applyConfidenceCap(95, signals({ surveyResponses: 0 }));
    expect(out.confidence).toBe(75);
    expect(out.capReason).toContain('No customer survey data exists');
  });

  it('caps at 60 without live web research', () => {
    expect(applyConfidenceCap(95, signals({ webSearchUsed: false })).confidence).toBe(60);
  });

  it('caps hardest when both are missing', () => {
    const out = applyConfidenceCap(99, signals({ webSearchUsed: false, sourceCount: 0, surveyResponses: 0 }));
    expect(out.confidence).toBe(50);
    expect(buildLimitations(signals({ webSearchUsed: false, surveyResponses: 0 }), out.capReason)).toContain(out.capReason);
  });

  it('never inflates a low confidence up to the cap', () => {
    expect(applyConfidenceCap(20, signals({ surveyResponses: 0 })).confidence).toBe(20);
  });
});

describe('what we could not verify', () => {
  const base = {
    competitors: { direct: [{ name: 'Acme', pricing: null }, { name: 'Globex', pricing: '$10/mo' }] },
    market: { size: { tam: null, sam: null, som: null } },
    customers: { unknowns: ['Whether schools have budget for this'] },
    risks: [{ risk: 'Channel access', missingEvidence: 'Nobody has confirmed distributor interest.' }],
  } as any;

  it('names unverified competitor pricing', () => {
    const out = buildCouldNotVerify(base, signals());
    const pricing = out.find(e => e.item === 'Competitor pricing');
    expect(pricing!.note).toContain('Acme');
    expect(pricing!.note).not.toContain('Globex');
    expect(pricing!.kind).toBe('UNVERIFIED');
  });

  it('reports missing market sizing rather than estimating it', () => {
    const out = buildCouldNotVerify(base, signals());
    expect(out.find(e => e.item === 'Market size')!.note).toContain('Insufficient source-backed evidence');
  });

  it('flags absent customer evidence when no survey has run', () => {
    const out = buildCouldNotVerify(base, signals({ surveyResponses: 0 }));
    expect(out.some(e => e.item === 'Customer willingness to pay')).toBe(true);
  });

  it('carries through research unknowns and unchecked risks', () => {
    const out = buildCouldNotVerify(base, signals());
    expect(out.some(e => e.item === 'Whether schools have budget for this')).toBe(true);
    expect(out.some(e => e.item === 'Channel access')).toBe(true);
  });

  it('says so plainly when the whole run had no web research', () => {
    const out = buildCouldNotVerify(base, signals({ webSearchUsed: false }));
    expect(out[0].item).toBe('External facts');
  });
});
