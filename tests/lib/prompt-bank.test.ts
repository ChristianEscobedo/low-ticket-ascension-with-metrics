import { describe, it, expect } from 'vitest';
import {
  PROMPT_RECIPES,
  getPromptRecipe,
  recipesFor,
  recipeCraftBlock,
  recipeInputsBlock,
  frameworkRotation,
  rotationAssignmentLines,
  type PromptRecipe,
} from '@/lib/mothermode/content/promptBank';
import {
  rowToRecipe,
  recipeToRow,
} from '@/lib/mothermode/content/promptBankStore';
import {
  parseNotionEntry,
  slugifyRecipeId,
} from '@/lib/mothermode/content/promptBankImport';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
} from '@/lib/mothermode/content/constants';

const VALID_PLATFORMS = Object.keys(PLATFORM_LABEL);
const VALID_FORMATS = Object.keys(FORMAT_LABEL);

describe('prompt bank registry integrity', () => {
  it('has 147 builtin frameworks with unique ids', () => {
    expect(PROMPT_RECIPES.length).toBe(147);
    const ids = PROMPT_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of PROMPT_RECIPES) {
      expect(r.builtin).toBe(true);
      expect(r.group).toBe('framework');
    }
  });

  it('ships the platform-specific frameworks, one tight fit per channel', () => {
    const expected: [string, string[]][] = [
      ['x-thread-blueprint', ['x']],
      ['x-hot-take', ['x']],
      ['x-bookmark-bomb', ['x']],
      ['fb-colorblock-conversation', ['facebook']],
      ['fb-group-question', ['facebook']],
      ['fb-ad-pas', ['facebook']],
      ['fb-ad-bab', ['facebook']],
      ['fb-ad-ugc-proof', ['facebook']],
      ['fb-ad-offer-stack', ['facebook']],
      ['ig-carousel-classroom', ['instagram']],
      ['ig-reel-loop', ['instagram']],
      ['ig-send-to-friend', ['instagram']],
      ['tiktok-3s-hook', ['tiktok']],
      ['tiktok-pov-skit', ['tiktok']],
      ['tiktok-storytime-loop', ['tiktok']],
      ['yt-title-thumbnail-pair', ['youtube']],
      ['yt-intro-retention', ['youtube']],
      ['yt-value-density', ['youtube']],
      ['li-linebreak-authority', ['linkedin']],
      ['li-data-pattern', ['linkedin']],
      ['li-working-mother-reframe', ['linkedin']],
      ['pin-seo-howto', ['pinterest']],
      ['pin-listicle-saves', ['pinterest']],
      ['email-subject-curiosity', ['email']],
      ['email-open-loop-story', ['email']],
      ['blog-seo-listicle', ['blog']],
    ];
    for (const [id, platforms] of expected) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms[0], id).toBe(platforms[0]);
    }
    // The 4 Facebook ad-copy frameworks are marked as paid placement.
    for (const id of ['fb-ad-pas', 'fb-ad-bab', 'fb-ad-ugc-proof', 'fb-ad-offer-stack']) {
      expect(getPromptRecipe(id)!.kind, id).toBe('ad');
    }
    // AEO answer capsule covers both answer and blog surfaces.
    expect(getPromptRecipe('aeo-answer-capsule')!.platforms).toContain('aeo');
  });

  it('round 2 ships 10 FB ad frameworks, 8 LinkedIn, and 8 long-form', () => {
    const fbAds = [
      'fb-ad-question-hook', 'fb-ad-stat-shock', 'fb-ad-myth-buster',
      'fb-ad-checklist', 'fb-ad-founder-note', 'fb-ad-objection-flip',
      'fb-ad-price-anchor', 'fb-ad-social-proof', 'fb-ad-demo-script',
      'fb-ad-one-big-idea',
    ];
    for (const id of fbAds) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('ad');
      expect(r!.goal, id).toBe('clicks');
      expect(r!.platforms, id).toEqual(['facebook']);
    }
    const liIds = [
      'li-case-study', 'li-poll-insight', 'li-doc-teach', 'li-myth-retirement',
      'li-operating-principle', 'li-week-review', 'li-hiring-lens',
      'li-translation-table',
    ];
    for (const id of liIds) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms, id).toEqual(['linkedin']);
    }
    const lfIds = [
      'lf-ultimate-guide', 'lf-deep-dive-system', 'lf-encyclopedia',
      'lf-serial-chapter', 'lf-research-report', 'lf-masterclass',
      'lf-book-application', 'lf-exhaustive-list',
    ];
    for (const id of lfIds) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(
        ['saves', 'follows', 'shares'].includes(r!.goal),
        `${id} goal ${r!.goal}`,
      ).toBe(true);
    }
  });

  it('round 3 ships 8 Shorts, 8 long-form, and 6 YouTube ad frameworks', () => {
    const shorts = [
      'ytshort-loop-answer', 'ytshort-three-things', 'ytshort-pov-system',
      'ytshort-comment-bait', 'ytshort-micro-method', 'ytshort-myth-flip-15',
      'ytshort-story-loop', 'ytshort-watch-twice',
    ];
    for (const id of shorts) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms, id).toEqual(['youtube']);
      expect(r!.formats, id).toEqual(['reel']);
      expect(r!.kind, id).toBeUndefined();
      expect(
        ['saves', 'shares', 'replies', 'follows'].includes(r!.goal),
        `${id} goal ${r!.goal}`,
      ).toBe(true);
    }
    const longs = [
      'ytlong-retention-essay', 'ytlong-ultimate-guide',
      'ytlong-teardown-audit', 'ytlong-experiment-vlog',
      'ytlong-documentary-case', 'ytlong-challenge-arc',
      'ytlong-confession-hour', 'ytlong-vs-week',
    ];
    for (const id of longs) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms, id).toEqual(['youtube']);
      expect(r!.formats, id).toEqual(['long']);
      expect(r!.kind, id).toBeUndefined();
      expect(
        ['saves', 'shares', 'follows'].includes(r!.goal),
        `${id} goal ${r!.goal}`,
      ).toBe(true);
    }
    const ads = [
      'ytad-preroll-pas', 'ytad-preroll-proof', 'ytad-preroll-founder',
      'ytad-infeed-answer', 'ytad-demo-walkthrough', 'ytad-testimonial-ugc',
    ];
    for (const id of ads) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('ad');
      expect(r!.goal, id).toBe('clicks');
      expect(r!.platforms, id).toEqual(['youtube']);
      expect(r!.formats, id).toEqual(['long', 'reel']);
    }
    // The round-3 inputs bar: 5 recipes declare custom input fields.
    const withInputs = [
      'ytshort-story-loop', 'ytlong-teardown-audit',
      'ytlong-experiment-vlog', 'ytlong-confession-hour',
      'ytad-testimonial-ugc',
    ];
    for (const id of withInputs) {
      const r = getPromptRecipe(id);
      expect(r!.inputs?.length, `${id} has no inputs`).toBeGreaterThan(0);
    }
  });

  it('round 4 ships 10 TikTok scripts and 6 TikTok ad frameworks', () => {
    const shorts = [
      'ttshort-stitch-answer', 'ttshort-comment-reply',
      'ttshort-green-screen-receipt', 'ttshort-voiceover-reset',
      'ttshort-day-count', 'ttshort-stopped-doing',
      'ttshort-quiet-method', 'ttshort-ranked-list',
      'ttshort-watch-me', 'ttshort-photo-carousel',
    ];
    for (const id of shorts) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms, id).toEqual(['tiktok']);
      expect(r!.formats, id).toContain('video');
      expect(r!.kind, id).toBeUndefined();
      expect(
        ['saves', 'shares', 'replies', 'follows'].includes(r!.goal),
        `${id} goal ${r!.goal}`,
      ).toBe(true);
    }
    const ads = [
      'ttad-spark-proof', 'ttad-ugc-testimonial', 'ttad-native-problem',
      'ttad-demo-realtime', 'ttad-comment-offer', 'ttad-offer-stack',
    ];
    for (const id of ads) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.kind, id).toBe('ad');
      expect(r!.goal, id).toBe('clicks');
      expect(r!.platforms, id).toEqual(['tiktok']);
      expect(r!.formats, id).toEqual(['video', 'reel']);
    }
    // The round-4 inputs bar: 5 recipes declare custom input fields.
    const withInputs = [
      'ttshort-stitch-answer', 'ttshort-comment-reply',
      'ttshort-day-count', 'ttad-spark-proof', 'ttad-ugc-testimonial',
    ];
    for (const id of withInputs) {
      const r = getPromptRecipe(id);
      expect(r!.inputs?.length, `${id} has no inputs`).toBeGreaterThan(0);
    }
    // Every ytshort now carries a tiktok cross-post note, so no ttshort
    // recipe near-duplicates a Short.
    const ytshortIds = [
      'ytshort-loop-answer', 'ytshort-three-things', 'ytshort-pov-system',
      'ytshort-comment-bait', 'ytshort-micro-method', 'ytshort-myth-flip-15',
      'ytshort-story-loop', 'ytshort-watch-twice',
    ];
    for (const id of ytshortIds) {
      const r = getPromptRecipe(id);
      expect(r!.platformNotes?.tiktok, `${id} missing tiktok note`).toBeDefined();
    }
  });

  it('round 5 ships the email ascension families: 8 email, 6 emlf, 8 embuy, 4 emgoal', () => {
    const emailIds = [
      'email-founder-letter', 'email-teach-everything', 'email-story-receipt',
      'email-objection-faq', 'email-honest-last-call', 'email-quick-win',
      'email-open-loop-tease', 'email-ps-close',
    ];
    for (const id of emailIds) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms, id).toEqual(['email']);
      expect(r!.formats, id).toEqual(['email']);
      expect(r!.kind, id).toBeUndefined();
    }
    const emlfIds = [
      'emlf-ultimate-guide', 'emlf-deep-dive', 'emlf-research-report',
      'emlf-masterclass', 'emlf-encyclopedia', 'emlf-serial-chapter',
    ];
    for (const id of emlfIds) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms, id).toEqual(['email']);
      expect(r!.formats, id).toEqual(['email']);
      expect(['saves', 'shares', 'follows'].includes(r!.goal), `${id} goal ${r!.goal}`).toBe(true);
    }
    const embuyIds = [
      'embuy-welcome-receipt', 'embuy-first-win', 'embuy-next-offer-seed',
      'embuy-deep-nurture-arc', 'embuy-oto-welcome', 'embuy-oto-ascend',
      'embuy-refund-save', 'embuy-review-ask',
    ];
    for (const id of embuyIds) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms, id).toEqual(['email']);
      expect(r!.formats, id).toEqual(['email']);
      expect(r!.kind, id).toBeUndefined();
      expect(['clicks', 'replies', 'saves'].includes(r!.goal), `${id} goal ${r!.goal}`).toBe(true);
    }
    const emgoalIds = [
      'emgoal-book-call', 'emgoal-attend-event',
      'emgoal-reply-survey', 'emgoal-community-join',
    ];
    for (const id of emgoalIds) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.platforms, id).toEqual(['email']);
      expect(r!.formats, id).toEqual(['email']);
      expect(r!.kind, id).toBeUndefined();
      // The custom-goal family declares the goal input field.
      const goalField = r!.inputs?.find((f) => f.id === 'goal');
      expect(goalField, `${id} missing the goal input`).toBeDefined();
    }
    // The offer input: every ascension + offer-pointing goal recipe declares it.
    const withOffer = [
      'embuy-next-offer-seed', 'embuy-deep-nurture-arc', 'embuy-oto-ascend',
      'emgoal-book-call', 'emgoal-attend-event', 'emgoal-community-join',
    ];
    for (const id of withOffer) {
      const r = getPromptRecipe(id);
      expect(r!.inputs?.some((f) => f.id === 'offer'), `${id} missing the offer input`).toBe(true);
    }
    // The round-5 inputs bar: 11 recipes declare custom input fields.
    const withInputs = [
      'email-founder-letter', 'email-story-receipt',
      'embuy-welcome-receipt', 'embuy-oto-welcome',
      'embuy-next-offer-seed', 'embuy-deep-nurture-arc', 'embuy-oto-ascend',
      'emgoal-book-call', 'emgoal-attend-event',
      'emgoal-reply-survey', 'emgoal-community-join',
    ];
    for (const id of withInputs) {
      const r = getPromptRecipe(id);
      expect(r!.inputs?.length, `${id} has no inputs`).toBeGreaterThan(0);
    }
  });

  it('every recipe is fully specified and voice-safe', () => {
    for (const r of PROMPT_RECIPES) {
      expect(r.label.trim().length).toBeGreaterThan(0);
      expect(r.craft.trim().length).toBeGreaterThan(0);
      expect(r.whyItWorks.length).toBeGreaterThan(0);
      expect(r.template.length).toBeGreaterThan(0);
      expect(r.exampleHooks.length).toBeGreaterThan(0);
      for (const p of r.platforms) expect(VALID_PLATFORMS).toContain(p);
      for (const f of r.formats) expect(VALID_FORMATS).toContain(f);
      // Voice rules: never em dashes or en dashes anywhere in the bank.
      const allText = [
        r.craft,
        r.template,
        ...r.exampleHooks,
        ...r.whyItWorks,
        ...Object.values(r.platformNotes ?? {}),
      ].join(' ');
      expect(allText).not.toMatch(/[—–]/);
      // A few NO-list stems that must never leak into prompts.
      expect(allText.toLowerCase()).not.toMatch(
        /mompreneur|girlboss|supermom|glow-up|wine mom/,
      );
    }
  });

  it('ships the owner-requested frameworks', () => {
    const expected = [
      'questions-proof',
      'personal-story',
      'analogy',
      'current-events',
      'normalize-x',
      'experience-lessons',
      'brag',
      'challenge-beliefs',
      'confident-directive',
      'feel-good',
      'headline-list',
      'actionable-authority',
      'comparison',
      'niched-entertainment',
      'do-this-not-that',
      'formula',
      'pareto',
      'journey-flex',
    ];
    for (const id of expected) {
      expect(getPromptRecipe(id), id).toBeDefined();
    }
  });

  it('journey-flex keeps the owner template verbatim shape', () => {
    const r = getPromptRecipe('journey-flex')!;
    expect(r.template).toContain('How I went from:');
    expect(r.template).toContain('{CrappyThing1}');
    expect(r.template).toContain('{ImpressiveAccomplishment1}');
    expect(r.template).toContain('{HereIsMyStory:}');
    expect(r.sourceUrls!.length).toBe(8);
  });
});

describe('recipesFor', () => {
  it('filters by platform and format fit', () => {
    const xThreads = recipesFor('x', 'thread');
    expect(xThreads.length).toBeGreaterThan(5);
    for (const r of xThreads) {
      expect(
        r.platforms.length === 0 || r.platforms.includes('x'),
      ).toBe(true);
      expect(r.formats.length === 0 || r.formats.includes('thread')).toBe(
        true,
      );
    }
  });

  it('every channel has at least one fitting framework', () => {
    for (const p of VALID_PLATFORMS) {
      const fits = recipesFor(p as Parameters<typeof recipesFor>[0]);
      expect(fits.length, `platform ${p} has no fitting framework`).toBeGreaterThan(0);
    }
  });
});


describe('recipeCraftBlock', () => {
  it('includes craft, template, why, and the matching platform note only', () => {
    const r = getPromptRecipe('normalize-x')!;
    const fb = recipeCraftBlock(r, 'facebook');
    expect(fb).toContain(r.craft);
    expect(fb).toContain('It is okay to {TabooButTrue}');
    expect(fb).toContain('Why it performs');
    expect(fb).toContain('colorblock');
    const x = recipeCraftBlock(r, 'x');
    expect(x).toContain('Platform execution for x');
    const li = recipeCraftBlock(r, 'linkedin');
    expect(li).not.toContain('Platform execution');
  });
});

describe('frameworkRotation', () => {
  it('assigns one framework per piece, fits first, distinct when pool allows', () => {
    const rot = frameworkRotation('instagram', 'feed', 5);
    expect(rot.length).toBe(5);
    const ids = rot.map((r) => r.id);
    expect(new Set(ids).size).toBe(5);
    for (const r of rot) {
      expect(
        r.platforms.length === 0 || r.platforms.includes('instagram'),
      ).toBe(true);
    }
  });

  it('fills with non-fitting frameworks rather than repeating early', () => {
    const rot = frameworkRotation('blog', 'blog', 5);
    expect(rot.length).toBe(5);
    expect(new Set(rot.map((r) => r.id)).size).toBe(5);
  });

  it('respects a custom pool (disabled recipes stay out)', () => {
    const pool: PromptRecipe[] = PROMPT_RECIPES.slice(0, 2);
    const rot = frameworkRotation('x', 'thread', 4, pool);
    expect(rot.length).toBe(4);
    for (const r of rot) expect(pool).toContain(r);
  });
});

describe('rotationAssignmentLines', () => {
  it('numbers pieces and names ids', () => {
    const rot = frameworkRotation('x', 'thread', 3);
    const block = rotationAssignmentLines(rot, 'x');
    expect(block).toContain('Piece 1 executes framework');
    expect(block).toContain('Piece 3 executes framework');
    expect(block).toContain(`id "${rot[0].id}"`);
  });
});

describe('promptBankStore row mapping', () => {
  it('round-trips a recipe through row shape without losing fields', () => {
    const seed = getPromptRecipe('journey-flex')!;
    const row = recipeToRow(seed, 3, 'test@mothermode.com');
    expect(row.slug).toBe(seed.id);
    expect(row.sort_order).toBe(3);
    const back = rowToRecipe(row);
    expect(back.id).toBe(seed.id);
    expect(back.label).toBe(seed.label);
    expect(back.whyItWorks).toEqual(seed.whyItWorks);
    expect(back.template).toBe(seed.template);
    expect(back.platformNotes).toEqual(seed.platformNotes);
    expect(back.sourceUrls).toEqual(seed.sourceUrls);
    expect(back.enabled).toBe(true);
  });

  it('rowToRecipe honors enabled=false and custom recipes', () => {
    const seed = getPromptRecipe('brag')!;
    const row = { ...recipeToRow(seed, 0), enabled: false, builtin: false };
    const back = rowToRecipe(row);
    expect(back.enabled).toBe(false);
    expect(back.builtin).toBe(false);
  });
});

describe('parseNotionEntry', () => {
  const PASTE = [
    '- Why it works:',
    '    - Shows that you’re an interesting person.',
    '    - Gets people engaged in your journey.',
    '    - Let’s you subtly flex your accomplishments',
    '- Template:',
    '    ',
    '    How I went from:',
    '    ',
    '    - {CrappyThing1}',
    '    - {CrappyThing2}',
    '    - {CrappyThing3}',
    '    ',
    '    To:',
    '    ',
    '    - {ImpressiveAccomplishment1}',
    '    - {ImpressiveAccomplishment2}',
    '    - {ImpressiveAccomplishment3}',
    '    ',
    '    {HereIsMyStory:}',
    '    ',
    '- Examples:',
    '    ',
    '    https://twitter.com/thejeremymoser/status/1492513210745987076?s=20&t=AZqDQzU7gVJu3Pgc3FfScg',
    '    https://twitter.com/WrongsToWrite/status/1400831270678978560?s=20&t=3JQe5DWJcxdbn4ZN_ESBZg',
    '    https://twitter.com/OneJKMolina/status/1360216180645060611?s=20&t=srZQeo7WNPL2poc5BVQpRQ',
    '    https://twitter.com/thedankoe/status/1349314580082810882?s=20&t=EzIpR_HJl2y2dXQtX_Tx2w',
    '    https://twitter.com/_IanBello/status/1518473182260441088?s=20&t=AZqDQzU7gVJu3Pgc3FfScg',
    '    https://twitter.com/ItsKieranDrew/status/1428038290804981761',
    '    https://twitter.com/iamsam_williams/status/1565791958374686720?s=21&t=9l0PCfW8N-7ci7duUPCLaQ',
    '    https://twitter.com/adityatheverma/status/1543233847189553152?s=46&t=9bizE1ofFdZGG2HutCUs1w',
  ].join('\n');

  it('parses the owner swipe-file format end to end', () => {
    const out = parseNotionEntry(PASTE);
    expect(out.whyItWorks.length).toBe(3);
    expect(out.whyItWorks[0]).toContain('interesting person');
    expect(out.template).toContain('How I went from:');
    expect(out.template).toContain('- {CrappyThing1}');
    expect(out.template).toContain('{HereIsMyStory:}');
    // Dedent: the template starts flush-left.
    expect(out.template.startsWith('How I went from:')).toBe(true);
    expect(out.sourceUrls.length).toBe(8);
    expect(out.sourceUrls[0]).toContain('thejeremymoser');
  });

  it('tolerates missing examples and no leading dashes on headers', () => {
    const out = parseNotionEntry(
      'Why it works:\n- one reason\nTemplate:\nDo {This}.\n',
    );
    expect(out.whyItWorks).toEqual(['one reason']);
    expect(out.template).toBe('Do {This}.');
    expect(out.sourceUrls).toEqual([]);
  });

  it('returns empty pieces for junk', () => {
    const out = parseNotionEntry('   ');
    expect(out.whyItWorks).toEqual([]);
    expect(out.template).toBe('');
  });
});

describe('slugifyRecipeId', () => {
  it('makes url-safe slugs', () => {
    expect(slugifyRecipeId('How I went from X to Y')).toBe(
      'how-i-went-from-x-to-y',
    );
    expect(slugifyRecipeId("It's okay to... (Normalize X)")).toBe(
      'its-okay-to-normalize-x',
    );
  });
});

describe('custom input fields (recipe.inputs)', () => {
  it('the story/lesson/experience family carries curated inputs', () => {
    const expected = [
      'personal-story', 'experience-lessons', 'journey-flex',
      'experiment-recap', 'start-over', 'mistakes', 'harsh-truths',
      'teardown', 'named-method', 'receipts', 'brag', 'open-loop',
      'letter-younger', 'current-events', 'challenge-beliefs',
      'normalize-x', 'tiktok-storytime-loop', 'analogy',
    ];
    for (const id of expected) {
      const r = getPromptRecipe(id);
      expect(r, id).toBeDefined();
      expect(r!.inputs?.length, `${id} has no inputs`).toBeGreaterThan(0);
    }
  });

  it('every declared input field is well-formed and voice-safe', () => {
    for (const r of PROMPT_RECIPES) {
      if (!r.inputs?.length) continue;
      const ids = r.inputs.map((f) => f.id);
      expect(new Set(ids).size, `${r.id} duplicate input ids`).toBe(ids.length);
      for (const f of r.inputs) {
        expect(f.id.trim().length).toBeGreaterThan(0);
        expect(f.label.trim().length).toBeGreaterThan(0);
        const text = [f.label, f.placeholder ?? '', f.hint ?? ''].join(' ');
        expect(text, `${r.id}/${f.id} dashes`).not.toMatch(/[—–]/);
        expect(text.toLowerCase(), `${r.id}/${f.id} NO-list`).not.toMatch(
          /mompreneur|girlboss|supermom|glow-up|wine mom/,
        );
      }
    }
  });
});

describe('recipeInputsBlock', () => {
  it('composes the material block with the output steer', () => {
    const r = getPromptRecipe('personal-story')!;
    const block = recipeInputsBlock(r, {
      story: 'Found the field trip form in the trash on Tuesday.',
    });
    expect(block).toContain('User-supplied material');
    expect(block).toContain('- Your story in 2-3 sentences');
    expect(block).toContain('the narrative spine');
    expect(block).toContain('"Found the field trip form in the trash on Tuesday."');
  });

  it('skips empty values and returns empty when nothing is filled', () => {
    const r = getPromptRecipe('journey-flex')!;
    expect(recipeInputsBlock(r, {})).toBe('');
    expect(recipeInputsBlock(r, { from: '   ' })).toBe('');
    expect(recipeInputsBlock(r, null)).toBe('');
    const partial = recipeInputsBlock(r, { to: 'One page, 20 minutes a week.' });
    expect(partial).toContain('- The impressive after (2-3 receipts)');
    expect(partial).not.toContain('crappy before');
  });

  it('returns empty for recipes with no inputs declared', () => {
    const r = getPromptRecipe('headline-list')!;
    expect(r.inputs?.length ?? 0).toBe(0);
    expect(recipeInputsBlock(r, { story: 'anything' })).toBe('');
  });

  it('collapses multiline input into one injected line', () => {
    const r = getPromptRecipe('personal-story')!;
    const block = recipeInputsBlock(r, { story: 'line one\nline two' });
    expect(block).toContain('"line one line two"');
    expect(block).not.toContain('\nline two');
  });
});

describe('promptBankStore inputs round-trip', () => {
  it('inputs survive recipeToRow -> rowToRecipe', () => {
    const seed = getPromptRecipe('personal-story')!;
    expect(seed.inputs?.length).toBeGreaterThan(0);
    const row = recipeToRow(seed, 0);
    expect(row.inputs).toEqual(seed.inputs);
    const back = rowToRecipe(row);
    expect(back.inputs).toEqual(seed.inputs);
  });

  it('malformed input defs drop out at the row boundary', () => {
    const seed = getPromptRecipe('brag')!;
    const row = {
      ...recipeToRow(seed, 0),
      inputs: [
        { id: 'ok', label: 'A real field' },
        { id: '', label: 'missing id' },
        { id: 'nolabel' },
        'junk',
        null,
      ] as never,
    };
    const back = rowToRecipe(row);
    expect(back.inputs).toEqual([{ id: 'ok', label: 'A real field' }]);
  });
});
