/**
 * The MotherMode prompt bank: A-level, platform-specific post frameworks that
 * power every text generator in the content hub. Each recipe mirrors the
 * owner's Notion bank structure (why it works, template with {Slots},
 * examples) and adds a `craft` block of direct generation orders plus
 * per-platform adaptation notes, all pre-fitted to the MotherMode voice
 * (calibration after bold claims, permission close, no NO-list words, no em
 * dashes, soft CTA).
 *
 * Client-safe: the Generate drawer, the admin Prompt Bank editor, and the
 * server generators all share this registry. Database rows (see
 * promptBankStore.ts) override or extend these seeds at resolve time, so every
 * recipe here is the version-controlled default, never the only copy.
 */
import type { ContentFormat, ContentKind, ContentPlatform } from './types';
import { PROMPT_RECIPES_ROUND2 } from './promptBankRound2';
import { PROMPT_RECIPES_ROUND3 } from './promptBankRound3';
import { PROMPT_RECIPES_ROUND4 } from './promptBankRound4';
import { PROMPT_RECIPES_ROUND5 } from './promptBankRound5';

/** The engagement job a framework is best at. Shown in editors, used for variety. */
export type RecipeGoal = 'replies' | 'saves' | 'shares' | 'follows' | 'clicks';

/**
 * Frameworks are viral post structures. Styles (promptStyles.ts) are voices.
 * Image recipes (imagePromptBank.ts) are visual creative frameworks: same
 * shape, but the template is an image-generation skeleton and the craft is
 * art direction.
 */
export type RecipeGroup = 'framework' | 'style' | 'image';

/**
 * A custom input field on a recipe: extended context the admin fills in at
 * generation time (Test lab, or an explicit pick in the Generate drawer) so
 * the output grounds in real material instead of invented specifics. Example:
 * a personal-story recipe asks "Your story in 2-3 sentences". Values are
 * always optional; empty fields fall back to the model inventing from the
 * offer facts, and Auto rotation runs never carry them.
 */
export interface RecipeInputField {
  /** Stable field id, unique within the recipe, e.g. 'story'. */
  id: string;
  /** The ask, shown as the field label, e.g. 'Your story in 2-3 sentences'. */
  label: string;
  /** Example answer shown as the placeholder (steers the admin, never sent). */
  placeholder?: string;
  /** How the model should use the value (the output-context steer). */
  hint?: string;
  /** When true, UIs mark the field as expected (never hard-blocked). */
  required?: boolean;
}

/** One programmable prompt recipe. */
export interface PromptRecipe {
  /** Stable slug, shared namespace with prompt style ids. */
  id: string;
  label: string;
  /** One-line hint under the chip. */
  hint: string;
  group: RecipeGroup;
  /** Primary engagement job. */
  goal: RecipeGoal;
  /** Why it performs, in plain bullets (the Notion "Why it works" section). */
  whyItWorks: string[];
  /**
   * The fill-in skeleton with {Slot} placeholders, exactly like the Notion
   * bank. Injected into prompts so the model executes a proven structure
   * instead of free-styling.
   */
  template: string;
  /** MotherMode-adapted exemplar openers. Steer the model, never copied. */
  exampleHooks: string[];
  /** Generation orders. Voice rules still win over these. */
  craft: string;
  /** Platforms this recipe is especially strong on. Empty = any. */
  platforms: ContentPlatform[];
  /** Formats this recipe is especially strong on. Empty = any. */
  formats: ContentFormat[];
  /**
   * Organic vs paid placement. Set on image recipes (ad creative vs organic
   * image) and ad-copy frameworks; undefined on organic text frameworks.
   */
  kind?: ContentKind;
  /**
   * Platform size preset ids (platformSizes.ts) an image recipe renders at.
   * Only meaningful for image-group recipes.
   */
  sizePresetIds?: string[];
  /** Per-platform execution notes, appended when generating for that channel. */
  platformNotes?: Partial<Record<ContentPlatform, string>>;
  /** Reference posts the recipe was reverse-engineered from (review UI only). */
  sourceUrls?: string[];
  /**
   * Custom input fields the admin fills in for extended input/output context
   * (story, lesson, receipts, scene). Undefined/empty = the recipe runs
   * fully from the offer facts, as before.
   */
  inputs?: RecipeInputField[];
  /** True when shipped in the code registry. DB rows mark builtin=false. */
  builtin: boolean;
  /**
   * On/off switch, driven by the database override. Undefined means enabled
   * (every code seed is on). Disabled recipes stay visible in the admin editor
   * but never reach generators or the Generate drawer.
   */
  enabled?: boolean;
}


const F = (
  r: Omit<PromptRecipe, 'group' | 'builtin'>,
): PromptRecipe => ({ ...r, group: 'framework', builtin: true });

/**
 * The bank. Order matters: it is the default rotation order for Auto batches,
 * tuned so a 5-piece batch always mixes story, authority, engagement, proof,
 * and reframe structures.
 */
export const PROMPT_RECIPES: PromptRecipe[] = [
  F({
    id: 'personal-story',
    label: 'Personal story',
    hint: 'Narrative arc that earns the lesson',
    goal: 'follows',
    whyItWorks: [
      'Stories are the highest-trust format on any feed. People follow people, not tips.',
      'A specific scene makes the reader feel the point before she is told the point.',
      'Vulnerability plus competence is the strongest follow trigger there is.',
    ],
    template: [
      '{ColdOpenScene: one concrete moment, time and place}.',
      '',
      '{WhatHappened: 2-4 short lines that raise the stakes}.',
      '',
      '{TurningPoint: the realization, one line}.',
      '',
      '{Lesson: what it taught you, told as a reframe}.',
      '',
      '{BridgeToReader: why this is about her, not you}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'Last Tuesday at 7:48 pm I found the field trip form. In the trash. Signed by nobody.',
      'I used to keep 40 tabs open in my head and call it being a good mother.',
    ],
    craft: [
      'Tell ONE story, not a medley. Cold open on a concrete scene with a time, a place, and an object.',
      'Raise stakes with specifics, then land the turning point in a single line.',
      'The lesson is a reframe (the system, not her character). Bridge to the reader before any CTA.',
      'Calibrate any bold claim within 1-2 sentences. Permission close, soft CTA.',
    ].join(' '),
    inputs: [
      {
        id: 'story',
        label: 'Your story in 2-3 sentences',
        placeholder: 'The scene (time, place, object), what happened, and what it taught you.',
        hint: 'the narrative spine. Retell this story, never invent a different one',
        required: true,
      },
    ],
    platforms: ['x', 'instagram', 'facebook', 'linkedin', 'email', 'youtube', 'blog'],
    formats: ['feed', 'thread', 'email', 'article', 'long', 'blog'],
    platformNotes: {
      x: 'As a thread: one beat per post, the cold open stands alone as post 1, the lesson lands in the second-to-last post, soft CTA last.',
      youtube: 'Long-form: the cold open is the first 30 seconds, story beats become chapters, the lesson is the closing reframe.',
      blog: 'Full narrative essay: scene-led opening, the turning point as a subhead, the lesson as the takeaway section.',

      instagram: 'Caption-first: the hook line must work above the fold, then line breaks every 1-2 sentences.',
      facebook: 'Warm and longer. Skimmable line breaks. Works as a colorblock when the cold open is under 130 characters.',
      linkedin: 'Professional frame: the lesson ties to work, leadership, or capacity. No melodrama, calm credibility.',
    },
  }),

  F({
    id: 'headline-list',
    label: 'Headline + list',
    hint: 'Bold claim, then the list that proves it',
    goal: 'saves',
    whyItWorks: [
      'A strong headline earns the stop, the list earns the save.',
      'Lists promise a payoff per line, so readers stay to the end.',
      'Save rates signal quality to every algorithm and compound reach.',
    ],
    template: [
      '{Headline: bold claim or numbered promise}',
      '',
      '1. {Item: specific, visual, one or two lines}',
      '2. {Item}',
      '3. {Item}',
      '...',
      '',
      '{Closer: the reframe that makes the list mean something}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      '11 things running a house actually involves, for anyone who has never done it.',
      'The invisible list: 9 jobs she did today before 9 am.',
    ],
    craft: [
      'Headline makes one bold, true, specific claim or numbered promise. No clickbait she cannot cash.',
      'Every list item is concrete and visual, never abstract advice. Odd numbers read as more honest.',
      'Order items so the most surprising one lands around 60% through. Close with the reframe, then a soft CTA.',
    ].join(' '),
    platforms: ['x', 'instagram', 'facebook', 'linkedin', 'pinterest'],
    formats: ['feed', 'thread', 'carousel', 'pin', 'idea'],
    platformNotes: {
      x: 'One item per post in a thread. Post 1 is the headline alone.',
      instagram: 'As a carousel: headline on slide 1, one item per slide, reframe + soft CTA on the last slide.',
      linkedin: 'Tie the list to capacity, leadership, or the economics of unpaid labor. Numbered lines, generous white space.',
      pinterest: 'Keyword-rich headline, the list teaches, caption carries the search terms.',
    },
  }),

  F({
    id: 'actionable-authority',
    label: 'Highly actionable',
    hint: 'A method she can run tonight',
    goal: 'saves',
    whyItWorks: [
      'Usable advice is the most saved and shared content type, period.',
      'Teaching one real method proves authority better than any claim about it.',
      'A reader who gets a result for free trusts the paid system instantly.',
    ],
    template: [
      '{ProblemInOneLine}',
      '',
      'Here is exactly how to {DesiredOutcome} ({TimeCost}):',
      '',
      '1. {Step: verb first, specific}',
      '2. {Step}',
      '3. {Step}',
      '',
      '{ExpectedResult: what changes and when}.',
      '{SoftCTA: the system does this for you}',
    ].join('\n'),
    exampleHooks: [
      'The 20-minute Sunday download that ends the 3 am remembering.',
      'Do this at 5 pm and the witching hour loses its teeth.',
    ],
    craft: [
      'Teach ONE micro-method with steps she can execute tonight. Verb-first steps, concrete tools and times.',
      'No blank-page advice. Each step includes the how, not just the what.',
      'Free action first, paid system second: the offer automates or holds the method, and says so in one line.',
    ].join(' '),
    platforms: ['x', 'instagram', 'facebook', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'blog', 'aeo'],
    formats: ['feed', 'thread', 'carousel', 'video', 'reel', 'pin', 'idea', 'long', 'blog', 'answer'],
    platformNotes: {
      tiktok: 'Spoken steps, one per beat, text overlay carries the step number. Hook names the outcome in under 3 seconds.',
      x: 'Thread: step per post. Post 1 is the problem line plus the promise.',
      pinterest: 'Teach fully in the pin copy. Search terms in the first sentence.',
      aeo: 'As an answer page: the problem line becomes the H1 question, each step a citable short answer block.',
    },
  }),


  F({
    id: 'questions-proof',
    label: 'Question + proof',
    hint: 'Her 11pm question, answered with receipts',
    goal: 'replies',
    whyItWorks: [
      'A question she has asked herself stops the scroll better than any statement.',
      'Questions invite replies, and replies are the strongest ranking signal.',
      'Answering with proof (numbers, receipts, results) quietly flexes credibility.',
    ],
    template: [
      '{Question: the one she asks herself at 11pm}?',
      '',
      '{ProofLine: the number, result, or receipt that answers it}.',
      '',
      '{ShortTake: 2-4 lines of what the proof actually means}.',
      '',
      '{QuestionBack: invite her answer in the replies}.',
    ].join('\n'),
    exampleHooks: [
      'What does it actually cost when she holds the whole house in her head?',
      'How many decisions did you make before coffee? We counted.',
    ],
    craft: [
      'Open with the question verbatim as the hook. It must be a question she has actually asked, not a rhetorical device.',
      'Answer with proof: a number, a count, a result. Bragging belongs here, calibrated and factual.',
      'End with a genuine question back that is easy to answer. Reply bait, not engagement bait.',
    ].join(' '),
    platforms: ['x', 'facebook', 'instagram', 'linkedin'],
    formats: ['feed', 'colorblock', 'thread'],
    platformNotes: {
      facebook: 'As a colorblock: the question alone on the block, under 130 characters, proof in the caption or comments.',
      x: 'Single post when the proof fits. Extend to a thread only if the take needs room.',
      linkedin: 'Frame the proof as data or a pattern observed across many mothers. Credible, calm.',
    },
  }),

  F({
    id: 'challenge-beliefs',
    label: 'Challenge a belief',
    hint: 'The opposite of the script is true',
    goal: 'replies',
    whyItWorks: [
      'Contrarian truths create instant tension, and tension creates comments.',
      'Naming the script she has been handed makes her feel seen and a little angry on her own behalf.',
      'Positions the brand as the one willing to say the true thing.',
    ],
    template: [
      'Most people believe {CommonBelief}.',
      '',
      'The opposite is closer to the truth: {ContrarianTake}.',
      '',
      '{Reasoning: 2-5 lines, evidence and mechanism, not just attitude}.',
      '',
      '{WhoItServes: who profits from her believing the script}.',
      '{PermissionClose}',
    ].join('\n'),
    exampleHooks: [
      'She does not need more patience. She needs less to hold.',
      'The mental load is not a mindset problem. Calling it one is the problem.',
    ],
    craft: [
      'Name the cultural script precisely, then flip it. Bold claim, immediate calibration.',
      'Give the mechanism: why the opposite is true, in evidence and structure, not attitude.',
      'Enemy is the system, never partners or other mothers. Permission close, never fear.',
    ].join(' '),
    inputs: [
      {
        id: 'belief',
        label: 'The belief to flip',
        placeholder: 'The script most people believe, stated precisely.',
        hint: 'the common belief. Name it precisely before the flip',
        required: true,
      },
      {
        id: 'take',
        label: 'Why the opposite is true (the mechanism)',
        placeholder: 'The evidence and structure behind your contrarian take, not just the attitude.',
        hint: 'the reasoning. Mechanism over attitude, so the take survives replies',
      },
    ],
    platforms: ['x', 'linkedin', 'facebook', 'instagram', 'tiktok'],
    formats: ['feed', 'thread', 'colorblock', 'video', 'reel'],
    platformNotes: {
      x: 'The flip lands in post 1. Reasoning follows in the thread. Expect replies, so the take must be defensible.',
      tiktok: 'Spoken hot take, direct to camera, calm not ranty. Text overlay carries the flipped claim.',
      linkedin: 'Contrarian but credentialed. The reasoning section does the heavy lifting.',
    },
  }),

  F({
    id: 'normalize-x',
    label: "It's okay to... (Normalize X)",
    hint: 'Permission for the taboo truth',
    goal: 'shares',
    whyItWorks: [
      'Permission content is the most shared content among mothers, full stop.',
      'Normalizing a taboo truth makes her feel less alone, and she sends it to the friend who needs it.',
      'Low effort to read, high emotional payoff, instant share.',
    ],
    template: [
      'It is okay to {TabooButTrue}.',
      '',
      'It is okay to {SecondPermission}.',
      'It is okay to {ThirdPermission}.',
      '',
      '{TheReason: why the guilt was never hers to carry}.',
      '',
      '{ClosingPermission: the one she most needed to hear}.',
    ].join('\n'),
    exampleHooks: [
      'It is okay to want to be alone more than you want to be needed.',
      'It is okay to buy the system instead of loving the chaos.',
    ],
    craft: [
      'Stack 2-4 permissions, each specific and slightly taboo, never generic wellness permission slips.',
      'Then the reframe: the guilt is manufactured by a system that runs on her free labor.',
      'Close on the strongest permission. Soft CTA only if it feels earned, otherwise end clean.',
    ].join(' '),
    inputs: [
      {
        id: 'permissions',
        label: 'The taboo-but-true permissions to normalize (2-4)',
        placeholder: 'Each one specific and slightly taboo, strongest last.',
        hint: 'the permission stack. Specific and slightly taboo, never generic wellness slips',
        required: true,
      },
    ],
    platforms: ['x', 'instagram', 'facebook', 'tiktok'],
    formats: ['feed', 'colorblock', 'thread', 'carousel', 'video', 'reel'],
    platformNotes: {
      facebook: 'Perfect colorblock: the strongest single permission, alone, under 130 characters.',
      instagram: 'Carousel: one permission per slide, reason slide, closing permission, quiet CTA.',
      x: 'Single posts travel best here. Pick the spiciest permission and let replies do the rest.',
    },
    sourceUrls: ['https://twitter.com/thedankoe/status/1345408093665046528?s=20'],
  }),

  F({
    id: 'brag',
    label: 'Brag (humble or blunt)',
    hint: 'Receipts, calibrated',
    goal: 'follows',
    whyItWorks: [
      'Proof of results is the fastest trust builder on any platform.',
      'A calibrated flex reads as confidence, a blunt one reads as authority. Both convert to follows.',
      'People benchmark themselves against receipts, which drives saves and profile visits.',
    ],
    template: [
      '{Receipt: the number or result, stated plainly}.',
      '',
      '{TheWork: what it actually took, 2-3 lines, no glory}.',
      '',
      '{TheLesson: the transferable part}.',
      '',
      '{Calibration: who helped, what luck played, what it cost}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      '47,000 mothers read the page last month. Here is the part nobody screenshots.',
      'We rebuilt one Sunday routine and gave 6 hours back a week. Blunt version: the system works.',
    ],
    craft: [
      'Lead with the receipt: number, result, outcome. Plain statement, no fanfare.',
      'Then show the work and the cost, so the flex reads honest. Calibrate within 1-2 sentences.',
      'Extract the transferable lesson so the post gives value, not just status.',
    ].join(' '),
    inputs: [
      {
        id: 'receipt',
        label: 'The receipt to flex',
        placeholder: 'The number, result, or outcome, plus what it actually took and what it cost.',
        hint: 'the flex and the work. Plain statement, then the honest cost',
        required: true,
      },
    ],
    platforms: ['x', 'linkedin', 'instagram', 'facebook'],
    formats: ['feed', 'thread', 'colorblock'],
    platformNotes: {
      x: 'Blunt version travels: receipt as the whole first post, story in the thread.',
      linkedin: 'Humble version: lesson-first framing, receipt in the middle, gratitude without theater.',
      facebook: 'Colorblock: the receipt line alone, story in the comments.',
    },
  }),

  F({
    id: 'confident-directive',
    label: 'Confident directive',
    hint: 'Tell her what to do, no hedging',
    goal: 'saves',
    whyItWorks: [
      'Decision fatigue makes direct instruction a relief, not an imposition.',
      'Confidence signals competence. Hedged advice gets scrolled past.',
      'Imperative posts get saved because they read as instructions to keep.',
    ],
    template: [
      '{Directive: verb first, one line}.',
      '',
      '{Why: the reason in one or two lines}.',
      '',
      '{How: the exact first move}.',
      '',
      '{WhatToIgnore: the advice to drop}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'Stop keeping the list in your head. Tonight, put it on one page.',
      'Buy the bins. Cancel the system you keep failing. Read that again.',
    ],
    craft: [
      'Open with a verb. No "you might want to", no "consider". Direct address, calm authority.',
      'One directive per post. Give the why in a breath, the exact first move, and the popular advice to drop.',
      'Never bossy about her life, only bossy about the method. Warm spine, steel core.',
    ].join(' '),
    platforms: ['x', 'instagram', 'facebook', 'linkedin'],
    formats: ['feed', 'colorblock', 'thread', 'carousel'],
    platformNotes: {
      facebook: 'Colorblock: the directive alone, under 130 characters.',
      x: 'The directive is post 1. The why and how are posts 2 and 3.',
    },
  }),

  F({
    id: 'feel-good',
    label: 'Make her feel good',
    hint: 'Validation she screenshots',
    goal: 'shares',
    whyItWorks: [
      'Feeling seen is the emotion most likely to make her share and tag.',
      'Validation content gets saved and re-read, which trains the algorithm toward you.',
      'It builds the parasocial trust that every other framework then cashes in.',
    ],
    template: [
      '{Observation: the unseen thing she did today, described precisely}.',
      '',
      '{Naming: what that actually is, and why it counts}.',
      '',
      '{Absolution: she is not behind, failing, or lazy}.',
      '',
      '{OneLine: the sentence she will screenshot}.',
    ].join('\n'),
    exampleHooks: [
      'Nobody claps when the permission slips get signed. This is the clap.',
      'You carried a whole small economy today and called it nothing.',
    ],
    craft: [
      'Describe the invisible work so precisely she feels watched over, not watched.',
      'Name it as real labor with real weight. Absolve without patronizing.',
      'Land one screenshotable line. No CTA at all, or the softest possible one.',
    ].join(' '),
    platforms: ['instagram', 'facebook', 'x', 'tiktok'],
    formats: ['feed', 'colorblock', 'carousel', 'video', 'reel', 'story'],
    platformNotes: {
      facebook: 'Colorblock: the screenshotable line alone.',
      instagram: 'Text-forward graphic or carousel. Share-to-a-friend energy in the caption.',
      tiktok: 'Spoken word over quiet b-roll. Slow. This is the one format that should feel like a hand on her shoulder.',
    },
  }),

  F({
    id: 'comparison',
    label: 'Comparison',
    hint: 'X vs Y through a sharp lens',
    goal: 'shares',
    whyItWorks: [
      'Contrast is the fastest way to make an abstract difference concrete.',
      'Readers use comparisons to explain their own lives, so they share them as proxies.',
      'Side-by-side structure is instantly skimmable and endlessly remixed.',
    ],
    template: [
      '{ThingA} vs {ThingB}:',
      '',
      '{ThingA}: {LineThatNailsIt}',
      '{ThingB}: {LineThatNailsIt}',
      '',
      '{ThingA}: {SecondLine}',
      '{ThingB}: {SecondLine}',
      '',
      '{ThePoint: the difference that changes everything}.',
    ].join('\n'),
    exampleHooks: [
      'A planner vs a place to put it all down.',
      'Managing the house vs carrying the house. They are not the same job.',
    ],
    craft: [
      'Pick two things she has been told are the same and split them cleanly.',
      'Parallel construction, line for line. Each pair should sting a little with recognition.',
      'End on the difference that reframes, then a soft CTA if one fits.',
    ].join(' '),
    platforms: ['x', 'instagram', 'facebook', 'linkedin'],
    formats: ['feed', 'thread', 'carousel', 'colorblock'],
    platformNotes: {
      instagram: 'Carousel: one A/B pair per slide, the point on the last slide.',
      x: 'Single post when the pairs fit. The first pair must be the strongest.',
    },
  }),

  F({
    id: 'do-this-not-that',
    label: 'Do this, not that',
    hint: 'Swap the failing move',
    goal: 'saves',
    whyItWorks: [
      'Correction content performs because it promises an instant upgrade.',
      'The not-that names what she is already doing, which feels personal and stops the scroll.',
      'Actionable both ways: she learns what to drop and what to pick up.',
    ],
    template: [
      'Do {ThisMove}, not {ThatMove}.',
      '',
      'Not: {ThatMove} - {why it quietly fails}',
      'Do: {ThisMove} - {why it works and the first step}',
      '',
      '(repeat pairs 2-4 more times)',
      '',
      '{ThePattern: the rule underneath all the pairs}.',
    ].join('\n'),
    exampleHooks: [
      'Do a 20-minute download on Sunday, not a perfect weekly reset you quit by Wednesday.',
      'Do one page everyone can see, not six apps only she checks.',
    ],
    craft: [
      '3-5 pairs, each a real swap she can make this week. The not-that is a popular move, never a strawman.',
      'Keep the tone of a friend correcting a recipe, not a guru correcting a life.',
      'Close with the pattern underneath the pairs, the transferable rule.',
    ].join(' '),
    platforms: ['x', 'instagram', 'facebook', 'pinterest', 'linkedin'],
    formats: ['feed', 'thread', 'carousel', 'pin', 'idea'],
    platformNotes: {
      instagram: 'Carousel: one pair per slide, Do in bold, Not in quieter type.',
      pinterest: 'The pairs teach in the pin copy. Strong search fit.',
    },
  }),

  F({
    id: 'formula',
    label: 'The formula for X',
    hint: 'Outcome = a + b + c',
    goal: 'saves',
    whyItWorks: [
      'Formulas compress complexity into something she can hold, which gets saved.',
      'Naming the ingredients in order implies a system, and systems sell.',
      'The equation format is a pattern interrupt on a feed of paragraphs.',
    ],
    template: [
      '{DesiredOutcome} =',
      '',
      '{Ingredient1}',
      '+ {Ingredient2}',
      '+ {Ingredient3}',
      '',
      '{OneLinePerIngredient: what each actually means in practice}.',
      '',
      '{MissingIngredient: the one everyone skips, which is the point}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'A calm Sunday = a 20-minute download + one page everyone can see + 3 decisions made early.',
      'The formula for never dropping the ball: fewer balls, named owners, a place the list lives.',
    ],
    craft: [
      'State the equation first, exactly as an equation. Then unpack each ingredient in one honest line.',
      'Include the ingredient everyone skips and make it the point of the post.',
      'The formula must survive scrutiny. No fake math, no mystical ingredients.',
    ].join(' '),
    platforms: ['x', 'instagram', 'linkedin', 'facebook', 'pinterest'],
    formats: ['feed', 'thread', 'carousel', 'colorblock', 'pin'],
    platformNotes: {
      facebook: 'Colorblock: the equation alone if it fits under 130 characters.',
      instagram: 'Carousel: equation on slide 1, ingredient per slide, missing ingredient last before the CTA.',
    },
  }),

  F({
    id: 'pareto',
    label: '80/20 rule',
    hint: 'The 20% that carries 80%',
    goal: 'saves',
    whyItWorks: [
      'Overwhelmed readers want permission to do less. The 80/20 frame is that permission with proof.',
      'Cut-list content (what to drop) outperforms add-more content with this audience.',
      'It reframes the offer as leverage, not another task.',
    ],
    template: [
      'The 20% of {Domain} that produces 80% of {Result}:',
      '',
      '1. {VitalFew: the move that carries the most weight}',
      '2. {VitalFew}',
      '3. {VitalFew}',
      '',
      'The 80% you can drop without anyone noticing:',
      '',
      '- {TrivialMany}',
      '- {TrivialMany}',
      '',
      '{Reframe: doing less of the wrong things beats doing more of anything}.',
    ].join('\n'),
    exampleHooks: [
      'Only 3 Sunday decisions carry the whole week. The rest is noise.',
      'She can drop 80% of the mental tabs. Here is the 20% that must stay open.',
    ],
    craft: [
      'Name the vital few first, precisely. Then the trivial many she has permission to drop.',
      'The drop list is the emotional payload. Make each item a relief.',
      'Tie the close to the mechanism: a system holds the vital few so her head does not have to.',
    ].join(' '),
    platforms: ['x', 'instagram', 'facebook', 'linkedin', 'pinterest'],
    formats: ['feed', 'thread', 'carousel', 'pin'],
  }),

  F({
    id: 'analogy',
    label: 'Analogy',
    hint: 'The invisible made familiar',
    goal: 'shares',
    whyItWorks: [
      'Analogies let her finally explain the invisible thing to people who do not feel it.',
      'A great analogy is infinitely quotable, which makes it infinitely shareable.',
      'It teaches without lecturing, so defenses stay down.',
    ],
    template: [
      '{InvisibleThing} is like {EverydayThing}.',
      '',
      '{Parallel1: the everyday version she already understands}.',
      '{Parallel2: the matching invisible version}.',
      '',
      '{Parallel3: push the analogy one step further than expected}.',
      '',
      '{Reframe: what this makes undeniable}.',
    ].join('\n'),
    exampleHooks: [
      'The mental load is like running a restaurant where you are the chef, the host, and the reservation book.',
      'Her head is a browser with 40 tabs and one of them is playing music.',
    ],
    craft: [
      'Choose an everyday thing she has felt in her body: a job, a machine, a sport, a shift.',
      'Run the parallels in pairs, everyday then invisible, at least three deep. Push one step past the obvious.',
      'The reframe at the end is what the analogy was always for.',
    ].join(' '),
    inputs: [
      {
        id: 'everyday',
        label: 'The everyday thing to compare it to (optional)',
        placeholder: 'A job, a machine, a sport, a shift she has felt in her body.',
        hint: 'the everyday half. Run the parallels in pairs, push one step past the obvious',
      },
    ],
    platforms: ['x', 'instagram', 'facebook', 'linkedin', 'tiktok'],
    formats: ['feed', 'thread', 'colorblock', 'carousel', 'video', 'reel'],
    platformNotes: {
      tiktok: 'Act out or prop out the everyday half. The closer the prop, the bigger the payoff.',
      facebook: 'Colorblock: the analogy sentence alone, under 130 characters.',
    },
  }),

  F({
    id: 'current-events',
    label: 'Current event tie-in',
    hint: 'The moment, through our lens',
    goal: 'shares',
    whyItWorks: [
      'Timeliness borrows attention that is already paid elsewhere.',
      'A niche lens on a big moment positions the brand as the interpreter.',
      'Spikes reach beyond the existing audience, then the profile converts them.',
    ],
    template: [
      '{Event: the thing everyone is talking about, in one line}.',
      '',
      '{TheNicheLens: what it looks like from where mothers stand}.',
      '',
      '{ThePattern: what it proves about the system, not the people}.',
      '',
      '{TheTake: the line they will quote}.',
      '{SoftCTA if earned, else end on the take}',
    ].join('\n'),
    exampleHooks: [
      'Everyone is debating the school calendar again. Nobody is asking who absorbs the gaps.',
      'That viral post about the default parent? The comments are the story.',
    ],
    craft: [
      'Only tie in when the connection is real. Forced newsjacking reads desperate.',
      'Lead with the niche lens, not the event summary. She already saw the event.',
      'The take is structural, never cruel, never punching at individuals.',
    ].join(' '),
    inputs: [
      {
        id: 'event',
        label: 'The event and the angle you see',
        placeholder: 'What everyone is talking about, in one line, plus what it looks like from where mothers stand.',
        hint: 'the moment and the niche lens. Lead with the lens, not the summary',
        required: true,
      },
    ],
    platforms: ['x', 'facebook', 'instagram', 'tiktok', 'linkedin'],
    formats: ['feed', 'thread', 'colorblock', 'video', 'reel'],
  }),

  F({
    id: 'experience-lessons',
    label: 'Experience lessons',
    hint: 'I lived it, here is what counts',
    goal: 'saves',
    whyItWorks: [
      'Lessons from lived time read as earned, and earned advice gets saved.',
      'The number in the hook (years, kids, weeks) sets a concrete credibility bar.',
      'Compresses authority into a list anyone can skim.',
    ],
    template: [
      'I have {LivedTheThing} for {TimePeriod}.',
      '',
      '{N} lessons that actually held up:',
      '',
      '1. {Lesson: stated as a law, not a tip}',
      '2. {Lesson}',
      '3. {Lesson}',
      '',
      '{TheOneThatMatters: expand the strongest lesson in 2-3 lines}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      '4 years of running a house on systems instead of memory. 7 lessons that held up.',
      'I tracked every invisible task for 30 days. Here is what the list taught me.',
    ],
    craft: [
      'Open with the credential: time, reps, or count. Concrete numbers only.',
      'State lessons as laws, each one line, each capable of standing alone as its own post.',
      'Expand the strongest lesson at the end so the post is not only a list.',
    ].join(' '),
    inputs: [
      {
        id: 'experience',
        label: 'The experience (how long, doing what)',
        placeholder: 'e.g. 4 years running a house on systems instead of memory.',
        hint: 'the credential line. Open with it, concrete numbers only',
        required: true,
      },
      {
        id: 'lessons',
        label: 'The lessons that actually held up',
        placeholder: '3-7 one-line lessons, stated as laws, not tips.',
        hint: 'the lesson list. Restate each as a one-line law, expand the strongest',
      },
    ],
    platforms: ['x', 'linkedin', 'facebook', 'instagram'],
    formats: ['feed', 'thread', 'carousel', 'article'],
    platformNotes: {
      x: 'Thread: lesson per post, the expanded lesson in the second-to-last post.',
      linkedin: 'Natural fit. Keep the lessons structural and work-relevant where honest.',
    },
  }),

  F({
    id: 'niched-entertainment',
    label: 'Niched entertainment',
    hint: 'Insider humor only she gets',
    goal: 'shares',
    whyItWorks: [
      'Humor that requires niche knowledge triggers the strongest share reflex: tagging the friend who gets it.',
      'Entertainment content buys attention that value content later spends.',
      'It proves the brand actually lives in her world, which no tip can fake.',
    ],
    template: [
      '{Setup: the painfully specific niche situation}.',
      '',
      '{Escalation: make it more true and more absurd, 2-4 beats}.',
      '',
      '{Punchline: the line that is funny because it is exact}.',
      '',
      '{Wink: one line of warmth so it never reads mean}.',
    ].join('\n'),
    exampleHooks: [
      'Nobody: ... The school app: please download three more apps to read one PDF.',
      'She said she was going to bed early and then remembered the costume, the cupcakes, and the form.',
    ],
    craft: [
      'Be funny by being exact, not by being loud. Specificity is the joke.',
      'Punch at systems and situations (school apps, forms, sign-up sheets), never at partners or mothers.',
      'End with warmth. The wink turns a joke into a share.',
    ].join(' '),
    platforms: ['x', 'instagram', 'facebook', 'tiktok'],
    formats: ['feed', 'colorblock', 'thread', 'video', 'reel', 'slideshow'],
    platformNotes: {
      tiktok: 'POV or skit format. Commit to the bit, keep it under 30 seconds.',
      facebook: 'Colorblock: the setup line alone when it is under 130 characters.',
    },
  }),

  F({
    id: 'journey-flex',
    label: 'How I went from X to Y',
    hint: 'Transformation with receipts',
    goal: 'follows',
    whyItWorks: [
      'Shows that you are an interesting person with an arc, not a content machine.',
      'Gets people invested in your progress and coming back for the next chapter.',
      'Lets you subtly flex accomplishments inside a story, which lands softer and stronger.',
    ],
    template: [
      'How I went from:',
      '',
      '- {CrappyThing1}',
      '- {CrappyThing2}',
      '- {CrappyThing3}',
      '',
      'To:',
      '',
      '- {ImpressiveAccomplishment1}',
      '- {ImpressiveAccomplishment2}',
      '- {ImpressiveAccomplishment3}',
      '',
      '{HereIsMyStory:}',
    ].join('\n'),
    exampleHooks: [
      'How I went from holding the whole house in my head to holding one page.',
      'How MotherMode went from a notes-app rant to 47,000 mothers a month.',
    ],
    craft: [
      'The from-list is specific and slightly embarrassing. The to-list is concrete and countable.',
      'The story section shows the mechanism, not the montage: what actually changed, in order.',
      'Calibrate: name the cost and the help. The flex lands harder when it is honest.',
      'End with the transferable move she can copy, then a soft CTA.',
    ].join(' '),
    inputs: [
      {
        id: 'from',
        label: 'The crappy before (2-3 specifics)',
        placeholder: 'What it looked and felt like before, slightly embarrassing details welcome.',
        hint: 'the from-list. Specific and slightly embarrassing',
        required: true,
      },
      {
        id: 'to',
        label: 'The impressive after (2-3 receipts)',
        placeholder: 'What it looks like now, concrete and countable.',
        hint: 'the to-list. Concrete and countable receipts',
        required: true,
      },
      {
        id: 'turn',
        label: 'What actually changed (the mechanism)',
        placeholder: 'The one move or system that caused the turn, in order.',
        hint: 'the story section. The mechanism, not the montage',
      },
    ],
    platforms: ['x', 'linkedin', 'instagram', 'facebook'],
    formats: ['thread', 'feed', 'article'],
    platformNotes: {
      x: 'The from/to block is post 1, verbatim list format. Story beats follow one per post.',
      linkedin: 'Keep the arc professional-capacity adjacent. The story section carries the credibility.',
    },
    sourceUrls: [
      'https://twitter.com/thejeremymoser/status/1492513210745987076?s=20&t=AZqDQzU7gVJu3Pgc3FfScg',
      'https://twitter.com/WrongsToWrite/status/1400831270678978560?s=20&t=3JQe5DWJcxdbn4ZN_ESBZg',
      'https://twitter.com/OneJKMolina/status/1360216180645060611?s=20&t=srZQeo7WNPL2poc5BVQpRQ',
      'https://twitter.com/thedankoe/status/1349314580082810882?s=20&t=EzIpR_HJl2y2dXQtX_Tx2w',
      'https://twitter.com/_IanBello/status/1518473182260441088?s=20&t=AZqDQzU7gVJu3Pgc3FfScg',
      'https://twitter.com/ItsKieranDrew/status/1428038290804981761',
      'https://twitter.com/iamsam_williams/status/1565791958374686720?s=21&t=9l0PCfW8N-7ci7duUPCLaQ',
      'https://twitter.com/adityatheverma/status/1543233847189553152?s=46&t=9bizE1ofFdZGG2HutCUs1w',
    ],
  }),

  F({
    id: 'experiment-recap',
    label: 'I did X for N days',
    hint: 'Numbers transparency, then results',
    goal: 'saves',
    whyItWorks: [
      'Experiments have a built-in arc (setup, rules, results) that holds attention.',
      'Transparent numbers read as radical honesty, which converts to trust.',
      'Results posts get saved as benchmarks she compares herself against.',
    ],
    template: [
      'I did {Experiment} for {N} days.',
      '',
      'The rules:',
      '- {Rule1}',
      '- {Rule2}',
      '',
      'The results:',
      '- {Result1: measurable}',
      '- {Result2: measurable}',
      '',
      '{Surprise: what nobody predicts}.',
      '{WouldIKeepIt: honest verdict}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'I did a 20-minute brain download every night for 14 days. The 3 am remembering stopped on day 4.',
      'I tracked every invisible task for 30 days. The count changed the conversation at our table.',
    ],
    craft: [
      'State the experiment and the window in the hook. Rules and results as clean lists.',
      'Results must be measurable or honestly qualitative. No invented precision.',
      'The surprise and the verdict carry the credibility. Soft CTA ties the method to the system.',
    ].join(' '),
    inputs: [
      {
        id: 'experiment',
        label: 'The experiment and the window',
        placeholder: 'e.g. a 20-minute brain download every night for 14 days.',
        hint: 'the setup. State it with the window in the hook',
        required: true,
      },
      {
        id: 'results',
        label: 'The rules and the real results',
        placeholder: 'The 2 rules you kept, what measurably changed, the surprise, and your honest verdict.',
        hint: 'the receipts. Measurable or honestly qualitative, never invented precision',
      },
    ],
    platforms: ['x', 'instagram', 'facebook', 'linkedin', 'tiktok'],
    formats: ['feed', 'thread', 'carousel', 'video', 'reel'],
  }),

  F({
    id: 'start-over',
    label: 'If I had to start over',
    hint: 'The reboot playbook',
    goal: 'follows',
    whyItWorks: [
      'Starting-over advice is advice with the stakes already removed, so readers trust it.',
      'It compresses everything you know into an ordered playbook, which gets saved.',
      'Signals mastery without a single explicit claim of mastery.',
    ],
    template: [
      'If I had to {StartScenario} again from zero, here is exactly what I would do:',
      '',
      'Week 1: {Move}',
      'Week 2: {Move}',
      'Week 3: {Move}',
      '',
      'What I would skip completely:',
      '- {PopularButUseless}',
      '- {PopularButUseless}',
      '',
      '{TheOneThing: the move that matters more than all the others}.',
    ].join('\n'),
    exampleHooks: [
      'If I had to rebuild our house systems from zero, I would start with one page and 20 minutes.',
      'If I became a mother again tomorrow, I would ignore 90% of the advice and do these 4 things.',
    ],
    craft: [
      'Order the playbook by week or by priority. Every move is executable and specific.',
      'The skip list is where the authority lives. Name popular advice she can drop.',
      'Close on the one thing that outweighs the rest. Soft CTA only if natural.',
    ].join(' '),
    inputs: [
      {
        id: 'scenario',
        label: 'The start-over scenario',
        placeholder: 'What you are rebuilding from zero, and the one move you would make first.',
        hint: 'the scenario and the first move. Order the playbook from it',
        required: true,
      },
      {
        id: 'skips',
        label: 'The popular advice you would skip',
        placeholder: '2-3 popular moves that wasted your time the first time around.',
        hint: 'the skip list. Where the authority lives',
      },
    ],
    platforms: ['x', 'linkedin', 'instagram', 'facebook'],
    formats: ['thread', 'feed', 'carousel', 'article'],
  }),

  F({
    id: 'mistakes',
    label: 'Mistakes I made',
    hint: 'So she does not have to',
    goal: 'saves',
    whyItWorks: [
      'Confession earns trust faster than expertise.',
      'Mistake lists let her skip pain, which is the most saveable promise there is.',
      'Each mistake is a soft proof that you have already done the reps.',
    ],
    template: [
      '{N} mistakes I made with {Domain} so you do not have to:',
      '',
      '1. {Mistake} - {what it cost} - {do this instead}',
      '2. {Mistake} - {cost} - {instead}',
      '3. {Mistake} - {cost} - {instead}',
      '',
      '{TheRootMistake: the one underneath all of them}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      '5 mistakes I made managing the mental load so you do not have to. Number 3 cost me a year.',
      'I built our family systems wrong 3 times before they held. Here is what broke them.',
    ],
    craft: [
      'Each mistake gets its cost and its fix on the same line. Pattern: mistake, cost, instead.',
      'Confess real ones, not humble-brag fake ones. She can tell the difference instantly.',
      'The root mistake at the end is the insight. Land it hard, then soften with permission.',
    ].join(' '),
    inputs: [
      {
        id: 'mistakes',
        label: 'Your real mistakes (2-4, with the cost)',
        placeholder: 'Each one: what you did wrong, what it cost, what you do instead.',
        hint: 'the confession list. Pattern: mistake, cost, instead. Real ones only',
        required: true,
      },
    ],
    platforms: ['x', 'instagram', 'facebook', 'linkedin', 'pinterest'],
    formats: ['feed', 'thread', 'carousel', 'pin', 'idea'],
  }),

  F({
    id: 'harsh-truths',
    label: 'Harsh truths',
    hint: 'The kind version of the hard thing',
    goal: 'replies',
    whyItWorks: [
      'Hard truths create productive friction, and friction fills the replies.',
      'Being the one who says it positions the brand as honest before flattering.',
      'Each truth is a standalone quotable, multiplying share surface.',
    ],
    template: [
      '{N} hard truths about {Domain} that nobody wants to say:',
      '',
      '1. {Truth: blunt, structural, one or two lines}',
      '2. {Truth}',
      '3. {Truth}',
      '',
      '{TheKindestOne: the truth that is actually mercy}.',
      '{PermissionClose}',
    ].join('\n'),
    exampleHooks: [
      'Hard truth: the house does not need a better you. It needs a system that is not you.',
      'No one is coming to relieve the default parent. That is the bad news and the starting line.',
    ],
    craft: [
      'Blunt but never cruel. Every truth attacks a structure, never a person.',
      'Order by escalating sting, then end on the truth that is secretly mercy.',
      'Calibration and permission close are mandatory. Harsh truths without an exit are just fear content.',
    ].join(' '),
    inputs: [
      {
        id: 'truths',
        label: 'The hard truths you want said (2-4)',
        placeholder: 'Blunt structural truths about her situation, plus the one that is secretly mercy.',
        hint: 'the truth list. Attacks a structure, never a person. End on the mercy one',
        required: true,
      },
    ],
    platforms: ['x', 'linkedin', 'facebook', 'instagram'],
    formats: ['feed', 'thread', 'carousel', 'colorblock'],
  }),

  F({
    id: 'teardown',
    label: 'The teardown',
    hint: 'Dissect something famous',
    goal: 'shares',
    whyItWorks: [
      'Borrowed interest: the famous thing brings the audience, your lens keeps them.',
      'Analysis proves expertise better than assertion.',
      'Deconstructing a system teaches yours by contrast.',
    ],
    template: [
      'Everyone is talking about {FamousThing}. Here is what is actually going on:',
      '',
      '{Layer1: the surface read everyone has}.',
      '{Layer2: the structural read they missed}.',
      '{Layer3: what it means for her}.',
      '',
      '{TheLesson: the transferable principle}.',
      '{SoftCTA if earned}',
    ].join('\n'),
    exampleHooks: [
      'That CEO morning routine making the rounds? Let us talk about who packs the lunches in it.',
      'Everyone loved the equal-chores post. The comments told the real story.',
    ],
    craft: [
      'Pick something already in the culture. Give the surface read credit, then go one layer deeper than the discourse.',
      'The structural read is the value: systems, incentives, invisible labor.',
      'End on the principle she can use. Never snark at individuals.',
    ].join(' '),
    inputs: [
      {
        id: 'subject',
        label: 'The famous thing to dissect',
        placeholder: 'The post, routine, or moment everyone is talking about, plus your one-line take.',
        hint: 'the subject and your angle. Go one layer deeper than the discourse',
        required: true,
      },
    ],
    platforms: ['x', 'linkedin', 'facebook', 'instagram'],
    formats: ['thread', 'feed', 'article'],
  }),

  F({
    id: 'named-method',
    label: 'Name your method',
    hint: 'Ownable IP, taught for free',
    goal: 'follows',
    whyItWorks: [
      'A named method is memorable, quotable, and ownable. People cite names, not ideas.',
      'Teaching the method for free proves the product is worth paying for.',
      'Names travel: readers repeat them in comments, groups, and kitchens.',
    ],
    template: [
      'The {MethodName}:',
      '',
      '{OneLineDefinition}.',
      '',
      'How it works:',
      '1. {Step}',
      '2. {Step}',
      '3. {Step}',
      '',
      '{WhyItWorks: the mechanism in 2 lines}.',
      '{SoftCTA: the system runs it for you}',
    ].join('\n'),
    exampleHooks: [
      'The Sunday Download: 20 minutes that ends the 3 am remembering.',
      'The One-Page House: every open loop, one visible page, zero memory required.',
    ],
    craft: [
      'Name it like a protocol: two to four words, concrete, no fluff. The name should make the mechanism guessable.',
      'Teach it fully. The free teaching is the ad.',
      'Use the name consistently inside the post. Repeat it at the close.',
    ].join(' '),
    inputs: [
      {
        id: 'method',
        label: 'Your method and its steps',
        placeholder: 'The name if you have one, what it does in one line, and the 3-5 steps.',
        hint: 'the named method. Name it like a protocol, teach it fully',
        required: true,
      },
    ],
    platforms: ['x', 'instagram', 'facebook', 'linkedin', 'pinterest', 'tiktok'],
    formats: ['feed', 'thread', 'carousel', 'video', 'reel', 'pin', 'idea'],
  }),

  F({
    id: 'receipts',
    label: 'Receipts first',
    hint: 'Proof before the pitch',
    goal: 'clicks',
    whyItWorks: [
      'Leading with evidence flips the usual post economics: trust first, ask second.',
      'Specific proof (screenshots, counts, quotes) outperforms every superlative.',
      'Receipts posts convert to clicks because the claim is already believed.',
    ],
    template: [
      '{Receipt: the screenshot, count, or quote, described exactly}.',
      '',
      '{Context: what produced it, 2-3 lines}.',
      '',
      '{SecondReceipt: corroboration}.',
      '',
      '{TheOffer: here is the thing that did it}.',
      '{DirectCTA: link energy, still soft}',
    ].join('\n'),
    exampleHooks: [
      'Her words, not ours: "I slept through the night for the first time since the baby." 214 comments like it this month.',
      'The count: 11,432 downloads, a 4.9 rating, and one recurring sentence in the reviews.',
    ],
    craft: [
      'Open on the strongest receipt. Describe it precisely since the copy must carry it before any image loads.',
      'Stack a second, different-shaped receipt (number after quote, quote after number).',
      'The CTA can be more direct than other frameworks. Earned, so take it.',
    ].join(' '),
    inputs: [
      {
        id: 'receipt',
        label: 'The receipt to lead with',
        placeholder: 'The quote, count, or screenshot described exactly, plus a second corroborating one.',
        hint: 'the proof stack. Describe each receipt precisely, alternate quote and number',
        required: true,
      },
    ],
    platforms: ['x', 'instagram', 'facebook', 'linkedin'],
    formats: ['feed', 'thread', 'carousel'],
  }),

  F({
    id: 'myth-truth',
    label: 'Myth vs truth',
    hint: 'Retire the advice that fails her',
    goal: 'saves',
    whyItWorks: [
      'Correcting popular advice is high-value and low-risk: everyone already suspects it fails.',
      'The paired format is carousel-native and endlessly skimmable.',
      'Each myth retired is a small relief, and relief gets saved.',
    ],
    template: [
      'Myth: {PopularAdvice}',
      'Truth: {WhatActuallyWorks}',
      '',
      'Myth: {PopularAdvice2}',
      'Truth: {WhatActuallyWorks2}',
      '',
      '(3-5 pairs total)',
      '',
      '{ThePattern: why the myths all fail the same way}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'Myth: just write it all down. Truth: if it lives in five places it lives nowhere.',
      'Myth: tag your partner in. Truth: invisible work cannot be shared until it is visible.',
    ],
    craft: [
      'Pick myths she has genuinely tried and failed at. Never strawmen.',
      'The truth is always structural and kind. Pattern close: all the myths fail the same way.',
      'Carousel-native: one pair per slide.',
    ].join(' '),
    platforms: ['instagram', 'facebook', 'x', 'pinterest', 'linkedin', 'aeo', 'blog'],
    formats: ['carousel', 'feed', 'thread', 'pin', 'idea', 'slideshow', 'answer', 'blog'],
  }),


  F({
    id: 'signs-list',
    label: 'Signs you are X',
    hint: 'Identity list she tags herself in',
    goal: 'shares',
    whyItWorks: [
      'Identity content converts readers into distributors: she shares to say "this is me".',
      'The format flatters by precision: being described exactly is being seen.',
      'Comments fill with self-identification, which feeds the ranking loop.',
    ],
    template: [
      'Signs you are {Identity}:',
      '',
      '- {Sign: painfully specific}',
      '- {Sign}',
      '- {Sign}',
      '- {Sign}',
      '',
      '{TheReframe: this identity is not a flaw, it is a job description}.',
      '{SoftCTA or warm close}',
    ].join('\n'),
    exampleHooks: [
      'Signs you are the household CEO: you know the shoe sizes, the shot records, and which teacher prefers email.',
      'Signs you carry the mental load: you delegate a task and then track it anyway.',
    ],
    craft: [
      '5-8 signs, each specific enough to feel spied on. Recognition is the mechanic.',
      'Order from light to heavy. Land the reframe: she is not broken, she is running infrastructure.',
      'Invite the tag without begging for it.',
    ].join(' '),
    platforms: ['instagram', 'facebook', 'x', 'tiktok'],
    formats: ['feed', 'carousel', 'colorblock', 'thread', 'video', 'reel', 'slideshow'],
  }),

  F({
    id: 'open-loop',
    label: 'Open loop storytime',
    hint: 'The twist that holds the watch',
    goal: 'follows',
    whyItWorks: [
      'An unresolved question in the first 3 seconds is the strongest retention hook in short-form.',
      'Storytime with a twist earns the follow for the next story.',
      'The loop forces structure: setup, tension, payoff, every time.',
    ],
    template: [
      '{Loop: the strange outcome, stated first} ({how did we get here})',
      '',
      '{Rewind: start the story at the beginning}.',
      '{Escalate: raise the stakes, 2-3 beats}.',
      '',
      '{Payoff: answer the loop}.',
      '{Lesson: the one-line reframe}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'I spent $0 and got my Sunday back. Here is the 20-minute thing I did instead of a reset.',
      'My partner took over the school forms for one week. It went exactly how you think, and then not.',
    ],
    craft: [
      'Open with the outcome or the strangest moment, withheld explanation. Resolve it only near the end.',
      'Escalate in beats, each line earning the next second of watch time.',
      'The lesson is one line. Short-form punishes epilogues.',
    ].join(' '),
    inputs: [
      {
        id: 'story',
        label: 'Your story: the strange outcome and how it got there',
        placeholder: 'The strangest moment first, then the 2-3 beats that led to it, and the payoff.',
        hint: 'the loop and the payoff. Open on the strange outcome, resolve it near the end',
        required: true,
      },
    ],
    platforms: ['tiktok', 'instagram', 'facebook'],
    formats: ['video', 'reel', 'story'],
    platformNotes: {
      tiktok: 'Spoken, mid-action, fast in. On-screen text carries the loop so it works muted.',
    },
  }),

  F({
    id: 'letter-younger',
    label: 'Letter to my younger self',
    hint: 'Tenderness with a payload',
    goal: 'shares',
    whyItWorks: [
      'The letter format permits tenderness that a normal post cannot carry.',
      'Readers project themselves into both the writer and the recipient, doubling the resonance.',
      'Long-form letters earn long reads, and long reads build deep trust.',
    ],
    template: [
      'Dear {YoungerSelf},',
      '',
      '{SceneSheIsIn: describe her precisely on a hard day}.',
      '',
      '{WhatYouWantHerToKnow: 3-5 short paragraphs}.',
      '',
      '{TheLineSheWillReadTwice}.',
      '',
      '{SignOff: warmth, one line}.',
    ].join('\n'),
    exampleHooks: [
      'Dear new mother hiding in the parked car. I know what you are doing in there, and I know why.',
      'Dear me, reheating the coffee for the third time. Put the list down. On paper. All of it.',
    ],
    craft: [
      'Write to a specific past self on a specific kind of day. The details do the emotional work.',
      'The advice inside the letter is the value payload. 3-5 real things, not vibes.',
      'End with the one line she will re-read. No CTA, or the softest imaginable.',
    ].join(' '),
    inputs: [
      {
        id: 'scene',
        label: 'The hard day your younger self was having',
        placeholder: 'Describe her precisely on a specific kind of day: the scene, the object, the hour.',
        hint: 'the scene she is in. The details do the emotional work',
        required: true,
      },
      {
        id: 'advice',
        label: 'What you want her to know (3-5 things)',
        placeholder: 'The real advice inside the letter, one thing per line.',
        hint: 'the value payload. Real things, not vibes',
      },
    ],
    platforms: ['facebook', 'linkedin', 'instagram', 'email'],
    formats: ['feed', 'article', 'email'],
  }),

  F({
    id: 'aphorism',
    label: 'Aphorism one-liner',
    hint: 'One line, read twice',
    goal: 'shares',
    whyItWorks: [
      'A perfect single line is the most screenshot-able, repostable unit on any platform.',
      'Compression reads as wisdom. The shorter the line, the longer it sits with her.',
      'Low production cost, high distribution: one-liners get quoted into other posts.',
    ],
    template: [
      '{TheLine: one sentence, parallel or turn structure, that lands the whole reframe}.',
      '',
      '(Optional) {OneFollowUp: a single second line that sharpens, never explains}.',
    ].join('\n'),
    exampleHooks: [
      'The mental load is not in her head. Her head is where we keep it.',
      'She does not have a time problem. She has a custody problem: everyone else has custody of her time.',
    ],
    craft: [
      'One sentence. Parallel construction or a turn at the end. Read it aloud: it must click shut like a box.',
      'No setup, no explanation. If it needs context, it is not an aphorism yet.',
      'At most one follow-up line that sharpens. Then stop.',
    ].join(' '),
    platforms: ['x', 'instagram', 'facebook'],
    formats: ['feed', 'colorblock', 'story'],
    platformNotes: {
      facebook: 'Colorblock native. Under 130 characters including the turn.',
      x: 'Post alone. Do not thread it. Let replies carry it.',
    },
  }),

  /* ------------------------------------------------------------------ */
  /* Platform-specific frameworks. Each is engineered for one channel's  */
  /* native mechanics, so Auto rotation always has a sharp fit on every  */
  /* surface the hub covers.                                             */
  /* ------------------------------------------------------------------ */

  F({
    id: 'x-thread-blueprint',
    label: 'X thread blueprint',
    hint: 'Hook post, proof beats, payoff',
    goal: 'follows',
    whyItWorks: [
      'Threads that earn the bookmark in post 1 get read to the end, and full reads are the strongest ranking signal on X.',
      'One idea per post keeps the reader moving; momentum is the whole game on a fast timeline.',
      'A recap post gives late arrivals the whole value, which converts lurkers into followers.',
    ],
    template: [
      '1/ {HookPost: the bold claim, count, or question that stands alone}',
      '',
      '2/ {Beat: one idea, one post, concrete}',
      '3/ {Beat}',
      '4/ {Beat}',
      '...',
      '',
      '{N-1}/ {RecapPost: the whole thread in 3 lines}',
      '{N}/ {SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'I tracked every invisible task in our house for 30 days. Here is the system that replaced 40 of them, one post at a time.',
      'The mental load has 5 moving parts. Most systems hold 2. Here is all 5.',
    ],
    craft: [
      'Post 1 must work completely alone: a claim, count, or question she cannot scroll past. No throat-clearing.',
      'One idea per post, each ending on a reason to read the next. Every post under the character limit with room to breathe.',
      'Second-to-last post recaps the whole thread for skimmers. Soft CTA last, never before the recap.',
    ].join(' '),
    platforms: ['x'],
    formats: ['thread'],
  }),

  F({
    id: 'x-hot-take',
    label: 'X hot take',
    hint: 'The defensible spike',
    goal: 'replies',
    whyItWorks: [
      'A sharp opinion is the unit X trades in; replies and quotes are the payout.',
      'Defensible heat beats safe agreement because the reader wants to argue or cosign, and both rank.',
      'One clean claim is screenshot-bait, and screenshots travel further than threads.',
    ],
    template: [
      '{HotTake: one line, stated as fact}.',
      '',
      '{TheGround: the 2-3 line case, mechanism not attitude}.',
      '',
      '{TheLineInTheSand: what you are NOT saying}.',
      '{QuestionBack: the reply invite}.',
    ].join('\n'),
    exampleHooks: [
      'Meal prep is not the hard part of feeding a family. Being the only one who knows what is in the freezer is.',
      '"Share the load" is bad advice. You cannot share what only one person can see.',
    ],
    craft: [
      'State the take as fact in line 1. Heat comes from precision, not volume.',
      'Prove the mechanism in 2-3 lines so the take survives its own replies.',
      'Say what you are not saying (the calibration), then invite the argument. Enemy is the system, never people.',
    ].join(' '),
    platforms: ['x'],
    formats: ['feed'],
  }),

  F({
    id: 'x-bookmark-bomb',
    label: 'X bookmark bomb',
    hint: 'One post, the whole method',
    goal: 'saves',
    whyItWorks: [
      'Bookmarks are the strongest quality signal on X, and density earns them.',
      'A complete playbook in one post respects the reader who hates threads.',
      'Long posts that deliver end to end get screenshot-shared into group chats.',
    ],
    template: [
      '{HookLine: the outcome, plainly}.',
      '',
      'Here is the whole {MethodName}:',
      '',
      '1. {Step: verb first, with the how}',
      '2. {Step}',
      '3. {Step}',
      '4. {Step}',
      '5. {Step}',
      '',
      '{TheOneEveryoneSkips: and why it is the point}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'Our house runs on one page and 20 minutes a week. Here is the entire system, free.',
      'You do not need an app stack to stop dropping balls. You need this 5-step download.',
    ],
    craft: [
      'Pack a full method into one long post. Line breaks between every beat so density never becomes a wall.',
      'Every step carries its own how. No "just plan ahead" filler.',
      'Name the step everyone skips and make it the payoff. Bookmarks come from completeness, so hold nothing back.',
    ].join(' '),
    platforms: ['x'],
    formats: ['feed'],
  }),

  F({
    id: 'fb-colorblock-conversation',
    label: 'FB colorblock conversation',
    hint: 'Big text that starts threads',
    goal: 'replies',
    whyItWorks: [
      'Facebook pushes the big-text format hard, and a sharp line on color stops the scroll cold.',
      'Comment threads are the strongest Facebook ranking signal, and a pointed statement is a pointed invitation.',
      'Staying under 130 characters keeps the native big-text treatment, which reads far bigger than a link post.',
    ],
    template: [
      '{TheLine: one statement or question under 130 characters, on the color block}',
      '',
      '(Caption or first comment:) {ThePayload: your answer, the story, or the 3-line take}',
      '',
      '{QuestionBack: the explicit invite}',
    ].join('\n'),
    exampleHooks: [
      'Name one invisible job you did today that nobody will ever know about.',
      'The mental load is not remembering. It is being the only one the remembering depends on.',
    ],
    craft: [
      'The block carries one line only, under 130 characters so Facebook keeps the big-text surface.',
      'Ask or declare something she has an instant answer to. Specific beats profound.',
      'Your own answer goes in the caption or first comment to seed the thread. End with the explicit invite.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['colorblock', 'textpost', 'tweet', 'feed'],
  }),

  F({
    id: 'fb-group-question',
    label: 'FB group question',
    hint: 'The thread that runs itself',
    goal: 'replies',
    whyItWorks: [
      'Groups reward questions everyone can answer in one line, and every answer bumps the post.',
      'Low-stakes, high-identity questions pull lurkers into their first comment.',
      'The comment section becomes free audience research you can build content from for weeks.',
    ],
    template: [
      '{ScenarioQuestion: a specific, slightly funny situation she has lived}.',
      '',
      '{YourAnswer: model the tone with your own 1-2 line answer}.',
      '',
      '{WhyYouAreAsking: one honest line}.',
    ].join('\n'),
    exampleHooks: [
      'Settle a debate in our house: is the 5 pm hour actually harder than the whole rest of the day combined?',
      'What is the one school form that broke you? Mine was the one that needed 3 logins.',
    ],
    craft: [
      'Ask about a specific lived moment, not an opinion. Everyone has the moment; few have the take.',
      'Answer your own question first, short and warm, so replies know the register.',
      'Mine the replies later. This post is both reach and research.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed', 'colorblock'],
  }),

  F({
    id: 'fb-ad-pas',
    label: 'FB ad: PAS',
    hint: 'Problem, agitate, solve',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'PAS is the highest-converting cold-traffic structure ever measured because it sells the problem before the product.',
      'Naming her 11pm problem in the first line stops the scroll better than any product shot.',
      'Agitation done with empathy instead of fear makes the solution feel like relief, which is what tired buyers click for.',
    ],
    template: [
      'Problem: {HerProblem: the exact moment, stated in her words}.',
      '',
      'Agitate: {WhatItCosts: the daily toll, 2-3 concrete lines}.',
      '',
      'Solve: {TheOffer: what it is and the one outcome it delivers}.',
      '',
      '{ProofLine: the receipt, one line}.',
      'CTA: {Button promise, e.g. "Get the $7 system"}',
    ].join('\n'),
    exampleHooks: [
      'You are not bad at routines. You are the only one holding the whole map, and it is heavy.',
      'Every Sunday you reset. Every Wednesday it falls apart. The reset was never the problem.',
    ],
    craft: [
      'Write the problem in her words, the way she would say it to a friend at pickup. First line is the problem, never the brand.',
      'Agitate with specifics (the 3 am remembering, the fourth app), never with fear or shame.',
      'The solve is one product, one outcome, one price. Proof line before the CTA. Calibrate: this helps because it holds the list, not because she failed.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    platformNotes: {
      facebook: 'Primary text runs PAS in full. Headline under 40 characters carries the outcome, description under 30 carries the price anchor.',
    },
  }),

  F({
    id: 'fb-ad-bab',
    label: 'FB ad: Before-After-Bridge',
    hint: 'Two worlds, one bridge',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Contrast sells: the before is her now, the after is her want, and the bridge is the only unknown left.',
      'BAB maps cleanly onto Meta ad fields, which keeps the message tight at every placement.',
      'Painting the after in sensory detail makes the click feel like the shortest path to it.',
    ],
    template: [
      'Before: {HerNow: the current chaos, 2-3 vivid lines}.',
      '',
      'After: {TheWant: the same scene, fixed, in sensory detail}.',
      '',
      'Bridge: {TheOffer: the specific mechanism that crosses it}.',
      '',
      'CTA: {What happens when she clicks}',
    ].join('\n'),
    exampleHooks: [
      'Before: 40 tabs open in your head at all times. After: one page, one 20-minute Sunday, zero remembering.',
      'Imagine the witching hour with nothing left to decide. That is not a fantasy. It is a download away.',
    ],
    craft: [
      'Before and after must be the SAME scene, so the only variable is the system. Mirror the details.',
      'Write the after in senses (quiet kitchen, signed forms, hot coffee), not adjectives.',
      'The bridge is the mechanism, stated plainly with the price. One click, one promise, no hype to walk back.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    platformNotes: {
      facebook: 'Headline carries the after in under 40 characters. The link description is the price anchor under 30.',
    },
  }),

  F({
    id: 'fb-ad-ugc-proof',
    label: 'FB ad: UGC proof',
    hint: 'Her words do the selling',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Ads that read like a friend posting in the group outperform polished brand creative on cold traffic.',
      'A specific customer quote is a receipt, and receipts beat claims every time.',
      'Native UGC style lowers ad fatigue because it does not pattern-match as an ad.',
    ],
    template: [
      '{QuoteHook: her exact words, the specific result}.',
      '',
      '{TheStory: 3-4 lines, who she is and what changed, told plainly}.',
      '',
      '{TheReceipt: the number or detail that proves it}.',
      '',
      '{Bridge: same system, one line}.',
      'CTA: {Soft, specific}',
    ].join('\n'),
    exampleHooks: [
      '"I stopped waking up at 3 am remembering the permission slips." That was week 1 for Dana.',
      'She told the group she got 6 hours back. Then she posted the page to prove it.',
    ],
    craft: [
      'Open on the quote, quotation marks and all. The more specific the result, the stronger the pull.',
      'Tell her story in plain 3-4 line beats: who, what was breaking, what changed. No polish; polish kills UGC.',
      'One receipt, one bridge line, one soft CTA. The ad should read like a share, not a pitch.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
  }),

  F({
    id: 'fb-ad-offer-stack',
    label: 'FB ad: Offer stack',
    hint: 'Everything she gets, anchored',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A stacked list of deliverables against a small price reframes the purchase as arithmetic, not emotion.',
      'Warm audiences who already know the brand convert on the stack because the only question left is value.',
      'Guarantee-first closes remove the last excuse without a single pressure tactic.',
    ],
    template: [
      '{AnchorLine: the total value story in one line}.',
      '',
      'Inside {TheOffer}:',
      '- {Deliverable1: named, concrete}',
      '- {Deliverable2}',
      '- {Deliverable3}',
      '- {Bonus: the unexpected extra}',
      '',
      'All of it for {Price}. {Guarantee: the risk-reversal, one line}.',
      'CTA: {Direct}',
    ].join('\n'),
    exampleHooks: [
      'The whole Sunday reset system, the templates, and the scripts. $7. Less than the coffee that went cold.',
      'Everything in the Brain Dump, plus the 20-minute setup, for the price of a drive-thru lunch.',
    ],
    craft: [
      'Anchor first: name everything she gets before the price ever appears.',
      'Every deliverable is named and concrete, never "and more". The bonus lands last in the stack.',
      'Price, guarantee, CTA, in that order. This is the direct close: still warm, but no longer soft.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
  }),

  F({
    id: 'ig-carousel-classroom',
    label: 'IG carousel classroom',
    hint: 'Teach it slide by slide',
    goal: 'saves',
    whyItWorks: [
      'Carousels earn the highest save rate on Instagram, and saves are the reach engine.',
      'One idea per slide creates a swipe rhythm that carries her to the last slide, where the CTA lives.',
      'A cover that promises a numbered payoff outperforms every pretty cover without one.',
    ],
    template: [
      'Slide 1 (cover): {NumberedPromise: 6 words or fewer}',
      '',
      'Slides 2 to {N-2}: {OneIdeaPerSlide: headline + 1-2 support lines}',
      '',
      'Slide {N-1}: {Recap: the whole lesson in 4 short lines}',
      'Slide {N}: {SoftCTA: save this + the system line}',
      '',
      'Caption: {HookLine} + {3-5 line expansion} + {QuestionBack}',
    ].join('\n'),
    exampleHooks: [
      '7 jobs she did before 9 am (that nobody counts)',
      'The 20-minute Sunday download, slide by slide',
    ],
    craft: [
      'Cover promises a numbered payoff in 6 words or fewer. If the cover does not stop the thumb, nothing else matters.',
      'One idea per slide, headline plus 1-2 support lines, never a paragraph. Every slide must be screenshot-able alone.',
      'Recap slide, then the CTA slide: save this, then the one-line system mention. Caption re-hooks and expands, never repeats the slides.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['carousel'],
  }),

  F({
    id: 'ig-reel-loop',
    label: 'IG reel loop',
    hint: 'Hook, loop, payoff, replay',
    goal: 'follows',
    whyItWorks: [
      'Reels that loop seamlessly get rewatched, and rewatches are the strongest reel ranking signal.',
      'The first frame decides everything: most of the audience is won or lost in under 2 seconds.',
      'An open loop closed at the very end pays off the wait and triggers the follow for the next one.',
    ],
    template: [
      'Frame 1 (0-1s): {PatternInterrupt: the line or visual that breaks the scroll}',
      '',
      'Setup (1-4s): {TheStakes: why she should care, one breath}',
      'Loop (4-20s): {TheBuild: 2-4 beats that withhold the payoff}',
      '',
      'Payoff (last 3s): {TheAnswer: lands clean and connects back to frame 1}',
      'Caption: {OneLine + SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'I deleted 4 apps off my phone and my house runs better. Here is the 1 page that replaced them.',
      'Watch what happens when she stops keeping the list in her head.',
    ],
    craft: [
      'Frame 1 is a pattern interrupt: movement, a bold line, or the end result shown first. Never a logo, never a wave at the camera.',
      'Withhold the payoff until the last 3 seconds, then land it clean so the loop back to frame 1 feels intentional.',
      'On-screen text carries the whole story for muted viewing. Caption is one line plus the soft CTA.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['reel'],
  }),

  F({
    id: 'ig-send-to-friend',
    label: 'IG send-to-a-friend',
    hint: 'The tag reflex, designed',
    goal: 'shares',
    whyItWorks: [
      'Sends are the heaviest ranking signal on Instagram, and identity posts are what she sends.',
      'Describing one friend precisely gives her a person to send it to within 2 seconds of reading.',
      'Share-trigger content grows the account through DMs, the one channel the algorithm fully trusts.',
    ],
    template: [
      '{TheFriend: describe her precisely in one line}.',
      '',
      '{TheThing: what she is carrying or needs to hear, 2-4 lines}.',
      '',
      '{ThePermission: the absolution}.',
      '',
      '{TheSend: send this to the friend who {reason}}.',
    ].join('\n'),
    exampleHooks: [
      'For the friend who answered "what is for dinner" 4 times before 10 am.',
      'Send this to the one holding 3 school apps, 2 sports schedules, and everybody\'s favorite cup.',
    ],
    craft: [
      'Describe one specific friend in line 1. Precision is the trigger: she should picture a face instantly.',
      'Pay it off with the thing she carries and the permission she needs. Warm, never sappy.',
      'The send line is the CTA. Make it effortless to obey: send this to the friend who...',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['feed', 'carousel', 'reel'],
  }),

  F({
    id: 'tiktok-3s-hook',
    label: 'TikTok 3-second hook',
    hint: 'Win or lose in the first line',
    goal: 'follows',
    whyItWorks: [
      'TikTok ranks on completion, and completion is decided in the first 3 seconds.',
      'Spoken hooks that name the viewer outperform every clever edit.',
      'A hook menu keeps every video starting on proven psychology instead of a cold open that rambles.',
    ],
    template: [
      'Hook (0-3s), pick ONE:',
      '- Call-out: {If you are the one who {specificJob}, stop scrolling}',
      '- Negative: {Stop {popularThing}. Do this instead}',
      '- Curiosity gap: {I found out why {commonStruggle}. It is not what you think}',
      '- Result first: {EndResult shown, then "here is how"}',
      '',
      'Body: {3-5 beats, each earning the next second}',
      'Close: {Payoff + follow reason}',
    ].join('\n'),
    exampleHooks: [
      'If you are the default parent, this 20-minute thing is about to change your Sundays.',
      'Stop doing weekly resets. They fail by Wednesday for 1 specific reason.',
    ],
    craft: [
      'Speak the hook in the first 3 seconds, on camera, with on-screen text doubling it. Pick exactly one hook type per video.',
      'Every following beat must earn the next second: no greetings, no "hey guys", no setup beyond one breath.',
      'Close with the payoff and a specific reason to follow (tomorrow I post the template).',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'tiktok-pov-skit',
    label: 'TikTok POV skit',
    hint: 'Act the moment she lives',
    goal: 'shares',
    whyItWorks: [
      'POV skits let her watch her own life from the outside, which is the strongest share trigger on TikTok.',
      'Playing both roles doubles the comedy and the accuracy, and accuracy is what gets sent to the group chat.',
      'Skit formats ride trending audio without chasing trends, so reach compounds.',
    ],
    template: [
      'POV line (on screen): POV: {TheExactScenario}',
      '',
      'Character A: {Her, playing it straight}',
      'Character B: {The system, app, or expectation, played absurd}',
      '',
      'Escalation: {2-3 exchanges, each more exact}',
      'Button: {The line that lands the joke and the truth}',
    ].join('\n'),
    exampleHooks: [
      'POV: the school app needs you to download 2 more apps to read the PDF about the field trip.',
      'POV: it is 5 pm and everyone is asking what is for dinner, including the dog.',
    ],
    craft: [
      'Put the POV line on screen in frame 1 and commit to the bit within 5 seconds.',
      'Play the system as the absurd character (the app, the form, the expectation), never the partner or the kids.',
      'End on the button: the line that is funny because it is exactly true. Under 30 seconds total.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'tiktok-storytime-loop',
    label: 'TikTok storytime loop',
    hint: 'Withhold the ending',
    goal: 'follows',
    whyItWorks: [
      'Storytime is TikTok\'s native long-watch format, and a withheld ending is legal attention theft.',
      'Starting mid-action skips the setup that kills retention.',
      'A payoff that recontextualizes the hook earns the follow for the next story.',
    ],
    template: [
      'Cold open (0-2s): {TheStrangestMoment: mid-action, unexplained}',
      '',
      'Rewind: {HowWeGotHere, 2 beats}',
      'Escalation: {RaiseStakes, 2-3 beats}',
      '',
      'Payoff: {TheEnding, lands with 2 seconds to spare}',
      'Loop line: {OneLineThatReframes the whole story}',
    ].join('\n'),
    exampleHooks: [
      'So I am standing in the school parking lot holding a poster board at 7:12 am, and that is when I knew.',
      'This is the exact moment I stopped being the family reminder app.',
    ],
    craft: [
      'Open on the strangest moment, mid-action, zero context. Explain nothing for the first 5 seconds.',
      'Rewind and escalate in beats, each one buying the next 3 seconds of watch time.',
      'Pay off with 2 seconds to spare, then the loop line that reframes it. The follow is earned by the quality, never begged.',
    ].join(' '),
    inputs: [
      {
        id: 'story',
        label: 'Your story: the strangest moment and how it ended',
        placeholder: 'Mid-action cold open, the 2-3 beats that raised the stakes, and the payoff.',
        hint: 'the arc. Open on the strangest moment, pay it off with 2 seconds to spare',
        required: true,
      },
    ],
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'yt-title-thumbnail-pair',
    label: 'YT title + thumbnail pair',
    hint: 'One promise, two surfaces',
    goal: 'clicks',
    whyItWorks: [
      'The click is decided by the pair, not the title alone: the thumbnail raises the question the title half-answers.',
      'Titles under 60 characters survive mobile truncation, and mobile is most of YouTube.',
      'A curiosity gap with a concrete noun beats vague intrigue because she knows exactly what she is clicking into.',
    ],
    template: [
      'Title (pick ONE frame):',
      '- Outcome: How to {DesiredResult} ({TimeCost})',
      '- Gap: I {DidTheThing} So You Do Not Have To',
      '- Numbered: {N} {Things} That {Outcome} ({Surprise})',
      '- Versus: {ThingA} vs {ThingB}: {TheVerdict}',
      '',
      'Thumbnail: {OneSceneOrSplit} + overlay words: {2-4 words max}',
      '',
      'First line of description: {ThePromise restated + the payoff moment}',
    ].join('\n'),
    exampleHooks: [
      'I Replaced My Brain With 1 Page for 30 Days (here is what happened)',
      'The 20-Minute Sunday Routine That Ends the 3 AM Remembering',
    ],
    craft: [
      'Write the title and thumbnail as one idea split in two: the thumbnail shows the feeling, the title names the promise. Never repeat the same words on both.',
      'Keep the title under 60 characters with the payoff word early. Front-load the concrete noun.',
      'Thumbnail overlay is 2-4 words maximum, readable at 120 pixels wide. The pair must be honest: the video cashes the check in the first minute.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
  }),

  F({
    id: 'yt-intro-retention',
    label: 'YT retention intro',
    hint: 'The first 30 seconds, scripted',
    goal: 'follows',
    whyItWorks: [
      'YouTube ranks on average view duration, and the biggest drop-off is the first 30 seconds.',
      'A cold open that shows the payoff first converts a casual click into a committed viewer.',
      'Stakes plus roadmap kills the two reasons she leaves: "this is not for me" and "this will ramble".',
    ],
    template: [
      '0-5s Cold open: {ShowThePayoff: the end result, the number, or the boldest claim}',
      '',
      '5-15s Stakes: {WhyThisMatters: what it costs her to keep doing it the old way}',
      '15-25s Credibility: {WhyYou: the receipt, in one line, calibrated}',
      '25-30s Roadmap: {WhatIsComing: the 3 beats, no fluff}',
      '',
      'Then straight into beat 1. No intro animation, no welcome back.',
    ].join('\n'),
    exampleHooks: [
      'This page runs our whole house. In 12 minutes you will have your own. Here is exactly how.',
      'I tracked every task for 30 days and the count changed our house. Let me show you the list.',
    ],
    craft: [
      'Open on the payoff, not the greeting. The viewer met you 3 seconds ago; earn the next 27.',
      'One credibility line, calibrated (what it cost, what help you had), then the roadmap so she knows the shape of the video.',
      'No channel intro, no housekeeping. Beat 1 starts at 30 seconds on the dot.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
  }),

  F({
    id: 'yt-value-density',
    label: 'YT value-dense video',
    hint: 'Payoff every 60 seconds',
    goal: 'follows',
    whyItWorks: [
      'Mid-roll retention is won by payoff spacing: a tangible takeaway every minute beats one big reveal.',
      'Numbered structure lets her mentally check off progress, which keeps her watching to complete the set.',
      'Ending on the next-video handoff converts one view into a session, and sessions are what the algorithm promotes.',
    ],
    template: [
      '{ColdOpen: payoff-first intro per the retention framework}',
      '',
      '{Point1: state it, prove it, use it} (payoff 1)',
      '{Point2: state it, prove it, use it} (payoff 2)',
      '{Point3: state it, prove it, use it} (payoff 3)',
      '',
      '{TheOneThatTiesThem: the system underneath}',
      '{NextVideoHandoff: watch this next, and why}',
    ].join('\n'),
    exampleHooks: [
      '5 systems that run our house, in 12 minutes. Number 4 is the one nobody believes until they try it.',
      'I rebuilt our whole week around 3 decisions. Here is each one and exactly how to copy it.',
    ],
    craft: [
      'Structure every point the same way: state it, prove it with a receipt or a scene, then tell her how to use it tonight.',
      'Tease point N+1 while landing point N so there is always a reason to stay.',
      'Close on the connective system, then hand off to the specific next video by name. Never end on "thanks for watching".',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
  }),

  F({
    id: 'li-linebreak-authority',
    label: 'LinkedIn line-break essay',
    hint: 'The calm authority scroll',
    goal: 'follows',
    whyItWorks: [
      'LinkedIn rewards dwell time, and one-line paragraphs manufacture dwell time line by line.',
      'A calm, structural take stands out in a feed of hustle theater, and contrast is attention.',
      'The essay format lets one idea breathe, which reads as confidence and converts to follows from exactly the right people.',
    ],
    template: [
      '{OpeningLine: the reframe, alone on line 1}.',
      '',
      '{OneLineParagraphs: the argument, one breath per line, 8-15 lines}.',
      '',
      '{TheTurn: the deeper point, 2 lines}.',
      '',
      '{TheClose: the line they quote in the comments}.',
      '{SoftCTA}',
    ].join('\n'),
    exampleHooks: [
      'The mental load is not a productivity problem. It is an infrastructure problem wearing a productivity costume.',
      'Nobody promotes the person holding the whole house together. We just call her reliable.',
    ],
    craft: [
      'Line 1 is the whole argument, alone. If she reads nothing else, she still got the point.',
      'One breath per line, no line over 12 words. The white space is the persuasion.',
      'Turn once, close quotable, soft CTA. Professional register: the personal is framed as structural.',
    ].join(' '),
    platforms: ['linkedin'],
    formats: ['feed'],
  }),

  F({
    id: 'li-data-pattern',
    label: 'LinkedIn data pattern',
    hint: 'We counted, here is what',
    goal: 'shares',
    whyItWorks: [
      'Original data is the most shared content type on LinkedIn because citing it makes the sharer look smart.',
      'A counted truth, even a small one, outperforms a big opinion because it is falsifiable and quotable.',
      'Pattern posts position the brand as the research desk for this conversation.',
    ],
    template: [
      'We {CountedOrTracked} {TheThing} for {Period}.',
      '',
      'The pattern nobody talks about:',
      '',
      '- {Finding1: the number, then what it means}',
      '- {Finding2}',
      '- {Finding3}',
      '',
      '{TheSoWhat: the structural point, 2 lines}.',
      '{MethodNote: how we counted, one line, for credibility}',
    ].join('\n'),
    exampleHooks: [
      'We counted every invisible task in 40 households for a month. The average came to 23 a day.',
      'I tracked who remembered what in our house for 30 days. The chart told a story no one expected.',
    ],
    craft: [
      'Lead with the act of counting and the window. The methodology is the flex.',
      'Every finding is a number plus its meaning. Surprise beats confirmation: lead with the finding that reframes.',
      'Close with the structural so-what, then a one-line method note so skeptics have nothing to grab.',
    ].join(' '),
    platforms: ['linkedin'],
    formats: ['feed', 'article', 'carousel'],
  }),

  F({
    id: 'li-working-mother-reframe',
    label: 'LinkedIn working mother reframe',
    hint: 'The skill nobody lists',
    goal: 'replies',
    whyItWorks: [
      'Reframing invisible labor as executive skill gives working mothers language they have been missing, and language gets shared.',
      'It converts a private struggle into a professional observation, which is the safest thing to comment on at work.',
      'Hiring managers and peers see it, which quietly shifts the culture the audience works in.',
    ],
    template: [
      '{TheSkill: what she does daily, described in executive language}.',
      '',
      'In any company we would call that {JobTitle}.',
      '',
      '{TheEvidence: 3-4 lines of the actual logistics she runs}.',
      '',
      '{TheReframe: the labor was never the problem, the invisibility was}.',
      '{QuestionBack: what would you list on the resume?}',
    ].join('\n'),
    exampleHooks: [
      'She manages logistics for a 5-person household with zero staff, zero budget, and a 24/7 on-call rotation. We call that a COO.',
      'Every morning she runs resource allocation, conflict resolution, and procurement before 8 am. Unpaid. Unlisted.',
    ],
    craft: [
      'Describe the daily reality in pure executive language first, then reveal the job title it maps to.',
      'Keep the evidence concrete: headcount, hours, decisions. The translation does the persuading.',
      'End on the reframe and a question back that professionals can answer in public without oversharing.',
    ].join(' '),
    platforms: ['linkedin'],
    formats: ['feed'],
  }),

  F({
    id: 'pin-seo-howto',
    label: 'Pinterest SEO how-to',
    hint: 'The pin that ranks for years',
    goal: 'clicks',
    whyItWorks: [
      'Pinterest is a search engine: a keyword-true pin compounds traffic for years, not hours.',
      'How-to pins with the outcome in the overlay text earn the click because the promise is readable at thumbnail size.',
      'A keyword-rich description feeds the algorithm exactly what it indexes, so the pin surfaces on every related search.',
    ],
    template: [
      'Pin title (front-load the keyword): {HowToOutcomeKeyword}',
      '',
      'Overlay text idea (2-6 words): {TheOutcome}',
      '',
      'Description:',
      '{KeywordSentence1: what it teaches, natural language}',
      '{KeywordSentence2: who it is for + the result}',
      '{SoftCTA + link}',
      '',
      'Image: {CleanScene with the top or bottom third clear for the overlay}',
    ].join('\n'),
    exampleHooks: [
      'Mental Load Checklist: The 20-Minute Sunday Reset for Overwhelmed Moms',
      'Brain Dump Template: How to Empty Your Head and Actually Relax',
    ],
    craft: [
      'Front-load the search phrase in the title exactly as she types it. Clever loses to findable here.',
      'Overlay text is 2-6 words stating the outcome; the image leaves clean space for it.',
      'Description is 2 natural sentences packed with the real search phrases, then the soft CTA. No keyword stuffing; Pinterest reads context now.',
    ].join(' '),
    platforms: ['pinterest'],
    formats: ['pin'],
  }),

  F({
    id: 'pin-listicle-saves',
    label: 'Pinterest listicle pin',
    hint: 'Numbered for the save',
    goal: 'saves',
    whyItWorks: [
      'Saves are Pinterest\'s ranking gold, and numbered lists are the most saved format on the platform.',
      'A listicle pin promises organized relief, which is exactly what her boards are for.',
      'Each list item is a mini search hook, widening the queries the pin can rank for.',
    ],
    template: [
      'Pin title: {N} {Things} for {DesiredOutcome} ({AudienceKeyword})',
      '',
      'Overlay: {N} {Things}',
      '',
      'The list (in the description or idea pin pages):',
      '1. {Item: specific, visual, doable}',
      '2. {Item}',
      '3. {Item}',
      '...',
      '',
      '{SoftCTA: the full system at the link}',
    ].join('\n'),
    exampleHooks: [
      '11 Sunday Reset Tasks That Make Monday Feel Like a Vacation',
      '9 Invisible Jobs to Get Out of Your Head This Week',
    ],
    craft: [
      'Odd numbers read as honest. 7 to 11 items is the save sweet spot.',
      'Every item is specific and doable tonight. Vague items kill saves.',
      'The pin teaches enough to be worth saving alone; the link sells the system that holds it all.',
    ].join(' '),
    platforms: ['pinterest'],
    formats: ['pin', 'idea'],
  }),

  F({
    id: 'email-subject-curiosity',
    label: 'Email subject + preheader',
    hint: 'The open, engineered',
    goal: 'clicks',
    whyItWorks: [
      'The open is won in the inbox: subject plus preheader is the whole ad for the email.',
      'Curiosity gaps with a concrete noun beat cleverness, because she knows what she is opening.',
      'A preheader that raises the stakes instead of repeating the subject doubles the persuasion surface.',
    ],
    template: [
      'Subject (pick ONE frame):',
      '- Gap: {The thing nobody counts}',
      '- Number: {N jobs before 9 am}',
      '- Question: {What is the 5 pm hour actually costing you?}',
      '- Statement: {You are not behind}',
      '',
      'Preheader (never repeats the subject):',
      '{RaiseTheStakes or NameThePayoff, under 90 characters}',
      '',
      'First line of body: {DeliverOnTheSubject in one line}',
    ].join('\n'),
    exampleHooks: [
      'The 3 am remembering has a name (and a fix)',
      '23 invisible jobs. We counted.',
    ],
    craft: [
      'Pick one subject frame per email. Under 50 characters so mobile shows it whole.',
      'Preheader adds stakes or payoff, never restates. Together they read as one two-line hook.',
      'The first body line must cash the subject immediately or the next email underperforms.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
  }),

  F({
    id: 'email-open-loop-story',
    label: 'Email open-loop story',
    hint: 'Story, bridge, PS',
    goal: 'clicks',
    whyItWorks: [
      'Story emails outperform tip emails on clicks because narrative pulls her to the resolution.',
      'An open loop in the first 2 lines manufactures the "one more line" read all the way to the CTA.',
      'The PS is the second most-read element in any email, so the receipt lives there.',
    ],
    template: [
      'Subject + preheader per the subject framework.',
      '',
      '{OpenLoop: the strange moment, unresolved, 1-2 lines}.',
      '',
      '{TheStory: 3-5 short paragraphs, scene to turning point}.',
      '',
      '{TheLesson: the reframe, 2 lines}.',
      '{Bridge: what this has to do with the offer, 1 honest line}.',
      'CTA: {Soft, specific}.',
      '',
      'PS: {TheReceipt: the number, quote, or result}.',
    ].join('\n'),
    exampleHooks: [
      'The field trip form was in the trash. Signed by nobody. That was the Tuesday I changed everything.',
      'I timed myself last Tuesday. 23 decisions before 8 am. Here is what I did with that number.',
    ],
    craft: [
      'Open mid-scene with something unresolved. Do not explain it for at least 3 lines.',
      'The story earns the lesson, the lesson earns the bridge. One honest line connects to the offer; two is a pitch.',
      'The PS carries the receipt (number, quote, result). Never waste the PS on a repeated CTA.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
  }),

  F({
    id: 'blog-seo-listicle',
    label: 'Blog SEO listicle',
    hint: 'Ranks, reads, converts',
    goal: 'clicks',
    whyItWorks: [
      'Listicles match how searchers skim, and the per-item H2s give Google the structure it ranks.',
      'A snippet-ready intro (the direct answer in 2 sentences) wins the featured position and the click.',
      'Each item is internally linkable, so the post distributes authority across the whole site.',
    ],
    template: [
      'H1: {N} {WaysThings} to {DesiredOutcome} ({YearOrQualifier})',
      '',
      'Intro (snippet-ready): {TheDirectAnswer in 2 sentences}.',
      '',
      'H2 per item: {Item}: {2-4 lines, what it is + how to run it tonight}',
      '',
      'H2: {TheSystemUnderneath: why these work together}',
      'H2: FAQ ({3 AEO question/answer pairs})',
      '',
      'CTA block: {TheOffer, one paragraph + link}',
    ].join('\n'),
    exampleHooks: [
      '9 Ways to Lighten the Mental Load of Motherhood (Without Doing More)',
      '7 Sunday Reset Rituals That Actually Survive Until Friday',
    ],
    craft: [
      'H1 carries the number, the outcome, and a qualifier. The intro answers the query in 2 citable sentences before any throat-clearing.',
      'Every item gets its own H2 and a how-to she can run tonight. Fluff items get cut, not padded.',
      'Close with the system section, 3 FAQ pairs for the snippet, and one CTA block. Internal-link every item that has a sibling post.',
    ].join(' '),
    platforms: ['blog'],
    formats: ['blog'],
  }),

  F({
    id: 'aeo-answer-capsule',
    label: 'AEO answer capsule',
    hint: 'The citable answer page',
    goal: 'clicks',
    whyItWorks: [
      'Answer engines quote pages that answer in the first 2 sentences, so the capsule wins the citation and the click.',
      'One question per page with a crisp answer is the exact shape AI assistants prefer to source.',
      'The expansion below the answer converts the citation visit into a reader, which search alone never does.',
    ],
    template: [
      'H1: {TheQuestion, exactly as she asks it}?',
      '',
      'Answer capsule (1-3 sentences, self-contained): {TheDirectAnswer}.',
      '',
      'The fuller picture:',
      '{Expansion: 3-5 short sections, each one idea}.',
      '',
      'FAQ:',
      'Q: {RelatedQuestion}',
      'A: {CitableAnswer}',
      '',
      '{SoftCTA: the system that does this for her}',
    ].join('\n'),
    exampleHooks: [
      'What is the mental load of motherhood?',
      'How do you do a brain dump that actually works?',
    ],
    craft: [
      'The H1 is the verbatim question. The capsule answers it completely in 1-3 sentences with zero preamble, written to be quoted word for word.',
      'Expand below in short sections that add the how, the why, and the pitfalls, one idea each.',
      'Add 2-4 related FAQ pairs in the same citable shape. Soft CTA closes: the system holds this for her.',
    ].join(' '),
    platforms: ['aeo', 'blog'],
    formats: ['answer', 'blog'],
  }),

  /* Round 2 (promptBankRound2.ts): 10 more FB ad frameworks, 8 LinkedIn  */
  /* organic frameworks, and 8 ultra-long-form value-forward structures. */
  ...PROMPT_RECIPES_ROUND2,

  /* Round 3 (promptBankRound3.ts): the YouTube round. 8 Shorts script    */
  /* frameworks, 8 long-form script frameworks, and 6 YouTube ad scripts. */
  ...PROMPT_RECIPES_ROUND3,

  /* Round 4 (promptBankRound4.ts): the TikTok half of the video-first    */
  /* round. 10 TikTok script frameworks and 6 TikTok ad script frameworks. */
  ...PROMPT_RECIPES_ROUND4,

  /* Round 5 (promptBankRound5.ts): the email ascension round. 8 email-   */
  /* sophisticated sends, 6 emlf- ultra-long-form essays, 8 embuy-        */
  /* purchase + OTO nurture, and 4 emgoal- goal-driven frameworks.        */
  ...PROMPT_RECIPES_ROUND5,
];

/** Look up a recipe by id. */
export function getPromptRecipe(id?: string | null): PromptRecipe | undefined {
  return id ? PROMPT_RECIPES.find((r) => r.id === id) : undefined;
}

/** Recipes that are a strong fit for a platform/format pair. */
export function recipesFor(
  platform?: ContentPlatform,
  format?: ContentFormat,
  pool: PromptRecipe[] = PROMPT_RECIPES,
): PromptRecipe[] {
  return pool.filter((r) => {
    const platformOk =
      !r.platforms.length || !platform || r.platforms.includes(platform);
    const formatOk =
      !r.formats.length || !format || r.formats.includes(format);
    return platformOk && formatOk;
  });
}

/**
 * Compose the full craft block for one recipe on one platform: generation
 * orders, the fill-in template, why it performs, the platform note, and
 * exemplar openers. Injected into batch and amplify prompts.
 */
export function recipeCraftBlock(
  recipe: PromptRecipe,
  platform?: ContentPlatform,
): string {
  const parts: string[] = [`Framework "${recipe.label}": ${recipe.craft}`];
  if (recipe.template.trim()) {
    parts.push(
      `Execute this proven structure (fill the {Slots}, do not output the braces or slot names literally):\n${recipe.template}`,
    );
  }
  if (recipe.whyItWorks.length) {
    parts.push(`Why it performs: ${recipe.whyItWorks.join(' ')}`);
  }
  const note = platform ? recipe.platformNotes?.[platform] : undefined;
  if (note) parts.push(`Platform execution for ${platform}: ${note}`);
  if (recipe.exampleHooks.length) {
    parts.push(
      `Openers in this vein (match the energy, never copy): ${recipe.exampleHooks
        .map((h) => `"${h}"`)
        .join(' · ')}`,
    );
  }
  return parts.join('\n');
}

/**
 * Compose the user-supplied-material block for one recipe from the values the
 * admin filled into its custom input fields. Empty values are skipped; when
 * nothing is filled the block is empty and generation runs from the offer
 * facts as before. Injected right after the craft block so the model grounds
 * the piece in the real material while the voice rules still win.
 */
export function recipeInputsBlock(
  recipe: PromptRecipe,
  values?: Record<string, string> | null,
): string {
  if (!recipe.inputs?.length || !values) return '';
  const lines: string[] = [];
  for (const field of recipe.inputs) {
    const value = (values[field.id] ?? '').replace(/\s+/g, ' ').trim();
    if (!value) continue;
    const steer = field.hint?.trim() ? ` (${field.hint.trim()})` : '';
    lines.push(`- ${field.label}${steer}: "${value}"`);
  }
  if (!lines.length) return '';
  return [
    'User-supplied material. Ground the piece in it: adapt it to the MotherMode voice, keep every specific true to what the user wrote, and never invent contradicting details.',
    ...lines,
  ].join('\n');
}

/**
 * Pick `count` distinct frameworks for an Auto batch, in rotation order, among
 * those that fit the channel. Falls back to any remaining frameworks when the
 * fitting pool is smaller than the batch, and finally allows repeats of the
 * strongest fits, so a batch of any size always has an assignment.
 */
export function frameworkRotation(
  platform: ContentPlatform,
  format: ContentFormat,
  count: number,
  pool: PromptRecipe[] = PROMPT_RECIPES,
): PromptRecipe[] {
  const fits = recipesFor(platform, format, pool);
  const ordered =
    fits.length >= count
      ? fits
      : [...fits, ...pool.filter((r) => !fits.includes(r))];
  const out: PromptRecipe[] = [];
  for (let i = 0; i < count; i++) {
    out.push(ordered[i % ordered.length]);
  }
  return out;
}

/** Short rotation line for the batch prompt: one recipe per piece, in order. */
export function rotationAssignmentLines(
  recipes: PromptRecipe[],
  platform: ContentPlatform,
): string {
  return recipes
    .map((r, i) => {
      const note = r.platformNotes?.[platform];
      return [
        `Piece ${i + 1} executes framework "${r.label}" (id "${r.id}"): ${r.craft}`,
        r.template
          ? `Structure:\n${r.template}`
          : '',
        note ? `Platform note: ${note}` : '',
      ]
        .filter(Boolean)
        .join(' ');
    })
    .join('\n\n');
}
