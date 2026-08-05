/**
 * Image prompt bank, round 2: more Facebook ad creatives, more YouTube
 * thumbnail CTR frameworks, LinkedIn organic image structures, and the
 * Instagram carousel slide-role system. Merged into IMAGE_PROMPT_RECIPES in
 * imagePromptBank.ts. Same brand lock: renders stay clean of baked-in text
 * (the overlay editor adds words later), faces stay off unless a recipe opts
 * in, palette stays warm bone / deep aubergine / aged brass.
 */
import type { PromptRecipe } from './promptBank';

const I = (
  r: Omit<PromptRecipe, 'group' | 'builtin'>,
): PromptRecipe => ({ ...r, group: 'image', builtin: true });

export const IMAGE_PROMPT_RECIPES_ROUND2: PromptRecipe[] = [
  /* ------------------------------------------------------------------ */
  /* Facebook ad creatives, round 2.                                     */
  /* ------------------------------------------------------------------ */

  I({
    id: 'fbad-question-card',
    label: 'FB ad: Question card',
    hint: 'A calm field for the big question',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A question in big type on a quiet background is the cheapest high-CTR ad structure ever measured for problem-aware audiences.',
      'The calm field makes the question feel personal instead of promotional, which earns the read.',
      'One render serves unlimited question tests, so creative testing costs drop to copywriting time only.',
    ],
    template: [
      '{VastCalmTexture: warm plaster, linen, or smooth oak} filling the frame in one even tone.',
      '',
      'One small grounding detail at {Edge}: {Detail: a brass pen, a ceramic cup, a single form}.',
      '',
      'Two thirds of the frame stay smooth and uniform for a large question overlay. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'A smooth warm-plaster wall in soft side light, one school form half-tucked under a brass paperweight in the bottom right corner, the rest of the frame even and quiet for a big question overlay. Minimal, premium, editorial.',
      'Washed bone linen with gentle folds filling the frame, a cold cup of coffee in the lower left third, vast calm space above for 5 to 7 words of overlay type. Quiet, warm, photographic.',
    ],
    craft: [
      'The texture carries the whole ad: pick one calm surface and keep it boring on purpose.',
      'The single grounding detail hints at the topic (a form, a cup, a pen) without cluttering the type zone.',
      'Two thirds of the frame must hold 5 to 7 bold words with total legibility. Render clean, no lettering.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45', 'ad-916'],
  }),

  I({
    id: 'fbad-checklist-visual',
    label: 'FB ad: The ticked list',
    hint: 'The proof of order, up close',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A nearly-complete checklist is visual proof that the system works, and proof outsells promise.',
      'Tick marks trigger completion desire: she wants the same satisfying grid on her own fridge.',
      'The close crop reads instantly at feed size, where detailed scenes die.',
    ],
    template: [
      'Close-up of {TheChecklist: a printed weekly page with most boxes ticked in pen} on {Surface}.',
      '',
      'One unticked row draws the eye: {TheOpenItem}.',
      'A {Pen: brass pen} rests beside it, mid-task.',
      '',
      'Shallow focus on the densest run of tick marks. Space at {Third} for the overlay headline. No readable words, only abstract list lines.',
    ].join('\n'),
    exampleHooks: [
      'Close-up of a printed weekly checklist on a worn wooden table, nine of ten boxes ticked in blue pen, one row open, a brass pen resting across the bottom edge, shallow focus on the run of tick marks, top edge clean for overlay text. Abstract list lines only, no readable words. Warm window light, editorial documentary.',
      'A checklist card held to a fridge by one brass magnet, every line ticked but the last, shot straight on with soft indoor light, the bottom third quiet for a headline overlay. Photorealistic, calm, honest.',
    ],
    craft: [
      'The satisfaction IS the creative: a dense run of tick marks with exactly one row left open.',
      'All list lines are abstract marks, never readable words. The overlay and primary text carry the message.',
      'Tight crop, shallow focus, one resting prop. Proof should feel used, not staged.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
  }),

  I({
    id: 'fbad-founder-note',
    label: 'FB ad: The handwritten note',
    hint: 'A letter, photographed',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A photographed handwritten note reads as a person, not an ad, and people stop for people.',
      'Handwriting implies effort and honesty, which lifts trust before a word of copy is read.',
      'The note aesthetic pairs perfectly with founder-note primary text, compounding the same signal.',
    ],
    template: [
      'A handwritten note on {Paper: cream paper, slightly curved} lying on {Surface: warm oak desk}.',
      '',
      'The writing is visible but abstract: {AbstractScript: flowing pen lines, a signature flourish at the bottom}.',
      'One prop anchors the scene: {Prop: coffee cup, reading glasses, pen resting on the page}.',
      '',
      'Soft window light, slight shadows from the page curl. Space at {Third} for overlay. No readable words.',
    ].join('\n'),
    exampleHooks: [
      'A handwritten letter on cream paper lying on a warm oak desk, flowing abstract pen lines with a signature flourish at the bottom, a brass pen resting across the top of the page, reading glasses beside it, soft window light with gentle page-curl shadows. Intimate, honest, editorial. No readable words.',
      'Overhead shot of a note card with abstract handwriting lines, a coffee ring near one corner, the card slightly rotated on linen, morning light, the left third kept smooth for overlay text. Quiet, personal, photographic.',
    ],
    craft: [
      'The note must look written, not printed: cream paper, a curl, abstract flowing pen lines ending in a signature flourish.',
      'Keep every line illegible. The moment a word reads, the spell breaks and the overlay headline fights it.',
      'One anchoring prop (pen, glasses, coffee) tells the desk story. Soft light, honest shadows.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
  }),

  I({
    id: 'fbad-phone-mockup',
    label: 'FB ad: Phone in hand',
    hint: 'The system on her screen',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A phone-in-hand shot answers "what does it look like" instantly, the top question for any digital product.',
      'Screen-mockup ads convert because they make an intangible system feel like an object she can hold.',
      'The in-use context (kitchen counter, couch) keeps it native instead of techy, which fits the audience.',
    ],
    template: [
      'A smartphone held in one hand at {Angle: slight tilt, natural grip}, screen toward camera, over {ContextSurface: kitchen counter, couch arm}.',
      '',
      'On screen: {AbstractUI: a clean checklist interface made of abstract blocks, lines, and tick shapes, no readable text}.',
      '',
      'Natural indoor light with a soft screen glow. Background softly blurred. Clean zone at {Third} for overlay. No readable words on the screen.',
    ].join('\n'),
    exampleHooks: [
      'A smartphone held in one hand over a kitchen counter, screen showing a clean abstract checklist interface of soft blocks and tick shapes, slight tilt, natural grip, warm indoor light with a gentle screen glow, background blurred. Editorial product-in-use photography, top third quiet for overlay text.',
      'Phone in hand on a couch arm at dusk, the screen glowing with an abstract weekly-page layout of lines and circles, a blanket edge in frame, cozy lamp light, shallow depth of field. Calm, premium, real.',
    ],
    craft: [
      'The screen content is an abstract UI of blocks, lines, and tick shapes. Never readable text; the overlay supplies the words.',
      'The grip and context must read as her hand, her kitchen, her couch. Native and warm, not a tech ad.',
      'Screen glow is the light accent: gentle, never blown out. Keep one clean third for the headline.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45', 'ad-916'],
  }),

  I({
    id: 'fbad-mechanism-diagram',
    label: 'FB ad: The mechanism sketch',
    hint: 'How it works, drawn simply',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A simple hand-drawn mechanism diagram explains the system faster than any paragraph, and explanation kills the top objection.',
      'Sketch aesthetics read as transparent and founder-made, which builds trust on cold traffic.',
      'Diagram-style ads earn long dwell time because the eye follows the flow, and dwell feeds ranking.',
    ],
    template: [
      'A hand-drawn flow diagram on {Paper: white or cream paper} photographed {Angle: overhead or slight angle}.',
      '',
      'The flow: {Flow: 3 abstract boxes or circles connected by hand-drawn arrows, left to right: the chaos, the one page, the calm week}.',
      '',
      'A {PenOrMarker} rests beside the paper as if just drawn. Shapes are abstract, labels are short scribble lines, never readable words. Space at {Third} for overlay.',
    ].join('\n'),
    exampleHooks: [
      'Overhead photo of a hand-drawn diagram on white paper: three abstract boxes connected by quick pen arrows flowing left to right, a black marker resting beside the page as if just drawn, small scribble lines under each shape, soft desk light, right third clean for overlay text. Honest, founder-made, editorial.',
      'A napkin-sketch style flow: a tangled scribble on the left resolving into one clean circle on the right, drawn in blue pen on a cream napkin, photographed at a slight angle on oak, morning light. Simple, clever, real.',
    ],
    craft: [
      'Three nodes maximum: the chaos, the one page, the calm week. The eye must finish the flow in 2 seconds.',
      'Everything hand-drawn and abstract: shapes, arrows, scribble labels. No readable words anywhere.',
      'The resting pen sells the just-drawn honesty. Photograph it like a found artifact, not a designed graphic.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
  }),

  I({
    id: 'fbad-testimonial-card',
    label: 'FB ad: The quote card',
    hint: 'Her words, center stage',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A real customer quote in large type is the highest-trust ad format, and a calm card lets the words carry everything.',
      'Quote cards read as content, not creative, which slips past ad blindness on every placement.',
      'One render plus the overlay editor produces an infinite testimonial series at zero design cost.',
    ],
    template: [
      '{WarmField: soft aubergine or warm bone seamless tone} filling the frame evenly.',
      '',
      'One small authenticity mark at {Corner}: {Mark: a tiny brass quotation mark ornament, a small photo-corner detail}.',
      '',
      'The frame is built for a 2-line quote overlay plus a first-name attribution. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'A seamless deep aubergine field in soft even light, one small brass quotation-mark ornament in the top left corner, the entire frame calm and uniform for a two-line quote overlay. Premium, quiet, editorial.',
      'Warm bone plaster with the faintest texture, a small photo-corner detail in the bottom right, vast even space for large quote type and a first-name line. Minimal, trustworthy, photographic.',
    ],
    craft: [
      'The color field is the brand signature: deep aubergine for warmth and gravity, bone for lightness. One tone, edge to edge.',
      'The tiny authenticity mark (brass quote ornament) signals "someone said this" without any baked words.',
      'Compose for a 2-line quote plus attribution. This is the retargeting workhorse: same field, new quote, weekly.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45', 'ad-916'],
  }),

  I({
    id: 'fbad-calendar-urgency',
    label: 'FB ad: The circled date',
    hint: 'Time, made visible',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A circled calendar date creates honest urgency: a real deadline (bonus end, price change, cohort close) made physical.',
      'Calendar imagery converts because it moves the decision from "someday" to "by this day" without any pressure language.',
      'The macro crop reads at feed size and pairs with any deadline copy in the primary text.',
    ],
    template: [
      'Macro shot of a wall or desk calendar page, one date circled in {CircleColor: brass or aubergine pen}.',
      '',
      'The circled date carries small abstract marks: {Marks: a star, a dot, a short scribble}.',
      'A {Prop: pen, glasses} rests at the frame edge.',
      '',
      'Shallow focus on the circle. Everything else soft. Space at {Third} for the overlay deadline line. No readable words or real dates legible.',
    ].join('\n'),
    exampleHooks: [
      'Macro shot of a desk calendar with one date circled twice in brass pen, a small star scribbled beside it, a black pen resting at the bottom of frame, shallow focus pulling the eye straight to the circle, the top third soft and quiet for overlay text. Warm window light, honest urgency, editorial.',
      'A wall calendar in a bright kitchen, one Sunday circled in aubergine marker, the rest of the grid softly blurred, reading glasses hanging at the frame edge. Clean, simple, immediate.',
    ],
    craft: [
      'One circled date, drawn twice, with a tiny scribble mark. The circle is the entire message.',
      'Keep real dates and words illegible: the primary text names the actual deadline, the image just makes time physical.',
      'Only use for honest deadlines (bonus end, price change). Urgency without truth breaks the brand.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
  }),

  I({
    id: 'fbad-hands-holding-page',
    label: 'FB ad: The page in hand',
    hint: 'The offer, offered',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A hand offering the page to camera is the most literal "here it is" an ad can make, and literal converts.',
      'Product-in-hand shots out-pull flat lays for low-ticket offers because they show scale and reality.',
      'The gesture reads as generous and human, which matches the price and the brand tone exactly.',
    ],
    template: [
      'A hand holding {ThePage: the printed one-page system, or a slim printed packet} up toward camera at {Angle: slight angle, natural grip}.',
      '',
      'The page shows {AbstractContent: clean abstract blocks, lines, and tick shapes, no readable text}.',
      'Background: {SoftScene: a calm kitchen or desk, well blurred}.',
      '',
      'Warm natural light on the page, the hand relaxed. Space at {Third} for the overlay headline. No readable words.',
    ].join('\n'),
    exampleHooks: [
      'A hand holding a single printed page up toward camera at a slight angle, the page showing clean abstract checklist blocks and tick shapes, a blurred warm kitchen behind, soft window light on the paper, the top third of frame quiet for overlay text. Generous, honest, editorial product-in-hand.',
      'A slim printed packet held out over a wooden table like an offer, abstract layout lines on the cover page, brass clip on top, soft afternoon light, background warmly blurred. Simple, premium, real.',
    ],
    craft: [
      'The gesture is the pitch: relaxed hand, page offered to camera at a natural angle, nothing else competing.',
      'Page content stays abstract blocks and lines. The overlay and ad copy say what the page is.',
      'Blur the background hard. The page must be the only sharp thing in the frame.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45', 'ad-916'],
  }),

  /* ------------------------------------------------------------------ */
  /* YouTube thumbnails, round 2. More CTR structures for the 16:9      */
  /* canvas, all overlay-safe and wordless in the render.               */
  /* ------------------------------------------------------------------ */

  I({
    id: 'ytthumb-checklist-hero',
    label: 'YT thumb: Checklist hero',
    hint: 'The whole system on one page',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A full checklist page as the hero object makes the video\'s promise tangible: she can see the artifact she is about to get.',
      'Grid-of-ticks compositions read instantly at 120 pixels, where most thumbnails turn to mush.',
      'The nearly-complete grid creates completion curiosity: she clicks to see the whole thing filled.',
    ],
    template: [
      'The printed checklist page heroically framed: {Treatment: straight-on and centered, or held by a brass clip at a slight angle}.',
      '',
      'Content is abstract: {Grid: neat rows of lines and tick shapes, one row open}.',
      '',
      'Strong directional light, confident shadow. Clean band at {Third} for 2-4 overlay words. No readable text.',
    ].join('\n'),
    exampleHooks: [
      'A printed weekly checklist page hanging straight-on from a brass clip against a deep aubergine wall, neat abstract rows of lines and tick shapes with one row open, strong soft light casting a confident shadow, the right third clean for overlay words. Bold, simple, readable small.',
      'The checklist page lying centered on warm oak at a slight angle, tick marks filling every abstract row but one, dramatic window light raking across the paper, top band clear for a short overlay line. Cinematic, honest, high contrast.',
    ],
    craft: [
      'The page is the thumbnail: centered, big, heroic. If it reads as paperwork at 120 pixels, the crop is wrong.',
      'Rows are abstract lines and tick shapes. One row stays open for curiosity.',
      'Protect the overlay band and the bottom-right duration-badge corner.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-timeline-marks',
    label: 'YT thumb: 30-day timeline',
    hint: 'The streak, made visible',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A visible streak (30 marked days) is instant proof of commitment, and commitment is the core promise of any challenge or experiment video.',
      'Timeline grids read as numbers without words, which is the highest-CTR pattern for experiment content.',
      'The one marked or missing day creates a story question the click resolves.',
    ],
    template: [
      'A 30-day tracker or calendar grid, {Coverage: every day marked in brass, or one day circled in aubergine}.',
      '',
      'Marks are abstract: {Marks: X marks, dots, or ticks in neat rows}.',
      '',
      'Shot {Angle: straight-on with soft even light, or macro on the final row}. Clean zone at {Third} for the overlay number. No readable text.',
    ].join('\n'),
    exampleHooks: [
      'A 30-day habit tracker shot straight-on, every day crossed in neat brass X marks, the final day circled in aubergine, soft even light, bold simple geometry readable at 120 pixels, the right third clean for an overlay numeral. Cinematic proof, editorial.',
      'Macro on the last row of a calendar tracker, 27 abstract tick marks in a run, one empty square glowing, a brass pen tip entering frame, dramatic soft light, high contrast. The streak, photographed.',
    ],
    craft: [
      'The grid is the story: neat rows of abstract marks with one day that means something (circled, empty, or starred).',
      'Geometry must survive at 120 pixels: strong rows, big marks, no fine detail.',
      'Reserve the clean zone for the overlay numeral (30, 14, 7) and protect the duration-badge corner.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-minimal-object',
    label: 'YT thumb: Minimal object',
    hint: 'One small thing, vast space',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Extreme minimalism is a pattern interrupt on YouTube, where every other thumbnail screams with clutter.',
      'One small meaningful object in vast space creates monument energy: the thing looks important because nothing else exists.',
      'The vast field doubles as the overlay zone, so words and image never fight.',
    ],
    template: [
      '{SingleSmallObject: the brass whistle, the rolled page, the single magnet} placed at {Position: lower third, rule of thirds} on {VastField: seamless warm bone, fog, or deep aubergine}.',
      '',
      'Strong but soft directional light, one long elegant shadow.',
      '',
      'Over 70% of the frame is empty field, reserved for the overlay words. No other props, no text.',
    ].join('\n'),
    exampleHooks: [
      'A single rolled printed page tied with twine standing in the lower third of a vast deep-aubergine field, one long elegant shadow raking right, over 70% of the frame empty for bold overlay words. Monument minimalism, cinematic, premium.',
      'One small brass magnet on an endless warm bone surface, dead-center low, soft directional light, nothing else existing in frame. Quiet, confident, instantly readable small.',
    ],
    craft: [
      'One object, one shadow, nothing else. The emptiness is what makes it feel important.',
      'Place low or off-center so the overlay words own the upper two thirds.',
      'This is the signature thumbnail for calm-authority videos. The rarer it is used, the harder it hits.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-simple-chart',
    label: 'YT thumb: The physical chart',
    hint: 'Growth, built from objects',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A physical ascending shape (blocks, steps, stacked cups) communicates growth and progress without a single word or axis.',
      'Data-shaped objects outperform digital charts because they feel real and read at any size.',
      'Ascending compositions prime outcome expectations, which is exactly the click motivation for method videos.',
    ],
    template: [
      '{AscendingObjects: wooden blocks, stacked books, or stepped risers} arranged as a rising bar shape, left to right, on {Surface}.',
      '',
      'The final step carries {ThePayoffObject: the printed page, a small flag, a brass tick mark}.',
      '',
      'Clean background, strong soft light, long shadows emphasizing the rise. Space at {Third} for overlay. No text, no axis lines.',
    ].join('\n'),
    exampleHooks: [
      'Five wooden blocks ascending left to right like a bar chart on a warm oak table, a small printed page standing on the tallest block, strong soft light throwing long shadows downhill, clean bone background, top third clear for overlay words. Growth, built from objects, editorial.',
      'Three stacked books rising in steps on linen, a brass tick ornament on the summit, window light from the left, vast quiet space above for a short overlay line. Simple, optimistic, premium.',
    ],
    craft: [
      'Build the rise from real objects: 3 to 5 ascending elements, clearly increasing, no more.',
      'The summit carries the payoff object (the page, the tick). The eye should land there last.',
      'No axes, no gridlines, no text. The shape alone says "this goes up".',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-mirror-split',
    label: 'YT thumb: Mirror split',
    hint: 'Two realities, one frame',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A mirror reflecting a different reality than the scene in front of it creates a visual riddle that demands the click.',
      'It shows transformation in a single photographic frame with no split line, which reads more premium than a hard before-after cut.',
      'Viewers zoom to compare the two states, and zoom time is ranking time.',
    ],
    template: [
      '{SceneComposition: a table or counter in the foreground holding {TheBefore: honest clutter}, with a mirror or framed glass behind reflecting {TheAfter: the same space, calm and ordered}}.',
      '',
      'Same light family across both states so the difference reads as method, not editing.',
      '',
      'Clean band at {Third} for 2-4 overlay words. No text, no arrows, no labels.',
    ].join('\n'),
    exampleHooks: [
      'A kitchen counter in the foreground covered in school forms and snack wrappers, a round mirror on the wall behind reflecting the same counter cleared to one page and a coffee, same warm light across both, a clean top band for overlay words. Two realities in one honest frame, cinematic.',
      'A desk with a chaotic Monday spread in front, an oval mirror behind it reflecting the Sunday-calm version of the same desk, soft evening light, bold simple shapes readable small. The transformation, without a cut line.',
    ],
    craft: [
      'Foreground holds the before, the reflection holds the after. One frame, zero graphic devices.',
      'Match light and palette between the states so the only variable is order.',
      'Keep both states simple enough to compare at 120 pixels. The riddle must resolve in a glance.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-offer-stack',
    label: 'YT thumb: The offer stack',
    hint: 'Everything she gets, in frame',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Laying out the complete deliverable stack converts "what is it" into "look how much", which is the click motivation for product videos.',
      'A tidy pile of artifacts reads as abundance and order at once, the two strongest low-ticket purchase triggers.',
      'The flat-lay stack survives small sizes because the shapes are big and few.',
    ],
    template: [
      'Overhead or 45-degree composition of the complete stack: {Items: the printed system pages, cover card, bonus card, slim packet} arranged {Arrangement: neat fan or grid} on {Surface}.',
      '',
      'One hero item largest at {Position}. {Prop: brass pen or clip} as the scale anchor.',
      '',
      'Soft even light, gentle shadows. Clean edge at {Third} for overlay words. Abstract content only, no readable text.',
    ].join('\n'),
    exampleHooks: [
      'A 45-degree shot of a complete printed system: cover card, five interior pages fanned neatly, a small bonus card, and a brass clip on warm linen, one corner of the frame open for overlay words, soft even daylight, gentle shadows. Premium abundance, editorial product photography.',
      'Overhead grid of the whole offer: packet, worksheets, and pen arranged with grid discipline on oak, abstract layout lines on every page, the right edge kept clear for a short overlay line. Calm, rich, honest.',
    ],
    craft: [
      'Show every component in one frame, hero item largest, 4 to 6 items maximum. The pile IS the value proposition.',
      'Grid or fan arrangement with real margins. Flat compositions punish clutter.',
      'All page content is abstract. The overlay names the offer; the frame proves the volume.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-myth-busted',
    label: 'YT thumb: Myth busted',
    hint: 'The crossed-out object',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A crossed-out familiar object promises a contrarian correction, and correction is the strongest curiosity trigger for advice-content.',
      'The physical X (tape, ribbon, cord) reads at 120 pixels where a text X would die.',
      'Myth-bust thumbnails pre-frame the video as an upgrade, which attracts the highest-intent viewers.',
    ],
    template: [
      '{TheMythObject: the planner, the stack of apps on a phone, the complicated binder} at {Position: center or slightly low}, crossed by {TheX: a strip of red tape, a red cord, two crossed brass pens}.',
      '',
      'Background: {CleanField: seamless bone or aubergine, uncluttered}.',
      '',
      'Strong simple shapes, high contrast, clean band at {Third} for the overlay words. No text, no drawn X graphic.',
    ].join('\n'),
    exampleHooks: [
      'A thick complicated planner lying centered on a seamless bone background, crossed by a single strip of red tape from corner to corner, strong soft light, bold simple shapes readable at 120 pixels, top band clean for overlay words. The myth, retired, cinematic.',
      'A phone crowded with bright app icons on aubergine seamless, two brass pens crossed over it in an X, dramatic soft shadows, instantly readable small. The popular answer, crossed out, no words needed.',
    ],
    craft: [
      'The myth object must be instantly recognizable (the planner, the app stack, the binder) and the X must be physical (tape, cord, crossed pens).',
      'One object, one X, one clean field. Anything more dilutes the message.',
      'Keep it honest: the video must actually retire the thing. No baiting a myth you half-defend.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-day-in-life',
    label: 'YT thumb: Day in the life',
    hint: 'The quiet hour, framed',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Day-in-the-life content wins on atmosphere, and a cinematic quiet hour (6 am kitchen, 9 pm desk) sells the fantasy of an ordered day.',
      'Atmospheric thumbnails attract long-watch viewers, which compounds CTR with retention.',
      'A single motivated light source at an unusual hour reads as intimate and premium in a feed of noon light.',
    ],
    template: [
      'A quiet scene at a specific hour: {TheScene: the 6 am kitchen with one lamp on, the 9 pm desk with the day closed}.',
      '',
      'One motivated light source: {Light: a single warm lamp, dawn through blinds}.',
      'One human-trace object: {Trace: the steaming cup, the open page, the closed laptop}.',
      '',
      'Strong negative space at {Third} for 2-4 overlay words. No people, no text.',
    ].join('\n'),
    exampleHooks: [
      'A kitchen at 6 am with one warm lamp on over a notebook and a French press, windows still dark, steam curling through the lamplight, strong negative space in the upper third for overlay words. The quiet hour, cinematic and intimate.',
      'A desk at 9 pm, laptop closed on a finished day, one printed page beside it, a single warm light pooling on the paper, the rest of the room falling to shadow. Calm, resolved, premium.',
    ],
    craft: [
      'Pick the hour and light first: one lamp, one pool of warm light, everything else quiet.',
      'The human-trace object (steam, open page, closed laptop) implies the person without showing her.',
      'Protect a clean third for overlay words and keep shapes simple enough for small sizes.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  /* ------------------------------------------------------------------ */
  /* LinkedIn organic images. Calm, professional scenes that earn the   */
  /* pause in a feed of headshots and hustle graphics.                  */
  /* ------------------------------------------------------------------ */

  I({
    id: 'liimg-quote-card',
    label: 'LinkedIn: Quote card',
    hint: 'A calm field for the one line',
    goal: 'shares',
    kind: 'organic',
    whyItWorks: [
      'A single strong line on a calm professional field is the most re-posted image format on LinkedIn.',
      'The restraint reads as confidence in a feed of busy graphics, and contrast is attention.',
      'One render plus the overlay editor produces an always-on-brand quote series at zero design cost.',
    ],
    template: [
      '{ProfessionalField: deep aubergine seamless, warm bone plaster, or soft grey linen} filling the frame evenly.',
      '',
      'One small grounding detail at {Edge}: {Detail: a brass pen, a slim notebook edge, a ceramic cup}.',
      '',
      'Over two thirds of the frame stays smooth and uniform for a 1 to 2 line quote overlay. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'A deep aubergine seamless field in soft even light, a slim brass pen resting in the bottom right corner, the rest of the frame calm and uniform for a two-line quote overlay. Premium, restrained, editorial.',
      'Warm bone plaster with soft texture, the edge of a closed notebook in the lower left third, vast even space above for one strong line. Quiet authority, photographic.',
    ],
    craft: [
      'One calm professional field, one tiny detail. The emptiness is what makes the line feel worth reading.',
      'Compose for 1 to 2 overlay lines plus room to breathe. Legibility at mobile size is the whole test.',
      'Alternate aubergine and bone fields across the series so the feed never repeats itself.',
    ].join(' '),
    platforms: ['linkedin'],
    formats: ['feed'],
    sizePresetIds: ['li-feed-square', 'li-feed-landscape'],
  }),

  I({
    id: 'liimg-doc-cover',
    label: 'LinkedIn: Document cover',
    hint: 'The PDF cover that earns the swipe',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'The cover slide decides the entire document post: a cover built for big type outperforms any photo with text squeezed on.',
      'A clean editorial cover signals "worth downloading" before a word is read, and downloads are the top save signal on LinkedIn.',
      'One cover template renders the whole document series, so every upload looks like the same premium publication.',
    ],
    template: [
      '{CoverComposition: a calm editorial scene or field} with a strong clean zone at {Zone: the left half or top third} for the document title.',
      '',
      'One small signature detail: {Detail: brass rule line texture, a small ornament, a paper edge}.',
      '',
      'The title zone must hold 4 to 6 bold words at upload size. No text in the render, no busy detail behind the zone.',
    ].join('\n'),
    exampleHooks: [
      'A warm bone paper-texture field with a thin brass rule detail along the left edge, a small oak desk strip at the bottom holding a brass pen, the left half smooth and even for a five-word document title. Editorial cover design, photographic and premium.',
      'Soft aubergine linen filling the frame, a small paper edge and brass clip in the bottom right, the top third completely calm for the title overlay. Quiet publication quality, minimal.',
    ],
    craft: [
      'Design the cover around the title zone first: pick the calmest half of the frame and keep it empty.',
      'The small signature detail (brass rule, clip, paper edge) gives the series its recognizable spine.',
      'Test the zone: 4 to 6 bold words at upload size, total legibility. No text baked into the render.',
    ].join(' '),
    platforms: ['linkedin'],
    formats: ['carousel', 'feed'],
    sizePresetIds: ['li-carousel', 'li-feed-square'],
  }),

  I({
    id: 'liimg-process-diagram',
    label: 'LinkedIn: Process diagram',
    hint: 'The system, as a clean sketch',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'A simple process diagram is the most saved image type on LinkedIn because it is a reference, not a decoration.',
      'Hand-drawn flow aesthetics read as transparent and founder-made, which builds authority faster than polished graphics.',
      'The mechanism made visible pre-answers "how does it work", the top scroll-past reason in the niche.',
    ],
    template: [
      'A hand-drawn process flow on {Paper: white or cream paper} photographed {Angle: overhead or slight angle}.',
      '',
      'The flow: {Flow: 3 to 5 abstract shapes connected by arrows: input, the weekly download, the one page, the calm week}.',
      '',
      'A {PenOrMarker} rests beside the paper. Shapes and labels are abstract scribbles, never readable words. Clean zone at {Third} for the overlay title.',
    ].join('\n'),
    exampleHooks: [
      'Overhead photo of a hand-drawn flow on white paper: four abstract boxes connected by neat pen arrows ending in a circled calm shape, a black marker resting beside the page, small scribble labels under each box, soft desk light, top edge clean for a title overlay. Founder-made, honest, editorial.',
      'A cream index card with a simple hand-drawn loop: three circles feeding one central square, drawn in blue pen, photographed at a slight angle on oak, morning light, right third quiet for the title. Clear, clever, real.',
    ],
    craft: [
      '3 to 5 nodes in a clean left-to-right or loop flow: input, the weekly download, the one page, the calm week.',
      'Everything hand-drawn and abstract. Readable words kill the overlay title and the honesty at once.',
      'The resting pen and real paper sell the founder-made signal. Photograph like an artifact, not a graphic.',
    ].join(' '),
    platforms: ['linkedin'],
    formats: ['feed', 'carousel'],
    sizePresetIds: ['li-feed-square', 'li-carousel'],
  }),

  I({
    id: 'liimg-workspace-hero',
    label: 'LinkedIn: The calm desk',
    hint: 'Executive calm, one scene',
    goal: 'shares',
    kind: 'organic',
    whyItWorks: [
      'A genuinely calm workspace photograph stands out in a feed of hustle theater, and calm is the brand\'s whole argument made visual.',
      'Desk scenes earn saves from professionals who want the reference for their own space, and saves train the algorithm.',
      'The scene quietly proves the system exists: the visible page, the single pen, the closed laptop.',
    ],
    template: [
      'A calm, ordered workspace: {TheScene: a clear desk with one printed page, a closed laptop, one warm cup}.',
      '',
      'Light: {Light: morning window light, one warm lamp}. Composition: {WideOrTight}, strong negative space.',
      '',
      'Every object earns its place: {Props: brass pen, reading glasses, a single notebook}. No clutter, no people, no text.',
    ].join('\n'),
    exampleHooks: [
      'A clear executive desk in morning window light: one printed page in a brass clip, a closed laptop, a warm ceramic cup, a brass pen aligned parallel, strong negative space above for an overlay line. Calm authority, editorial documentary.',
      'A tidy desk corner at golden hour: a single open notebook showing an abstract weekly layout, reading glasses resting on the page edge, one warm lamp glowing, deep quiet background. Premium, resolved, photographic.',
    ],
    craft: [
      'The scene argues the whole brand: one page, one pen, nothing to manage. Order as the hero.',
      '3 to 4 objects maximum, each earning its place. Clutter is the enemy of calm.',
      'Keep a clean zone for an overlay line and grade warm (bone, brass, soft aubergine shadow). No text, no faces.',
    ].join(' '),
    platforms: ['linkedin'],
    formats: ['feed'],
    sizePresetIds: ['li-feed-landscape', 'li-feed-square'],
  }),

  /* ------------------------------------------------------------------ */
  /* Instagram carousel slide-role system. One visual language for      */
  /* cover, teaching, proof, and CTA slides so every carousel reads as  */
  /* one designed publication.                                          */
  /* ------------------------------------------------------------------ */

  I({
    id: 'igcar-cover-number',
    label: 'IG carousel: Numbered cover',
    hint: 'The cover that earns swipe one',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'The cover slide is most of a carousel\'s performance, and a numbered promise cover outperforms every pretty cover without one.',
      'A clean numeral zone plus one calm scene reads at grid and feed size, where carousel covers are actually judged.',
      'One cover system means every carousel in the account looks like the same publication, which compounds recognition.',
    ],
    template: [
      '{CalmScene: the tidy table, warm plaster, linen} composed with a large clean zone at {Zone: top half or left third} sized for one big numeral plus 3 to 5 words.',
      '',
      'One small topic hint at the opposite edge: {Hint: the brass pen, the checklist corner, the cup}.',
      '',
      'The numeral zone stays smooth and high-contrast. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'A warm oak table shot from above, a checklist corner and brass pen in the lower right, the entire top half smooth empty wood in even morning light, sized for one huge numeral and four words. Minimal, warm, editorial cover design.',
      'Soft aubergine plaster filling the frame, a tiny stack of school forms in the bottom corner, the left third completely calm for a big number and short promise. Premium, quiet, built for type.',
    ],
    craft: [
      'The numeral zone comes first: pick the calmest half of the frame and protect it completely.',
      'The single topic hint anchors the subject without crowding the type.',
      'The cover must work as slide 1 of a series: same margins and zones as the teaching slides that follow.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['carousel'],
    sizePresetIds: ['ig-carousel-square', 'ig-carousel-45'],
  }),

  I({
    id: 'igcar-teach-slide',
    label: 'IG carousel: Teaching slide',
    hint: 'One idea, framed to read fast',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'Middle slides earn the swipe when each is a self-contained, screenshot-able idea with a consistent frame.',
      'A repeating slide system (same margins, same zones) is what makes a carousel feel like a publication instead of a dump.',
      'Calm teaching frames keep dwell time high, and dwell time is the carousel ranking signal.',
    ],
    template: [
      '{SlideField: warm bone paper texture, soft plaster, or linen} in the same tone family as the cover.',
      '',
      'A small slide marker at {Position: top left}: {Marker: a tiny brass dot, a small numeral-space, a short rule line}.',
      'One quiet illustrative detail at {Edge}: {Detail: the object of the idea, small}.',
      '',
      'The center and top stay smooth for a bold headline plus 1 to 2 support lines. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'Warm bone paper texture filling the frame, a tiny brass dot in the top left as the slide marker, a small cold coffee in the bottom right, the center smooth and even for a bold headline and one support line. Consistent, quiet, publication-grade.',
      'Soft plaster in the cover\'s tone, a short brass rule line top left, a single school form edge in the lower right, vast calm space for one idea in type. Minimal teaching frame, photographic.',
    ],
    craft: [
      'Same field, same margins, same marker as every other slide in the set. The system is the design.',
      'One small illustrative detail per slide, tied to that slide\'s idea. Never a collage.',
      'The center holds a bold headline plus 1 to 2 support lines at feed size. Render clean, no lettering.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['carousel'],
    sizePresetIds: ['ig-carousel-square', 'ig-carousel-45'],
  }),

  I({
    id: 'igcar-proof-slide',
    label: 'IG carousel: Proof slide',
    hint: 'The receipt, mid-swipe',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'A proof slide mid-carousel converts belief at the exact moment interest peaks, lifting both completion and saves.',
      'Evidence visuals (tick grids, marked calendars, before-after states) read as receipts without a single claim in type.',
      'Slides that show results get screenshotted most, and screenshots are the distribution engine.',
    ],
    template: [
      '{TheEvidence: the ticked checklist, the marked calendar, the mirror showing the calm state} framed {Treatment: close, centered, well lit}.',
      '',
      'Marks are abstract: {Marks: pen ticks, circled days, abstract result lines}.',
      '',
      'Same margins as the teaching slides. Clean zone at {Third} for the short proof caption overlay. No readable words.',
    ].join('\n'),
    exampleHooks: [
      'Close-up of a ticked weekly checklist on linen, nine abstract tick marks in a run, a brass pen beside it, same wide margins as the carousel set, the top third smooth for a one-line proof caption. The receipt, mid-swipe, editorial.',
      'A wall calendar with every Sunday circled in brass, shot straight on with soft light, the pattern telling the whole story, bottom third quiet for the caption overlay. Proof you can almost read, photographic.',
    ],
    craft: [
      'The evidence object fills the frame: tick grid, marked calendar, or the two-state mirror. One receipt per slide.',
      'Keep every mark abstract. The overlay caption names the result; the slide proves it happened.',
      'Hold the carousel margins exactly so the proof slide reads as part of the same publication.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['carousel'],
    sizePresetIds: ['ig-carousel-square', 'ig-carousel-45'],
  }),

  I({
    id: 'igcar-cta-slide',
    label: 'IG carousel: CTA slide',
    hint: 'The quiet last frame',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'The final slide is where the save and the follow happen, and a calm closing frame outperforms a salesy end card.',
      'A recap zone plus one soft call to action gives the swipe a destination instead of a dead end.',
      'Ending in the same visual language as the cover closes the loop, which is what makes accounts feel designed.',
    ],
    template: [
      '{ClosingField: the cover\'s field or its exact tonal partner} filling the frame evenly.',
      '',
      'One small closing detail at {Edge}: {Detail: the brass tick ornament, the single page corner, the pen at rest}.',
      '',
      'Zones for a 3 to 4 line recap block plus a one-line soft CTA. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'The cover\'s warm oak texture filling the frame, a small brass tick ornament resting in the bottom right, smooth even space above for a four-line recap and a one-line soft close. Resolved, quiet, publication-grade.',
      'Soft aubergine linen matching the cover, a single printed page corner entering frame left, vast calm space for the recap and the gentle ask. Premium closing frame, photographic.',
    ],
    craft: [
      'Close in the cover\'s field (or its tonal partner) so the carousel ends where it began. The loop is the polish.',
      'Compose for a short recap block and one soft CTA line. The slide invites; it never pushes.',
      'The small closing detail (tick ornament, page corner) is the signature that says "this was MotherMode".',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['carousel'],
    sizePresetIds: ['ig-carousel-square', 'ig-carousel-45'],
  }),
];
