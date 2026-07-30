/**
 * The MotherMode image prompt bank: A-level, platform-specific creative
 * frameworks for image generation. Same recipe shape as the text bank
 * (promptBank.ts), but the template is an image-prompt skeleton with {Slots},
 * the craft is art direction, and the example hooks are complete filled
 * prompts. Three sub-banks ship as seeds:
 *
 *   - Facebook ad creatives (kind 'ad'): scroll-stopping paid structures.
 *   - Instagram organic images (kind 'organic'): feed and carousel stills.
 *   - YouTube thumbnails (kind 'organic'): CTR frameworks for the long format.
 *
 * Every recipe locks the brand rules the imagery guide enforces: renders stay
 * clean of baked-in text (words go on later with the overlay editor), faces
 * stay soft or absent unless a recipe explicitly opts in, and the palette
 * stays warm bone, deep aubergine, aged brass. Database rows in
 * `mothermode_prompt_recipes` (recipe_group 'image') override or extend these
 * seeds at resolve time, exactly like the text bank.
 */
import type { ContentKind, ContentPlatform } from './types';
import type { PromptRecipe } from './promptBank';
import { IMAGE_PROMPT_RECIPES_ROUND2 } from './imagePromptBankRound2';
import { IMAGE_PROMPT_RECIPES_ROUND3 } from './imagePromptBankRound3';
import { IMAGE_PROMPT_RECIPES_ROUND4 } from './imagePromptBankRound4';
import { IMAGE_PROMPT_RECIPES_ROUND5 } from './imagePromptBankRound5';
import { IMAGE_STYLE } from './constants';
import { PLATFORM_SIZE_PRESETS } from './platformSizes';

const I = (
  r: Omit<PromptRecipe, 'group' | 'builtin'>,
): PromptRecipe => ({ ...r, group: 'image', builtin: true });

/**
 * The image bank. Order is the default picker order inside each sub-bank:
 * proven thumb-stoppers first.
 */
export const IMAGE_PROMPT_RECIPES: PromptRecipe[] = [
  /* ---------------------------------------------------------------- */
  /* Facebook ad creatives. Paid scroll-stoppers for Meta placements. */
  /* ---------------------------------------------------------------- */

  I({
    id: 'fbad-pattern-interrupt',
    label: 'FB ad: Pattern interrupt',
    hint: 'The scene that breaks the feed',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'The feed is a rhythm of sameness; one visually wrong note is the cheapest scroll-stopper there is.',
      'An unexpected object in a familiar setting earns the half-second pause that every other metric depends on.',
      'Curiosity without clickbait keeps Meta quality ranking high while still stopping the thumb.',
    ],
    template: [
      '{SingleUnexpectedObject} photographed {Treatment: dead-center, heroic} in {OrdinaryKitchenSetting}.',
      '',
      'The object is slightly out of place: {TheWrongness: color, scale, or context}.',
      '',
      'Light: {NaturalWindowLight}. Negative space on {Side} for the headline overlay.',
      'No people. No text. No logos.',
    ].join('\n'),
    exampleHooks: [
      'A single brass whistle standing upright on a worn wooden kitchen table covered in school forms, shot dead-center like a trophy, soft morning window light, shallow depth of field, clean negative space on the left third for headline text. Warm bone and aubergine tones, editorial product photography.',
      'One perfectly organized drawer glowing open in the middle of a chaotic kitchen counter, everything around it softly blurred, the drawer lit like a display case. Negative space across the top for text overlay. 35mm documentary style, warm natural light.',
    ],
    craft: [
      'Build the whole image around ONE object that does not belong (or one ordinary object treated like a hero). The wrongness is the hook.',
      'Compose for the overlay: one third of the frame stays clean and low-detail for the headline the overlay editor adds later.',
      'Photorealistic and lived-in, never surreal or jokey. The interrupt is visual, not absurd.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
    platformNotes: {
      facebook: 'Square 1:1 for broad placements, 4:5 for mobile-heavy. Keep the hero object clear of the bottom 250 pixels where Meta chrome sits.',
    },
  }),

  I({
    id: 'fbad-before-after-split',
    label: 'FB ad: Before-after split',
    hint: 'Chaos vs calm in one frame',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Split frames do the persuasion instantly: the before is her now, the after is her want, no copy required.',
      'Transformation imagery is the highest-CTR ad structure for system and routine products.',
      'The contrast reads at thumbnail size, which is where most impressions happen.',
    ],
    template: [
      'Split composition, one frame divided {VerticallyOrDiagonally}:',
      '',
      'Left (before): {TheChaos: cluttered counter, scattered papers, cold coffee}.',
      'Right (after): {TheSameScene calm: one page, one pen, hot coffee}.',
      '',
      'Same room, same light direction, so the only variable is the system. Clean dividing line, no text.',
    ].join('\n'),
    exampleHooks: [
      'Vertical split frame of the same kitchen table: left side buried under permission slips, snack wrappers, and a cold coffee; right side clear except one printed page, a pen, and a fresh cup. Same window light, same angle, editorial documentary style, warm bone tones with aubergine shadows.',
      'Diagonal split of a desk: chaotic sticky-note storm on the left, single calm checklist page on the right. Photorealistic, shallow depth of field, negative space preserved top and bottom for overlay text.',
    ],
    craft: [
      'Mirror the scene exactly on both sides: same room, same props family, same light direction. The only difference is order.',
      'The before is honest clutter, not staged disaster. The after is achievable calm, not a magazine set.',
      'Leave breathing room at top or bottom for the overlay headline. No baked-in words, no arrows.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
  }),

  I({
    id: 'fbad-product-hero',
    label: 'FB ad: Product hero',
    hint: 'The system, shot like a trophy',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A concrete product shot answers "what exactly am I buying" faster than any headline.',
      'Hero treatment of a $7 product reads as premium, which lifts perceived value past the price.',
      'Showing the artifact (the page, the binder, the tablet mockup) makes a digital system feel ownable.',
    ],
    template: [
      '{TheArtifact: printed system, binder, or tablet showing the one page} resting on {StyledSurface}.',
      '',
      'Props that tell the use: {Props: pen, reading glasses, coffee}.',
      'Light: {HeroLight: soft directional}. Camera: {Angle: 45-degree or flat-lay}.',
      '',
      'Clean space at {Third} for the price and headline overlay. No visible brand logos, no readable body text on the page. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'A printed one-page household system in a slim brass clip frame, standing on a warm oak table beside a ceramic coffee cup and a pen, shot at 45 degrees with soft directional window light. Top third clean and blurred for headline overlay. Editorial product photography, warm bone and aged brass tones.',
      'Overhead flat lay of a tablet displaying a simple checklist page, flanked by reading glasses and a linen napkin on a stone surface, soft shadows, generous negative space on the right for text. Premium, quiet, photorealistic.',
    ],
    craft: [
      'The artifact is the star: a printed page, binder, or tablet mockup of the system, shot with product-photography respect.',
      'Style 2-3 props that prove daily use (pen, glasses, coffee). Nothing decorative that does not tell the use story.',
      'Any screen or page content is abstract blocks and lines, never readable tiny text. The overlay adds the words later.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45', 'ad-916'],
    platformNotes: {
      facebook: 'Works across 1:1, 4:5, and 9:16. For 9:16 stories, stack the hero low and keep the top half for the headline.',
    },
  }),

  I({
    id: 'fbad-ugc-native',
    label: 'FB ad: UGC native',
    hint: 'Shot like her camera roll',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Ads that look like a friend\'s post beat studio creative on cold traffic because they do not pattern-match as ads.',
      'Camera-roll imperfection (slight blur, real light, real mess) reads as proof, not production.',
      'Native style lifts engagement, and engagement lowers CPMs.',
    ],
    template: [
      'Candid phone-photo look: {EverydayScene} captured mid-moment, {Imperfection: slight tilt, motion, or clutter at the edges}.',
      '',
      'The evidence object in frame: {Proof: the printed page on the fridge, the checklist on the counter}.',
      '',
      'Natural indoor light, real colors, no styling. No faces, no text, no logos.',
    ].join('\n'),
    exampleHooks: [
      'Phone-photo style shot of a fridge door with one printed weekly page held by a single magnet, kids artwork slightly visible at the edges, overhead kitchen light, slightly off-center framing like a quick snapshot. Real, unstyled, warm and ordinary.',
      'A countertop mid-morning: a checklist page with two boxes ticked in pen, toast crumbs nearby, coffee half finished, shot from standing height like a quick photo for a friend. Natural window light, documentary candid feel.',
    ],
    craft: [
      'Dial down the polish on purpose: standing-height angle, real indoor light, edges of real life in frame. It must pass as her photo.',
      'The proof object (printed page, checklist) sits naturally in the scene, as if she just used it.',
      'No faces, no staged styling, no studio light. The art direction is restraint.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45', 'ad-916'],
  }),

  I({
    id: 'fbad-text-space-card',
    label: 'FB ad: Type-ready card',
    hint: 'Negative space is the creative',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'When the image is mostly calm space, the overlay headline becomes the creative, and headline-led ads are the cheapest to test at scale.',
      'A quiet premium field stands out in a loud feed exactly because it refuses to shout.',
      'One compositional anchor plus clean space survives every placement crop Meta applies.',
    ],
    template: [
      '{FieldOrTexture: plaster wall in warm bone, linen in soft aubergine, oak grain} filling most of the frame.',
      '',
      'One small anchor: {Anchor: brass pen, single leaf, ceramic cup} placed {Placement: lower right, rule of thirds}.',
      '',
      'Two thirds of the frame stay clean, low-contrast, and uniform for a large text overlay. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'A warm bone plaster wall filling the frame, one aged brass pen resting on a small oak shelf in the lower right third, soft side light, two thirds of the frame clean and even for a big headline overlay. Minimal, premium, editorial.',
      'Soft aubergine linen fabric with gentle folds as a full-frame texture, a small ceramic cup of coffee in the bottom corner, window light from the left. Vast clean space above for text. Quiet luxury product mood.',
    ],
    craft: [
      'The texture IS the image: plaster, linen, oak, stone. One tiny anchor object gives the eye a place to land.',
      'Two thirds of the frame must stay uniform and low-contrast so the overlay headline is legible at any size.',
      'This is the workhorse ad background: premium, calm, infinitely re-headlinable. Render clean, no lettering.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45', 'ad-916'],
  }),

  I({
    id: 'fbad-proof-receipt',
    label: 'FB ad: The receipt',
    hint: 'Proof you can almost read',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Evidence imagery (the tally, the checklist, the count) implies results without a single claim Meta can flag.',
      'Almost-readable documents trigger lean-in curiosity that clean graphics never do.',
      'Receipt-style creative pairs perfectly with proof-led primary text, compounding credibility.',
    ],
    template: [
      'Close-up of {TheEvidence: handwritten tally sheet, ticked checklist, calendar with marked days} on {Surface}.',
      '',
      'Marks are visible but abstract: {Marks: pen ticks, circled dates, column of checkmarks}.',
      '',
      'Shot at {Angle} with {Light}. Shallow focus pulls the eye to {FocalPoint}. Space at {Third} for overlay. No readable words, no logos.',
    ].join('\n'),
    exampleHooks: [
      'Macro-style close-up of a handwritten tally sheet on a clipboard, columns of pen tick marks filling the page, a brass pen resting beside it on worn wood, shallow depth of field pulling focus to the densest column of marks. Warm window light, top edge soft and clean for overlay text.',
      'A wall calendar with every Sunday circled in brass-colored pen, shot straight on with soft shadows, the pattern of circles telling the story. Bottom third slightly blurred and quiet for a headline overlay. Documentary editorial style.',
    ],
    craft: [
      'The evidence object does the talking: tally marks, ticked boxes, circled dates. Marks read as proof at a glance.',
      'Keep every mark abstract (ticks, circles, lines) so nothing is literally readable; the overlay and primary text supply the words.',
      'Tight crop, shallow focus, one clear focal point. Proof feels closer when it fills the frame.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
  }),

  I({
    id: 'fbad-side-by-side-vs',
    label: 'FB ad: Versus face-off',
    hint: 'Two options, one obvious',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Comparison creative lets her self-select in under a second, and self-selection drives qualified clicks.',
      'Framing the old way vs the system way sells without ever naming a competitor.',
      'The versus layout is native to how people already screenshot and share comparisons.',
    ],
    template: [
      'Two {ObjectsOrScenes} composed as a face-off: {OptionA: the old way, visually heavy} versus {OptionB: the system way, visually light}.',
      '',
      'A: {Description: six apps on a phone screen, stacked notebooks, tangled sticky notes}.',
      'B: {Description: one printed page, single pen, clean table}.',
      '',
      'Equal framing, neutral background between them, clear space across the top for the versus headline. No text, no VS graphic baked in.',
    ].join('\n'),
    exampleHooks: [
      'Side-by-side composition on a neutral bone background: left, a phone crowded with colorful app icons beside a leaning stack of notebooks; right, one calm printed page with a single brass pen. Equal framing, soft even light, clean band across the top for overlay text. Editorial product style.',
      'Two coffee cups on a kitchen table shot from above: one surrounded by scattered sticky notes and crumbs, one beside a single neat checklist. Symmetrical framing, documentary light, generous top third left clean.',
    ],
    craft: [
      'Give both options identical framing and light so the comparison is fair; the clutter difference does the arguing.',
      'The old way is ordinary and recognizable, never grotesque. The system way is calm and concrete.',
      'Keep the top band clean for the versus headline the overlay adds. No baked-in VS text or arrows.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
  }),

  I({
    id: 'fbad-offer-flatlay',
    label: 'FB ad: Offer flat lay',
    hint: 'The whole stack at a glance',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Laying out everything she gets converts the abstract offer into a pile of value she can see.',
      'Flat lays are the highest-saved ad format in the planner and template niche, and saves retarget for free.',
      'An organized stack photographically pre-answers "is $7 worth it" before the copy says a word.',
    ],
    template: [
      'Overhead flat lay of the complete offer: {Items: printed system pages, cover sheet, bonus card, pen} arranged in a {GridOrFan} on {Surface}.',
      '',
      'One hero item largest at {Position}, supporting items smaller around it.',
      '',
      'Soft even light, gentle shadows, clean margin at {Edge} for the price anchor overlay. No readable text on any item, no logos.',
    ].join('\n'),
    exampleHooks: [
      'Overhead flat lay of a complete printed system: a cover page, five interior pages fanned neatly, a small bonus card, and a brass pen arranged in a clean grid on warm linen. Soft even daylight, gentle shadows, the bottom edge left clear for a price overlay. Premium editorial product photography.',
      'A tidy stack of printed worksheets tied with twine beside a tablet showing an abstract checklist screen, shot from directly above on oak, one corner of the frame open and quiet for text. Warm bone and aubergine palette.',
    ],
    craft: [
      'Show every component of the offer in one overhead frame, hero item largest. The pile IS the pitch.',
      'Arrange with intention (grid or fan), generous margins, soft even light. Flat lay rewards neatness and punishes clutter.',
      'All page content is abstract blocks and lines. Leave one clean edge for the price anchor overlay.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45'],
  }),

  I({
    id: 'fbad-color-field',
    label: 'FB ad: Brand color field',
    hint: 'One object, one bold color',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A saturated brand-color field is a visual interrupt that no photo in her feed can match.',
      'One object on one color reads instantly at any size, which is why color-field ads dominate thumb-stop rates.',
      'The empty field is built for the overlay, so one render serves unlimited headline tests.',
    ],
    template: [
      '{SingleObject: the brass whistle, the printed page rolled and tied, the ceramic cup} centered on a seamless {BrandColor: deep aubergine, aged brass, warm bone} background.',
      '',
      'Strong but soft directional light, one confident shadow.',
      '',
      'Over half the frame is pure color field, reserved for the headline overlay. No text, no logos, no props beyond the one object.',
    ].join('\n'),
    exampleHooks: [
      'A single rolled printed page tied with twine, standing upright on a seamless deep aubergine background, lit with one soft directional light casting a long elegant shadow. Over half the frame is clean color for a bold headline overlay. Studio minimalism, premium and quiet.',
      'One small brass whistle on a seamless warm bone field, dead center, strong soft shadow, nothing else in frame. Vast clean space above and around for overlay text. Editorial color-block product photography.',
    ],
    craft: [
      'One object, one brand color, one shadow. Anything more dilutes the interrupt.',
      'Center or lower-center the object and keep the majority of the frame as uninterrupted color for the headline.',
      'Use the palette: deep aubergine, aged brass, warm bone. The color field should read as MotherMode before a word is seen.',
    ].join(' '),
    platforms: ['facebook'],
    formats: ['feed'],
    sizePresetIds: ['ad-11', 'ad-45', 'ad-916'],
  }),

  /* ---------------------------------------------------------------- */
  /* Instagram organic images. Feed and carousel stills that earn the */
  /* pause, the save, and the send.                                    */
  /* ---------------------------------------------------------------- */

  I({
    id: 'igorg-object-story',
    label: 'IG: Single-object story',
    hint: 'One thing says everything',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'A single object in close-up reads instantly on a fast-scrolling feed, and instant reads earn the pause.',
      'Object storytelling lets her project herself into the frame, which faces never allow.',
      'Tight crops on meaningful objects are the most screenshot-shared stills in the niche.',
    ],
    template: [
      'Extreme close-up of {TheObject: crumpled permission slip, cold coffee beside a checklist, the pen that signed 4 forms}.',
      '',
      '{ContextHint: the edge of the table, morning light, a backpack strap blurring past}.',
      '',
      'Shallow depth of field, one focal point, quiet background. No text, no faces.',
    ].join('\n'),
    exampleHooks: [
      'Extreme close-up of a crumpled field trip permission slip smoothed out on a kitchen table, one corner still curled, morning window light raking across the paper texture, a backpack strap blurred in the background. 35mm documentary style, warm bone tones, shallow focus.',
      'Macro shot of a cold cup of coffee beside a handwritten checklist with every box ticked, steam long gone, soft overcast light, the edge of a wooden table framing the scene. Quiet, lived-in, editorial still life.',
    ],
    craft: [
      'Choose the object that carries the whole emotional story and get close. Fill at least half the frame with it.',
      'Let one blurred context hint (a strap, a doorway, a sleeve) suggest the world without showing it.',
      'One focal point, shallow depth, quiet everything else. The object is the headline.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['feed', 'carousel'],
    sizePresetIds: ['ig-feed-45', 'ig-fb-feed-11'],
    platformNotes: {
      instagram: 'Portrait 4:5 maximizes feed real estate. Keep the object off the exact center so a caption preview never covers it.',
    },
  }),

  I({
    id: 'igorg-cinematic-moment',
    label: 'IG: Cinematic quiet moment',
    hint: 'A still from her movie',
    goal: 'shares',
    kind: 'organic',
    whyItWorks: [
      'Cinematic stills stop the scroll because they promise a story, and story is what the feed cannot supply fast enough.',
      'The parked-car, cold-coffee moments make her feel seen without a single word.',
      'Moody but warm grading reads premium in a feed of bright sameness.',
    ],
    template: [
      'A quiet cinematic moment: {TheScene: empty parked car with a list on the wheel, kitchen at blue hour with one lamp on}.',
      '',
      'Light does the emotional work: {Light: dawn through blinds, one warm lamp in a dark room}.',
      '',
      'Composition: {WideOrTight}, strong negative space, film grain, no people or back-of-frame only. No text.',
    ].join('\n'),
    exampleHooks: [
      'An empty parked car interior at dusk, a handwritten list resting on the steering wheel, dashboard glow mixing with blue hour light through the windshield, shot from the passenger side like a film still. Cinematic grain, deep aubergine shadows, warm highlights.',
      'A kitchen at 6 am with one lamp on, a notebook open at a fresh page beside a French press, window still dark, steam curling, shot wide with strong negative space above. Moody, warm, editorial film still.',
    ],
    craft: [
      'Frame a moment, not a subject: the still should feel lifted from a film she recognizes as her own.',
      'Light carries the emotion. Pick one motivated source (dawn, one lamp, dashboard glow) and let everything else fall quiet.',
      'People are absent or backs-of-frames only. She casts herself. No text anywhere.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['feed'],
    sizePresetIds: ['ig-feed-45', 'ig-fb-feed-11'],
  }),

  I({
    id: 'igorg-flatlay-system',
    label: 'IG: Flat-lay system',
    hint: 'Order you can feel',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'Organized flat lays are aspirational proof: the calm she wants, photographed from above.',
      'Flat-lay saves run high because the layout itself doubles as a reference she wants to copy.',
      'The overhead angle is the native grammar of the planning niche, so it signals the topic instantly.',
    ],
    template: [
      'Overhead flat lay: {HeroItem: the one page, the open planner} at {Position}, surrounded by {SupportingProps: pen, coffee, glasses} in deliberate spacing.',
      '',
      '{Surface: linen, oak, stone}. {Light: soft window light, gentle shadows}.',
      '',
      'Grid discipline, generous margins, palette locked to bone, aubergine, brass. No readable text, no logos.',
    ].join('\n'),
    exampleHooks: [
      'Overhead flat lay of a single printed weekly page on washed linen, a brass pen aligned parallel, reading glasses at two o\'clock, a ceramic espresso cup top left, everything spaced with grid discipline. Soft window light, warm bone and aubergine palette, editorial still life.',
      'A tidy flat lay on oak: an open slim notebook showing an abstract checklist layout, a small dish of paper clips, one eucalyptus stem, gentle morning shadows. Calm, premium, organized to the millimeter.',
    ],
    craft: [
      'One hero item, 3-4 supporting props maximum, everything placed with visible intention. Flat lay punishes clutter and rewards spacing.',
      'Lock the palette to bone, aubergine, brass. Mismatched color is the fastest way to look amateur.',
      'Page content is abstract blocks and lines. The layout is the message: order is possible.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['feed', 'carousel'],
    sizePresetIds: ['ig-feed-45', 'ig-fb-feed-11'],
  }),

  I({
    id: 'igorg-carousel-cover-space',
    label: 'IG: Carousel cover',
    hint: 'Built for big words',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'The cover slide is most of a carousel\'s performance, and covers built for type beat photos with text squeezed on.',
      'A calm scene with a clean text zone lets the numbered promise shout without clutter.',
      'Covers that read at thumbnail size earn the first swipe, and nothing else matters without it.',
    ],
    template: [
      '{CalmScene: the tidy table, the single page, morning light} composed so {TwoFifths: the top or left} is smooth, low-detail, and even in tone.',
      '',
      'Focal interest sits in the opposite third: {FocalPoint}.',
      '',
      'The clean zone must hold 6 words of bold type at 1080 pixels. No text in the render, no busy patterns behind the zone.',
    ].join('\n'),
    exampleHooks: [
      'A warm oak table shot from above, a single printed page and brass pen in the lower right third, the entire top two fifths smooth empty wood in even morning light, composed to hold large bold overlay text. Minimal, warm, editorial.',
      'Soft aubergine plaster wall with a small oak shelf in the bottom right holding a ceramic cup and one printed card, the rest of the frame calm and even for big type. Window light from the left, quiet premium mood.',
    ],
    craft: [
      'Design the frame around the text zone first: pick the calmest two fifths and keep them boring on purpose.',
      'Put the visual interest in the opposite third so the slide still feels artful, not empty.',
      'Test the zone mentally: 6 bold words at feed size must sit there with total legibility. No text baked into the render.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['carousel', 'feed'],
    sizePresetIds: ['ig-carousel-45', 'ig-carousel-square', 'ig-feed-45'],
  }),

  I({
    id: 'igorg-hands-at-work',
    label: 'IG: Hands at work',
    hint: 'The doing, up close',
    goal: 'saves',
    kind: 'organic',
    whyItWorks: [
      'Hands doing the method prove it is real in a way flat graphics never can.',
      'Action close-ups (writing, ticking, pinning) imply the reader\'s own hands, a subtle identity transfer.',
      'Process shots earn saves because they read as instructions, and instructions get kept.',
    ],
    template: [
      'Close shot of hands {Action: writing the Sunday download, ticking a box, pinning the page to the fridge}.',
      '',
      'Frame tight on the action: {Props: pen mid-word, sleeve cuff, the page}.',
      '',
      'Natural window light, shallow focus on the action point, real skin texture, no jewelry distraction, no faces, no text.',
    ].join('\n'),
    exampleHooks: [
      'Close-up of hands mid-stroke writing a weekly list on a printed page, pen caught mid-word, sleeve cuff visible, the page held steady on a worn wooden table, soft window light, shallow focus on the pen tip. Documentary warmth, real and unposed.',
      'Hands pinning a single printed page to a fridge with one brass magnet, fingers pressing the corner, a blurred kitchen behind, natural indoor light, tight framing on the action. Quiet, useful, editorial.',
    ],
    craft: [
      'Frame tighter than feels natural: the action point (pen tip, magnet, tick mark) is the subject.',
      'Hands are real and unstyled, sleeves plain, no statement jewelry pulling focus.',
      'One action per image. The motion implies her own hands doing it tonight.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['feed', 'carousel'],
    sizePresetIds: ['ig-feed-45', 'ig-fb-feed-11'],
  }),

  I({
    id: 'igorg-before-after-frame',
    label: 'IG: Before-after frame',
    hint: 'One photo, two realities',
    goal: 'shares',
    kind: 'organic',
    whyItWorks: [
      'Transformation in a single organic frame earns the double-tap faster than any caption can ask for it.',
      'The before validates her now while the after sells the want, and both emotions drive saves.',
      'Split or paired compositions invite zoom-ins, and zoom time trains the algorithm.',
    ],
    template: [
      'One frame holding two states: {Device: split composition, mirror reflection, or two prints side by side}.',
      '',
      'Before: {TheChaos, honestly}. After: {TheCalm, believably}.',
      '',
      'Same palette, same light family, so the shift reads as method, not magic. No text, no arrows.',
    ].join('\n'),
    exampleHooks: [
      'A mirror-and-table composition: the real counter in front cluttered with school papers and snack wrappers, the mirror reflecting the same counter cleared to one page and a pen, same warm light, same angle. Editorial documentary style, honest and calm.',
      'Two printed photos laid side by side on linen, shot from above: left photo a chaotic Monday table, right photo the same table serene with a single checklist. Soft even light, generous margins, no text.',
    ],
    craft: [
      'Use a device (mirror, split, paired prints) that keeps both states in one honest frame.',
      'Match light and palette across the states so the transformation reads as achievable method.',
      'The before is relatable, not disgusting. The after is calm, not sterile. No baked-in labels or arrows.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['feed', 'carousel'],
    sizePresetIds: ['ig-feed-45', 'ig-fb-feed-11'],
  }),

  I({
    id: 'igorg-negative-space-quote',
    label: 'IG: Quote-ready scene',
    hint: 'Calm space for one line',
    goal: 'shares',
    kind: 'organic',
    whyItWorks: [
      'Quote content is the most re-posted format on Instagram, and a beautiful quiet scene makes the line feel worth framing.',
      'A mostly-empty image loads the words with weight that a busy photo dilutes.',
      'One render plus the overlay editor produces an infinite, always-on-brand quote series.',
    ],
    template: [
      '{VastCalmField: fog over a field, bare plaster wall, out-of-focus water, linen in shadow}.',
      '',
      'One small grounding element at {Edge}: {Element: a fence post, a cup, a stem}.',
      '',
      '80% of the frame is smooth, low-contrast tone for the quote overlay. Moody but warm. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'Soft fog rolling over a quiet field at dawn, one dark fence post in the lower right corner, the rest of the frame smooth muted tone, composed to hold a large quote overlay. Cinematic calm, warm grey and bone palette.',
      'A bare warm plaster wall in raking afternoon light, a single dried stem in a small vase at the bottom edge, vast even space above for a one-line quote. Minimal, contemplative, editorial.',
    ],
    craft: [
      'Aim for 80% smooth, even tone. The emptiness is the design.',
      'One tiny grounding element keeps the frame photographic instead of a gradient.',
      'Grade warm and quiet (bone, fog, plaster, dusk). The overlay line will supply all the energy.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['feed', 'story'],
    sizePresetIds: ['ig-feed-45', 'ig-fb-feed-11', 'ig-fb-story'],
  }),

  I({
    id: 'igorg-pov-candid',
    label: 'IG: POV candid',
    hint: 'Shot from her eyes',
    goal: 'shares',
    kind: 'organic',
    whyItWorks: [
      'First-person framing drops her directly into the scene, which is the fastest identity match on the feed.',
      'POV shots read as stolen moments, and authenticity beats production in organic reach.',
      'The perspective is endlessly repeatable across scenes, making it a reliable content engine.',
    ],
    template: [
      'First-person POV: {WhatSheSees: the table from standing height, the car seat and school bags, the 5 pm kitchen}.',
      '',
      'Frame includes a hint of her world at the edges: {Edges: her mug, her sleeve, the steering wheel}.',
      '',
      'Real light, slight candid imperfection, documentary honesty. No faces, no text.',
    ].join('\n'),
    exampleHooks: [
      'First-person view of a kitchen table at 7 am from standing height: school forms fanned out, a half-eaten bowl of cereal, her own mug of fresh coffee at the bottom edge of frame, morning light through the blinds. Candid documentary, real and unstaged.',
      'POV from the driver seat at school pickup: the steering wheel bottom of frame, a handwritten list tucked in the dash, the school doors ahead softly blurred, late afternoon light. Quiet, honest, cinematic slice of life.',
    ],
    craft: [
      'Shoot from her exact eye line (standing, seated at the wheel, at the desk) so the frame becomes her view.',
      'Keep one personal edge element (mug, sleeve, wheel) to anchor the first-person read.',
      'Embrace small imperfections: a tilt, a crumb, a blur. Candid is the whole point. No faces, no text.',
    ].join(' '),
    platforms: ['instagram'],
    formats: ['feed', 'story'],
    sizePresetIds: ['ig-feed-45', 'ig-fb-story', 'ig-fb-feed-11'],
  }),

  /* ---------------------------------------------------------------- */
  /* YouTube thumbnails. CTR frameworks for the 16:9 long format.     */
  /* Words always go on with the overlay editor afterward; the render */
  /* stays clean and keeps a protected zone for them.                 */
  /* ---------------------------------------------------------------- */

  I({
    id: 'ytthumb-curiosity-scene',
    label: 'YT thumb: Curiosity scene',
    hint: 'The unexplained image',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A scene that raises a question it refuses to answer is the highest-CTR thumbnail structure on YouTube.',
      'The image asks, the title half-answers, and the click completes the loop.',
      'One strange focal detail outperforms busy collages at 120 pixels wide, where thumbnails are actually seen.',
    ],
    template: [
      '{TheStrangeScene: an unexpected state or object arrangement} that demands explanation.',
      '',
      'One focal detail carries the mystery: {Detail: the wall of ticked boxes, the single page replacing 6 apps}.',
      '',
      'Clean composition readable at 120 pixels, strong contrast, one-third clean space for 2-4 overlay words. No text in the render, no clutter.',
    ].join('\n'),
    exampleHooks: [
      'A kitchen wall calendar completely filled with neat brass checkmarks for 30 straight days, one day circled in aubergine, shot straight on with dramatic soft light, the right third kept clean for overlay text. High contrast, cinematic, instantly readable small.',
      'A phone face-down on a table beside one printed page and a pen, the page glowing slightly in a shaft of window light, everything else in shadow. Simple, mysterious, bold shapes that read at thumbnail size.',
    ],
    craft: [
      'Build the frame around ONE unexplained detail. If she can fully understand the image without clicking, it is not a curiosity scene.',
      'Simplify ruthlessly: 3 shapes maximum, readable at 120 pixels wide.',
      'Reserve a clean third for 2-4 overlay words. The render stays wordless.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
    platformNotes: {
      youtube: '1280x720. Keep the focal detail out of the bottom right corner where the duration badge sits.',
    },
  }),

  I({
    id: 'ytthumb-result-hero',
    label: 'YT thumb: Result hero',
    hint: 'The after, front and center',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Showing the end state big sells the transformation before a word is read.',
      'Result-first thumbnails attract intent-matched viewers who watch longer, compounding CTR with retention.',
      'A calm, achieved scene stands out in a home feed of shouting faces.',
    ],
    template: [
      'The achieved result, heroically framed: {TheResult: the serene Sunday table, the single page running the house, the empty done list}.',
      '',
      'Treat it like the finish line: {Treatment: centered, glowing light, slight low angle}.',
      '',
      'Space at {Third} for the overlay words. Warm, believable, no people, no text.',
    ].join('\n'),
    exampleHooks: [
      'A serene kitchen table set for a slow Sunday breakfast, sunlight pouring across it, one printed page in a brass clip at the head of the table, shot slightly low like a monument. Warm golden light, clean top third for overlay text, cinematic and achievable.',
      'A single framed checklist page with every box ticked, hanging where a family photo would go, soft gallery light on it, the rest of the wall quiet and warm. Bold simple composition, negative space left for 2-4 words.',
    ],
    craft: [
      'Frame the result like it matters: centered, well-lit, slightly heroic. The after-state is the whole sell.',
      'Keep the scene believable (a real kitchen, a real page). Aspiration dies when it looks staged beyond reach.',
      'Reserve a clean zone for overlay words and protect the bottom right from the duration badge.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-before-after-split',
    label: 'YT thumb: Before-after split',
    hint: 'The transformation, side by side',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Before-after is the most clicked thumbnail format in every how-to niche because the promise is self-explanatory.',
      'The split frame lets the viewer measure the gap, and the gap is the reason to watch.',
      'High contrast between halves keeps both readable at small sizes.',
    ],
    template: [
      'Split the frame {VerticallyOrDiagonally}: before on the left, after on the right.',
      '',
      'Before: {TheChaos: paper storm, dark cluttered counters}. After: {TheCalm: one page, warm light, clear surface}.',
      '',
      'Same scene both sides for a fair fight. Strong dividing line, clean bands top and bottom for overlay words. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'Vertical split thumbnail: left half a dark cluttered kitchen counter buried in papers and sticky notes, right half the same counter in warm morning light holding one printed page and a coffee. Bold simple shapes, high contrast, clean top band for overlay text.',
      'Diagonal split of a desk: chaotic weeknight clutter bleeding into calm Sunday order, the dividing line crisp, both halves in matching palette so the difference pops. Readable at 120 pixels, space at the edges for words.',
    ],
    craft: [
      'Make the two halves the same scene so only order changes; the fairness makes the transformation feel achievable.',
      'Push the contrast: before slightly darker and busier, after warmer and emptier.',
      'Both halves must survive at 120 pixels wide. Simple shapes, no fine detail, no baked-in words.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-big-number-space',
    label: 'YT thumb: Big-number hero',
    hint: 'Built around one numeral',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Numbers in thumbnails lift CTR because they set a concrete expectation the brain wants to verify.',
      'Composing around a numeral-sized space forces the simplicity that small-size legibility demands.',
      'The number plus a plain scene reads as a promise, not clickbait, which protects watch time.',
    ],
    template: [
      '{SimpleScene: the table, the list, the system} composed with a large clean zone at {LeftOrRight} sized for one huge numeral.',
      '',
      'Supporting detail: {Detail: ticked boxes, stacked papers reduced to one page}.',
      '',
      'The numeral zone stays smooth and high-contrast. No text in the render; the overlay supplies the number and 2-3 words.',
    ].join('\n'),
    exampleHooks: [
      'A single printed checklist on a warm oak table in the right third of frame, the entire left half smooth dark aubergine wall in soft light, composed for one huge numeral overlay. Bold, minimal, cinematic contrast.',
      'An overhead shot of 7 small props neatly crossed off to one side and a single clean page on the other, one half of the frame kept flat and even in tone for a giant number. Editorial, high contrast, instantly readable.',
    ],
    craft: [
      'Pick the numeral-sized clean zone first, then compose the scene around it.',
      'The scene illustrates the count (ticked boxes, reduced piles) so the number feels proven, not promised.',
      'High contrast between zone and scene. The overlay adds the numeral and 2-3 words; the render stays clean.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-vs-faceoff',
    label: 'YT thumb: Versus face-off',
    hint: 'Two contenders, one frame',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Versus thumbnails recruit the viewer as judge, and judgment requires the click.',
      'Side-by-side contenders compress the whole video premise into one glance.',
      'Face-off frames get saved as reference images, extending reach past the click.',
    ],
    template: [
      'Two {Contenders: the app-crowded phone vs the single page, the stuffed binder vs the slim checklist} facing each other across {NeutralGround}.',
      '',
      'Left contender: {A, described with weight}. Right contender: {B, described with calm}.',
      '',
      'Symmetrical framing, even light, clean top band for the versus words. No VS text baked in.',
    ].join('\n'),
    exampleHooks: [
      'A smartphone crowded with bright app icons on the left facing one calm printed page with a brass pen on the right, both on a neutral bone table, symmetrical overhead framing, soft even light, clean top band for overlay words. Bold, simple, high contrast.',
      'A thick overstuffed binder leaning left versus a single laminated checklist standing upright right, studio-style on aubergine seamless, equal size in frame, dramatic soft shadows. Reads instantly at thumbnail size.',
    ],
    craft: [
      'Give both contenders equal size, light, and framing so the face-off feels fair and the verdict feels earned in the video.',
      'Make the old way visually heavy and the system way visually light. The weight difference is the argument.',
      'No baked-in VS lettering or lightning bolts. The overlay adds the words; symmetry adds the drama.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-peak-moment',
    label: 'YT thumb: Peak moment',
    hint: 'The emotion, frozen',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Emotion is the most universal scroll-stopper, and a frozen peak moment broadcasts it without words.',
      'Object-led emotional beats (the laptop closing on a finished week, the exhale over a clear table) keep the brand face-free while still feeling human.',
      'Peak frames create open loops: she needs the video to know what led here.',
    ],
    template: [
      'Freeze the peak beat: {TheMoment: the laptop closing on a finished week, hands flat on a clear table, the last tick going into the box}.',
      '',
      'Push the emotion through light and timing: {Light: golden exhale, dusk relief}.',
      '',
      'One clean zone for 2-4 overlay words. No faces required; hands and objects carry the feeling. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'The exact moment a laptop lid closes on a finished Sunday planning session, warm evening light across the desk, one printed page beside it, frozen mid-motion with visible finality. Cinematic, emotional, clean left third for overlay text.',
      'Two hands flat and relaxed on a completely clear kitchen table, a single ticked checklist at the edge of frame, golden hour light pouring in. The exhale, photographed. Bold, simple, readable small.',
    ],
    craft: [
      'Pick the single most emotional beat of the video and freeze it mid-action. Timing is the special effect.',
      'Carry the feeling with light (golden exhale, dusk relief) instead of faces. Hands and objects are enough.',
      'Keep one clean zone for overlay words and protect small-size legibility with simple shapes.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-face-closeup',
    label: 'YT thumb: The face (opt-in)',
    hint: 'Real emotion, frame-left',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Faces lift CTR across YouTube, and a genuine expression matched to the title emotion is the strongest single thumbnail element there is.',
      'Eye contact creates a connection no object can, which is why top creators lead with a face on the videos that matter.',
      'Reserved for flagship videos, a rare face stands out precisely because the brand is object-led everywhere else.',
    ],
    template: [
      'Close-up of {ThePerson: the founder, expressive and real} showing {MatchedEmotion: relief, wide-eyed surprise, quiet triumph}.',
      '',
      'Frame {Framing: face on the left third, looking toward the right} so the eyeline points at {TheThing: the page, the result, the overlay words}.',
      '',
      'Real skin texture, natural light, unpolished honesty. Right two thirds carry the object or the overlay space. No text in the render.',
    ].join('\n'),
    exampleHooks: [
      'Close-up of a woman in her late 30s mid-laugh of pure relief, face on the left third, looking right toward a single printed page held up beside her, warm natural window light, real skin texture, genuine unposed expression. Right side clean for overlay words.',
      'A founder close-up with wide mock-horror eyes glancing sideways at a towering stack of papers just entering frame right, soft daylight, honest and unretouched, the stack cropped tight so shapes stay bold at small size.',
    ],
    craft: [
      'The expression must match the title emotion exactly (relief for a payoff video, disbelief for a count video). Mismatched faces kill CTR.',
      'Face left, eyeline right, pointing at the object or the words. The gaze is a directional arrow.',
      'Use only with a real person on file (founder or approved face), keep it honest and unretouched, and deploy rarely so it stays a pattern interrupt for this brand.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  /* Round 2 (imagePromptBankRound2.ts): 8 more FB ad creatives, 8 more  */
  /* YT thumbnail frameworks, 4 LinkedIn organic images, and the 4-slide */
  /* Instagram carousel cover/teach/proof/CTA system.                    */
  ...IMAGE_PROMPT_RECIPES_ROUND2,

  /* Round 3 (imagePromptBankRound3.ts): 10 more YouTube thumbnail CTR    */
  /* frameworks, text-anchored structures as type-ready compositions.     */
  ...IMAGE_PROMPT_RECIPES_ROUND3,

  /* Round 4 (imagePromptBankRound4.ts): 8 TikTok cover frameworks, the   */
  /* missing cover sub-bank from the roadmap, type-ready 9:16 frames.     */
  ...IMAGE_PROMPT_RECIPES_ROUND4,

  /* Round 5 (imagePromptBankRound5.ts): 6 emimg- email header/section    */
  /* image frameworks on the email-header preset, inbox-safe composition. */
  ...IMAGE_PROMPT_RECIPES_ROUND5,
];

/** Look up an image recipe by id. */
export function getImageRecipe(id?: string | null): PromptRecipe | undefined {
  return id ? IMAGE_PROMPT_RECIPES.find((r) => r.id === id) : undefined;
}

/**
 * Image recipes that fit a platform and/or placement kind. Both filters are
 * optional; an empty platforms list on a recipe matches every platform.
 */
export function imageRecipesFor(
  platform?: ContentPlatform,
  kind?: ContentKind,
  pool: PromptRecipe[] = IMAGE_PROMPT_RECIPES,
): PromptRecipe[] {
  return pool.filter((r) => {
    const platformOk =
      !r.platforms.length || !platform || r.platforms.includes(platform);
    const kindOk = !kind || r.kind === kind;
    return platformOk && kindOk;
  });
}

/** Human-readable size labels for a recipe's preset ids, e.g. "IG Feed 4:5 (1080x1350)". */
export function imageRecipeSizeLabels(recipe: PromptRecipe): string[] {
  return (recipe.sizePresetIds ?? [])
    .map((id) => PLATFORM_SIZE_PRESETS.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => `${p.label} (${p.size})`);
}

/**
 * Compose the full art-direction block for one image recipe: craft orders,
 * the fill-in image skeleton, why it performs, the platform note, target
 * sizes, and complete example prompts, closed by the non-negotiable brand
 * art-direction lock (IMAGE_STYLE plus the no-baked-in-text rule). Injected
 * into image-prompt generation stages and shown in the admin editor preview.
 */
export function imageRecipeCraftBlock(
  recipe: PromptRecipe,
  platform?: ContentPlatform,
): string {
  const parts: string[] = [
    `Image creative framework "${recipe.label}" (${recipe.kind ?? 'organic'} creative): ${recipe.craft}`,
  ];
  if (recipe.template.trim()) {
    parts.push(
      `Execute this proven image structure (fill the {Slots}, do not output the braces or slot names literally):\n${recipe.template}`,
    );
  }
  if (recipe.whyItWorks.length) {
    parts.push(`Why it performs: ${recipe.whyItWorks.join(' ')}`);
  }
  const note = platform ? recipe.platformNotes?.[platform] : undefined;
  if (note) parts.push(`Platform execution for ${platform}: ${note}`);
  const sizes = imageRecipeSizeLabels(recipe);
  if (sizes.length) {
    parts.push(`Target sizes: ${sizes.join(', ')}.`);
  }
  if (recipe.exampleHooks.length) {
    parts.push(
      `Complete example prompts in this vein (match the energy, never copy): ${recipe.exampleHooks
        .map((h) => `"${h}"`)
        .join(' · ')}`,
    );
  }
  parts.push(
    `Art direction lock (non-negotiable): ${IMAGE_STYLE} Words and lettering are added later with the overlay editor; keep the render itself clean of text, reserving the negative space the recipe calls for.`,
  );
  return parts.join('\n');
}
