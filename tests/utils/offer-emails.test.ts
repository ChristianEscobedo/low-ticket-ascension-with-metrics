import { describe, it, expect } from 'vitest';
import {
  getOfferEmailTemplate,
  hasOfferEmail
} from '@/utils/email/offer-emails';
import { PALETTE } from '@/lib/mothermode/brand';

// Every product that should ship a dedicated, long-form welcome email.
const KNOWN_PRODUCT_IDS = [
  'mm_brain_dump_system',
  'mm_five_pm_reset',
  'mm_morning_without_yelling',
  'mm_offload_map',
  'mm_first_90_days',
  'mm_invisible_labor_inventory',
  'mm_weekly_reset',
  'mm_mental_load_audit',
  'mothermode_os',
  'mothermode_redesign_vault',
  'mothermode_coaching'
];

// Voice rules from design-guide.txt. No em dashes, none of the NO-list words.
const BANNED_WORDS = [
  'mama',
  'thrive',
  'empower',
  'journey',
  'girlboss',
  'hustle',
  'elevate',
  'grind'
];

describe('getOfferEmailTemplate', () => {
  it('returns null for unknown / empty product ids', () => {
    expect(getOfferEmailTemplate(null)).toBeNull();
    expect(getOfferEmailTemplate(undefined)).toBeNull();
    expect(getOfferEmailTemplate('prod_not_in_catalog')).toBeNull();
    expect(hasOfferEmail('prod_not_in_catalog')).toBe(false);
  });

  it('ships a dedicated email for every known product', () => {
    for (const id of KNOWN_PRODUCT_IDS) {
      expect(hasOfferEmail(id), id).toBe(true);
      const tpl = getOfferEmailTemplate(id);
      expect(tpl, id).not.toBeNull();
      expect(tpl!.subject.length, id).toBeGreaterThan(0);
      expect(tpl!.body_html.length, id).toBeGreaterThan(400);
      expect(tpl!.body_text.length, id).toBeGreaterThan(200);
    }
  });

  it('renders the Editorial Warm theme and keeps render tokens intact', () => {
    const tpl = getOfferEmailTemplate('mm_brain_dump_system')!;
    // Themed shell: Mode aubergine header + Brass accent + Bone background.
    expect(tpl.body_html).toContain(PALETTE.mode);
    expect(tpl.body_html).toContain(PALETTE.brass);
    expect(tpl.body_html).toContain(PALETTE.bone);
    // Tokens survive for the render pipeline to substitute per send.
    expect(tpl.body_html).toContain('{{amount}}');
    expect(tpl.body_html).toContain('{{ref}}');
    expect(tpl.body_text).toContain('{{amount}}');
  });

  it('honours the brand voice in every dedicated email', () => {
    for (const id of KNOWN_PRODUCT_IDS) {
      const tpl = getOfferEmailTemplate(id)!;
      const haystack = `${tpl.subject}\n${tpl.body_text}`.toLowerCase();
      expect(tpl.body_text.includes('\u2014'), `em dash in ${id}`).toBe(false);
      for (const word of BANNED_WORDS) {
        expect(haystack.includes(word), `"${word}" in ${id}`).toBe(false);
      }
    }
  });
});
