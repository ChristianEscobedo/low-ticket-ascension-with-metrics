import { describe, it, expect } from 'vitest';
import {
  IMAGE_PROMPT_RECIPES,
  getImageRecipe,
  imageRecipesFor,
  imageRecipeCraftBlock,
  imageRecipeSizeLabels,
} from '@/lib/mothermode/content/imagePromptBank';
import {
  rowToRecipe,
  recipeToRow,
  ALL_SEED_RECIPES,
} from '@/lib/mothermode/content/promptBankStore';
import { PLATFORM_SIZE_PRESETS } from '@/lib/mothermode/content/platformSizes';
import { IMAGE_STYLE } from '@/lib/mothermode/content/constants';

const PRESET_IDS = new Set(PLATFORM_SIZE_PRESETS.map((p) => p.id));

describe('image prompt bank registry integrity', () => {
  it('has 72 builtin image recipes with unique ids across 7 sub-banks', () => {
    expect(IMAGE_PROMPT_RECIPES.length).toBe(72);
    const ids = IMAGE_PROMPT_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of IMAGE_PROMPT_RECIPES) {
      expect(r.builtin).toBe(true);
      expect(r.group).toBe('image');
    }
    // 17 Facebook ads, 8 Instagram organic, 25 YouTube thumbnails,
    // 4 LinkedIn organic, 4 Instagram carousel slide roles, 8 TikTok covers,
    // 6 email images.
    expect(IMAGE_PROMPT_RECIPES.filter((r) => r.id.startsWith('fbad-')).length).toBe(17);
    expect(IMAGE_PROMPT_RECIPES.filter((r) => r.id.startsWith('igorg-')).length).toBe(8);
    expect(IMAGE_PROMPT_RECIPES.filter((r) => r.id.startsWith('ytthumb-')).length).toBe(25);
    expect(IMAGE_PROMPT_RECIPES.filter((r) => r.id.startsWith('liimg-')).length).toBe(4);
    expect(IMAGE_PROMPT_RECIPES.filter((r) => r.id.startsWith('igcar-')).length).toBe(4);
    expect(IMAGE_PROMPT_RECIPES.filter((r) => r.id.startsWith('ttimg-')).length).toBe(8);
    expect(IMAGE_PROMPT_RECIPES.filter((r) => r.id.startsWith('emimg-')).length).toBe(6);
  });

  it('round 5 ships 6 email image frameworks, brand-locked', () => {
    const em = [
      'emimg-header-calm', 'emimg-offer-hero', 'emimg-receipt-proof',
      'emimg-welcome-scene', 'emimg-event-card', 'emimg-divider-rule',
    ];
    for (const id of em) {
      const r = getImageRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('organic');
      expect(r!.goal, id).toBe('clicks');
      expect(r!.platforms, id).toEqual(['email']);
      expect(r!.sizePresetIds, id).toEqual(['email-header']);
      expect(r!.formats, id).toEqual(['email']);
    }
  });

  it('round 4 ships 8 TikTok cover frameworks, brand-locked', () => {
    const tt = [
      'ttimg-cover-title-field', 'ttimg-series-hero',
      'ttimg-split-before-after', 'ttimg-object-story',
      'ttimg-hands-mid-method', 'ttimg-count-row',
      'ttimg-quiet-scene', 'ttimg-receipt-closeup',
    ];
    for (const id of tt) {
      const r = getImageRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('organic');
      expect(r!.goal, id).toBe('clicks');
      expect(r!.platforms, id).toEqual(['tiktok']);
      expect(r!.sizePresetIds, id).toEqual(['ig-fb-story']);
      expect(r!.formats, id).toContain('video');
    }
  });

  it('round 3 ships 10 more YouTube thumbnail frameworks, brand-locked', () => {
    const yt3 = [
      'ytthumb-contrast-marker', 'ytthumb-curiosity-gap-object',
      'ytthumb-split-decision', 'ytthumb-countdown-still',
      'ytthumb-documentary-grab', 'ytthumb-empty-chair',
      'ytthumb-prop-confession', 'ytthumb-scale-contrast',
      'ytthumb-then-now-map', 'ytthumb-confessional-light',
    ];
    for (const id of yt3) {
      const r = getImageRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('organic');
      expect(r!.goal, id).toBe('clicks');
      expect(r!.platforms, id).toEqual(['youtube']);
      expect(r!.sizePresetIds, id).toEqual(['yt-thumb']);
      expect(r!.formats, id).toContain('long');
    }
  });

  it('round 2 ships the new sub-banks with correct placement kinds', () => {
    const fbad2 = [
      'fbad-question-card', 'fbad-checklist-visual', 'fbad-founder-note',
      'fbad-phone-mockup', 'fbad-mechanism-diagram', 'fbad-testimonial-card',
      'fbad-calendar-urgency', 'fbad-hands-holding-page',
    ];
    for (const id of fbad2) {
      const r = getImageRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('ad');
      expect(r!.platforms, id).toEqual(['facebook']);
    }
    const yt2 = [
      'ytthumb-checklist-hero', 'ytthumb-timeline-marks', 'ytthumb-minimal-object',
      'ytthumb-simple-chart', 'ytthumb-mirror-split', 'ytthumb-offer-stack',
      'ytthumb-myth-busted', 'ytthumb-day-in-life',
    ];
    for (const id of yt2) {
      const r = getImageRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('organic');
      expect(r!.platforms, id).toEqual(['youtube']);
    }
    const liIds = [
      'liimg-quote-card', 'liimg-doc-cover', 'liimg-process-diagram',
      'liimg-workspace-hero',
    ];
    for (const id of liIds) {
      const r = getImageRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('organic');
      expect(r!.platforms, id).toEqual(['linkedin']);
    }
    const carIds = [
      'igcar-cover-number', 'igcar-teach-slide', 'igcar-proof-slide',
      'igcar-cta-slide',
    ];
    for (const id of carIds) {
      const r = getImageRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('organic');
      expect(r!.formats, id).toEqual(['carousel']);
    }
  });

  it('every image recipe is fully specified, voice-safe, and brand-locked', () => {
    for (const r of IMAGE_PROMPT_RECIPES) {
      expect(r.label.trim().length, r.id).toBeGreaterThan(0);
      expect(r.hint.trim().length, r.id).toBeGreaterThan(0);
      expect(r.craft.trim().length, r.id).toBeGreaterThan(0);
      expect(r.whyItWorks.length, r.id).toBeGreaterThan(0);
      expect(r.template.length, r.id).toBeGreaterThan(0);
      expect(r.exampleHooks.length, r.id).toBeGreaterThan(0);
      expect(r.kind, r.id).toBeDefined();
      expect(r.platforms.length, r.id).toBeGreaterThan(0);
      expect(r.formats.length, r.id).toBeGreaterThan(0);
      expect(r.sizePresetIds?.length ?? 0, r.id).toBeGreaterThan(0);
      for (const id of r.sizePresetIds ?? []) {
        expect(PRESET_IDS.has(id), `${r.id} -> ${id}`).toBe(true);
      }
      // Voice rules: never em dashes or en dashes anywhere in the bank.
      const allText = [
        r.craft,
        r.template,
        ...r.exampleHooks,
        ...r.whyItWorks,
        ...Object.values(r.platformNotes ?? {}),
      ].join(' ');
      expect(allText, r.id).not.toMatch(/[—–]/);
      expect(allText.toLowerCase(), r.id).not.toMatch(
        /mompreneur|girlboss|supermom|glow-up|wine mom/,
      );
      // Brand lock: renders never bake words in; overlays add them later.
      const noTextRule = `${r.template} ${r.craft}`.toLowerCase();
      expect(noTextRule, r.id).toMatch(
        /no text|no baked-in|render stays wordless|no lettering|no readable|never readable/,
      );
    }
  });

  it('sub-banks carry the right placement kinds and platforms', () => {
    for (const r of IMAGE_PROMPT_RECIPES) {
      if (r.id.startsWith('fbad-')) {
        expect(r.kind, r.id).toBe('ad');
        expect(r.platforms, r.id).toContain('facebook');
        expect(r.goal, r.id).toBe('clicks');
      } else if (r.id.startsWith('igorg-')) {
        expect(r.kind, r.id).toBe('organic');
        expect(r.platforms, r.id).toContain('instagram');
      } else if (r.id.startsWith('ytthumb-')) {
        expect(r.kind, r.id).toBe('organic');
        expect(r.platforms, r.id).toEqual(['youtube']);
        expect(r.sizePresetIds, r.id).toEqual(['yt-thumb']);
        expect(r.goal, r.id).toBe('clicks');
      } else if (r.id.startsWith('ttimg-')) {
        expect(r.kind, r.id).toBe('organic');
        expect(r.platforms, r.id).toEqual(['tiktok']);
        expect(r.sizePresetIds, r.id).toEqual(['ig-fb-story']);
        expect(r.goal, r.id).toBe('clicks');
      } else if (r.id.startsWith('emimg-')) {
        expect(r.kind, r.id).toBe('organic');
        expect(r.platforms, r.id).toEqual(['email']);
        expect(r.sizePresetIds, r.id).toEqual(['email-header']);
        expect(r.goal, r.id).toBe('clicks');
      }
    }
    // The face close-up is the only recipe that opts into faces.
    const faceRecipe = getImageRecipe('ytthumb-face-closeup')!;
    expect(faceRecipe.craft).toContain('founder or approved face');
  });
});

describe('imageRecipesFor', () => {
  it('filters by platform and placement kind', () => {
    const fbAds = imageRecipesFor('facebook', 'ad');
    expect(fbAds.length).toBe(17);
    for (const r of fbAds) expect(r.id.startsWith('fbad-')).toBe(true);

    const igOrganic = imageRecipesFor('instagram', 'organic');
    expect(igOrganic.length).toBe(12);
    for (const r of igOrganic) {
      expect(r.id.startsWith('igorg-') || r.id.startsWith('igcar-')).toBe(true);
    }

    const yt = imageRecipesFor('youtube');
    expect(yt.length).toBe(25);

    const li = imageRecipesFor('linkedin', 'organic');
    expect(li.length).toBe(4);

    const tt = imageRecipesFor('tiktok', 'organic');
    expect(tt.length).toBe(8);
    for (const r of tt) expect(r.id.startsWith('ttimg-')).toBe(true);

    const em = imageRecipesFor('email', 'organic');
    expect(em.length).toBe(6);
    for (const r of em) expect(r.id.startsWith('emimg-')).toBe(true);

    // Facebook organic has no ad recipes, and x has no image bank yet.
    expect(imageRecipesFor('facebook', 'organic').length).toBe(0);
    expect(imageRecipesFor('x').length).toBe(0);
  });
});

describe('imageRecipeCraftBlock', () => {
  it('includes craft, skeleton, why, sizes, examples, and the art-direction lock', () => {
    const r = getImageRecipe('fbad-pattern-interrupt')!;
    const block = imageRecipeCraftBlock(r, 'facebook');
    expect(block).toContain(r.craft);
    expect(block).toContain('{SingleUnexpectedObject}');
    expect(block).toContain('Why it performs');
    expect(block).toContain('Platform execution for facebook');
    expect(block).toContain('Target sizes: Ad 1:1 (1080x1080), Ad 4:5 (1080x1350)');
    expect(block).toContain(r.exampleHooks[0]);
    expect(block).toContain('Art direction lock (non-negotiable)');
    expect(block).toContain('no on-image text');
    expect(block).toContain('overlay editor');
  });

  it('omits the platform note when the platform differs', () => {
    const r = getImageRecipe('fbad-pattern-interrupt')!;
    const block = imageRecipeCraftBlock(r, 'instagram');
    expect(block).not.toContain('Platform execution for facebook');
  });

  it('always carries the shared IMAGE_STYLE fragment', () => {
    for (const r of IMAGE_PROMPT_RECIPES) {
      expect(imageRecipeCraftBlock(r)).toContain(
        IMAGE_STYLE.slice(0, 40),
      );
    }
  });
});

describe('imageRecipeSizeLabels', () => {
  it('maps preset ids to readable labels', () => {
    const r = getImageRecipe('ytthumb-curiosity-scene')!;
    expect(imageRecipeSizeLabels(r)).toEqual(['YouTube thumbnail (1280x720)']);
  });
});

describe('prompt bank store: image group round-trip', () => {
  it('round-trips an image recipe through the row shape without losing fields', () => {
    const seed = getImageRecipe('fbad-offer-flatlay')!;
    const row = recipeToRow(seed, 42, 'test@mothermode.com');
    expect(row.slug).toBe(seed.id);
    expect(row.recipe_group).toBe('image');
    expect(row.kind).toBe('ad');
    expect(row.size_presets).toEqual(['ad-11', 'ad-45']);
    expect(row.sort_order).toBe(42);
    const back = rowToRecipe(row);
    expect(back.id).toBe(seed.id);
    expect(back.group).toBe('image');
    expect(back.kind).toBe('ad');
    expect(back.sizePresetIds).toEqual(['ad-11', 'ad-45']);
    expect(back.template).toBe(seed.template);
    expect(back.exampleHooks).toEqual(seed.exampleHooks);
  });

  it('text recipes round-trip with kind null and empty size presets', () => {
    const textSeed = ALL_SEED_RECIPES.find((r) => r.id === 'normalize-x')!;
    const row = recipeToRow(textSeed, 0);
    expect(row.recipe_group).toBe('framework');
    expect(row.kind).toBeNull();
    expect(row.size_presets).toEqual([]);
    const back = rowToRecipe(row);
    expect(back.group).toBe('framework');
    expect(back.kind).toBeUndefined();
    expect(back.sizePresetIds).toEqual([]);
  });

  it('ALL_SEED_RECIPES holds the full bank: 147 frameworks + 72 image recipes', () => {
    expect(ALL_SEED_RECIPES.length).toBe(219);
    expect(ALL_SEED_RECIPES.filter((r) => r.group === 'image').length).toBe(72);
    expect(ALL_SEED_RECIPES.filter((r) => r.group === 'framework').length).toBe(147);
    const ids = ALL_SEED_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
