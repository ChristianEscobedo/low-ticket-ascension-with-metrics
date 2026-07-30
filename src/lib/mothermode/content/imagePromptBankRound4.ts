/**
 * Image prompt bank, round 4: the TikTok cover sub-bank, the missing cover
 * bank from the roadmap. Eight cover frameworks for the 9:16 vertical feed,
 * merged into IMAGE_PROMPT_RECIPES in imagePromptBank.ts. Same rules as the
 * earlier rounds: renders stay clean of baked-in text (the overlay editor
 * adds the cover title later, so every framework is a type-ready
 * composition with a protected safe zone), faces stay off, palette stays
 * warm bone / deep aubergine / aged brass.
 *
 * TikTok chrome note: covers render behind the app's UI, so every recipe
 * keeps the bottom quarter (caption + follow chrome) and the right rail
 * (action icons) quiet and low-detail. The title zone lives upper-middle
 * left; the overlay editor owns the words.
 */
import type { PromptRecipe } from './promptBank';

const I = (
  r: Omit<PromptRecipe, 'group' | 'builtin'>,
): PromptRecipe => ({ ...r, group: 'image', builtin: true });

export const IMAGE_PROMPT_RECIPES_ROUND4: PromptRecipe[] = [
  I({
    id: 'ttimg-cover-title-field',
    label: 'TT cover: Title field',
    hint: 'Calm scene built for one big line',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'The cover is the title card of the For You page: a calm frame with a huge clean type zone lets the title shout without any visual competition.',
      'Title-led covers are the highest-tap structure for value content because the promise is readable before the video even buffers.',
      'One render serves unlimited title tests, which makes this the workhorse cover for a daily posting rhythm.',
    ],
    template: [
      '{CalmField: a warm plaster wall, a linen-draped table, soft morning light on oak} filling the frame, {Treatment: slightly out of focus, even tone}.',
      '',
      'One small anchor object at {Placement: lower left third}: {Anchor: a brass pen, a ceramic cup, the printed page}.',
      '',
      'The upper two fifths stay smooth and low-contrast for the big cover title. The bottom quarter and right rail stay quiet for the app chrome. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'A warm bone plaster wall in soft morning light filling the frame, slightly out of focus, a single brass pen resting on a small oak ledge in the lower left third, the upper half smooth and even for a large cover title, the bottom quarter empty and quiet. Minimal, warm, editorial, no text.',
      'Soft aubergine linen draped over a table, gentle folds catching window light, a small ceramic espresso cup at the lower left, vast even space above for bold title type, the right edge calm and dark. Quiet premium still life, no text.',
    ],
    craft: [
      'The field IS the cover: one texture, one tone family, one tiny anchor. Anything busier fights the title the overlay adds.',
      'The upper two fifths must hold 5 words of bold type at 1080 pixels with total legibility. The bottom quarter and the right rail stay low-detail because the app chrome sits there.',
      'Lock the palette to bone, aubergine, brass. No text, no lettering, no logos in the render.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    sizePresetIds: ['ig-fb-story'],
  }),

  I({
    id: 'ttimg-series-hero',
    label: 'TT cover: Series hero',
    hint: 'Same object, same frame, every episode',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Series are the follow engine on TikTok, and a consistent cover hero (same object, same composition) is what makes a series recognizable at a glance on the profile grid.',
      'Repetition compounds: by episode three the cover itself is the brand, and the grid reads as a collection worth bingeing.',
      'A locked composition with one variable zone (the episode-safe band) produces a week of covers from a single art direction.',
    ],
    template: [
      '{TheHeroObject: the printed page, the brass clipboard, the checklist card} in {TheLockedComposition: dead center on warm oak, 45-degree light}, identical every episode.',
      '',
      'A small variable zone at {Zone: the upper band}: clean and even for the episode marker the overlay adds.',
      '',
      'Everything else locked: palette, light, framing. Bottom quarter and right rail quiet for the app chrome. No text, no episode numbers in the render.',
    ].join('\n'),
    exampleHooks: [
      'A printed weekly page in a slim brass clip, dead center on a warm oak table, 45-degree window light, identical framing every time, the upper band smooth and even for an episode marker, the lower quarter quiet. Series-locked, warm bone and brass, no text.',
      'A brass clipboard holding a blank checklist card on deep aubergine seamless, same centered composition and soft shadow as always, clean even space across the top for the episode tag, right edge calm. The repeatable series cover, no text.',
    ],
    craft: [
      'Lock the composition and never move it: same hero object, same surface, same light direction, same crop. The series recognition lives in the repetition.',
      'The only variable is the overlay: a small clean band for the episode marker. No numbers or words baked into the render.',
      'Keep the bottom quarter and right rail quiet for the chrome. One render style, infinite episodes.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    sizePresetIds: ['ig-fb-story'],
  }),

  I({
    id: 'ttimg-split-before-after',
    label: 'TT cover: Before-after split',
    hint: 'Chaos on top, calm below',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A horizontal split uses the 9:16 frame the way the feed gives it: before on top, after below, the transformation read in half a second.',
      'The tap motivation is built in: the viewer wants the method that moves her from the top half to the bottom half.',
      'Transformation covers are the most saved cover type in the routine niche, and covers drive profile visits the video alone cannot.',
    ],
    template: [
      'Horizontal split of {TheSameScene: the kitchen table, the desk, the fridge door}, divided at {DividingLine: the middle third, a brass rule, a fold of linen}.',
      '',
      'Top (before): {TheChaos: the paper storm, the cluttered counter, cold coffee}. Bottom (after): {TheCalm: one page, one pen, warm light}.',
      '',
      'Same light family across both halves so the difference reads as method. The dividing band stays clean for the overlay line. Bottom quarter and right rail quiet. No text, no arrows.',
    ].join('\n'),
    exampleHooks: [
      'A horizontal split of the same kitchen table: top half buried under school forms and a cold coffee, bottom half cleared to one printed page and a fresh cup, a fold of linen as the dividing line, same window light across both, the middle band clean for a cover line. Warm bone palette, honest and calm, no text.',
      'Before-after on a desk, split at the middle third by a brass ruler: above, a storm of sticky notes and stacked notebooks; below, a single checklist card and a closed laptop, same soft evening light on both halves. The transformation, wordless, no text.',
    ],
    craft: [
      'Mirror the scene exactly across the split: same surface, same light family, same props family. Order is the only variable, which is what makes the after believable.',
      'The dividing band doubles as the title zone, so keep it clean and even. Bottom quarter and right rail stay quiet for the app chrome.',
      'The before is honest clutter, never staged disaster; the after is achievable calm, never a magazine set. No text, no labels, no arrows baked in.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    sizePresetIds: ['ig-fb-story'],
  }),

  I({
    id: 'ttimg-object-story',
    label: 'TT cover: The telling object',
    hint: 'One prop says what the video is about',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A single object that carries the whole story (the crumpled form, the ticked page, the abandoned planner) stops the scroll because the brain wants the story behind it.',
      'Object-led covers let every viewer project her own version, which is relatability a face would block.',
      'One prop plus calm space reads instantly at grid size, where covers are actually chosen.',
    ],
    template: [
      '{TheTellingObject: the crumpled permission slip, the ticked weekly page, the cold coffee beside a finished list} at {Position: center or upper third} on {Surface: warm oak, linen, aubergine seamless}.',
      '',
      'One supporting trace at most: {Trace: a brass pen, a school backpack strap at the frame edge}.',
      '',
      'Soft directional light, generous clean space at {Third} for the cover line. Bottom quarter and right rail quiet. No text, no labels on the object.',
    ].join('\n'),
    exampleHooks: [
      'A crumpled permission slip smoothed flat on warm oak, one corner still curled, a brass pen resting beside it, soft raking window light, the upper third clean and even for a cover line, the lower quarter quiet. The whole story in one object, no text.',
      'A ticked weekly page on deep aubergine seamless, every box checked, a cold coffee just at the frame edge, strong soft light from the left, generous clean space above for the title. Single-object storytelling, premium and calm, no text.',
    ],
    craft: [
      'Exactly one hero object and at most one supporting trace. Two story objects is clutter; the single prop is the headline.',
      'Compose for the grid: the object must read at thumbnail size, so keep shapes bold and the background silent.',
      'Any page content stays abstract (lines, ticks, boxes), never readable words. No text anywhere in the render; the overlay adds the cover line.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    sizePresetIds: ['ig-fb-story'],
  }),

  I({
    id: 'ttimg-hands-mid-method',
    label: 'TT cover: Hands mid-method',
    hint: 'The doing, frozen at the good part',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Hands caught mid-action promise a process, and process covers convert because the viewer taps to see the rest of the move.',
      'The implied motion (pen mid-word, page mid-turn, magnet mid-place) adds energy a still life cannot, without a single face in frame.',
      'Action covers pre-answer "what is this video" in a glance, which filters for the viewer who watches to the end.',
    ],
    template: [
      'Hands {TheAction: mid-word on the weekly page, mid-tick on the checklist, pinning the page to the fridge} caught at the exact moment, {Framing: tight crop, slightly off-center, documentary}.',
      '',
      'The action point is the focal interest: {FocalPoint: the pen tip, the tick landing, the magnet pressing}.',
      '',
      'Natural window light, shallow focus on the action. Clean zone at {Third} for the cover line. Bottom quarter and right rail quiet. No faces, no text.',
    ].join('\n'),
    exampleHooks: [
      'Hands mid-stroke on a weekly page, the pen caught mid-word, sleeve cuff visible, tight documentary crop slightly off-center, soft window light, shallow focus on the pen tip, the upper third clean for a cover line. The method, mid-move, no faces, no text.',
      'Fingers pressing a brass magnet onto a printed page on a fridge, the exact moment of contact, real kitchen blurred behind, natural indoor light, clean space at the top for the title. Caught, not staged, no text.',
    ],
    craft: [
      'Freeze the single most legible moment of the method. One action, one focal point; two actions read as chaos at grid size.',
      'Hands are real and unstyled, sleeves plain, no statement jewelry pulling focus. Faces stay out entirely.',
      'Keep the upper third or left band clean for the overlay title, and the bottom quarter plus right rail quiet for the chrome. No text in the render.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    sizePresetIds: ['ig-fb-story'],
  }),

  I({
    id: 'ttimg-count-row',
    label: 'TT cover: The count row',
    hint: 'Three objects, list rhythm, vertical',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Three ordered objects read as a list before a single word loads, and list covers are the most tapped shape for value content.',
      'A vertical stack uses the 9:16 frame natively: the eye climbs the objects like steps, which buys the extra beat that becomes the tap.',
      'Leaving the numerals to the overlay keeps one render reusable across every numbered video in the series.',
    ],
    template: [
      '{ThreeObjects: the page, the pen, the timer} stacked {Arrangement: top to bottom in a clean column} on {Surface: warm oak, linen, aubergine seamless}.',
      '',
      'The bottom object carries the emphasis: {Emphasis: a brass tick ornament, the only warm light pool, a slightly raised position}.',
      '',
      'Strong simple geometry, clean band at {Third} for the overlay numeral and cover line. Bottom quarter and right rail quiet. No text, no numerals in the render.',
    ].join('\n'),
    exampleHooks: [
      'Three objects in a clean column on warm oak: a printed page at the top, a brass pen in the middle, a small timer at the bottom standing in the only pool of warm light, generous even space along the left for a big overlay numeral, the right edge quiet. List rhythm, vertical, no text.',
      'A checklist card, a coffee cup, and a single magnet stacked top to bottom on deep aubergine seamless, a brass tick ornament resting against the lowest, soft directional light, clean left band for the cover title. Three things, no numerals baked in, no text.',
    ],
    craft: [
      'Exactly three objects in one column, ordered by the list\'s logic. Four is clutter; the rhythm of three is the whole trick.',
      'Give the final object the emphasis so the eye lands where the payoff lives. The overlay carries the numerals and the title; the render stays wordless.',
      'Keep shapes bold enough to read at grid size, and keep the bottom quarter and right rail quiet for the app chrome. No text, no numerals in the render.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    sizePresetIds: ['ig-fb-story'],
  }),

  I({
    id: 'ttimg-quiet-scene',
    label: 'TT cover: The quiet scene',
    hint: 'A still from her movie',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A cinematic quiet moment (the 6 am kitchen, the one lamp at 9 pm) stops the scroll precisely because everything around it is shouting.',
      'Mood covers attract the storytime and confession audience, the highest-completion viewers on the platform.',
      'An empty, warm scene lets her cast herself in the frame, which is the quietest form of relatability a cover can buy.',
    ],
    template: [
      '{TheQuietScene: the kitchen at dawn with one lamp on, the 9pm desk with a warm cup, the parked car at school pickup} shot {Framing: wide with strong negative space, film grain}.',
      '',
      'One motivated light source: {Light: dawn through blinds, the single lamp, dashboard glow}.',
      '',
      'Deep quiet negative space at {Third} for the cover line. Bottom quarter and right rail stay dark and calm for the chrome. No people, no text.',
    ].join('\n'),
    exampleHooks: [
      'A kitchen at 6 am with one lamp on, a notebook open beside a French press, the window still dark, steam curling, shot wide with deep negative space above, film grain, aubergine shadows and warm highlights. A still from her movie, no people, no text.',
      'A desk at 9 pm, one warm lamp pooling light on an open page, a tea cup steaming at the frame edge, the rest falling to soft dark, composed with a calm upper band for a cover line. Cinematic quiet, no people, no text.',
    ],
    craft: [
      'Frame a moment, not a subject: the scene should feel lifted from a film she recognizes as her own. One motivated light source carries all the emotion.',
      'People stay out entirely; she casts herself. The negative space is deliberate: the overlay title needs a calm home.',
      'Grade warm and quiet (bone, brass, soft aubergine shadow) and keep the bottom quarter plus right rail dark and low-detail for the app chrome. No text in the render.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    sizePresetIds: ['ig-fb-story'],
  }),

  I({
    id: 'ttimg-receipt-closeup',
    label: 'TT cover: The receipt close-up',
    hint: 'Proof that fills the frame',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A macro of the evidence (the tally column, the ticked boxes, the circled dates) implies results without a single claim, which is the strongest cover for proof-led videos.',
      'Almost-readable marks trigger lean-in curiosity that clean graphics never do, and lean-in is the tap.',
      'Receipt covers set the documentary tone the video delivers, so the audience arrives pre-trusting.',
    ],
    template: [
      'Macro close-up of {TheEvidence: the tally sheet, the ticked weekly page, the calendar with circled Sundays} filling the frame on {Surface: worn wood, linen, dark oak}.',
      '',
      'Marks are visible but abstract: {Marks: pen ticks, circled dates, a column of checkmarks}.',
      '',
      '{Light: raking window light, soft shadows}, shallow focus pulling to {FocalPoint: the densest column}. Clean quiet band at {Third} for the cover line. No readable words, no logos, no text.',
    ].join('\n'),
    exampleHooks: [
      'Macro close-up of a tally sheet on worn wood, columns of pen tick marks filling the page, a brass pen at the frame edge, raking window light, shallow focus on the densest column, the upper band clean and even for a cover line. Proof, wordless, no readable text.',
      'A calendar page with every Sunday circled in brass-colored pen, shot tight with soft shadows, the pattern of circles telling the story, the lower quarter quiet for the chrome. The receipt as the cover, no readable words, no text.',
    ],
    craft: [
      'The evidence fills the frame; proof feels closer when it is big. One clear focal point (the densest column, the last tick) anchors the macro.',
      'Every mark stays abstract (ticks, circles, lines) so nothing is literally readable; the overlay and the video supply the words.',
      'Keep one band clean for the cover line and the bottom quarter plus right rail quiet for the chrome. No readable text, no logos in the render.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    sizePresetIds: ['ig-fb-story'],
  }),
];
