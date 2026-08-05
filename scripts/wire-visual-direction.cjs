/**
 * Task C step 2 — give `FunnelBrief.visual` a writer.
 *
 * Before this, nothing in src/ wrote any `visual.*` field: `funnelBriefFromIntake`
 * spread `blankFunnelBrief()` and set only identity/audience/promise/voice/offer,
 * so every funnel's 16 image slots used the neutral fallback and
 * `assumedVisualFields` returned all five names. This wires:
 *
 *   SalesAiIntake.visual* (6 flat string fields, admin-editable, AI-fillable)
 *     -> funnelBriefFromIntake -> FunnelBrief.visual -> buildSalesImagePrompts
 *
 * Flat string fields (not a nested object) deliberately: the intake already
 * carries flat upsell1Name/upsell1Price pairs, the admin setter is
 * setIntakeField(key, value) over `keyof SalesAiIntake`, and the AI fill merge
 * copies an allowlist of scalar keys. Nesting would have required touching all
 * three; flat fields ride the plumbing that already exists and is already tested.
 *
 * Idempotent: every edit asserts its anchor appears exactly once and skips if the
 * replacement is already present.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const changed = [];
const skipped = [];

// Several files in this repo are CRLF (see scripts/fix-ts-crlf.cjs). Match and
// edit in LF, then write back in whatever the file already used, so the patch
// does not show up as a whole-file diff.
function readLf(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') };
}

function writeEol(file, text, crlf) {
  fs.writeFileSync(file, crlf ? text.replace(/\n/g, '\r\n') : text);
}

function edit(rel, pairs) {
  const file = path.join(ROOT, rel);
  const read = readLf(file);
  let src = read.text;
  const before = src;

  pairs.forEach(([find, replace], i) => {
    if (src.includes(replace)) {
      skipped.push(rel + ' #' + (i + 1) + ' (already applied)');
      return;
    }
    const count = src.split(find).length - 1;
    if (count !== 1) {
      throw new Error('ANCHOR MISS in ' + rel + ' #' + (i + 1) + ' — found ' + count + ' times:\n' + find);
    }
    src = src.replace(find, replace);
  });
  if (src !== before) {
    writeEol(file, src, read.crlf);
    changed.push(rel);
  }
}

// ---------------------------------------------------------------------------
// 1. The input: six flat visual fields on SalesAiIntake
// ---------------------------------------------------------------------------

edit('src/lib/mothermode/sales/aiIntake.ts', [
  [
    "  toneNotes: string;\n  /** Structured money path. */",
    [
      '  toneNotes: string;',
      '  /**',
      '   * Art direction. Six flat fields rather than a nested block so the existing',
      '   * setIntakeField / AI-fill allowlist / normalize plumbing carries them without',
      '   * special cases. They are the input side of `FunnelBrief.visual`: until they',
      '   * existed the brief could describe a visual world but nothing could state one,',
      '   * so every generated image fell back to the neutral look.',
      '   *',
      '   * List-ish fields (palette, style, avoid) are comma separated because they are',
      '   * typed into single-line inputs; `splitVisualList` is the one place that splits.',
      '   */',
      '  visualSubject: string;',
      '  visualPalette: string;',
      '  visualStyleKeywords: string;',
      '  visualLighting: string;',
      '  visualComposition: string;',
      '  visualAvoid: string;',
      '  /** Structured money path. */',
    ].join('\n'),
  ],
  [
    "    toneNotes: '',\n    offerStack: blankOfferStack(),",
    [
      "    toneNotes: '',",
      "    visualSubject: '',",
      "    visualPalette: '',",
      "    visualStyleKeywords: '',",
      "    visualLighting: '',",
      "    visualComposition: '',",
      "    visualAvoid: '',",
      '    offerStack: blankOfferStack(),',
    ].join('\n'),
  ],
  [
    "    toneNotes: as('toneNotes'),",
    [
      "    toneNotes: as('toneNotes'),",
      "    visualSubject: as('visualSubject'),",
      "    visualPalette: as('visualPalette'),",
      "    visualStyleKeywords: as('visualStyleKeywords'),",
      "    visualLighting: as('visualLighting'),",
      "    visualComposition: as('visualComposition'),",
      "    visualAvoid: as('visualAvoid'),",
    ].join('\n'),
  ],
  [
    "/** Human-readable stack summary for AI user prompts. */",
    [
      '// ---------------------------------------------------------------------------',
      '// Visual direction',
      '// ---------------------------------------------------------------------------',
      '',
      '/**',
      ' * Split a comma/semicolon/newline separated field into the array shape',
      ' * `FunnelBriefVisual` wants. One implementation so the admin field, the brief',
      ' * and the image prompts cannot disagree about what a separator is.',
      ' */',
      'export function splitVisualList(v: string | undefined): string[] {',
      '  if (!v) return [];',
      '  return v',
      '    .split(/[,;\\n]/)',
      '    .map((s) => s.trim())',
      '    .filter(Boolean);',
      '}',
      '',
      '/**',
      ' * The `visual.*` paths that will be assumed if images are generated now, as',
      ' * dotted brief paths so the pre-flight warning in the editor and the post-run',
      ' * notice from `assumedVisualFields` name the same things.',
      ' *',
      " * `visual.avoid` is absent on purpose: the prompt builder always has a base",
      ' * avoid list, so an empty avoid field is never an assumption.',
      ' */',
      'export function missingIntakeVisualFields(intake: SalesAiIntake): string[] {',
      '  const gaps: string[] = [];',
      "  if (!(intake.visualSubject || '').trim()) gaps.push('visual.subject');",
      "  if (!splitVisualList(intake.visualPalette).length) gaps.push('visual.palette');",
      "  if (!splitVisualList(intake.visualStyleKeywords).length) gaps.push('visual.styleKeywords');",
      "  if (!(intake.visualLighting || '').trim()) gaps.push('visual.lighting');",
      "  if (!(intake.visualComposition || '').trim()) gaps.push('visual.composition');",
      '  return gaps;',
      '}',
      '',
      '/** One-line art direction summary for AI user prompts. Empty when unstated. */',
      'export function formatIntakeVisualForPrompt(intake: SalesAiIntake): string {',
      '  const bits = [',
      "    intake.visualSubject && 'subject: ' + intake.visualSubject,",
      "    intake.visualPalette && 'palette: ' + intake.visualPalette,",
      "    intake.visualStyleKeywords && 'style: ' + intake.visualStyleKeywords,",
      "    intake.visualLighting && 'lighting: ' + intake.visualLighting,",
      "    intake.visualComposition && 'composition: ' + intake.visualComposition,",
      "    intake.visualAvoid && 'avoid: ' + intake.visualAvoid,",
      '  ].filter(Boolean);',
      "  return bits.join(' | ');",
      '}',
      '',
      '/** Human-readable stack summary for AI user prompts. */',
    ].join('\n'),
  ],
]);

// ---------------------------------------------------------------------------
// 2. The mapping: intake -> brief.visual (gap #4 in the finding doc)
// ---------------------------------------------------------------------------

edit('src/lib/mothermode/sales/funnelBrief.ts', [
  [
    "import { normalizeOfferStack } from './aiIntake';",
    "import { normalizeOfferStack, splitVisualList } from './aiIntake';",
  ],
  [
    '    voice: { ...brief.voice, toneNotes: intake.toneNotes },',
    [
      '    voice: { ...brief.voice, toneNotes: intake.toneNotes },',
      '    // Art direction, verbatim. Still no invention: an unstated field stays',
      '    // empty and the image builder reports it in `assumedVisualFields`.',
      '    visual: {',
      "      subject: intake.visualSubject || '',",
      '      palette: splitVisualList(intake.visualPalette),',
      '      styleKeywords: splitVisualList(intake.visualStyleKeywords),',
      "      lighting: intake.visualLighting || '',",
      "      composition: intake.visualComposition || '',",
      '      avoid: splitVisualList(intake.visualAvoid),',
      '    },',
    ].join('\n'),
  ],
]);

// The doc comment above funnelBriefFromIntake claimed the visual block is always
// left empty. That stopped being true one edit ago; leaving it would be a lie in
// the exact file the next session reads first.
edit('src/lib/mothermode/sales/funnelBrief.ts', [
  [
    ' * Everything the intake genuinely knows is copied across. Everything it does\n * not — identity, mechanism name, objections, the whole visual block — is left\n * empty for the AI pass or the admin to fill. That emptiness is the point: it\n * is what the coverage audit can see and count.',
    ' * Everything the intake genuinely knows is copied across — including, since the\n * visual block landed on the intake, art direction. Everything it does not —\n * identity, mechanism name, objections — is left empty for the AI pass or the\n * admin to fill. That emptiness is the point: it is what the coverage audit can\n * see and count.',
  ],
]);

// ---------------------------------------------------------------------------
// 3. The AI: let fill propose art direction, and let every page prompt read it
// ---------------------------------------------------------------------------

edit('src/utils/integrations/openai-sales.ts', [
  [
    '  formatOfferStackForPrompt,\n  normalizeOfferStack,',
    '  formatIntakeVisualForPrompt,\n  formatOfferStackForPrompt,\n  normalizeOfferStack,',
  ],
  [
    "- Tone notes: ${synced.toneNotes || '(default MotherMode calm authority)'}",
    "- Tone notes: ${synced.toneNotes || '(default MotherMode calm authority)'}\n- Visual direction: ${formatIntakeVisualForPrompt(synced) || '(not set)'}",
  ],
  [
    '  "toneNotes": string,',
    [
      '  "toneNotes": string,',
      '  "visualSubject": string,',
      '  "visualPalette": string,',
      '  "visualStyleKeywords": string,',
      '  "visualLighting": string,',
      '  "visualComposition": string,',
      '  "visualAvoid": string,',
    ].join('\n'),
  ],
  [
    '- toneNotes stay short.',
    [
      '- toneNotes stay short.',
      '- visual* fields are art direction for image generation, not copy. Describe a',
      '  look this specific brand could own; do not reach for a generic stock look.',
      '  visualPalette, visualStyleKeywords and visualAvoid are comma separated.',
      '  Leave a visual field empty rather than inventing a look that fights the niche',
      '  — an empty field is reported to the admin, a wrong one silently renders.',
    ].join('\n'),
  ],
  [
    "    'upsell3Name', 'upsell3Price', 'upsell4Name', 'upsell4Price', 'toneNotes',",
    "    'upsell3Name', 'upsell3Price', 'upsell4Name', 'upsell4Price', 'toneNotes',\n    'visualSubject', 'visualPalette', 'visualStyleKeywords', 'visualLighting',\n    'visualComposition', 'visualAvoid',",
  ],
  [
    "- Tone: ${synced.toneNotes || '(default MotherMode)'}",
    "- Tone: ${synced.toneNotes || '(default MotherMode)'}\n- Visual direction: ${formatIntakeVisualForPrompt(synced) || '(not set)'}",
  ],
]);

// ---------------------------------------------------------------------------
// 4. The UI: fields to fill, and the warning that clearing them removes
// ---------------------------------------------------------------------------

const offerTab = path.join(ROOT, 'src/app/admin/sales-funnels/parts/OfferTab.tsx');
const otRead = readLf(offerTab);
let ot = otRead.text;

if (!ot.includes('missingIntakeVisualFields')) {
  const firstImport = ot.match(/^import .*?;$/m);
  if (!firstImport) throw new Error('OfferTab: no import line found');
  ot = ot.replace(
    firstImport[0],
    firstImport[0] + "\nimport { missingIntakeVisualFields } from '@/lib/mothermode/sales/aiIntake';",
  );

  const toneLine = ot.match(/^.*<Area label="Tone notes \(optional\)".*$/m);
  if (!toneLine) throw new Error('OfferTab: tone notes Area not found');
  const indent = toneLine[0].match(/^\s*/)[0];
  const visualBlock = [
    toneLine[0],
    '',
    '{/* Art direction. Without these six fields every image slot falls back to a',
    '    neutral look, which is honest but is nobody in particular. */}',
    '<p className="mt-4 text-xs uppercase tracking-wide text-neutral-400">Visual direction (drives generated images)</p>',
    '<div className="grid gap-3 sm:grid-cols-2">',
    '  <Field label="Recurring subject" value={intake.visualSubject} onChange={(v) => setIntakeField(\'visualSubject\', v)} placeholder="A calm home desk and the system on it" />',
    '  <Field label="Palette (comma separated)" value={intake.visualPalette} onChange={(v) => setIntakeField(\'visualPalette\', v)} placeholder="warm sand, deep green, off white" />',
    '  <Field label="Style keywords (comma separated)" value={intake.visualStyleKeywords} onChange={(v) => setIntakeField(\'visualStyleKeywords\', v)} placeholder="editorial, tactile, unfussy" />',
    '  <Field label="Lighting" value={intake.visualLighting} onChange={(v) => setIntakeField(\'visualLighting\', v)} placeholder="late afternoon window light" />',
    '  <Field label="Composition" value={intake.visualComposition} onChange={(v) => setIntakeField(\'visualComposition\', v)} placeholder="off centre subject, generous negative space" />',
    '  <Field label="Avoid (comma separated)" value={intake.visualAvoid} onChange={(v) => setIntakeField(\'visualAvoid\', v)} placeholder="stock smiles, clutter, neon" />',
    '</div>',
  ]
    .map((l, i) => (i === 0 ? l : l ? indent + l : l))
    .join('\n');
  ot = ot.replace(toneLine[0], visualBlock);

  const btnLine = ot.match(/^.*onClick=\{onGenerateImages\}.*$/m);
  if (!btnLine) throw new Error('OfferTab: generate-images button not found');
  const btnIndent = btnLine[0].match(/^\s*/)[0];
  const warning = [
    '{missingIntakeVisualFields(intake).length > 0 && (',
    '  <p className="basis-full text-xs text-amber-300">',
    "    No visual direction for {missingIntakeVisualFields(intake).join(', ')} — generated images will use a neutral look. Fill the fields above to make them match this brand.",
    '  </p>',
    ')}',
  ]
    .map((l) => btnIndent + l)
    .join('\n');
  ot = ot.replace(btnLine[0], warning + '\n' + btnLine[0]);

  writeEol(offerTab, ot, otRead.crlf);
  changed.push('src/app/admin/sales-funnels/parts/OfferTab.tsx');
} else {
  skipped.push('OfferTab (already applied)');
}

// ---------------------------------------------------------------------------
// 5. Tests — the mapping is the whole point, so pin it
// ---------------------------------------------------------------------------

const testFile = path.join(ROOT, 'tests/lib/sales-visual-direction.test.ts');
fs.writeFileSync(
  testFile,
  [
    "import { describe, expect, it } from 'vitest';",
    '',
    'import {',
    '  blankSalesAiIntake,',
    '  formatIntakeVisualForPrompt,',
    '  missingIntakeVisualFields,',
    '  normalizeSalesAiIntake,',
    '  splitVisualList,',
    '  type SalesAiIntake,',
    "} from '@/lib/mothermode/sales/aiIntake';",
    "import { funnelBriefFromIntake } from '@/lib/mothermode/sales/funnelBrief';",
    "import { buildSalesImagePrompts, SALES_IMAGE_SLOTS } from '@/lib/mothermode/sales/imagePrompts';",
    '',
    '/**',
    ' * These assert the link that did not exist until now: an admin-stated visual',
    ' * position reaching the image prompts. The companion file',
    ' * tests/lib/sales-image-prompts.test.ts already pins the downstream behaviour',
    ' * (congruence, per-slot format, fallback reporting); this pins the input.',
    ' */',
    '',
    'function filledIntake(): SalesAiIntake {',
    '  return {',
    '    ...blankSalesAiIntake(),',
    "    niche: 'Mental load',",
    "    offerName: 'The Brain Dump System',",
    "    visualSubject: 'A worn kitchen table with the printed system on it',",
    "    visualPalette: 'warm sand, deep green',",
    "    visualStyleKeywords: 'editorial, tactile',",
    "    visualLighting: 'late afternoon window light',",
    "    visualComposition: 'off centre subject',",
    "    visualAvoid: 'stock smiles, neon',",
    '  };',
    '}',
    '',
    "describe('splitVisualList', () => {",
    "  it('splits on commas, semicolons and newlines and trims', () => {",
    "    expect(splitVisualList('warm sand, deep green; off white\\nbone')).toEqual([",
    "      'warm sand',",
    "      'deep green',",
    "      'off white',",
    "      'bone',",
    '    ]);',
    '  });',
    '',
    "  it('treats empty and undefined as no entries, not as one empty entry', () => {",
    "    expect(splitVisualList('')).toEqual([]);",
    '    expect(splitVisualList(undefined)).toEqual([]);',
    "    expect(splitVisualList(' , ; ')).toEqual([]);",
    '  });',
    '});',
    '',
    "describe('missingIntakeVisualFields', () => {",
    "  it('names all five assumable fields for a blank intake', () => {",
    '    expect(missingIntakeVisualFields(blankSalesAiIntake())).toEqual([',
    "      'visual.subject',",
    "      'visual.palette',",
    "      'visual.styleKeywords',",
    "      'visual.lighting',",
    "      'visual.composition',",
    '    ]);',
    '  });',
    '',
    "  it('is empty once the admin has stated a position', () => {",
    '    expect(missingIntakeVisualFields(filledIntake())).toEqual([]);',
    '  });',
    '',
    "  it('names exactly the gaps on a partial fill, and never visual.avoid', () => {",
    "    const partial = { ...blankSalesAiIntake(), visualPalette: 'bone, ink' };",
    '    const gaps = missingIntakeVisualFields(partial);',
    "    expect(gaps).not.toContain('visual.palette');",
    "    expect(gaps).not.toContain('visual.avoid');",
    "    expect(gaps).toContain('visual.subject');",
    '    expect(gaps).toHaveLength(4);',
    '  });',
    '',
    "  it('agrees with what the image builder will actually assume', () => {",
    '    const blankGaps = missingIntakeVisualFields(blankSalesAiIntake());',
    '    const set = buildSalesImagePrompts(funnelBriefFromIntake(blankSalesAiIntake()));',
    '    expect(set.assumedVisualFields).toEqual(blankGaps);',
    '  });',
    '});',
    '',
    "describe('funnelBriefFromIntake — visual block', () => {",
    "  it('carries every visual field through, splitting the list fields', () => {",
    '    const brief = funnelBriefFromIntake(filledIntake());',
    "    expect(brief.visual.subject).toBe('A worn kitchen table with the printed system on it');",
    "    expect(brief.visual.palette).toEqual(['warm sand', 'deep green']);",
    "    expect(brief.visual.styleKeywords).toEqual(['editorial', 'tactile']);",
    "    expect(brief.visual.lighting).toBe('late afternoon window light');",
    "    expect(brief.visual.composition).toBe('off centre subject');",
    "    expect(brief.visual.avoid).toEqual(['stock smiles', 'neon']);",
    '  });',
    '',
    "  it('still leaves the block empty when the intake states nothing', () => {",
    '    const brief = funnelBriefFromIntake(blankSalesAiIntake());',
    "    expect(brief.visual.subject).toBe('');",
    '    expect(brief.visual.palette).toEqual([]);',
    '  });',
    '});',
    '',
    "describe('image prompts read the stated position', () => {",
    "  it('reports no assumptions and embeds the palette in all 16 slots', () => {",
    '    const set = buildSalesImagePrompts(funnelBriefFromIntake(filledIntake()));',
    '    expect(set.assumedVisualFields).toEqual([]);',
    "    expect(set.styleLine).toContain('warm sand and deep green palette');",
    '    const prompts = Object.values(set.prompts);',
    '    expect(prompts).toHaveLength(SALES_IMAGE_SLOTS.length);',
    '    prompts.forEach((p) => expect(p.imagePrompt).toContain(set.styleLine));',
    '  });',
    '',
    "  it('carries the avoid field into the negative prompt', () => {",
    '    const set = buildSalesImagePrompts(funnelBriefFromIntake(filledIntake()));',
    "    expect(set.prompts.salesHero.negativePrompt).toContain('stock smiles');",
    '  });',
    '',
    "  it('two different positions produce two different worlds', () => {",
    '    const a = buildSalesImagePrompts(funnelBriefFromIntake(filledIntake()));',
    "    const b = buildSalesImagePrompts(funnelBriefFromIntake({ ...filledIntake(), visualPalette: 'cobalt, chalk' }));",
    '    expect(a.styleLine).not.toBe(b.styleLine);',
    '  });',
    '});',
    '',
    "describe('persistence', () => {",
    "  it('survives a JSON round trip through the normalizer', () => {",
    '    const stored = JSON.parse(JSON.stringify(filledIntake()));',
    '    const back = normalizeSalesAiIntake(stored);',
    "    expect(back.visualPalette).toBe('warm sand, deep green');",
    "    expect(back.visualAvoid).toBe('stock smiles, neon');",
    '  });',
    '',
    "  it('tolerates a record saved before the fields existed', () => {",
    '    const legacy = JSON.parse(JSON.stringify(blankSalesAiIntake()));',
    '    delete legacy.visualSubject;',
    '    delete legacy.visualPalette;',
    '    const back = normalizeSalesAiIntake(legacy);',
    "    expect(back.visualSubject).toBe('');",
    "    expect(back.visualPalette).toBe('');",
    '    expect(() => funnelBriefFromIntake(back)).not.toThrow();',
    '  });',
    '});',
    '',
    "describe('formatIntakeVisualForPrompt', () => {",
    "  it('is empty when nothing is stated, so prompts omit the line', () => {",
    "    expect(formatIntakeVisualForPrompt(blankSalesAiIntake())).toBe('');",
    '  });',
    '',
    "  it('summarises only the stated fields', () => {",
    "    const out = formatIntakeVisualForPrompt({ ...blankSalesAiIntake(), visualLighting: 'harsh noon' });",
    "    expect(out).toBe('lighting: harsh noon');",
    '  });',
    '});',
    '',
  ].join('\n'),
);
changed.push('tests/lib/sales-visual-direction.test.ts');

console.log('CHANGED:\n  ' + changed.join('\n  '));
if (skipped.length) console.log('SKIPPED:\n  ' + skipped.join('\n  '));

// ---------------------------------------------------------------------------
// 6. Verify. A green typecheck is not evidence the images are right, but a red
//    one is evidence the wiring is wrong, and that is worth knowing now.
// ---------------------------------------------------------------------------

function run(cmd) {
  console.log('\n$ ' + cmd);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (e) {
    console.log('FAILED: ' + cmd);
    return false;
  }
}

const tsOk = run('npx tsc --noEmit');
const testOk = run('npx vitest run tests/lib/sales-visual-direction.test.ts tests/lib/sales-image-prompts.test.ts tests/lib/sales-offer-stack.test.ts');
console.log('\nRESULT typecheck=' + (tsOk ? 'pass' : 'FAIL') + ' tests=' + (testOk ? 'pass' : 'FAIL'));
