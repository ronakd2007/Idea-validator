import { toPublicIpRecord, parsePublicFields, publicFacingSignature, PUBLIC_SELECT } from '../ip-public.util';
import { PUBLIC_FIELD_DEFAULTS } from '../ip.constants';

/**
 * The registry's privacy contract, locked down.
 *
 * toPublicIpRecord is the one pure step between a database row and a public
 * page, so it is the one place a leak can be proven absent rather than argued
 * about. If a future edit spreads the row instead of naming fields, or adds a
 * column that quietly rides along, these fail.
 */

// A row with every private field populated — nothing here is a realistic
// value, they are tripwires. If a string below shows up in a public payload,
// the test says exactly which field leaked.
function fullRow(overrides: any = {}) {
  return {
    id: 'ip_1',
    title: 'KisanCold Cooling System',
    description: 'A solar cold-storage unit for smallholder farms.',
    type: 'PATENT',
    status: 'FILED',
    jurisdiction: 'India',
    filingDate: new Date('2025-03-14T00:00:00.000Z'),
    state: 'Gujarat',
    city: 'Ahmedabad',
    institution: 'LEAK_INSTITUTION',
    applicationNumber: 'LEAK_APPLICATION_NUMBER',
    publicUrl: 'https://LEAK_PUBLIC_URL.example',
    publicFields: JSON.stringify(PUBLIC_FIELD_DEFAULTS),
    // Never public under any setting:
    notes: 'LEAK_NOTES',
    ownerName: 'LEAK_OWNER',
    inventorNames: JSON.stringify(['LEAK_INVENTOR']),
    adminNote: 'LEAK_ADMIN_NOTE',
    reviewMessage: 'LEAK_REVIEW_MESSAGE',
    authority: 'LEAK_AUTHORITY',
    documents: [{ id: 'd1', fileUrl: 'https://LEAK_DOCUMENT.example/a.pdf', fileName: 'a.pdf' }],
    founderId: 'LEAK_FOUNDER_ID',
    founder: { name: 'Asha Patel', email: 'LEAK_EMAIL@example.com', phone: 'LEAK_PHONE' },
    idea: { industryCategory: 'AgriTech', startup: { name: 'KisanCold', slug: 'kisancold', status: 'APPROVED' } },
    ...overrides,
  };
}

const serialized = (row: any) => JSON.stringify(toPublicIpRecord(row));

describe('toPublicIpRecord', () => {
  it('never emits a field marked as a leak tripwire', () => {
    const json = serialized(fullRow());
    for (const secret of [
      'LEAK_NOTES', 'LEAK_OWNER', 'LEAK_INVENTOR', 'LEAK_ADMIN_NOTE', 'LEAK_REVIEW_MESSAGE',
      'LEAK_DOCUMENT', 'LEAK_EMAIL', 'LEAK_PHONE', 'LEAK_FOUNDER_ID', 'LEAK_AUTHORITY',
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it('withholds the opt-in extras by default', () => {
    const out = toPublicIpRecord(fullRow());
    // Absent, not null — a client cannot tell "withheld" from "not set".
    expect(out).not.toHaveProperty('applicationNumber');
    expect(out).not.toHaveProperty('publicUrl');
    expect(out).not.toHaveProperty('filingDate');
    expect(out).not.toHaveProperty('institution');
  });

  it('emits an extra only when the founder opted that exact field in', () => {
    const out = toPublicIpRecord(
      fullRow({ publicFields: JSON.stringify({ ...PUBLIC_FIELD_DEFAULTS, showApplicationNumber: true }) })
    );
    expect(out.applicationNumber).toBe('LEAK_APPLICATION_NUMBER');
    // Opting one field in must not open the others.
    expect(out).not.toHaveProperty('publicUrl');
    expect(out).not.toHaveProperty('institution');
    expect(out).not.toHaveProperty('filingDate');
  });

  it('shows the filing year without the full date', () => {
    const out = toPublicIpRecord(fullRow());
    expect(out.filingYear).toBe(2025);
    expect(out).not.toHaveProperty('filingDate');
  });

  it('hides a startup name unless that listing is itself approved', () => {
    const pending = fullRow({
      idea: { industryCategory: 'AgriTech', startup: { name: 'LEAK_UNAPPROVED_STARTUP', status: 'PENDING_REVIEW' } },
    });
    expect(toPublicIpRecord(pending).startupName).toBeNull();
    expect(serialized(pending)).not.toContain('LEAK_UNAPPROVED_STARTUP');

    expect(toPublicIpRecord(fullRow()).startupName).toBe('KisanCold');
  });

  it('always carries the not-verified disclaimer and marks the status as founder-provided', () => {
    const out = toPublicIpRecord(fullRow());
    expect(out.statusSource).toBe('FOUNDER_PROVIDED');
    expect(out.disclaimer).toMatch(/has not been independently verified/i);
  });

  it('survives a row with nothing filled in', () => {
    const out = toPublicIpRecord({ id: 'ip_2' });
    expect(out.title).toBe('');
    expect(out.filingYear).toBeNull();
    expect(out.startupName).toBeNull();
  });

  it('ignores an unparseable or hostile publicFields blob', () => {
    for (const raw of ['not json', '', null, undefined, '{"showPublicUrl":"yes"}', '{"__proto__":{"x":1}}']) {
      const out = toPublicIpRecord(fullRow({ publicFields: raw }));
      expect(out).not.toHaveProperty('publicUrl');
      expect(out).not.toHaveProperty('applicationNumber');
    }
  });
});

describe('parsePublicFields', () => {
  it('defaults every key to false — a founder opts in, never out', () => {
    expect(parsePublicFields('{}')).toEqual(PUBLIC_FIELD_DEFAULTS);
    expect(Object.values(PUBLIC_FIELD_DEFAULTS).every((v) => v === false)).toBe(true);
  });

  it('drops keys that are not in the fixed set', () => {
    const out = parsePublicFields('{"showNotes":true,"showOwnerName":true,"showPublicUrl":true}');
    expect(out).not.toHaveProperty('showNotes');
    expect(out).not.toHaveProperty('showOwnerName');
    expect(out.showPublicUrl).toBe(true);
  });

  it('ignores non-boolean values', () => {
    expect(parsePublicFields('{"showPublicUrl":"true"}').showPublicUrl).toBe(false);
    expect(parsePublicFields('{"showPublicUrl":1}').showPublicUrl).toBe(false);
  });
});

describe('PUBLIC_SELECT', () => {
  it('never reads a private column out of the database', () => {
    for (const column of ['notes', 'ownerName', 'inventorNames', 'adminNote', 'reviewMessage', 'documents', 'founderId', 'authority']) {
      expect(PUBLIC_SELECT).not.toHaveProperty(column);
    }
  });

  it('reads only the founder name, never their contact details', () => {
    expect(PUBLIC_SELECT.founder.select).toEqual({ name: true });
  });
});

describe('publicFacingSignature', () => {
  const base = fullRow();

  it('changes when something the public can see changes', () => {
    for (const change of [
      { title: 'Something else' },
      { description: 'Rewritten' },
      { status: 'GRANTED' },
      { city: 'Surat' },
      { publicFields: JSON.stringify({ ...PUBLIC_FIELD_DEFAULTS, showPublicUrl: true }) },
    ]) {
      expect(publicFacingSignature({ ...base, ...change })).not.toBe(publicFacingSignature(base));
    }
  });

  it('does not change when only private fields change', () => {
    // Editing private notes must not cost a founder an approval they earned.
    for (const change of [
      { notes: 'new private note' },
      { ownerName: 'Someone Else' },
      { inventorNames: JSON.stringify(['A', 'B']) },
      { authority: 'A different office' },
      { adminNote: 'internal' },
    ]) {
      expect(publicFacingSignature({ ...base, ...change })).toBe(publicFacingSignature(base));
    }
  });
});
