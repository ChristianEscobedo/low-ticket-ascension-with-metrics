/**
 * Codemod: palette migration for the three admin surfaces the burgundy card
 * codemod could never reach (`scripts/apply-burgundy-cards.cjs`).
 *
 * WHY A SECOND SCRIPT
 * -------------------
 * apply-burgundy-cards.cjs only rewrites shells that *already* speak the brand
 * palette — its matcher requires `border-bone/10|15` **and** `rounded-xl|2xl`.
 * Two families of files fail that test for different reasons:
 *
 *   1. planner  — `PlannerWorkspace.tsx` was never themed. It is raw Tailwind
 *      grey (`neutral-800`, `bg-neutral-900`, `text-neutral-400`) with plain
 *      `rounded`. No bone token, no xl radius: zero matches.
 *   2. courses / course-access — the `page.tsx` files are 18-line wrappers; the
 *      real shells live in `src/components/admin/**`, which the burgundy TARGETS
 *      never scanned. And when you look inside, they are *legacy* admin palette
 *      (`border-white/10`, `bg-black/30`, `bg-amber-500`), not bone either.
 *
 * So this is a token migration, not a card swap. Two ordered rule tables map
 * each legacy dialect onto the MotherMode palette from tailwind.config.js
 * (bone / ink / mode / mode-deep / brass), and only then does a card pass
 * promote real shells to the burgundy treatment.
 *
 * WHAT COUNTS AS A CARD HERE
 * --------------------------
 * After the token pass, a shell qualifies when it has a border on a brand token
 * plus a rounded corner plus its own padding. That deliberately skips:
 *   - buttons/pills (`px-3 py-1`, no `p-*`)
 *   - bare dividers (`border-b`, no rounding)
 *   - inputs, popovers and dropdowns (`rounded-lg`, which the design uses for
 *     controls; cards are `rounded-xl`/`2xl`)
 *   - modal shells (they keep an opaque fill; a translucent gradient would let
 *     the page bleed through)
 * Empty states keep the quiet flat fill used by SystemsPanel rather than the
 * gradient, because a confident burgundy card that says "nothing here" reads as
 * broken content.
 *
 * Usage:
 *   node scripts/apply-palette-migration.cjs            # dry run, writes report
 *   node scripts/apply-palette-migration.cjs --write    # apply
 */
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const REPORT = path.join('scripts', 'palette-migration-report.txt');

const GRADIENT = 'bg-gradient-to-br from-mode-deep/40 to-ink/70';

/**
 * Planner dialect: raw Tailwind neutrals.
 *
 * The greys are mapped by *role*, not by number: neutral-400 is body-secondary
 * text, so it becomes bone/50, while neutral-500 (the quietest label) becomes
 * bone/40. Variant-prefixed classes are listed before their bare form so
 * `hover:text-neutral-200` doesn't get rewritten to `hover:text-bone/70`.
 */
const GREY_RULES = [
  [/\bhover:text-neutral-200\b/g, 'hover:text-bone'],
  [/\bhover:bg-neutral-800\b/g, 'hover:bg-bone/5'],

  [/\btext-neutral-100\b/g, 'text-bone'],
  [/\btext-neutral-200\b/g, 'text-bone/70'],
  [/\btext-neutral-300\b/g, 'text-bone/60'],
  [/\btext-neutral-400\b/g, 'text-bone/50'],
  [/\btext-neutral-500\b/g, 'text-bone/40'],

  // Draggable chips sit *inside* a burgundy column, so they lift with a lighter
  // aubergine rather than a grey that would read as a different system.
  [/\bbg-neutral-800\b/g, 'bg-mode/30'],
  [/\bbg-neutral-900\b/g, 'bg-ink/60'],

  [/\bborder-neutral-800\b/g, 'border-bone/10'],
  [/\bborder-neutral-700\b/g, 'border-bone/15'],

  // The active-tab underline and the primary Save button were pure white on
  // black — the only two places in the file using colour as emphasis.
  [/\bborder-b-2 border-white\b/g, 'border-b-2 border-brass'],
  [/\bbg-white px-3 py-1 text-xs font-medium text-black\b/g,
    'bg-brass px-3 py-1 text-xs font-medium text-ink'],
  [/\btext-white\b/g, 'text-bone'],

  // Error banner: brand-neutral red at brand opacities.
  [/\bborder-red-800\b/g, 'border-red-400/30'],
  [/\bbg-red-950\/50\b/g, 'bg-red-500/10'],
];

/**
 * Legacy admin dialect: white/black scrims with an amber accent. Amber was the
 * pre-MotherMode accent and maps 1:1 onto brass; white maps onto bone and black
 * onto ink at the same opacity so contrast ratios survive the swap.
 */
const LEGACY_RULES = [
  // amber → brass (variant-prefixed first)
  [/\bhover:border-amber-300\/30\b/g, 'hover:border-brass/40'],
  [/\bgroup-hover:text-amber-200\b/g, 'group-hover:text-brass'],
  [/\bhover:text-amber-200\b/g, 'hover:text-brass'],
  [/\bhover:text-amber-100\b/g, 'hover:text-bone'],
  [/\bfocus:border-amber-300\/40\b/g, 'focus:border-brass/40'],
  [/\bhover:bg-amber-500\/25\b/g, 'hover:bg-brass/25'],
  [/\bhover:bg-amber-400\b/g, 'hover:bg-brass/90'],

  [/\bbg-amber-500\/30\b/g, 'bg-brass/25'],
  [/\bbg-amber-500\/(\d+)\b/g, 'bg-brass/$1'],
  [/\bbg-amber-500\b/g, 'bg-brass'],
  [/\btext-amber-200\/70\b/g, 'text-brass/70'],
  [/\btext-amber-200\b/g, 'text-brass'],
  [/\btext-amber-300\b/g, 'text-brass'],
  [/\bring-amber-\d{3}\/(\d+)\b/g, 'ring-brass/$1'],
  [/\bborder-amber-\d{3}\/(\d+)\b/g, 'border-brass/$1'],


  // white → bone, preserving the opacity step (incl. arbitrary `/[0.02]`)
  [/\bplaceholder-white\/(\[[^\]]+\]|\d+)/g, 'placeholder-bone/$1'],
  [/\b(hover:|group-hover:|focus:)?text-white\/(\[[^\]]+\]|\d+)/g, '$1text-bone/$2'],
  [/\b(hover:|group-hover:|focus:)?bg-white\/(\[[^\]]+\]|\d+)/g, '$1bg-bone/$2'],
  [/\b(hover:|focus:)?border-white\/(\[[^\]]+\]|\d+)/g, '$1border-bone/$2'],
  [/\b(hover:|group-hover:|focus:)?text-white\b/g, '$1text-bone'],

  // black scrims → ink. The modal backdrop goes *darker* (ink/80) because ink is
  // warmer and lighter than pure black and would otherwise stop reading as a
  // scrim.
  [/\bbg-black\/60\b/g, 'bg-ink/80'],
  [/\bbg-black\/40\b/g, 'bg-ink/60'],
  [/\bbg-black\/30\b/g, 'bg-ink/40'],
  [/\btext-black\b/g, 'text-ink'],

  // Modal fills must stay opaque, so they get the full-strength brand gradient
  // instead of the translucent card one.
  [/\bfrom-gray-950 to-black\b/g, 'from-mode-deep to-ink'],
  [/\bbg-gray-950\b/g, 'bg-ink'],
];

const TARGETS = [
  { file: path.join('src', 'app', 'admin', 'planner', 'PlannerWorkspace.tsx'), rules: GREY_RULES },
  { file: path.join('src', 'components', 'admin', 'CoursesPanel.tsx'), rules: LEGACY_RULES },
  { file: path.join('src', 'components', 'admin', 'CourseAccessPanel.tsx'), rules: LEGACY_RULES },
  { file: path.join('src', 'components', 'admin', 'CourseAccessSelector.tsx'), rules: LEGACY_RULES },
  { file: path.join('src', 'components', 'admin', 'courses', 'CourseFormModal.tsx'), rules: LEGACY_RULES },
  { file: path.join('src', 'components', 'admin', 'courses', 'CourseLessonsEditor.tsx'), rules: LEGACY_RULES },
];

/** Does this (already token-migrated) class string describe a card shell? */
function isCardShell(cls) {
  if (!/\bborder-bone\/1[05]\b/.test(cls)) return false;
  if (!/\brounded(?:-xl|-2xl)?\b/.test(cls)) return false;
  if (/rounded-full|rounded-lg/.test(cls)) return false;
  if (/focus:|placeholder|outline-none|appearance-none/.test(cls)) return false;
  // needs its own padding — that's what separates a card from a chip or divider
  if (!/\bp-\d|\bmin-h-\[|\boverflow-x-auto\b/.test(cls)) return false;
  return true;
}

/** Empty states stay flat: a filled card that says "nothing here" reads broken. */
function isEmptyState(cls) {
  return /\btext-center\b/.test(cls);
}

function restyleCard(cls) {
  if (isEmptyState(cls)) {
    return cls.replace(/\bbg-ink\/\d+\b/, 'bg-bone/[0.02]').replace(/\s{2,}/g, ' ');
  }

  let next = cls
    .replace(/\bborder-bone\/1[05]\b/g, 'border-brass/15')
    // plain `rounded` is a 4px control radius; cards are xl in this design
    .replace(/\brounded\b(?!-)/, 'rounded-xl');

  const FILL = /\bbg-ink\/\d+\b|\bbg-bone\/\[0\.0\d\]|\bbg-bone\/(?:5|10)\b/;
  if (FILL.test(next)) {
    next = next.replace(FILL, GRADIENT);
  } else {
    next = next.replace(/\bborder-brass\/15\b/, `border-brass/15 ${GRADIENT}`);
  }

  return next
    .replace(/(\bbg-gradient-to-br from-mode-deep\/40 to-ink\/70\b)(\s+\1)+/g, '$1')
    .replace(/\s{2,}/g, ' ');
}

const lines = [];
let filesChanged = 0;
let stringsChanged = 0;
let cardsPromoted = 0;

for (const { file, rules } of TARGETS) {
  if (!fs.existsSync(file)) {
    lines.push(`!! MISSING ${file}`);
    continue;
  }
  const before = fs.readFileSync(file, 'utf8');
  let count = 0;
  let cards = 0;

  /** Apply the rule table (+ card promotion) to one class fragment. */
  const migrate = (body) => {
    let next = body;
    for (const [re, to] of rules) next = next.replace(re, to);
    if (isCardShell(next)) {
      const promoted = restyleCard(next);
      if (promoted !== next) cards += 1;
      next = promoted;
    }
    return next;
  };

  // Pass 1 — single-line quoted strings. Only string bodies are rewritten, so
  // comments and logic are safe.
  let after = before.replace(/(['"`])((?:[^'"`\n\\]|\\.)*?)\1/g, (whole, q, body) => {
    if (!/[a-z]-|\brounded\b/.test(body)) return whole;

    const next = migrate(body);
    if (next === body) return whole;

    count += 1;
    lines.push(`${file}\n    -  ${body}\n    +  ${next}`);
    return `${q}${next}${q}`;
  });

  // Pass 2 — class fragments that open a MULTI-LINE template literal, e.g.
  //     className={`min-h-[84px] rounded border border-neutral-800 p-1 ${
  //       dim ? 'opacity-40' : ''
  //     }`}
  // Pass 1 cannot see these: its body class excludes newlines, so an unclosed
  // backtick never matches. This was the sole reason the planner's calendar day
  // cell and the lessons-editor icon button survived the first run — the two
  // "leftovers" were never a rule gap, just an unreachable string. Matching the
  // head fragment line-by-line keeps backtick pairing unambiguous (no attempt to
  // span `${...}` expressions, which can themselves contain template literals).
  after = after.replace(/(className=\{`)([^`\n]*)$/gm, (whole, head, body) => {
    if (!/[a-z]-|\brounded\b/.test(body)) return whole;

    const next = migrate(body);
    if (next === body) return whole;

    count += 1;
    lines.push(`${file}\n    -  ${body}\n    +  ${next}`);
    return `${head}${next}`;
  });


  if (count) {
    filesChanged += 1;
    stringsChanged += count;
    cardsPromoted += cards;
    if (WRITE) fs.writeFileSync(file, after);
  }
}

// Leftover scan: anything still speaking a legacy dialect after the pass. This
// is the check that would have caught the planner in the first place.
const LEFTOVER = /\b(?:text|bg|border|from|to|ring|placeholder)-(?:neutral|white|black|gray|amber)(?:-\d{2,3})?(?:\/(?:\[[^\]]+\]|\d+))?\b/g;

/**
 * Deliberate exceptions — NOT drift.
 *
 * `text-amber-400` is the planner's over-capacity warning
 * (`over ? 'text-amber-400' : 'text-bone/40'` on the per-column card count).
 * Amber is carrying *semantics* there, not brand: mapping it to brass would
 * make "you are over your weekly limit" render identically to ordinary accent
 * text and silently delete the signal. Warning amber is used the same way in
 * EmailInsightsPanel, so this stays consistent with the rest of the admin.
 */
const ALLOWED = new Set(['text-amber-400']);

const leftovers = [];
for (const { file } of TARGETS) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const hits = [...new Set(text.match(LEFTOVER) || [])].filter((h) => !ALLOWED.has(h));
  if (hits.length) leftovers.push(`${file}\n    ${hits.join('  ')}`);
}


const header = [
  WRITE ? 'MODE: write (files updated)' : 'MODE: dry run (no files written)',
  `files touched:    ${filesChanged}`,
  `class strings:    ${stringsChanged}`,
  `cards promoted:   ${cardsPromoted}`,
  '',
].join('\n');

const footer = [
  '',
  '--- leftover legacy tokens (after pass) ---',
  leftovers.length ? leftovers.join('\n') : '  (none)',
  '',
].join('\n');

fs.writeFileSync(REPORT, header + lines.join('\n') + '\n' + footer);
console.log(header);
console.log(footer);
console.log(`report -> ${REPORT}`);
