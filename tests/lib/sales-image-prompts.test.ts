/**
 * Tests for `sales/imagePrompts` — the six cases named in
 * `docs/SALES_FUNNEL_IMAGE_PROMPTS_FINDING.md`.
 *
 * These assert on returned data, never on generated pictures. A green run here
 * says the prompt derivation is coherent; it does NOT say any image has been
 * generated or looked at. That is still step 4 of the finding's plan.
 */

import { describe, it, expect } from 'vitest';
import { blankFunnelBrief, type FunnelBrief } from '@/lib/mothermode/sales/funnelBrief';
import {
  SALES_IMAGE_SLOTS,
  buildSalesImagePrompt,
  buildSalesImagePrompts,
  formatVisualStyleLine,
  salesImageSlot,
  type SalesImageSlotKey,
} from '@/lib/mothermode/sales/imagePrompts';

/** A brief with a real visual position, as step 2 of the plan would produce. */
function briefWithVisual(over: Partial<FunnelBrief['visual']> = {}): FunnelBrief {
  const b = blankFunnelBrief();
  return {
    ...b,
    audience: { ...b.audience, niche: 'freelance illustrators', avatar: 'solo illustrators' },
    identity: { ...b.identity, founderRole: 'studio owner' },
    offer: { ...b.offer, name: 'The Rate Card System' },
    visual: {
      subject: 'a working illustration desk',
      palette: ['slate', 'chalk'],
      styleKeywords: ['documentary', 'matte'],
      lighting: 'low north window light',
      composition: 'off-centre subject, wide margins',
      avoid: ['neon'],
      ...over,
    },
  };
}

const ALL_KEYS = SALES_IMAGE_SLOTS.map((s) => s.key);

describe('coverage', () => {
  it('enumerates 16 slots with unique keys', () => {
    expect(SALES_IMAGE_SLOTS).toHaveLength(16);
    expect(new Set(ALL_KEYS).size).toBe(16);
  });

  it('returns a non-empty prompt for every slot', () => {
    const set = buildSalesImagePrompts(briefWithVisual());
    expect(Object.keys(set.prompts).sort()).toEqual([...ALL_KEYS].sort());
    ALL_KEYS.forEach((key) => {
      const p = set.prompts[key];
      expect(p.imagePrompt.trim().length).toBeGreaterThan(0);
      expect(p.negativePrompt.trim().length).toBeGreaterThan(0);
      expect(p.variants.length).toBeGreaterThan(0);
      p.variants.forEach((v) => expect(v.trim().length).toBeGreaterThan(0));
    });
  });

  it('gives gallery slots one distinct prompt per shot', () => {
    const set = buildSalesImagePrompts(briefWithVisual());
    const gallery = set.prompts.upsell1Gallery;
    expect(gallery.variants).toHaveLength(3);
    expect(new Set(gallery.variants).size).toBe(3);
  });

  it('resolves slots by key and rejects unknown ones', () => {
    expect(salesImageSlot('salesHero').field).toBe('heroImageUrl');
    expect(() => salesImageSlot('nope' as SalesImageSlotKey)).toThrow(/Unknown sales image slot/);
  });
});

describe('congruence', () => {
  it('embeds the same style line verbatim in all 16 prompts', () => {
    const set = buildSalesImagePrompts(briefWithVisual());
    expect(set.styleLine.trim().length).toBeGreaterThan(0);
    ALL_KEYS.forEach((key) => {
      expect(set.prompts[key].imagePrompt).toContain(set.styleLine);
      set.prompts[key].variants.forEach((v) => expect(v).toContain(set.styleLine));
    });
  });

  it('carries brief-supplied avoid terms into every negative prompt', () => {
    const set = buildSalesImagePrompts(briefWithVisual());
    ALL_KEYS.forEach((key) => {
      expect(set.prompts[key].negativePrompt).toContain('neon');
      expect(set.prompts[key].negativePrompt).toContain('watermarks');
    });
  });
});

describe('variation', () => {
  const OLD_LITERAL = ['brass', 'bone', 'Warm dark background'];

  it('produces different style lines for different visual blocks', () => {
    const a = formatVisualStyleLine(briefWithVisual());
    const b = formatVisualStyleLine(
      briefWithVisual({
        palette: ['oxblood', 'cream'],
        styleKeywords: ['high-contrast', 'graphic'],
        lighting: 'hard afternoon sun',
      }),
    );
    expect(a).not.toBe(b);
  });

  it('never reintroduces the removed MotherMode literal', () => {
    const lines = [
      formatVisualStyleLine(blankFunnelBrief()),
      formatVisualStyleLine(briefWithVisual()),
      formatVisualStyleLine(briefWithVisual({ palette: ['oxblood'], styleKeywords: ['graphic'] })),
    ];
    lines.forEach((line) => {
      OLD_LITERAL.forEach((banned) => expect(line).not.toContain(banned));
    });
  });
});

describe('per-slot format', () => {
  it('assigns the aspect ratio each placement actually needs', () => {
    expect(salesImageSlot('salesHero').format).toBe('wide');
    expect(salesImageSlot('salesFounder').format).toBe('portrait');
    expect(salesImageSlot('checkoutProduct').format).toBe('square');
    expect(salesImageSlot('upsell1Poster').format).toBe('wide');
  });

  it('does not collapse every slot to one format', () => {
    // Regression test for the `'feed'`-for-all bug.
    const formats = new Set(SALES_IMAGE_SLOTS.map((s) => s.format));
    expect(formats.size).toBeGreaterThan(1);
  });

  it('threads the slot format onto the built prompt', () => {
    const set = buildSalesImagePrompts(briefWithVisual());
    SALES_IMAGE_SLOTS.forEach((slot) => {
      expect(set.prompts[slot.key].format).toBe(slot.format);
      expect(set.prompts[slot.key].field).toBe(slot.field);
      expect(set.prompts[slot.key].page).toBe(slot.page);
    });
  });
});

describe('fallback reporting', () => {
  const ALL_FIVE = [
    'visual.subject',
    'visual.palette',
    'visual.styleKeywords',
    'visual.lighting',
    'visual.composition',
  ];

  it('names all five fields when the brief states no visual position', () => {
    // This is today's real state for every funnel: `funnelBriefFromIntake`
    // spreads `blankFunnelBrief()` and never writes `visual`.
    const set = buildSalesImagePrompts(blankFunnelBrief());
    expect([...set.assumedVisualFields].sort()).toEqual([...ALL_FIVE].sort());
  });

  it('reports nothing when the visual block is fully populated', () => {
    expect(buildSalesImagePrompts(briefWithVisual()).assumedVisualFields).toEqual([]);
  });

  it('names exactly the missing fields when partially populated', () => {
    const set = buildSalesImagePrompts(
      briefWithVisual({ subject: '', palette: [], composition: '' }),
    );
    expect([...set.assumedVisualFields].sort()).toEqual(
      ['visual.subject', 'visual.palette', 'visual.composition'].sort(),
    );
  });

  it('treats whitespace-only values as absent', () => {
    const set = buildSalesImagePrompts(briefWithVisual({ lighting: '   ' }));
    expect(set.assumedVisualFields).toContain('visual.lighting');
  });
});

describe('name resolution', () => {
  it('prefers ctx overrides over brief names', () => {
    const brief = briefWithVisual();
    brief.offer.upsellNames = ['Brief Upsell One'];
    const p = buildSalesImagePrompt(brief, salesImageSlot('upsell1Product'), {
      upsellNames: ['Ctx Upsell One'],
    });
    expect(p.imagePrompt).toContain('Ctx Upsell One');
    expect(p.imagePrompt).not.toContain('Brief Upsell One');
  });

  it('falls back to the brief upsell name, then the offer name', () => {
    const brief = briefWithVisual();
    brief.offer.upsellNames = ['Brief Upsell One'];
    const fromBrief = buildSalesImagePrompt(brief, salesImageSlot('upsell1Product'));
    expect(fromBrief.imagePrompt).toContain('Brief Upsell One');

    const noUpsells = briefWithVisual();
    const fromOffer = buildSalesImagePrompt(noUpsells, salesImageSlot('upsell2Product'));
    expect(fromOffer.imagePrompt).toContain('The Rate Card System');
  });

  it('uses the magnet and product ctx names on their own slots', () => {
    const brief = briefWithVisual();
    const set = buildSalesImagePrompts(brief, {
      magnetTitle: 'The Pricing Teardown',
      checkoutProductName: 'Rate Card Pro',
      founderRole: 'illustrator',
    });
    expect(set.prompts.optinCover.imagePrompt).toContain('The Pricing Teardown');
    expect(set.prompts.checkoutProduct.imagePrompt).toContain('Rate Card Pro');
    expect(set.prompts.salesFounder.imagePrompt).toContain('illustrator');
  });

  it('never leaves a slot with an empty subject', () => {
    const set = buildSalesImagePrompts(blankFunnelBrief());
    ALL_KEYS.forEach((key) => {
      // An unresolved name would render as an empty quoted string.
      expect(set.prompts[key].imagePrompt).not.toContain('""');
      expect(set.prompts[key].imagePrompt).toContain('the offer');
    });
  });
});
