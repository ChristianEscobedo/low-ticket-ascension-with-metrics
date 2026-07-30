import { describe, it, expect } from 'vitest';
import {
  appendExample,
  buildRemixDraft,
  clampSequenceCount,
  deriveTemplateFromPiece,
  funnelArcGuide,
  orderRecipesForPicker,
  orderEmailRecipesForTrigger,
  triggerRecipeFamilyLabel,
  EXAMPLE_HOOKS_CAP,
  SEQUENCE_MIN,
  SEQUENCE_MAX,
} from '@/lib/mothermode/content/promptBankActions';
import {
  getPromptRecipe,
  recipesFor,
  PROMPT_RECIPES,
  type PromptRecipe,
} from '@/lib/mothermode/content/promptBank';
import { IMAGE_PROMPT_RECIPES } from '@/lib/mothermode/content/imagePromptBank';
import type { ContentPiece } from '@/lib/mothermode/content/types';

/** A minimal feed piece for the pure builders (no AI involved). */
function feedPiece(over: Partial<ContentPiece> = {}): ContentPiece {
  return {
    id: 'test-1',
    platform: 'instagram',
    format: 'feed',
    kind: 'organic',
    tone: 'confidante',
    theme: 'The mental load',
    title: 'Test piece',
    hook: 'I counted 47 open loops in my head before breakfast.',
    body: ['First proof paragraph.', 'Second proof paragraph.'],
    cta: 'The Brain Dump System holds them for you.',
    ...over,
  };
}

describe('appendExample', () => {
  it('appends a new example and reports it added', () => {
    const out = appendExample(['one'], 'two');
    expect(out.added).toBe(true);
    expect(out.next).toEqual(['one', 'two']);
    expect(out.dropped).toBeNull();
  });

  it('dedupes case- and whitespace-insensitively', () => {
    const out = appendExample(['The  hook   lands'], 'the hook lands');
    expect(out.added).toBe(false);
    expect(out.next).toEqual(['The  hook   lands']);
  });

  it('rejects empty candidates', () => {
    const out = appendExample(['one'], '   ');
    expect(out.added).toBe(false);
    expect(out.next).toEqual(['one']);
  });

  it('caps at 6 and reports the dropped oldest example', () => {
    const existing = Array.from({ length: EXAMPLE_HOOKS_CAP }, (_, i) => `ex-${i + 1}`);
    const out = appendExample(existing, 'ex-new');
    expect(out.added).toBe(true);
    expect(out.next.length).toBe(EXAMPLE_HOOKS_CAP);
    expect(out.dropped).toBe('ex-1');
    expect(out.next[0]).toBe('ex-2');
    expect(out.next[EXAMPLE_HOOKS_CAP - 1]).toBe('ex-new');
  });

  it('collapses multiline output into one stored example line', () => {
    const out = appendExample([], 'line one\nline two');
    expect(out.next).toEqual(['line one line two']);
  });
});

describe('deriveTemplateFromPiece', () => {
  it('names hook, body, and CTA slots for a feed piece', () => {
    const t = deriveTemplateFromPiece(feedPiece());
    expect(t).toContain('{Hook: opener in the spirit of "I counted 47 open');
    expect(t).toContain('{Body: 2 short paragraphs');
    expect(t).toContain('{SoftCTA}');
  });

  it('names slide beats for a carousel piece', () => {
    const t = deriveTemplateFromPiece(
      feedPiece({
        body: undefined,
        slides: [
          { text: 's1' },
          { text: 's2' },
          { text: 's3' },
          { text: 's4' },
        ],
      }),
    );
    expect(t).toContain('{Slide1Hook');
    expect(t).toContain('{Slides2to3');
    expect(t).toContain('{Slide4');
  });

  it('names tweet beats for a thread piece', () => {
    const t = deriveTemplateFromPiece(
      feedPiece({ body: undefined, tweets: ['t1', 't2', 't3'] }),
    );
    expect(t).toContain('{Tweet1Hook');
    expect(t).toContain('{Tweet3');
  });

  it('falls back gracefully when the hook is empty', () => {
    const t = deriveTemplateFromPiece(feedPiece({ hook: '' }));
    expect(t).toContain('{Hook: opener in the spirit of "the opener"}');
  });
});

describe('buildRemixDraft', () => {
  it('builds a custom text draft seeded from the source and the output', () => {
    const source = getPromptRecipe('personal-story')!;
    const piece = feedPiece();
    const draft = buildRemixDraft(source, piece, []);
    expect(draft.id).toBe('personal-story-remix');
    expect(draft.label).toContain('Personal story remix');
    expect(draft.group).toBe('framework');
    expect(draft.builtin).toBe(false);
    expect(draft.enabled).toBe(true);
    expect(draft.exampleHooks).toEqual([piece.hook]);
    expect(draft.whyItWorks[0]).toContain('Remixed from "Personal story"');
    expect(draft.whyItWorks.length).toBe(3);
    expect(draft.craft).toBe(source.craft);
    expect(draft.platforms).toEqual(source.platforms);
    expect(draft.template).toContain('{Hook');
  });

  it('dedupes the remix id with a counter against existing ids', () => {
    const source = getPromptRecipe('personal-story')!;
    const draft = buildRemixDraft(source, feedPiece(), [
      'personal-story-remix',
      'personal-story-remix-2',
    ]);
    expect(draft.id).toBe('personal-story-remix-3');
  });

  it('falls back to the piece platform/format when the source lists are empty', () => {
    const source = {
      ...getPromptRecipe('personal-story')!,
      platforms: [],
      formats: [],
    };
    const draft = buildRemixDraft(source, feedPiece(), []);
    expect(draft.platforms).toEqual(['instagram']);
    expect(draft.formats).toEqual(['feed']);
  });

  it('keeps image recipes as image drafts with the prompt as the example', () => {
    const source = IMAGE_PROMPT_RECIPES[0];
    expect(source.group).toBe('image');
    const piece = feedPiece({
      media: {
        type: 'image',
        alt: 'Kitchen counter at 6am',
        prompt: 'A cluttered counter, cold coffee, one sticky note.',
      },
    });
    const draft = buildRemixDraft(source, piece, []);
    expect(draft.group).toBe('image');
    expect(draft.id).toBe(`${source.id}-remix`);
    expect(draft.exampleHooks).toEqual([piece.media!.prompt]);
    expect(draft.kind).toBe(source.kind);
    expect(draft.sizePresetIds).toEqual(source.sizePresetIds);
  });
});

describe('clampSequenceCount', () => {
  it('defaults to 4 and clamps into the 3-5 band', () => {
    expect(clampSequenceCount(NaN)).toBe(4);
    expect(clampSequenceCount(1)).toBe(SEQUENCE_MIN);
    expect(clampSequenceCount(9)).toBe(SEQUENCE_MAX);
    expect(clampSequenceCount(4)).toBe(4);
  });
});

describe('funnelArcGuide', () => {
  it('describes the hook, proof, and convert beats in order', () => {
    const g = funnelArcGuide(4);
    expect(g).toContain('These 4 posts are ONE connected content funnel');
    expect(g).toContain('Post 1 hooks');
    expect(g).toContain('Post 2 proves');
    expect(g).toContain('Post 3 deepens');
    expect(g).toContain('Post 4 converts');
  });

  it('shapes a 3-post arc with one proof beat', () => {
    const g = funnelArcGuide(3);
    expect(g).toContain('These 3 posts');
    expect(g).toContain('Post 2 proves');
    expect(g).toContain('Post 3 converts');
    expect(g).not.toContain('Post 4');
  });

  it('clamps out-of-band counts and stays voice-safe', () => {
    for (const n of [0, 1, 3, 4, 5, 12]) {
      const g = funnelArcGuide(n);
      expect(g).not.toMatch(/[—–]/);
      expect(g.toLowerCase()).not.toMatch(
        /mompreneur|girlboss|supermom|glow-up|wine mom/,
      );
    }
    expect(funnelArcGuide(12)).toContain('These 5 posts');
  });
});

describe('orderRecipesForPicker', () => {
  const ALL: PromptRecipe[] = [...PROMPT_RECIPES, ...IMAGE_PROMPT_RECIPES];

  it('floats strong fits for the channel first, registry order inside', () => {
    const ordered = orderRecipesForPicker(PROMPT_RECIPES, 'instagram', 'feed');
    const fits = recipesFor('instagram', 'feed', PROMPT_RECIPES);
    expect(ordered.length).toBe(PROMPT_RECIPES.length);
    expect(ordered.slice(0, fits.length).map((r) => r.id)).toEqual(
      fits.map((r) => r.id),
    );
    // Everything after the fits block is a non-fit, in registry order.
    const rest = ordered.slice(fits.length);
    const fitIds = new Set(fits.map((r) => r.id));
    expect(rest.map((r) => r.id)).toEqual(
      PROMPT_RECIPES.filter((r) => !fitIds.has(r.id)).map((r) => r.id),
    );
  });

  it('keeps registry order when no channel is given', () => {
    const ordered = orderRecipesForPicker(PROMPT_RECIPES);
    expect(ordered.map((r) => r.id)).toEqual(PROMPT_RECIPES.map((r) => r.id));
  });

  it('offers only the groups the surface can execute', () => {
    const imageOnly = orderRecipesForPicker(ALL, undefined, undefined, [
      'image',
    ]);
    expect(imageOnly.length).toBeGreaterThan(0);
    expect(imageOnly.every((r) => r.group === 'image')).toBe(true);

    const textOnly = orderRecipesForPicker(ALL, undefined, undefined, [
      'framework',
      'style',
    ]);
    expect(textOnly.length).toBeGreaterThan(0);
    expect(textOnly.some((r) => r.group === 'image')).toBe(false);
  });

  it('drops disabled recipes (DB toggles never reach a picker)', () => {
    const pool: PromptRecipe[] = [
      ...PROMPT_RECIPES.slice(0, 4),
      { ...PROMPT_RECIPES[0], id: 'disabled-custom', enabled: false },
    ];
    const ordered = orderRecipesForPicker(pool, 'instagram', 'feed');
    expect(ordered.some((r) => r.id === 'disabled-custom')).toBe(false);
    expect(ordered.length).toBe(4);
  });

  it('fits ordering respects group filtering (image stage for FB ads)', () => {
    const ordered = orderRecipesForPicker(
      ALL,
      'facebook',
      'feed',
      ['image'],
    );
    const fits = recipesFor(
      'facebook',
      'feed',
      IMAGE_PROMPT_RECIPES,
    );
    expect(ordered.length).toBeGreaterThan(0);
    expect(ordered.slice(0, fits.length).map((r) => r.id)).toEqual(
      fits.map((r) => r.id),
    );
    expect(ordered.every((r) => r.group === 'image')).toBe(true);
  });

  it('fitsOnly narrows to the channel recommendations (nothing from other platforms)', () => {
    const ordered = orderRecipesForPicker(
      PROMPT_RECIPES,
      'tiktok',
      'reel',
      undefined,
      true,
    );
    const fits = recipesFor('tiktok', 'reel', PROMPT_RECIPES);
    expect(ordered.length).toBeGreaterThan(0);
    expect(ordered.length).toBeLessThan(PROMPT_RECIPES.length);
    expect(ordered.map((r) => r.id)).toEqual(fits.map((r) => r.id));
    // Every listed recipe either names the channel or is channel-agnostic.
    for (const r of ordered) {
      const platformOk =
        r.platforms.length === 0 || r.platforms.includes('tiktok');
      const formatOk = r.formats.length === 0 || r.formats.includes('reel');
      expect(platformOk && formatOk).toBe(true);
    }
  });
});

describe('orderEmailRecipesForTrigger + triggerRecipeFamilyLabel', () => {
  it('filters to email-platform framework recipes only (round-5 families present)', () => {
    const ordered = orderEmailRecipesForTrigger([
      ...PROMPT_RECIPES,
      ...IMAGE_PROMPT_RECIPES,
    ]);
    expect(ordered.length).toBeGreaterThan(0);
    for (const r of ordered) {
      expect(r.group).toBe('framework');
      expect(r.platforms).toContain('email');
    }
    for (const id of [
      'email-founder-letter',
      'emlf-deep-dive',
      'embuy-oto-ascend',
      'emgoal-book-call',
    ]) {
      expect(ordered.some((r) => r.id === id), id).toBe(true);
    }
  });

  it('sorts the trigger-matched family first, registry order otherwise', () => {
    const purchase = orderEmailRecipesForTrigger(PROMPT_RECIPES, 'purchase');
    expect(purchase[0].id.startsWith('embuy-')).toBe(true);
    const lastGoal = purchase
      .map((r) => r.id)
      .lastIndexOf('emgoal-community-join');
    const firstOther = purchase.findIndex(
      (r) => !r.id.startsWith('embuy-') && !r.id.startsWith('emgoal-'),
    );
    expect(lastGoal).toBeGreaterThan(-1);
    expect(firstOther).toBeGreaterThan(lastGoal);

    const oto = orderEmailRecipesForTrigger(
      PROMPT_RECIPES,
      'upsell_purchase',
    );
    expect(oto[0].id.startsWith('embuy-oto')).toBe(true);

    const booking = orderEmailRecipesForTrigger(PROMPT_RECIPES, 'booking');
    expect(booking[0].id).toBe('emgoal-book-call');

    const abandon = orderEmailRecipesForTrigger(PROMPT_RECIPES, 'abandon');
    expect(abandon[0].id).toBe('email-honest-last-call');
  });

  it('names the fitting family per trigger, empty otherwise', () => {
    expect(triggerRecipeFamilyLabel('purchase')).toContain('embuy-');
    expect(triggerRecipeFamilyLabel('upsell_purchase')).toContain('embuy-');
    expect(triggerRecipeFamilyLabel('refund')).toContain('embuy-');
    expect(triggerRecipeFamilyLabel('booking')).toContain('emgoal-');
    expect(triggerRecipeFamilyLabel('abandon')).toContain('last call');
    expect(triggerRecipeFamilyLabel('optin')).toBe('');
    expect(triggerRecipeFamilyLabel(undefined)).toBe('');
  });
});
