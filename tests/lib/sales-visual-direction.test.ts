import { describe, expect, it } from 'vitest';

import {
  blankSalesAiIntake,
  formatIntakeVisualForPrompt,
  missingIntakeVisualFields,
  normalizeSalesAiIntake,
  splitVisualList,
  type SalesAiIntake,
} from '@/lib/mothermode/sales/aiIntake';
import { funnelBriefFromIntake } from '@/lib/mothermode/sales/funnelBrief';
import { buildSalesImagePrompts, SALES_IMAGE_SLOTS } from '@/lib/mothermode/sales/imagePrompts';

/**
 * These assert the link that did not exist until now: an admin-stated visual
 * position reaching the image prompts. The companion file
 * tests/lib/sales-image-prompts.test.ts already pins the downstream behaviour
 * (congruence, per-slot format, fallback reporting); this pins the input.
 */

function filledIntake(): SalesAiIntake {
  return {
    ...blankSalesAiIntake(),
    niche: 'Mental load',
    offerName: 'The Brain Dump System',
    visualSubject: 'A worn kitchen table with the printed system on it',
    visualPalette: 'warm sand, deep green',
    visualStyleKeywords: 'editorial, tactile',
    visualLighting: 'late afternoon window light',
    visualComposition: 'off centre subject',
    visualAvoid: 'stock smiles, neon',
  };
}

describe('splitVisualList', () => {
  it('splits on commas, semicolons and newlines and trims', () => {
    expect(splitVisualList('warm sand, deep green; off white\nbone')).toEqual([
      'warm sand',
      'deep green',
      'off white',
      'bone',
    ]);
  });

  it('treats empty and undefined as no entries, not as one empty entry', () => {
    expect(splitVisualList('')).toEqual([]);
    expect(splitVisualList(undefined)).toEqual([]);
    expect(splitVisualList(' , ; ')).toEqual([]);
  });
});

describe('missingIntakeVisualFields', () => {
  it('names all five assumable fields for a blank intake', () => {
    expect(missingIntakeVisualFields(blankSalesAiIntake())).toEqual([
      'visual.subject',
      'visual.palette',
      'visual.styleKeywords',
      'visual.lighting',
      'visual.composition',
    ]);
  });

  it('is empty once the admin has stated a position', () => {
    expect(missingIntakeVisualFields(filledIntake())).toEqual([]);
  });

  it('names exactly the gaps on a partial fill, and never visual.avoid', () => {
    const partial = { ...blankSalesAiIntake(), visualPalette: 'bone, ink' };
    const gaps = missingIntakeVisualFields(partial);
    expect(gaps).not.toContain('visual.palette');
    expect(gaps).not.toContain('visual.avoid');
    expect(gaps).toContain('visual.subject');
    expect(gaps).toHaveLength(4);
  });

  it('agrees with what the image builder will actually assume', () => {
    const blankGaps = missingIntakeVisualFields(blankSalesAiIntake());
    const set = buildSalesImagePrompts(funnelBriefFromIntake(blankSalesAiIntake()));
    expect(set.assumedVisualFields).toEqual(blankGaps);
  });
});

describe('funnelBriefFromIntake — visual block', () => {
  it('carries every visual field through, splitting the list fields', () => {
    const brief = funnelBriefFromIntake(filledIntake());
    expect(brief.visual.subject).toBe('A worn kitchen table with the printed system on it');
    expect(brief.visual.palette).toEqual(['warm sand', 'deep green']);
    expect(brief.visual.styleKeywords).toEqual(['editorial', 'tactile']);
    expect(brief.visual.lighting).toBe('late afternoon window light');
    expect(brief.visual.composition).toBe('off centre subject');
    expect(brief.visual.avoid).toEqual(['stock smiles', 'neon']);
  });

  it('still leaves the block empty when the intake states nothing', () => {
    const brief = funnelBriefFromIntake(blankSalesAiIntake());
    expect(brief.visual.subject).toBe('');
    expect(brief.visual.palette).toEqual([]);
  });
});

describe('image prompts read the stated position', () => {
  it('reports no assumptions and embeds the palette in all 16 slots', () => {
    const set = buildSalesImagePrompts(funnelBriefFromIntake(filledIntake()));
    expect(set.assumedVisualFields).toEqual([]);
    expect(set.styleLine).toContain('warm sand and deep green palette');
    const prompts = Object.values(set.prompts);
    expect(prompts).toHaveLength(SALES_IMAGE_SLOTS.length);
    prompts.forEach((p) => expect(p.imagePrompt).toContain(set.styleLine));
  });

  it('carries the avoid field into the negative prompt', () => {
    const set = buildSalesImagePrompts(funnelBriefFromIntake(filledIntake()));
    expect(set.prompts.salesHero.negativePrompt).toContain('stock smiles');
  });

  it('two different positions produce two different worlds', () => {
    const a = buildSalesImagePrompts(funnelBriefFromIntake(filledIntake()));
    const b = buildSalesImagePrompts(funnelBriefFromIntake({ ...filledIntake(), visualPalette: 'cobalt, chalk' }));
    expect(a.styleLine).not.toBe(b.styleLine);
  });
});

describe('persistence', () => {
  it('survives a JSON round trip through the normalizer', () => {
    const stored = JSON.parse(JSON.stringify(filledIntake()));
    const back = normalizeSalesAiIntake(stored);
    expect(back.visualPalette).toBe('warm sand, deep green');
    expect(back.visualAvoid).toBe('stock smiles, neon');
  });

  it('tolerates a record saved before the fields existed', () => {
    const legacy = JSON.parse(JSON.stringify(blankSalesAiIntake()));
    delete legacy.visualSubject;
    delete legacy.visualPalette;
    const back = normalizeSalesAiIntake(legacy);
    expect(back.visualSubject).toBe('');
    expect(back.visualPalette).toBe('');
    expect(() => funnelBriefFromIntake(back)).not.toThrow();
  });
});

describe('formatIntakeVisualForPrompt', () => {
  it('is empty when nothing is stated, so prompts omit the line', () => {
    expect(formatIntakeVisualForPrompt(blankSalesAiIntake())).toBe('');
  });

  it('summarises only the stated fields', () => {
    const out = formatIntakeVisualForPrompt({ ...blankSalesAiIntake(), visualLighting: 'harsh noon' });
    expect(out).toBe('lighting: harsh noon');
  });
});
