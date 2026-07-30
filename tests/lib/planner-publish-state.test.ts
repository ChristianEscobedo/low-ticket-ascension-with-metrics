import { describe, expect, it } from 'vitest';

import {
  canonicalPlatform,
  platformInitial,
  platformLabel,
} from '@/lib/mothermode/planner/platformGlyph';
import {
  describeSchedule,
  isoToLocalInput,
  localInputToIso,
  normalizePublishState,
  publishStateLabel,
  scheduleTimeLabel,
  stageForPublishState,
  willPublishItself,
} from '@/lib/mothermode/planner/publishState';

describe('normalizePublishState', () => {
  it('accepts the vocabulary, case and space insensitively', () => {
    expect(normalizePublishState('draft')).toBe('draft');
    expect(normalizePublishState(' Scheduled ')).toBe('scheduled');
    expect(normalizePublishState('PUBLISHED')).toBe('published');
    expect(normalizePublishState('')).toBe('');
  });

  it('collapses anything unknown to "planned", never to a promise', () => {
    // The direction matters: guessing 'scheduled' from junk would invent a
    // commitment the scheduler never made, and the calendar would show a post
    // going out by itself when nothing will happen.
    for (const junk of ['queued', 'live', null, undefined, 7, {}, []]) {
      expect(normalizePublishState(junk)).toBe('');
    }
  });
});

describe('publishStateLabel', () => {
  it('never renders a blank chip', () => {
    expect(publishStateLabel('')).toBe('Planned');
    expect(publishStateLabel(undefined)).toBe('Planned');
    expect(publishStateLabel('draft')).toBe('Draft');
    expect(publishStateLabel('scheduled')).toBe('Scheduled');
    expect(publishStateLabel('published')).toBe('Published');
  });
});

describe('willPublishItself', () => {
  it('is true only for a live schedule', () => {
    expect(willPublishItself('scheduled')).toBe(true);
    // The whole point of the draft state: dated, but inert.
    expect(willPublishItself('draft')).toBe(false);
    expect(willPublishItself('published')).toBe(false);
    expect(willPublishItself('')).toBe(false);
  });
});

describe('stageForPublishState', () => {
  it('stages drafts and schedules, and only moves published to terminal', () => {
    expect(stageForPublishState('draft')).toBe('scheduled');
    expect(stageForPublishState('scheduled')).toBe('scheduled');
    expect(stageForPublishState('published')).toBe('published');
    expect(stageForPublishState('')).toBe('scheduled');
  });
});

describe('schedule labels', () => {
  it('omits the time entirely when there is no usable date', () => {
    expect(scheduleTimeLabel(null)).toBe('');
    expect(scheduleTimeLabel(undefined)).toBe('');
    expect(scheduleTimeLabel('')).toBe('');
    expect(scheduleTimeLabel('not a date')).toBe('');
  });

  it('describes an unscheduled card with the state alone', () => {
    expect(describeSchedule({ scheduledAt: null, publishState: 'draft' })).toBe(
      'Draft',
    );
    expect(describeSchedule({ publishState: '' })).toBe('Planned');
  });

  it('leads with the state when there is a date', () => {
    const out = describeSchedule(
      { scheduledAt: '2026-03-04T14:00:00.000Z', publishState: 'draft' },
      'en-US',
    );
    expect(out.startsWith('Draft · ')).toBe(true);
    expect(out).toContain('Mar');
  });
});

describe('datetime-local round trip', () => {
  it('reads a local-time input as local time', () => {
    const iso = localInputToIso('2026-03-04T09:00');
    expect(iso).not.toBeNull();
    const d = new Date(iso as string);
    // Whatever the runner's zone, 9am local in must be 9am local out.
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(4);
  });

  it('treats a cleared field as "unschedule", not as an error', () => {
    expect(localInputToIso('')).toBeNull();
    expect(localInputToIso('   ')).toBeNull();
    expect(localInputToIso('garbage')).toBeNull();
  });

  it('pre-fills in local time so opening the drawer cannot move the post', () => {
    const iso = localInputToIso('2026-03-04T09:00') as string;
    // The round trip is the actual guarantee: isoToLocalInput must undo
    // localInputToIso exactly, or a no-op save would shift every post by the
    // UTC offset.
    expect(isoToLocalInput(iso)).toBe('2026-03-04T09:00');
  });

  it('returns an empty field for missing or broken values', () => {
    expect(isoToLocalInput(null)).toBe('');
    expect(isoToLocalInput(undefined)).toBe('');
    expect(isoToLocalInput('nope')).toBe('');
  });
});

describe('canonicalPlatform', () => {
  it('resolves the spellings other systems use', () => {
    // GHL still says 'twitter'; treating it as its own channel would split one
    // account's posts across two logos.
    expect(canonicalPlatform('twitter')).toBe('x');
    expect(canonicalPlatform('X')).toBe('x');
    expect(canonicalPlatform('ig')).toBe('instagram');
    expect(canonicalPlatform('Instagram Business')).toBe('instagram');
    expect(canonicalPlatform('facebook_page')).toBe('facebook');
    expect(canonicalPlatform('YT')).toBe('youtube');
    expect(canonicalPlatform('tik-tok')).toBe('tiktok');
    expect(canonicalPlatform('LinkedIn')).toBe('linkedin');
  });

  it('prefers the longest matching alias', () => {
    // 'ig' prefixes nothing here, but 'instagrambusiness' must not be claimed by
    // a shorter alias that happens to start the same way.
    expect(canonicalPlatform('instagram_business_account')).toBe('instagram');
    expect(canonicalPlatform('youtube shorts')).toBe('youtube');
  });

  it('returns null for unknown platforms so the caller can draw a letter chip', () => {
    expect(canonicalPlatform('threads')).toBeNull();
    expect(canonicalPlatform('')).toBeNull();
    expect(canonicalPlatform(null)).toBeNull();
  });
});

describe('platformLabel', () => {
  it('uses proper brand casing for known platforms', () => {
    expect(platformLabel('tiktok')).toBe('TikTok');
    expect(platformLabel('linkedin')).toBe('LinkedIn');
    expect(platformLabel('twitter')).toBe('X');
  });

  it('echoes what the admin typed for unknown platforms', () => {
    // More useful to them than "Unknown", which hides their own input.
    expect(platformLabel('threads')).toBe('Threads');
    expect(platformLabel('')).toBe('');
  });
});

describe('platformInitial', () => {
  it('gives a chip character, with a visible fallback', () => {
    expect(platformInitial('threads')).toBe('T');
    expect(platformInitial('')).toBe('?');
    expect(platformInitial(null)).toBe('?');
  });
});
