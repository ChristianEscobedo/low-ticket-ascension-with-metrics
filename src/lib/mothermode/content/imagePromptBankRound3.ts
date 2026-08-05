/**
 * Image prompt bank, round 3: ten more YouTube thumbnail CTR frameworks,
 * the most viral structures adapted to the brand lock. Merged into
 * IMAGE_PROMPT_RECIPES in imagePromptBank.ts. Same rules as the earlier
 * rounds: renders stay clean of baked-in text (the overlay editor adds the
 * words later, so text-anchored frameworks become type-ready compositions
 * with a protected safe zone), faces stay off, palette stays warm bone /
 * deep aubergine / aged brass.
 */
import type { PromptRecipe } from './promptBank';

const I = (
  r: Omit<PromptRecipe, 'group' | 'builtin'>,
): PromptRecipe => ({ ...r, group: 'image', builtin: true });

export const IMAGE_PROMPT_RECIPES_ROUND3: PromptRecipe[] = [
  I({
    id: 'ytthumb-contrast-marker',
    label: 'YT thumb: The marker',
    hint: 'A drawn circle that points at the story',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A hand-drawn circle or arrow is the highest-CTR annotation device on YouTube because it tells the eye exactly where the story is without a single word.',
      'The marker creates a micro-riddle (why is that circled?) that only the click resolves.',
      'Physical markers (a pen ring, a brass arrow ornament) keep the composition premium where a digital red circle would cheapen it.',
    ],
    template: [
      '{TheStoryObject: the one object the video is about} on {Surface: warm oak, linen, aubergine seamless}, occupying {Position: right third}.',
      '',
      'A physical marker frames it: {Marker: a hand-drawn pen circle on the page, a small brass arrow ornament resting against it, a loop of twine}.',
      '',
      'Strong soft light, simple shapes. Clean band at {Third} for 2 to 4 overlay words. No text, no digital annotation graphics.',
    ].join('\n'),
    exampleHooks: [
      'A single school form on a warm oak desk, circled in a loose hand-drawn pen ring, a brass pen resting beside it, strong window light, the left half of frame quiet for overlay words. The one object that matters, marked, editorial.',
      'A small brass arrow ornament pointing at a cold coffee cup on deep aubergine seamless, everything else empty, bold simple geometry readable at 120 pixels. The marker does the talking, no text.',
    ],
    craft: [
      'One object, one marker. The circle or arrow must be physical (pen ring, brass ornament, twine loop), never a drawn digital graphic.',
      'The marked object sits off-center so the overlay band stays clean, and the composition must read at 120 pixels.',
      'No text anywhere in the render. The overlay editor carries the words; the marker only aims the eye.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-curiosity-gap-object',
    label: 'YT thumb: The wrong object',
    hint: 'Half-hidden, out of place, demanding the click',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'An object that does not belong (the boot in the fridge, the form in the plant pot) creates an information gap the brain cannot leave open.',
      'Half-hiding the prop (cropped, under a cloth, behind a door edge) forces a second look, and second looks are the CTR engine.',
      'The wrongness does the hooking, so the composition can stay calm and premium instead of shouting.',
    ],
    template: [
      '{TheOutOfPlaceObject: the prop that does not belong in the scene} placed {Placement: half-cropped at the frame edge, half-hidden under a linen cloth, behind a door edge} in {TheScene: an otherwise calm kitchen or desk}.',
      '',
      'Everything else in frame is ordinary and tidy, which is what makes the one wrong thing loud.',
      '',
      'Soft natural light, strong negative space at {Third} for the overlay line. No text, no arrows, no labels.',
    ].join('\n'),
    exampleHooks: [
      'A rain boot standing inside an otherwise tidy fridge shelf, half-cropped by the door edge, everything else ordinary, soft daylight, the top third clean for overlay words. The wrong object, calm frame, cinematic curiosity.',
      'A school form half-tucked into a plant pot on a warm windowsill, the rest of the sill spotless, morning light, deep quiet space for the overlay line. One wrong thing, everything else still, no text.',
    ],
    craft: [
      'The scene stays calm and ordinary; exactly one thing is wrong. Two wrong things is a mess, not a riddle.',
      'Half-hide the prop: a crop, a cloth, a door edge. The viewer should need the second look.',
      'Keep the overlay third completely quiet. No text in the render; the wrongness is the only headline it needs.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-split-decision',
    label: 'YT thumb: The split decision',
    hint: 'This or that, one clearly winning',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A this-or-that composition turns the thumbnail into a question (which side wins?) that the video answers, and unanswered questions drive clicks.',
      'Making one side visibly calmer or more ordered plants the verdict without words, which pre-frames the video as the correction.',
      'Split frames invite the viewer to pick a side before clicking, and invested viewers watch longer.',
    ],
    template: [
      'A clean two-sided composition on {Surface}: left holds {OptionA: the familiar cluttered way}, right holds {OptionB: the calm system way}, divided by {Divider: a brass rule, a strip of linen, the table edge}.',
      '',
      'Same light family across both sides so the difference reads as method, not editing. The winning side is visibly calmer.',
      '',
      'Bold simple shapes, clean band at {Third} for 2 to 4 overlay words. No text, no VS graphics, no labels.',
    ].join('\n'),
    exampleHooks: [
      'A warm oak table split by a brass ruler: left side buried in loose school papers, right side holding one printed page and a pen, same window light across both, top band clean for overlay words. Two ways, one winner, no words.',
      'A linen runner dividing the frame: left a phone crowded with bright app icons, right a single checklist card and brass clip, soft even light, instantly readable small. The decision, pre-made, editorial.',
    ],
    craft: [
      'Two sides, one divider, same light family. The winning side is visibly calmer: fewer objects, more order.',
      'Keep each side to 2 or 3 objects maximum so the comparison survives at 120 pixels.',
      'No VS lettering, no labels, no text. The split itself asks the question; the overlay may answer it.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-countdown-still',
    label: 'YT thumb: The countdown',
    hint: 'Three objects in list rhythm',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Three ordered objects read as a list before a single word loads, and list content is the most clicked shape on the platform.',
      'Ordered rows create rhythm the eye follows left to right, which buys the extra beat of attention that becomes the click.',
      'Leaving the numeral to the overlay keeps one render reusable across 3, 5, or 7-item videos in the series.',
    ],
    template: [
      '{ThreeOrderedObjects: the three props of the list, in size or importance order} arranged {Arrangement: left to right in a clean row} on {Surface}.',
      '',
      'The final object carries a small emphasis: {Emphasis: a brass tick ornament, a slightly raised position, the only warm light pool}.',
      '',
      'Strong simple geometry, generous negative space above for the overlay numeral and words. No text, no numerals in the render.',
    ].join('\n'),
    exampleHooks: [
      'Three objects in a row on warm oak: a printed page, a brass pen, a small timer, ascending left to right, the timer standing slightly raised under the only pool of warm light, vast quiet space above for a big overlay numeral. The list, before words, editorial.',
      'A checklist card, a cold coffee, and a single magnet in a disciplined row on aubergine seamless, a brass tick ornament resting against the last, soft directional light. Three things, no numerals baked in, premium.',
    ],
    craft: [
      'Exactly three objects in one clean row, ordered by size or importance. The row IS the list; four objects is clutter.',
      'Give the final object the emphasis (tick ornament, raised position, the light pool) so the eye lands where the payoff lives.',
      'No numerals or words in the render. The overlay carries the number; the still carries the rhythm.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-documentary-grab',
    label: 'YT thumb: The frame grab',
    hint: 'Caught mid-action, motion energy',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A mid-action still reads as a moment from inside the video, and inside moments convert better than posed compositions because they promise story, not lecture.',
      'Slight motion energy (a falling page, a hand mid-reach, steam in motion) breaks the grid of static thumbnails around it.',
      'Frame-grab honesty matches the documentary register of the channel, so the thumbnail pre-sets the tone the video delivers.',
    ],
    template: [
      '{TheAction: a page mid-turn, hands mid-sort over a table, the exact second the tick lands} caught {Framing: slightly off-center, candid crop, documentary lens}.',
      '',
      'Motion is implied, never blurred to mush: one moving element, everything else still and sharp.',
      '',
      'Natural motivated light, honest shadows. Clean zone at {Third} for the short overlay line. No text, no staged poses.',
    ].join('\n'),
    exampleHooks: [
      'Hands mid-sort over a kitchen table, school papers in motion, one page frozen mid-turn, everything else sharp and still, window light, candid off-center crop, the left third quiet for overlay words. A moment, not a pose, cinematic documentary.',
      'The exact second a brass pen ticks a box on the weekly page, steam from a coffee curling through frame, natural light, honest shadows, bold shapes readable small. Caught, not staged, no text.',
    ],
    craft: [
      'One moving element, everything else sharp. Motion energy comes from the caught instant, not from blur.',
      'Crop candid and slightly off-center like a pulled frame. A posed subject kills the documentary spell.',
      'Keep a clean third for the overlay line. No text in the render; the moment is the hook.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-empty-chair',
    label: 'YT thumb: The empty chair',
    hint: 'What just happened, implied',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'An empty chair at a just-used desk implies a story (she was just here; something just happened), and implication is the strongest click trigger there is.',
      'Absence reads as honest and cinematic in a feed of shouting faces, which is a pattern interrupt in itself.',
      'The viewer fills the empty space with herself, which is the quietest form of relatability a thumbnail can buy.',
    ],
    template: [
      '{TheEmptySeat: a chair slightly pushed back, a desk with the work mid-done, a screen still glowing} at {TheHour: dawn, 9pm, school-pickup afternoon light}.',
      '',
      'Fresh traces of the person: {Traces: a warm cup, an open page with abstract lines, a pen left across the paper}.',
      '',
      'One motivated light source, strong negative space at {Third} for the overlay line. No people, no text.',
    ].join('\n'),
    exampleHooks: [
      'A chair pushed back from a desk at 9pm, the weekly page open with abstract lines, a warm cup still steaming, one lamp pooling light on the paper, the upper third dark and quiet for overlay words. She was just here, cinematic absence.',
      'An empty kitchen chair at dawn, a checklist card face-up on the table, a pen resting across it, cold coffee untouched, blinds light in stripes. The story already happened, no people, no text.',
    ],
    craft: [
      'The seat is empty but the traces are fresh: steam, an open page, a pen mid-rest. The story is what just left the frame.',
      'Pick the hour first (dawn or 9pm) and let one motivated light source carry the mood.',
      'No people, no text. The absence is the subject; the overlay names what happened.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-prop-confession',
    label: 'YT thumb: The damning prop',
    hint: 'One incriminating object, hard light',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A single incriminating object (the crumpled form, the untouched planner) in interrogation light promises a confession, and confessions are the most clicked content type on the platform.',
      'Hard, directional light on one object creates courtroom energy: the prop is the evidence and the video is the trial.',
      'Keeping any page or screen unreadable makes the object symbolic, so every viewer sees her own version of the story.',
    ],
    template: [
      '{TheDamningProp: the crumpled form, the dead phone, the untouched planner} isolated at {Position: center or low third} on {Surface: dark wood, aubergine seamless}.',
      '',
      'Hard directional light from {Direction: a single raking side light}, long accusing shadow, everything else falling to dark.',
      '',
      'Any page or screen stays unreadable: abstract lines only. Clean dark band at {Third} for the overlay line. No readable text, no faces.',
    ].join('\n'),
    exampleHooks: [
      'A crumpled permission form isolated on dark wood, hit by one raking side light, its shadow long and accusing, everything else falling to black, the top band clean for overlay words. The evidence, exhibited, cinematic.',
      'An untouched planner, spine uncracked, centered on deep aubergine seamless under a single hard light, abstract unreadable lines on its open page, vast dark space above for the overlay. The confession, objectified, no readable text.',
    ],
    craft: [
      'One prop, one hard light, one long shadow. The drama comes from isolation, not from clutter or effects.',
      'Pages and screens stay unreadable: abstract lines only. The object is symbolic; readable words would make it specific and small.',
      'Keep the palette dark and warm (aubergine, dark oak, brass glint). No text, no faces; the prop does the confessing.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-scale-contrast',
    label: 'YT thumb: Tiny vs huge',
    hint: 'Macro object against vast space',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'Extreme scale contrast (one small object against a huge field) is a pattern interrupt that reads instantly at feed size, where subtle compositions die.',
      'Small-but-significant reads as the whole brand argument: one page against the entire chaos, one hour against the whole week.',
      'The vast negative space doubles as the overlay zone, so the boldest type treatment never fights the image.',
    ],
    template: [
      '{TheSmallObject: the single page, the brass magnet, the one tick card} placed {Position: low, off-center} against {TheVastField: an endless seamless field, a wall of soft fog, a huge empty table plane}.',
      '',
      'The field dwarfs the object by at least ten to one. One long elegant shadow for scale.',
      '',
      'Strong directional light, minimal palette. The upper two thirds stay empty for bold overlay words. No text.',
    ].join('\n'),
    exampleHooks: [
      'A single printed page lying low and small against an endless warm bone seamless field, one long shadow raking across the emptiness, the upper two thirds completely clear for huge overlay words. One page, the whole war, monument minimalism.',
      'A tiny brass tick ornament on a vast dark oak table plane, shot low so the grain reads as landscape, soft fog light, the small thing holding the whole frame. Scale as the story, no text.',
    ],
    craft: [
      'The object must be genuinely small in frame (one tenth or less) and the field genuinely empty. Half-measures read as bad cropping, not scale.',
      'One long shadow for orientation. Low camera angles turn the small object into terrain.',
      'The emptiness is the overlay zone: compose for the biggest boldest words the video dares. No text in the render.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-then-now-map',
    label: 'YT thumb: Then and now',
    hint: 'Chaos to calm, one palette',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A then-now diptych is the transformation story compressed into one frame, and transformation is the core promise of every method video.',
      'Sharing one palette and light family across both halves makes the difference read as method, not editing, which keeps the premium register.',
      'Viewers zoom to compare the halves, and zoom time is ranking time on the home feed.',
    ],
    template: [
      'A quiet diptych on {Surface}: left half holds {TheThen: the old chaos, loosely arranged}, right half holds {TheNow: the same objects, ordered into the system}, split by {Divider: a brass rule, a fold of linen}.',
      '',
      'Same light, same palette, same objects across both halves. Order is the only variable.',
      '',
      'Simple bold shapes that read at 120 pixels. Clean band at {Third} for 2 to 4 overlay words. No text, no dates, no arrows.',
    ].join('\n'),
    exampleHooks: [
      'A linen fold dividing warm oak: left a scatter of school forms and dead pens, right the same forms stacked into one clipped packet beside a printed weekly page, identical window light on both halves, top band clean for overlay words. Then and now, one palette, editorial.',
      'Two halves of the same desk at the same hour: left the chaos of paper stacks, right one page and a closed laptop, a brass ruler as the divider, soft evening light across both. The map of the change, no words.',
    ],
    craft: [
      'Both halves hold the same objects under the same light. The only difference is order; any other variable breaks the honesty.',
      'Keep each half to 3 or 4 shapes so the comparison resolves in one glance at 120 pixels.',
      'No dates, no arrows, no text. The diptych is the before-after; the overlay only gets to caption it.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),

  I({
    id: 'ytthumb-confessional-light',
    label: 'YT thumb: Confessional light',
    hint: 'Window light, hands, steam',
    goal: 'clicks',
    kind: 'organic',
    whyItWorks: [
      'A quiet, face-adjacent scene (hands, steam, window light) signals intimacy and honesty, which is the exact click motivation for story and confession videos.',
      'Faceless-but-human compositions let every viewer project herself into the frame, which a face would block.',
      'Soft window light with warm steam reads as calm authority in a feed of ring-lit faces, a premium pattern interrupt.',
    ],
    template: [
      '{TheQuietScene: hands wrapped around a warm mug, steam rising through window light, a journal page with abstract lines half-visible} at {TheHour: early morning, dusk}.',
      '',
      'Face-adjacent but faceless: {Framing: hands and forearms only, an over-shoulder frame with no face, light across the table}.',
      '',
      'Soft directional window light, warm bone and brass palette, deep quiet background. Clean zone at {Third} for the overlay line. No faces, no text.',
    ].join('\n'),
    exampleHooks: [
      'Hands wrapped around a warm ceramic mug, steam rising through soft morning window light, a journal page with abstract unreadable lines half-visible on the table, deep quiet background, the upper third calm for overlay words. The confessional hour, faceless, cinematic.',
      'An over-shoulder frame at dusk: a shoulder and hands at the edge of a warm desk, one page catching the last window light, steam from a tea curl crossing the beam. Intimate, honest, no face, no text.',
    ],
    craft: [
      'Hands, steam, and window light carry the humanity. The frame is face-adjacent (hands, shoulder, forearms) and absolutely faceless.',
      'Keep the palette warm (bone, brass, soft aubergine shadow) and the background deep and quiet. One light source only.',
      'No readable words on any page, no text in the render. The scene promises the confession; the overlay only hints at it.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    sizePresetIds: ['yt-thumb'],
  }),
];
