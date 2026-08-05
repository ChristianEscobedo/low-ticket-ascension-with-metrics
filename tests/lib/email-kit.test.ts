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
  EMAIL_FRAMEWORKS,
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
  renderEmailHtml,
  renderSequenceHtml,
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

describe('deep event nurtures (7-14 emails)', () => {
  const EVENT_CAMPAIGNS = ['webinar-event', 'event-nurture'] as const;

  it('every event nurture blueprint runs 7-14 emails with aligned timing', () => {
    for (const key of EVENT_CAMPAIGNS) {
      const spec = campaignSpec(key);
      expect(spec.emailRoles.length, key).toBeGreaterThanOrEqual(7);
      expect(spec.emailRoles.length, key).toBeLessThanOrEqual(14);
      expect(spec.defaultTiming.length, key).toBe(spec.emailRoles.length);
    }
  });

  it('event-nurture is a 12-email pre-event runway that alternates jobs', () => {
    const spec = campaignSpec('event-nurture');
    expect(spec.emailRoles).toHaveLength(12);
    // The runway closes with the invitation, then a final reminder.
    expect(spec.emailRoles.at(-2)).toBe('invite');
    expect(spec.emailRoles.at(-1)).toBe('reminder');
    // Every send lands before the event date.
    expect(spec.defaultTiming.every((t) => t.startsWith('-'))).toBe(true);
    // No two consecutive emails do the same job.
    for (let i = 1; i < spec.emailRoles.length; i++) {
      expect(spec.emailRoles[i]).not.toBe(spec.emailRoles[i - 1]);
    }
  });

  it('webinar-event is a 10-email arc spanning before, during, and after the event', () => {
    const spec = campaignSpec('webinar-event');
    expect(spec.emailRoles).toHaveLength(10);
    expect(spec.emailRoles[0]).toBe('invite');
    expect(spec.emailRoles.at(-1)).toBe('offer');
    // Covers the pre-event week (-), live day (+0h), and the post-event tail (+d).
    expect(spec.defaultTiming.some((t) => t.startsWith('-'))).toBe(true);
    expect(spec.defaultTiming).toContain('+0h');
    expect(spec.defaultTiming.some((t) => /^\+[1-9]/.test(t))).toBe(true);
  });

  it('every role used by an event nurture has a framework default', () => {
    for (const key of EVENT_CAMPAIGNS) {
      const spec = campaignSpec(key);
      for (const role of Array.from(new Set(spec.emailRoles))) {
        expect(spec.frameworkByRole?.[role], `${key}:${role}`).toBeTruthy();
      }
    }
  });
});

describe('HTML output guarantee', () => {
  it('renderSequenceHtml populates bodyHtml for every email from bodyText', () => {
    const seq = {
      ...blankSequence(),
      emails: [
        normalizeEmail({
          subject: 'One',
          bodyText: 'Hello {{first_name}}.\n\n- a\n- b',
          cta: { label: 'Go', url: 'https://ex.com' },
        }),
        normalizeEmail({
          subject: 'Two',
          bodyText: '<p><strong>Rich</strong> body</p>',
        }),
      ],
    };
    const rendered = renderSequenceHtml(seq);
    expect(rendered.emails).toHaveLength(2);
    for (const email of rendered.emails) {
      // Every email carries a full brand-styled HTML document.
      expect(email.bodyHtml.length).toBeGreaterThan(0);
      expect(email.bodyHtml).toContain('MotherMode');
    }
    // Plain-text body: paragraphs/bullets render, tokens survive for the ESP.
    expect(rendered.emails[0].bodyHtml).toContain('{{first_name}}');
    expect(rendered.emails[0].bodyHtml).toContain('&bull;');
    expect(rendered.emails[0].bodyHtml).toContain('href="https://ex.com"');
    // Rich-HTML body: inline marks are preserved.
    expect(rendered.emails[1].bodyHtml).toContain('<strong>Rich</strong>');
    // bodyText stays the untouched source of truth.
    expect(rendered.emails[0].bodyText).toBe(seq.emails[0].bodyText);
  });

  it('renderEmailHtml renders even an empty body to a valid brand shell', () => {
    const html = renderEmailHtml(normalizeEmail({ subject: 'Empty' }));
    expect(html).toContain('Empty');
    expect(html).toContain('MotherMode');
  });
});

describe('email body formatting (bold, markers, spacing)', () => {
  it('converts *emphasis* to real bold in plain-text bodies', () => {
    const html = renderEmailHtml(
      normalizeEmail({
        subject: 's',
        bodyText: 'The *big idea* lands here.\n\n- *one* point\n- two',
      }),
    );
    expect(html).toContain('<strong>big idea</strong>');
    expect(html).toContain('<strong>one</strong>');
    // No literal asterisks leak into the rendered email.
    expect(html).not.toContain('*big');
  });

  it('keeps every short paragraph in its own block (no walls of text)', () => {
    const html = renderEmailHtml(
      normalizeEmail({ subject: 's', bodyText: 'One line.\n\nSecond line.\n\nThird line.' }),
    );
    const paragraphs = html.match(/<p style="margin:0 0 16px/g) ?? [];
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it('renders [BUTTON:] markers as real buttons and never leaks marker text', () => {
    const html = renderEmailHtml(
      normalizeEmail({
        subject: 's',
        bodyText: 'Do the thing.\n\n[BUTTON: Grab the guide -> https://ex.com/go]',
      }),
    );
    expect(html).toContain('href="https://ex.com/go"');
    expect(html).toContain('Grab the guide');
    expect(html).not.toContain('[BUTTON');
  });

  it('maps [IMAGE:] markers to attached images in order, drops unattached ones', () => {
    const withImage = renderEmailHtml(
      normalizeEmail({
        subject: 's',
        bodyText: 'Look.\n\n[IMAGE: revenue chart]',
        images: ['https://cdn.ex.com/chart.png'],
      }),
    );
    expect(withImage).toContain('src="https://cdn.ex.com/chart.png"');
    expect(withImage).toContain('alt="revenue chart"');
    expect(withImage).not.toContain('[IMAGE');

    const withoutImage = renderEmailHtml(
      normalizeEmail({ subject: 's', bodyText: 'Look.\n\n[IMAGE: revenue chart]' }),
    );
    expect(withoutImage).not.toContain('[IMAGE');
  });

  it('converts markers inside rich-HTML bodies without clobbering formatting', () => {
    const html = renderEmailHtml(
      normalizeEmail({
        subject: 's',
        bodyText:
          '<p>Intro <strong>line</strong>.</p><p>[BUTTON: Go now -> https://ex.com]</p><p>[IMAGE: chart]</p>',
      }),
    );
    expect(html).toContain('<strong>line</strong>');
    expect(html).toContain('href="https://ex.com"');
    expect(html).toContain('Go now');
    expect(html).not.toContain('[BUTTON');
    expect(html).not.toContain('[IMAGE');
  });
});

describe('round 5: ascension frameworks + bank recipe wiring', () => {
  const ASCENSION = [
    'buyer-welcome',
    'ascension-bridge',
    'deep-nurture',
    'oto-ascend',
    'goal-driven',
    'ps-close',
  ] as const;

  it('ships the 6 ascension frameworks, resolvable and fully specified', () => {
    for (const key of ASCENSION) {
      expect(toEmailFramework(key), key).toBe(key);
      const spec = frameworkSpec(key);
      expect(spec.label.trim().length, key).toBeGreaterThan(0);
      expect(spec.structure.trim().length, key).toBeGreaterThan(0);
      expect(spec.styleNote.trim().length, key).toBeGreaterThan(0);
      expect(spec.lengthTarget.trim().length, key).toBeGreaterThan(0);
    }
    // The enum and the registry never drift apart.
    expect(Object.keys(EMAIL_FRAMEWORK_SPECS).sort()).toEqual(
      [...EMAIL_FRAMEWORKS].sort(),
    );
  });

  it('pre-post-purchase maps welcome to buyer-welcome and bridge to ascension-bridge', () => {
    const spec = campaignSpec('pre-post-purchase');
    expect(spec.frameworkByRole?.welcome).toBe('buyer-welcome');
    expect(spec.frameworkByRole?.bridge).toBe('ascension-bridge');
  });

  it('normalizeEmail round-trips frameworkRecipeId, absent and blank stay undefined', () => {
    const withRecipe = normalizeEmail({
      subject: 'Hi',
      frameworkRecipeId: 'embuy-welcome-receipt',
    });
    expect(withRecipe.frameworkRecipeId).toBe('embuy-welcome-receipt');
    const blank = normalizeEmail({ subject: 'Hi' });
    expect(blank.frameworkRecipeId).toBeUndefined();
    expect('frameworkRecipeId' in blank).toBe(false);
    const empty = normalizeEmail({ subject: 'Hi', frameworkRecipeId: '   ' });
    expect(empty.frameworkRecipeId).toBeUndefined();
  });
});
