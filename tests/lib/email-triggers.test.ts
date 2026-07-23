import { describe, it, expect } from 'vitest';
import {
  EMAIL_TRIGGER_EVENTS,
  EMAIL_TRIGGER_CATEGORIES,
  EMAIL_TRIGGER_META,
  EMAIL_TRIGGER_LABELS,
  EMAIL_TRIGGER_DESCRIPTIONS,
  DEFAULT_EMAIL_TRIGGER,
  toEmailTriggerEvent,
  emailTriggerLabel,
  emailTriggerMeta,
  emailTriggerCategory,
  emailTriggerLocationLabel,
  emailTriggerEventsByCategory,
  emailTriggerGroups,
} from '@/lib/mothermode/email/triggers';

describe('email triggers — enum + metadata integrity', () => {
  it('every trigger event has a full metadata descriptor', () => {
    for (const t of EMAIL_TRIGGER_EVENTS) {
      const meta = EMAIL_TRIGGER_META[t];
      expect(meta, `meta for ${t}`).toBeTruthy();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(EMAIL_TRIGGER_CATEGORIES).toContain(meta.category);
    }
  });

  it('funnel triggers carry a funnelPage; content triggers carry a contentStage (exactly one)', () => {
    for (const t of EMAIL_TRIGGER_EVENTS) {
      const meta = EMAIL_TRIGGER_META[t];
      if (meta.category === 'funnel') {
        expect(meta.funnelPage, `funnelPage for ${t}`).toBeTruthy();
        expect(meta.contentStage).toBeUndefined();
      } else {
        expect(meta.contentStage, `contentStage for ${t}`).toBeTruthy();
        expect(meta.funnelPage).toBeUndefined();
      }
    }
  });

  it('labels/descriptions maps stay in sync with the metadata', () => {
    for (const t of EMAIL_TRIGGER_EVENTS) {
      expect(EMAIL_TRIGGER_LABELS[t]).toBe(EMAIL_TRIGGER_META[t].label);
      expect(EMAIL_TRIGGER_DESCRIPTIONS[t]).toBe(EMAIL_TRIGGER_META[t].description);
    }
  });
});

describe('email triggers — normalizer', () => {
  it('coerces unknown / null / garbage to the default (optin)', () => {
    expect(toEmailTriggerEvent(undefined)).toBe(DEFAULT_EMAIL_TRIGGER);
    expect(toEmailTriggerEvent(null)).toBe(DEFAULT_EMAIL_TRIGGER);
    expect(toEmailTriggerEvent('nope')).toBe('optin');
    expect(toEmailTriggerEvent(42)).toBe('optin');
  });

  it('passes through known values unchanged', () => {
    expect(toEmailTriggerEvent('purchase')).toBe('purchase');
    expect(toEmailTriggerEvent('content_published')).toBe('content_published');
  });

  it('label/meta/category helpers tolerate unknown input', () => {
    expect(emailTriggerLabel('bogus')).toBe(EMAIL_TRIGGER_LABELS.optin);
    expect(emailTriggerMeta('bogus').category).toBe('funnel');
    expect(emailTriggerCategory('bogus')).toBe('funnel');
  });
});

describe('email triggers — location labels', () => {
  it('returns the funnel page label for funnel triggers', () => {
    expect(emailTriggerLocationLabel('purchase')).toBe('Checkout page');
    expect(emailTriggerLocationLabel('optin')).toBe('Opt-in page');
    expect(emailTriggerLocationLabel('booking')).toBe('Booking / calendar page');
  });

  it('returns the content stage label for content triggers', () => {
    expect(emailTriggerLocationLabel('content_published')).toBe('Content published');
    expect(emailTriggerLocationLabel('content_rejected')).toBe('Content rejected');
  });
});

describe('email triggers — grouping', () => {
  it('splits events cleanly by category with no overlap and full coverage', () => {
    const funnel = emailTriggerEventsByCategory('funnel');
    const content = emailTriggerEventsByCategory('content');
    expect(funnel).toContain('optin');
    expect(content).toContain('content_generated');
    expect(funnel.some((t) => t.startsWith('content_'))).toBe(false);
    expect([...funnel, ...content].sort()).toEqual([...EMAIL_TRIGGER_EVENTS].sort());
  });

  it('emailTriggerGroups() yields one group per category in declaration order', () => {
    const groups = emailTriggerGroups();
    expect(groups.map((g) => g.category)).toEqual([...EMAIL_TRIGGER_CATEGORIES]);
    for (const g of groups) {
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.events.length).toBeGreaterThan(0);
      for (const t of g.events) {
        expect(emailTriggerCategory(t)).toBe(g.category);
      }
    }
  });
});
