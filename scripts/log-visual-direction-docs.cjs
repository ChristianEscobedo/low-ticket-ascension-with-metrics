/**
 * Record the visual-direction work in every doc whose subject matter it changed.
 *
 * Appends rather than rewrites: the earlier sections are the record of what was
 * true then, and the next session needs to see that the "visual block has no
 * writer" claim was accurate when written and is not accurate now. Each block is
 * appended once (guarded by its marker).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = '## 2026-07-25 — Visual direction: the brief finally has a writer';
const done = [];
const already = [];

function append(rel, body) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    throw new Error('Missing doc: ' + rel);
  }
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.includes(MARKER)) {
    already.push(rel);
    return;
  }
  const crlf = raw.includes('\r\n');
  const text = raw.replace(/\r\n/g, '\n').replace(/\s*$/, '\n');
  const next = text + '\n' + MARKER + '\n\n' + body.trim() + '\n';
  fs.writeFileSync(file, crlf ? next.replace(/\n/g, '\r\n') : next);
  done.push(rel);
}

const WHAT_SHIPPED = `
**What shipped**

\`SalesAiIntake\` gained six flat art-direction fields — \`visualSubject\`,
\`visualPalette\`, \`visualStyleKeywords\`, \`visualLighting\`, \`visualComposition\`,
\`visualAvoid\` — and \`funnelBriefFromIntake\` now maps them onto
\`FunnelBrief.visual\`. Before this, nothing in \`src/\` wrote a single \`visual.*\`
field: the mapper spread \`blankFunnelBrief()\` and set only identity, audience,
promise, voice and offer. Every funnel's 16 image slots therefore rendered the
neutral fallback and \`assumedVisualFields\` returned all five names. The slots
agreed with each other; they did not agree with any brand.

Flat string fields, not a nested block, on purpose: the intake already stores
flat \`upsell1Name\`/\`upsell1Price\` pairs, the admin setter is
\`setIntakeField(key, value)\` keyed on \`keyof SalesAiIntake\`, and the AI-fill
merge copies an allowlist of scalar keys. A nested object would have needed all
three changed; flat fields ride plumbing that already exists and is already
tested. The list-ish fields are comma separated and split in exactly one place,
\`splitVisualList\`.
`;

// 1. The finding doc — this is the file that carried the "gap #4" claim.
append(
  'docs/SALES_FUNNEL_IMAGE_PROMPTS_FINDING.md',
  `
This section supersedes the Status section above, which recorded step 1 (tests)
as the only completed step. Step 2 is now done.

${WHAT_SHIPPED}

**Gap #4 is closed.** The gap was: \`FunnelBrief.visual\` had no writer, so the
visual congruence the prompt builder is designed around was congruence with a
default rather than with the brand. There is now an input, it persists, the AI
can propose it, and the mapping is pinned by tests.

**Surfacing, in the order the last session argued for.** The pre-flight warning
lives in the Offer tab beside "Generate missing images" and lists the exact
fields that will be assumed — \`missingIntakeVisualFields(intake)\`. It was
deliberately added *after* the input existed: a permanently-on banner with no
field to clear it would have been noise. It now clears itself when the admin
fills the fields, and a test asserts it names exactly the same paths that
\`assumedVisualFields\` reports after the run, so the before and after messages
cannot drift apart.

**Verification**

- \`npx tsc --noEmit\` — clean.
- \`npx vitest run\` on the three sales suites — 44 passed, 0 failed (vitest
  4.1.8): 15 new in \`tests/lib/sales-visual-direction.test.ts\`, plus the 19 from
  last session and 10 offer-stack, all still green.
- New tests cover: list splitting (commas, semicolons, newlines, blank-vs-empty),
  \`missingIntakeVisualFields\` on blank/filled/partial intakes, the brief mapping
  field by field, all 16 slots carrying the stated style line, \`avoid\` reaching
  the negative prompt, two palettes producing two different worlds, a JSON round
  trip through the normalizer, and a legacy record saved before the fields
  existed still normalizing and mapping without throwing.

**Still honestly outstanding**

- No image has been generated. Every assertion here is about returned strings.
  Whether a stated palette actually improves the rendered result is unmeasured,
  and the only way to measure it is to run the generator and look.
- The AI-fill prompt now asks for \`visual*\` values and is told to leave a field
  empty rather than invent a look. That instruction is untested against a live
  model — no API call was made this session.
- Task D remains untouched.
- The warning's placement was verified by reading the JSX and by a clean
  typecheck, not in a browser.
`,
);

// 2. The image-prompt handoff — the pipeline description changes shape here.
append(
  'docs/SALES_FUNNEL_IMAGE_PROMPTS_HANDOFF.md',
  `
${WHAT_SHIPPED}

**The pipeline as it now stands**

\`\`\`
Offer tab visual fields (or AI fill)
  -> SalesAiIntake.visual*            (persisted in the existing ai_intake JSON)
  -> funnelBriefFromIntake            -> FunnelBrief.visual
  -> buildSalesImagePrompts           -> styleLine + 16 slot prompts
                                      -> assumedVisualFields (now usually empty)
\`\`\`

No migration was needed: the intake is stored as JSON, and
\`normalizeSalesAiIntake\` fills the new keys with \`''\` for records written
before they existed. A test pins that legacy path.

Unchanged and still true: \`assumedVisualFields\` reports what the builder had to
assume, and an empty \`visualAvoid\` is never reported because the builder always
has a base negative list.
`,
);

// 3. The AI builder port — the fill contract changed.
append(
  'docs/SALES_FUNNEL_AI_BUILDER_PORT.md',
  `
${WHAT_SHIPPED}

**AI surface changes in \`src/utils/integrations/openai-sales.ts\`**

- \`aiFillSalesIntake\` — the response schema gained the six \`visual*\` keys, the
  guidance block explains they are art direction rather than copy and that a
  field left empty is reported to the admin while a wrong one silently renders,
  and the six keys were added to the scalar allowlist so a proposed value
  actually survives the merge instead of being dropped.
- \`aiGenerateSalesFunnel\` and \`aiGenerateSalesPage\` — both INTAKE blocks now
  include a \`Visual direction:\` line via \`formatIntakeVisualForPrompt\`, which
  renders \`(not set)\` when nothing is stated. Copy generation can now reference
  the same world the images are built in.

Not verified: no live model call was made, so how well a model fills these
fields is unknown. The allowlist change is the part that matters and is
mechanical — without it the model's answer would have been discarded silently,
which is the failure mode that would have looked like "the AI ignores visuals".
`,
);

// 4. The system port — the intake shape is part of the system contract.
append(
  'docs/SALES_FUNNEL_SYSTEM_PORT.md',
  `
${WHAT_SHIPPED}

**Porting notes**

- Schema: none required. The six fields live inside the existing \`ai_intake\`
  JSON column on the sales funnel row; \`normalizeSalesAiIntake\` defaults them to
  \`''\`, so older rows load unchanged.
- Files touched: \`src/lib/mothermode/sales/aiIntake.ts\` (fields, blank,
  normalize, \`splitVisualList\`, \`missingIntakeVisualFields\`,
  \`formatIntakeVisualForPrompt\`), \`src/lib/mothermode/sales/funnelBrief.ts\`
  (the mapping), \`src/utils/integrations/openai-sales.ts\` (fill schema,
  guidance, allowlist, two prompt blocks),
  \`src/app/admin/sales-funnels/parts/OfferTab.tsx\` (six inputs plus the
  pre-flight warning), \`tests/lib/sales-visual-direction.test.ts\` (new).
- Applied by \`scripts/wire-visual-direction.cjs\`, which asserts each anchor
  matches exactly once, is idempotent, and preserves each file's existing line
  endings.
`,
);

// 5. The brief handoff — its own doc comment said the visual block is always empty.
append(
  'docs/FUNNEL_BRIEF_HANDOFF.md',
  `
${WHAT_SHIPPED}

**Correction to earlier text in this doc.** Anywhere above that says the visual
block is always left empty for the AI pass or the admin, that was accurate when
written and is no longer. \`funnelBriefFromIntake\` now populates
\`brief.visual\` from the intake. The doc comment above the function in
\`funnelBrief.ts\` was updated in the same commit rather than left to rot.

What has *not* changed is the principle the emptiness served: the mapper still
invents nothing. An unstated visual field maps to \`''\` or \`[]\` and is reported
downstream by \`assumedVisualFields\`, so the coverage audit can still see and
count the gaps.
`,
);

// 6. The autofill task doc — coverage numbers move when fields are added.
append(
  'docs/SALES_FUNNEL_AI_AUTOFILL_TASK.md',
  `
${WHAT_SHIPPED}

**Effect on coverage.** Six new intake fields are now AI-fillable and
admin-editable, and one previously unreachable brief block (\`visual\`, five
reported paths) now has a path from input to output. Anyone re-running
\`scripts/audit-ai-fill-coverage.cjs\` should expect the totals to move; the
numbers recorded earlier in this doc predate these fields.
`,
);

// 7. The editor refactor port — OfferTab is one of its extracted parts.
append(
  'docs/SALES_FUNNEL_EDITOR_REFACTOR_SYSTEM_PORT.md',
  `
\`OfferTab.tsx\` gained a "Visual direction (drives generated images)" group of
six inputs below the tone notes field, and an amber pre-flight line beside
"Generate missing images" that names the visual fields still unset. Both use the
existing \`Field\` component and the existing \`setIntakeField\` prop — no new
props, no editor-level state, so the tab's contract with
\`SalesFunnelEditor.tsx\` is unchanged.

The warning derives its text from \`missingIntakeVisualFields(intake)\`, the same
function the tests pin against \`assumedVisualFields\`, so the message before a
run and the notice after one cannot disagree. Verified by typecheck, not in a
browser.
`,
);

console.log('UPDATED:\n  ' + (done.join('\n  ') || '(none)'));
if (already.length) console.log('ALREADY PRESENT:\n  ' + already.join('\n  '));
