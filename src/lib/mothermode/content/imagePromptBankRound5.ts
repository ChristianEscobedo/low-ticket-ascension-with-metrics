/**
 * Image prompt bank, round 5: the email image sub-bank. Six header and
 * section-image frameworks for the inbox, merged into IMAGE_PROMPT_RECIPES
 * in imagePromptBank.ts. Same rules as the earlier rounds: renders stay
 * clean of baked-in text (the email HTML or the overlay editor carries
 * words), faces stay off, palette stays warm bone / deep aubergine / aged
 * brass.
 *
 * Inbox rendering note: email clients show these at about 600 pixels wide,
 * so every recipe composes one focal idea with a generous clean zone and
 * bold simple shapes that survive small, compressed, dark-mode-flipped
 * rendering. All render on the email-header preset (1200x600, 2:1).
 */
import type { PromptRecipe } from './promptBank';

const I = (
  r: Omit<PromptRecipe, 'group' | 'builtin'>,
): PromptRecipe => ({ ...r, group: 'image', builtin: true });

export const IMAGE_PROMPT_RECIPES_ROUND5: PromptRecipe[] = [
  I({
    id: 'emimg-header-calm',
    label: 'Email img: Calm header',
    hint: 'Type-ready banner for letter emails',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A quiet branded banner at the top of a letter email signals care without shouting, which is exactly the register that keeps nurture emails welcome in the inbox.',
      'One calm field with a tiny anchor object reads instantly at 600 pixels wide, where email clients actually render images.',
      'A type-ready header lets the subject line or the week\'s word repeat as overlay text, so one render serves a whole series.',
    ],
    template: [
      '{CalmField: warm plaster, soft linen, pale oak grain} filling the frame, {Treatment: even tone, gentle raking light}.',
      '',
      'One small anchor at {Placement: lower right third}: {Anchor: a brass pen, a ceramic cup, a single printed page}.',
      '',
      'The center and left stay smooth and low-contrast for the overlay line. No text in the render, no logos.',
    ].join('\n'),
    exampleHooks: [
      'A warm bone plaster wall in soft morning light filling the frame, one small brass pen resting on a pale oak ledge in the lower right third, the center and left smooth and even for a single overlay line. Minimal, quiet, premium, no text.',
      'Soft aubergine linen with gentle folds as a full-frame texture, a tiny ceramic espresso cup in the lower right corner, generous calm space across the middle for type. Quiet letter-header mood, no text.',
    ],
    craft: [
      'One texture, one anchor, one tone family. The banner is a signature, not an illustration; anything busier fights the letter below it.',
      'Compose for 600-pixel-wide email rendering: bold simple shapes, even tone behind the type zone, no fine detail that turns to noise.',
      'The center-left stays clean for the overlay line. No text, no lettering, no logos in the render.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
    sizePresetIds: ['email-header'],
  }),

  I({
    id: 'emimg-offer-hero',
    label: 'Email img: Offer hero',
    hint: 'The artifact, shot like it matters',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Offer emails convert on concreteness: showing the artifact (the printed page, the binder, the tablet) answers "what exactly do I get" before the copy says a word.',
      'A hero shot inside the email re-anchors the reader who scrolled past the same artifact on the sales page, and recognition converts.',
      'Premium treatment of a low-ticket product lifts perceived value past the price, which is the whole economics of the ascension chain.',
    ],
    template: [
      '{TheArtifact: the printed system, binder, or tablet showing the one page} resting on {StyledSurface: warm oak, linen, stone}.',
      '',
      'Props that tell the use: {Props: pen, reading glasses, coffee, 2-3 maximum}.',
      '',
      'Soft directional light, generous negative space at {Third} for the overlay line. Page content stays abstract (lines and boxes), never readable. No text in the render, no logos.',
    ].join('\n'),
    exampleHooks: [
      'A printed one-page household system in a slim brass clip frame standing on warm oak beside a ceramic coffee cup and a pen, soft directional window light, the left third clean for an overlay line. Editorial product photography, warm bone and aged brass, page content abstract, no text.',
      'Overhead flat lay of a tablet showing an abstract checklist screen, reading glasses and a linen napkin on stone, soft shadows, generous quiet space across the top for type. Premium, calm, photorealistic, no text.',
    ],
    craft: [
      'The artifact is the star, shot with product-photography respect: one hero item, 2-3 props that prove daily use, nothing decorative.',
      'Any screen or page content is abstract blocks and lines, never readable words; the email HTML carries the copy.',
      'Keep one third clean for the overlay line and compose bold enough to read at 600 pixels wide in an email client. No text, no logos.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
    sizePresetIds: ['email-header'],
  }),

  I({
    id: 'emimg-receipt-proof',
    label: 'Email img: The receipt',
    hint: 'Proof macro for story and report emails',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A macro of the evidence (the tally column, the ticked boxes, the circled dates) proves the claim visually, so the case-study and report emails never ask the reader to take anyone\'s word for it.',
      'Almost-readable marks trigger lean-in curiosity that clean graphics never do, and lean-in is what scrolls the reader into the body.',
      'Receipt imagery inside the email mirrors the receipts cited in the copy, which doubles the credibility of both.',
    ],
    template: [
      'Macro close-up of {TheEvidence: the tally sheet, the ticked weekly page, the calendar with circled Sundays} on {Surface: worn wood, linen, dark oak}.',
      '',
      'Marks are visible but abstract: {Marks: pen ticks, circled dates, a column of checkmarks}.',
      '',
      '{Light: raking window light, soft shadows}, shallow focus on {FocalPoint: the densest column}. Clean band at {Third} for the overlay line. No readable words, no logos, no text.',
    ].join('\n'),
    exampleHooks: [
      'Macro close-up of a tally sheet on worn wood, columns of pen tick marks, a brass pen at the frame edge, raking window light, shallow focus on the densest column, the top band clean for a small overlay line. Proof, wordless, no readable text.',
      'A calendar page with four Sundays circled in brass-colored pen, shot tight with soft shadows, the pattern telling the story, quiet space on the right for type. The receipt as the header, no readable words, no text.',
    ],
    craft: [
      'The evidence fills the frame; proof feels closer when it is big. One focal point (the densest column, the last tick) anchors the macro.',
      'Every mark stays abstract (ticks, circles, lines) so nothing is literally readable; the email copy supplies the words.',
      'Compose bold for 600-pixel email rendering and keep one band clean for the overlay line. No readable text, no logos.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
    sizePresetIds: ['email-header'],
  }),

  I({
    id: 'emimg-welcome-scene',
    label: 'Email img: Welcome scene',
    hint: 'Warm first-day scene for buyer emails',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A warm, lived-in scene at the top of a purchase email extends the feeling of a good decision, and affirmed buyers do not refund.',
      'First-day scenes (the calm table, the open page, the fresh coffee) picture the result she just bought, which starts activation before the first instruction.',
      'Welcome imagery humanizes transactional mail, and the welcome receipt is the most-opened email the brand ever sends.',
    ],
    template: [
      '{TheWelcomeScene: a calm kitchen table with the printed page laid out, morning light, fresh coffee} shot {Framing: from her seat, eye level}.',
      '',
      'Fresh-start details: {Details: the pen uncapped, the first box ticked, steam rising}.',
      '',
      'Warm motivated light, gentle depth, clean quiet band at {Third} for the overlay line. No people, no text.',
    ].join('\n'),
    exampleHooks: [
      'A calm kitchen table in morning light with a printed weekly page laid out flat, a pen uncapped beside it, fresh coffee steaming, shot from her seat at eye level, the top band quiet for an overlay line. First-day warmth, no people, no text.',
      'A printed page on a fridge held by one brass magnet, morning kitchen light, a mug steaming in the soft foreground blur, clean space across the top for type. The welcome, pictured, no text.',
    ],
    craft: [
      'Picture the first day of the result, not the product: the page in use, the steam, the morning light. The scene says "good decision" without a word.',
      'Shoot from her seat at eye level so the frame becomes her view. One fresh-start detail (the uncapped pen, the first tick) is enough.',
      'Keep the top band clean for the overlay line and the shapes bold for 600-pixel rendering. No people, no text.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
    sizePresetIds: ['email-header'],
  }),

  I({
    id: 'emimg-event-card',
    label: 'Email img: Event card',
    hint: 'Invite header with a date-safe zone',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Event emails live or die on the header: one composed scene with a protected zone for the date and title converts the open into a registration decision in a glance.',
      'A scene that pictures the after-state (the calm she will learn to build) sells the transformation the invite copy promises.',
      'Keeping the date zone clean means one render serves the whole event series with only the overlay changing.',
    ],
    template: [
      '{TheEventScene: the prepared table for a workshop, one printed page per seat, a single lamp lit} shot {Framing: wide, slightly elevated}.',
      '',
      'A clear {Zone: upper third or right band} stays smooth and even for the date and title the overlay adds.',
      '',
      'Warm expectant light, simple shapes, everything composed and ready. No people, no text, no baked-in dates.',
    ].join('\n'),
    exampleHooks: [
      'A prepared workshop table with one printed page per seat, a single warm lamp lit, shot wide and slightly elevated, the upper third smooth and even for the event date and title overlay. Expectant, calm, premium, no people, no text.',
      'A long oak table set for a small class: five printed pages, five pens, one pot of coffee, soft evening light, the right band kept clean and dark for the event details. The room before the room fills, no text.',
    ],
    craft: [
      'Picture the room ready: the prepared table, the pages, the one lamp. Expectation is the emotion; clutter kills it.',
      'Protect the date zone absolutely (upper third or one band, smooth and even). The overlay adds the title and date; the render bakes in neither.',
      'Compose bold and simple for 600-pixel email rendering. No people, no text, no baked-in dates or logos.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
    sizePresetIds: ['email-header'],
  }),

  I({
    id: 'emimg-divider-rule',
    label: 'Email img: The divider',
    hint: 'Minimal section break for long essays',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Long value emails need air: a minimal image divider resets attention between chapters better than any horizontal rule.',
      'A quiet mid-email scene (one object, vast space) gives the reader a breath without breaking the essay\'s spell, which protects completion.',
      'Divider images carry the brand palette through a long plain-text send, so the essay reads designed without a single banner.',
    ],
    template: [
      '{TheSingleObject: the brass pen, the closed notebook, the ceramic cup} placed {Position: low, off-center} against {TheField: a vast even field of warm bone, soft aubergine, or pale oak}.',
      '',
      'One long soft shadow for orientation. The field is at least 80 percent of the frame.',
      '',
      'Composed as a pause: extreme calm, nothing to read, nothing to solve. No text, no logos.',
    ].join('\n'),
    exampleHooks: [
      'A single brass pen resting low and off-center on a vast warm bone field, one long soft shadow, the frame 80 percent quiet even tone. A breath between chapters, minimal and premium, no text.',
      'A closed slim notebook in the lower right of a deep aubergine seamless, soft raking light, enormous still space around it. The divider as a palate cleanser, no text.',
    ],
    craft: [
      'One small object, one vast field, one shadow. The divider is a pause, so it must ask nothing of the reader.',
      'Aim for 80 percent smooth even tone; the emptiness is the design, and it must survive 600-pixel email rendering without banding.',
      'Palette locked to bone, aubergine, brass so the essay carries the brand without banners. No text, no logos.',
    ].join(' '),
    platforms: ['email'],
    formats: ['email'],
    sizePresetIds: ['email-header'],
  }),
];
