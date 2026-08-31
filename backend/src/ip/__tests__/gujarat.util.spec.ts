import {
  normalizeText, canonicalCity, canonicalInstitution, isFocusState, countBy, monthlySeries,
} from '../gujarat.util';

/**
 * The ecosystem dashboard's arithmetic.
 *
 * The rule these lock in: a location is only ever counted when a founder
 * actually chose it. Nothing here may infer Gujarat from a name, a city, or a
 * near-miss spelling — an unset state is unknown, and unknown is reported as
 * coverage, never bucketed.
 */

describe('isFocusState', () => {
  it('matches the dropdown value, case and padding aside', () => {
    expect(isFocusState('Gujarat')).toBe(true);
    expect(isFocusState('gujarat')).toBe(true);
    expect(isFocusState('  Gujarat  ')).toBe(true);
  });

  it('never guesses', () => {
    // A Gujarat city with no state set is unknown, not Gujarat: the founder
    // did not say, and the dashboard must not say it for them.
    expect(isFocusState('')).toBe(false);
    expect(isFocusState(null)).toBe(false);
    expect(isFocusState(undefined)).toBe(false);
    expect(isFocusState('Maharashtra')).toBe(false);
    expect(isFocusState('Gujarat Colony, Pune')).toBe(false);
    expect(isFocusState('Ahmedabad')).toBe(false);
  });
});

describe('canonicalCity', () => {
  it('folds the spellings that would otherwise split a bar in two', () => {
    expect(canonicalCity('ahmedabad')).toBe('Ahmedabad');
    expect(canonicalCity('  AHMEDABAD ')).toBe('Ahmedabad');
    expect(canonicalCity('Amdavad')).toBe('Ahmedabad');
    expect(canonicalCity('baroda')).toBe('Vadodara');
    expect(canonicalCity('Vadodara')).toBe('Vadodara');
  });

  it('title-cases an unknown city rather than dropping it', () => {
    expect(canonicalCity('kheda')).toBe('Kheda');
    expect(canonicalCity('new delhi')).toBe('New Delhi');
  });

  it('returns empty for nothing, so it is excluded rather than bucketed', () => {
    expect(canonicalCity('')).toBe('');
    expect(canonicalCity(null)).toBe('');
    expect(canonicalCity('   ')).toBe('');
  });
});

describe('canonicalInstitution', () => {
  it('normalises whitespace but does not invent a canonical name', () => {
    expect(canonicalInstitution('  LD  College   of Engineering ')).toBe('LD College of Engineering');
    expect(canonicalInstitution('')).toBe('');
  });

  it('keeps the punctuation an institution name actually uses', () => {
    expect(canonicalInstitution("St. Xavier's College")).toBe("St. Xavier's College");
    expect(canonicalInstitution('Nirma University & Institute')).toBe('Nirma University & Institute');
  });
});

describe('countBy', () => {
  const rows = [
    { city: 'Ahmedabad' }, { city: 'Ahmedabad' }, { city: 'Surat' }, { city: '' }, { city: 'Rajkot' },
  ];

  it('counts, drops blanks, and sorts biggest first', () => {
    expect(countBy(rows, (r) => r.city)).toEqual([
      { label: 'Ahmedabad', count: 2 },
      { label: 'Rajkot', count: 1 },
      { label: 'Surat', count: 1 },
    ]);
  });

  it('never emits an Unknown bucket — coverage is reported separately', () => {
    expect(countBy(rows, (r) => r.city).map((d) => d.label)).not.toContain('');
    expect(countBy([{ city: '' }], (r) => r.city)).toEqual([]);
  });
});

describe('monthlySeries', () => {
  it('emits one bucket per month, oldest first', () => {
    const series = monthlySeries([], 12);
    expect(series).toHaveLength(12);
    expect(series.every((p) => p.value === 0)).toBe(true);
  });

  it('counts a date into the current month and ignores unusable values', () => {
    const series = monthlySeries([new Date(), null, undefined, 'not a date'], 6);
    expect(series).toHaveLength(6);
    expect(series[series.length - 1].value).toBe(1);
    expect(series.reduce((sum, p) => sum + p.value, 0)).toBe(1);
  });

  it('leaves quiet months at zero rather than joining across them', () => {
    const old = new Date();
    old.setUTCFullYear(old.getUTCFullYear() - 5);
    // Out of range entirely — counted nowhere, not clamped into the first bucket.
    expect(monthlySeries([old], 6).reduce((sum, p) => sum + p.value, 0)).toBe(0);
  });
});

describe('normalizeText', () => {
  it('collapses whitespace and strips stray punctuation', () => {
    expect(normalizeText('  Gujarat,  India ')).toBe('Gujarat India');
    expect(normalizeText(null)).toBe('');
  });
});
