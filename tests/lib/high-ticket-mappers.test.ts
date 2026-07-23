import { describe, it, expect } from 'vitest';
import {
  rowToHighTicketKit,
  normalizeIntake,
  normalizeKit,
  toHighTicketStatus,
  blankIntake,
  blankKit,
  KIT_SECTIONS,
  SEVEN_A_KEYS,
  type HighTicketKitRow,
} from '@/lib/mothermode/highticket/types';
import {
  SECTION_LABELS,
  SECTION_HINTS,
  SEVEN_A_LABELS,
  allSections,
  sectionToText,
  kitToText,
  kitToPrintableHtml,
} from '@/lib/mothermode/highticket/export';
import { frameworkForSection } from '@/lib/mothermode/highticket/frameworks';

describe('high ticket status normalizer', () => {
  it('falls back to draft on unknown values', () => {
    expect(toHighTicketStatus('active')).toBe('active');
    expect(toHighTicketStatus('archived')).toBe('archived');
    expect(toHighTicketStatus('draft')).toBe('draft');
    expect(toHighTicketStatus('nonsense')).toBe('draft');
    expect(toHighTicketStatus(undefined)).toBe('draft');
    expect(toHighTicketStatus(null)).toBe('draft');
  });
});

describe('normalizeIntake', () => {
  it('produces a full intake from partial input', () => {
    const out = normalizeIntake({ niche: 'Fitness', audience: 'Busy execs' });
    expect(out).toEqual({
      ...blankIntake(),
      niche: 'Fitness',
      audience: 'Busy execs',
    });
  });

  it('tolerates null / undefined', () => {
    expect(normalizeIntake(null)).toEqual(blankIntake());
    expect(normalizeIntake(undefined)).toEqual(blankIntake());
  });

  it('carries the priceBand field through', () => {
    const out = normalizeIntake({ priceBand: '10k+' });
    expect(out.priceBand).toBe('10k+');
    expect(blankIntake().priceBand).toBe('');
  });
});

describe('normalizeKit', () => {
  it('produces a fully-populated kit from empty input', () => {
    expect(normalizeKit({})).toEqual(blankKit());
    expect(normalizeKit(null)).toEqual(blankKit());
  });

  it('coerces nested basics, offer, problems and script defensively', () => {
    const out = normalizeKit({
      basics: {
        avatar: { genders: 'Men', ageRange: '40-60', labels: 'plateaued' },
        problems: [
          { problem: 'stuck', cost: '$25k/mo', result: 'growth' },
          {},
        ],
      },
      sevenAs: { attention: 'leads', bogus: 'ignore me' },
      offer: {
        nameOptions: ['A', 'B', 42, null],
        chosenName: 'A',
        iHelpStatement: 'I help X',
        paymentOptions: ['full'],
        addOns: ['bonus', 7],
      },
      problems: [
        { title: '#1', problem: 'root', angst: 'cost', solution: 'map', implementation: ['step', 9] },
      ],
      offerScript: [{ label: 'PILLAR ONE', body: 'Hi' }, {}],
    });
    expect(out.basics.avatar.genders).toBe('Men');
    expect(out.basics.problems).toEqual([
      { problem: 'stuck', cost: '$25k/mo', result: 'growth' },
      { problem: '', cost: '', result: '' },
    ]);
    expect(out.sevenAs.attention).toBe('leads');
    expect(out.offer.nameOptions).toEqual(['A', 'B']);
    expect(out.offer.chosenName).toBe('A');
    expect(out.offer.paymentOptions).toEqual(['full']);
    expect(out.offer.addOns).toEqual(['bonus']);
    expect(out.problems[0].implementation).toEqual(['step']);
    expect(out.offerScript).toEqual([
      { label: 'PILLAR ONE', body: 'Hi' },
      { label: '', body: '' },
    ]);
  });
});

describe('rowToHighTicketKit', () => {
  it('maps a DB row into a record with normalized JSON', () => {
    const row: HighTicketKitRow = {
      id: 'id-1',
      slug: 'my-offer',
      name: 'My Offer',
      status: 'active',
      intake: { niche: 'Coaching' },
      kit: { offer: { chosenName: 'Elite' } },
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
      updated_by: 'admin@example.com',
    };
    const rec = rowToHighTicketKit(row);
    expect(rec.id).toBe('id-1');
    expect(rec.slug).toBe('my-offer');
    expect(rec.status).toBe('active');
    expect(rec.intake.niche).toBe('Coaching');
    expect(rec.kit.offer.chosenName).toBe('Elite');
    expect(rec.updatedBy).toBe('admin@example.com');
  });

  it('defaults a bad status to draft and null name to empty', () => {
    const row: HighTicketKitRow = {
      id: 'id-2',
      slug: 's',
      name: null,
      status: 'bogus',
      intake: null,
      kit: null,
      created_at: null,
      updated_at: null,
      updated_by: null,
    };
    const rec = rowToHighTicketKit(row);
    expect(rec.status).toBe('draft');
    expect(rec.name).toBe('');
    expect(rec.intake).toEqual(blankIntake());
    expect(rec.kit).toEqual(blankKit());
  });
});

describe('export helpers', () => {
  it('has a label and hint for every section', () => {
    for (const s of KIT_SECTIONS) {
      expect(SECTION_LABELS[s]).toBeTruthy();
      expect(SECTION_HINTS[s]).toBeTruthy();
    }
    expect(allSections()).toEqual([...KIT_SECTIONS]);
  });

  it('has a label for every one of the 7 A\'s', () => {
    for (const k of SEVEN_A_KEYS) {
      expect(SEVEN_A_LABELS[k]).toBeTruthy();
    }
  });

  it('returns empty string for empty sections', () => {
    const kit = blankKit();
    for (const s of KIT_SECTIONS) {
      expect(sectionToText(kit, s)).toBe('');
    }
  });

  it('renders a populated offer section to labeled markdown', () => {
    const kit = blankKit();
    kit.offer.chosenName = 'Elite Accelerator';
    kit.offer.nameOptions = ['Elite Accelerator', 'Growth Lab'];
    const text = sectionToText(kit, 'offer');
    expect(text).toContain(`## ${SECTION_LABELS.offer}`);
    expect(text).toContain('Elite Accelerator');
    expect(text).toContain('Growth Lab');
  });

  it('builds a full document and printable html', () => {
    const kit = blankKit();
    kit.offer.chosenName = 'Elite Accelerator';
    kit.offer.iHelpStatement = 'I help coaches scale to seven figures';
    const doc = kitToText(kit, 'Elite Accelerator');
    expect(doc).toContain('# Elite Accelerator');
    expect(doc).toContain('seven figures');
    const html = kitToPrintableHtml(kit, 'Elite Accelerator');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Elite Accelerator');
  });
});

describe('frameworks', () => {
  it('returns a non-empty framework block for every section', () => {
    for (const s of KIT_SECTIONS) {
      expect(frameworkForSection(s).length).toBeGreaterThan(0);
    }
  });
});
