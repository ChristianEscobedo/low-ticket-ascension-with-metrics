import { describe, it, expect } from 'vitest';
import {
  rowToCommunityKit,
  normalizeIntake,
  normalizeKit,
  toCommunityType,
  toCommunityStatus,
  toQuestionType,
  blankIntake,
  blankKit,
  type CommunityKitRow,
} from '@/lib/mothermode/community/types';

describe('community kit enum normalizers', () => {
  it('falls back to safe defaults on unknown values', () => {
    expect(toCommunityType('paid')).toBe('paid');
    expect(toCommunityType('free')).toBe('free');
    expect(toCommunityType('both')).toBe('both');
    expect(toCommunityType('nonsense')).toBe('paid');
    expect(toCommunityStatus('active')).toBe('active');
    expect(toCommunityStatus(undefined)).toBe('draft');
    expect(toQuestionType('email')).toBe('email');
    expect(toQuestionType('weird')).toBe('multiple_choice');
  });
});

describe('normalizeIntake', () => {
  it('produces a full intake from partial input', () => {
    const out = normalizeIntake({ niche: 'Yoga', audience: 'New moms' });
    expect(out).toEqual({
      ...blankIntake(),
      niche: 'Yoga',
      audience: 'New moms',
    });
  });

  it('tolerates null / undefined', () => {
    expect(normalizeIntake(null)).toEqual(blankIntake());
    expect(normalizeIntake(undefined)).toEqual(blankIntake());
  });

  it('carries the goal field through', () => {
    const out = normalizeIntake({ goal: 'book a strategy call' });
    expect(out.goal).toBe('book a strategy call');
    // blank intake defaults goal to empty string
    expect(blankIntake().goal).toBe('');
  });
});

describe('normalizeKit', () => {
  it('fills a full kit shape from empty input', () => {
    expect(normalizeKit({})).toEqual(blankKit());
  });

  it('coerces questions, drops options for non-choice types', () => {
    const out = normalizeKit({
      qualifyingQuestions: {
        paid: [
          { prompt: 'Q1', type: 'multiple_choice', options: ['a', 'b'], required: true },
          { prompt: 'Q2', type: 'short_text', options: ['ignored'], required: false },
          { prompt: 'Q3', type: 'email' },
        ],
      },
    });
    expect(out.qualifyingQuestions.paid).toHaveLength(3);
    expect(out.qualifyingQuestions.paid[0].options).toEqual(['a', 'b']);
    // short_text drops options
    expect(out.qualifyingQuestions.paid[1].options).toBeUndefined();
    // required defaults to true when omitted
    expect(out.qualifyingQuestions.paid[2].required).toBe(true);
    // free absent -> empty array
    expect(out.qualifyingQuestions.free).toEqual([]);
  });

  it('normalizes dm stages, sales phases, and ad concept', () => {
    const out = normalizeKit({
      dmScript: { stages: [{ key: 'welcome', label: 'Welcome', message: 'Hi' }] },
      salesCallScript: { phases: [{ key: 'open', label: 'Open', lines: ['a', 2, 'b'] }] },
      ad: { concept: 'c', headline: 'h', imagePrompt: 'p' },
    });
    expect(out.dmScript.stages[0].message).toBe('Hi');
    // non-string line dropped
    expect(out.salesCallScript.phases[0].lines).toEqual(['a', 'b']);
    expect(out.ad.concept).toBe('c');
    expect(out.ad.primaryText).toBe('');
  });

  it('normalizes the lead form and defaults missing keys', () => {
    const out = normalizeKit({
      leadForm: {
        headline: 'Click next to get the pack',
        description: 'value stack',
        questions: ['What is your #1 goal?', 42, 'How soon?'],
        callToAction: 'Join the group',
        groupUrl: 'https://facebook.com/groups/x',
      },
    });
    expect(out.leadForm.headline).toBe('Click next to get the pack');
    // non-string question dropped
    expect(out.leadForm.questions).toEqual(['What is your #1 goal?', 'How soon?']);
    // missing keys default to empty strings
    expect(out.leadForm.completionHeadline).toBe('');
    expect(out.leadForm.completionDescription).toBe('');
    // empty input yields a fully-shaped empty lead form
    expect(normalizeKit({}).leadForm).toEqual(blankKit().leadForm);
  });
});

describe('rowToCommunityKit', () => {
  it('maps a DB row to a camelCase record with normalized JSON', () => {
    const row: CommunityKitRow = {
      id: 'k1',
      slug: 'mom-circle',
      name: 'Mom Circle',
      community_type: 'both',
      status: 'active',
      intake: { niche: 'Parenting' },
      kit: { chosenName: 'Mom Circle', nameOptions: ['A', 'B'] },
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      updated_by: 'admin@example.com',
    };
    const record = rowToCommunityKit(row);
    expect(record.id).toBe('k1');
    expect(record.communityType).toBe('both');
    expect(record.status).toBe('active');
    expect(record.intake.niche).toBe('Parenting');
    expect(record.kit.chosenName).toBe('Mom Circle');
    expect(record.kit.nameOptions).toEqual(['A', 'B']);
    expect(record.updatedBy).toBe('admin@example.com');
  });

  it('applies safe defaults for null enum columns', () => {
    const row: CommunityKitRow = {
      id: 'k2',
      slug: 'x',
      name: null,
      community_type: null,
      status: null,
      intake: null,
      kit: null,
      created_at: null,
      updated_at: null,
      updated_by: null,
    };
    const record = rowToCommunityKit(row);
    expect(record.name).toBe('');
    expect(record.communityType).toBe('paid');
    expect(record.status).toBe('draft');
    expect(record.intake).toEqual(blankIntake());
    expect(record.kit).toEqual(blankKit());
  });
});
