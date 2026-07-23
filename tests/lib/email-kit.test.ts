import { describe, it, expect } from 'vitest';
import {
  blankIntake,
  blankSequence,
  normalizeIntake,
  normalizeEmail,
  normalizeSequence,
  rowToEmailKit,
  toEmailCampaignType,
  toEmailFramework,
  toEmailRole,
  toEmailTimingStyle,
  type EmailKitRow,
} from '@/lib/mothermode/email/types';
import {
  campaignSpec,
  scaleOffset,
  scaleTiming,
  EMAIL_CAMPAIGN_SPECS,
} from '@/lib/mothermode/email/campaigns';
import { frameworkSpec, EMAIL_FRAMEWORK_SPECS } from '@/lib/mothermode/email/frameworks';
import {
  sequenceToText,
  sequenceToHtml,
  sequenceToRows,
} from '@/lib/mothermode/email/export';

describe('email kit normalizers', () => {
  it('coerces unknown enum values to safe defaults', () => {
    expect(toEmailCampaignType('nope')).toBe('nurture-to-offer');
    expect(toEmailFramework('nope')).toBe('story-lesson');
    expect(toEmailRole('nope')).toBe('nurture');
    expect(toEmailTimingStyle('nope')).toBe('standard');
  });

  it('normalizeIntake fills every field from partial input', () => {
    const intake = normalizeIntake({ audience: 'coaches', timingStyle: 'gentle' });
    expect(intake.audience).toBe('coaches');
    expect(intake.timingStyle).toBe('gentle');
    expect(intake.goal).toBe('');
    expect(Object.keys(intake).sort()).toEqual(
      Object.keys(blankIntake()).sort(),
    );
  });

  it('normalizeEmail always yields a stable id and clean cta', () => {
    const e = normalizeEmail({ subject: 'Hi', cta: { label: 'Buy' } });
    expect(e.id).toMatch(/^eml-/);
    expect(e.subject).toBe('Hi');
    expect(e.cta).toEqual({ label: 'Buy', url: '' });
    expect(e.subjectIdeas).toEqual([]);
  });

  it('normalizeSequence drops malformed emails gracefully', () => {
    const seq = normalizeSequence({ name: 'S', emails: [{ subject: 'a' }, 42, null] });
    expect(seq.name).toBe('S');
    expect(seq.emails).toHaveLength(3); // non-objects normalize to blank emails
    expect(seq.emails.every((e) => e.id.startsWith('eml-'))).toBe(true);
  });

  it('rowToEmailKit maps snake_case row to a typed record', () => {
    const row: EmailKitRow = {
      id: 'id1',
      slug: 'welcome',
      name: 'Welcome',
      campaign_type: 'garbage',
      framework: 'pas',
      status: 'active',
      intake: { audience: 'x' },
      context_refs: [{ kind: 'offer', id: 'starter' }, { bad: true }],
      sequence: { name: 'Seq', emails: [{ subject: 's' }] },
      created_at: null,
      updated_at: null,
      updated_by: null,
    };
    const rec = rowToEmailKit(row);
    expect(rec.campaignType).toBe('nurture-to-offer'); // bad -> default
    expect(rec.framework).toBe('pas');
    expect(rec.status).toBe('active');
    expect(rec.contextRefs).toEqual([{ kind: 'offer', id: 'starter' }]);
    expect(rec.sequence.emails).toHaveLength(1);
  });
});

describe('campaign + framework catalogs', () => {
  it('every campaign spec has aligned roles and timing', () => {
    for (const spec of Object.values(EMAIL_CAMPAIGN_SPECS)) {
      expect(spec.emailRoles.length).toBe(spec.defaultTiming.length);
      expect(spec.emailRoles.length).toBeGreaterThan(0);
    }
  });

  it('campaignSpec / frameworkSpec fall back to safe defaults', () => {
    expect(campaignSpec('missing' as never).label).toBe(
      EMAIL_CAMPAIGN_SPECS['nurture-to-offer'].label,
    );
    expect(frameworkSpec('missing' as never)).toBe(
      EMAIL_FRAMEWORK_SPECS['story-lesson'],
    );
  });

  it('scaleOffset scales days by timing style and preserves sign/unit', () => {
    expect(scaleOffset('+2d', 'standard')).toBe('+2d');
    expect(scaleOffset('+2d', 'aggressive')).toBe('+1d');
    expect(scaleOffset('+2d', 'gentle')).toBe('+4d');
    expect(scaleOffset('-3d', 'gentle')).toBe('-6d');
    expect(scaleOffset('+0h', 'aggressive')).toBe('+0h');
    expect(scaleOffset('junk', 'gentle')).toBe('junk');
  });

  it('scaleTiming maps a whole plan', () => {
    expect(scaleTiming(['+0h', '+2d'], 'gentle')).toEqual(['+0h', '+4d']);
  });
});

describe('email export renderers', () => {
  const seq = {
    ...blankSequence(),
    name: 'Nurture',
    goal: 'Sell',
    emails: [
      normalizeEmail({
        role: 'offer',
        sendOffset: '+1d',
        subject: 'Grab it',
        preview: 'peek',
        bodyText: 'Line one.\n\n- a\n- b',
        cta: { label: 'Buy now', url: 'https://ex.com' },
      }),
    ],
  };

  it('sequenceToText includes subject, cta and header', () => {
    const text = sequenceToText(seq);
    expect(text).toContain('Nurture');
    expect(text).toContain('Subject: Grab it');
    expect(text).toContain('CTA: Buy now -> https://ex.com');
  });

  it('sequenceToHtml renders brand layout with bullets + cta link', () => {
    const html = sequenceToHtml(seq);
    // Brand layout renders bullets as themed table rows (&bull;), not <ul>/<li>.
    expect(html).toContain('&bull;');
    expect(html).toContain('href="https://ex.com"');
    expect(html).toContain('Grab it');
    // Editorial Warm wrapper markers are present.
    expect(html).toContain('MotherMode');
  });


  it('sequenceToHtml strips scripts but preserves rich body formatting + images', () => {
    // bodyText is rich HTML from the kit editor. The renderer preserves inline
    // marks (e.g. bold) and inline images with brand-safe inline styling, while
    // dropping unsafe tags: no raw or escaped executable markup survives.
    const dangerous = {
      ...blankSequence(),
      emails: [
        normalizeEmail({
          subject: 'x',
          bodyText:
            '<p><strong>Hi</strong> there</p><p><img src="https://ex.com/a.png" alt="Shot"></p><script>bad()</script>',
        }),
      ],
    };
    const html = sequenceToHtml(dangerous);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('bad()');
    expect(html).not.toContain('&lt;script&gt;');
    // Bold survives as a real tag and the image is kept with its source.
    expect(html).toContain('<strong>Hi</strong>');
    expect(html).toContain('src="https://ex.com/a.png"');
  });


  it('sequenceToRows flattens one row per email', () => {
    const rows = sequenceToRows(seq);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      order: 1,
      role: 'offer',
      subject: 'Grab it',
      ctaUrl: 'https://ex.com',
    });
  });
});
