/**
 * Fix Offer/Upsell tab field collision — correctly this time.
 *
 * WRONG DIAGNOSIS (reverted here): `selectClass = inputClass + ' h-[38px]'`.
 * I blamed a <select> rendering ~4px taller than a sibling <input> and pinning
 * the grid row height. That is real but cosmetic, it is not overlap, and the
 * height did not fix it because it was never the cause.
 *
 * ACTUAL CAUSE: grid items default to `min-width: auto`, which means they refuse
 * to shrink below their content's intrinsic minimum width. `ui.tsx` already
 * documents this for <input> and puts `min-w-0` on the Field/Area/NumberField
 * wrappers. But the grid children that are NOT those components never got it:
 *
 *   <div>                                  <- select wrapper, no min-w-0
 *     <label className={labelClass}>Billing</label>
 *     <select className={selectClass} ...>
 *
 *   <div className="flex items-end">       <- button wrapper, no min-w-0
 *     <button ...>Remove</button>
 *
 * A <select> (widest <option>) and a <button> (label text) both carry a large
 * intrinsic min-width. Inside `sm:grid-cols-2` / `lg:grid-cols-4` /
 * `sm:grid-cols-[1fr_120px_auto]` those tracks cannot compress, so they overrun
 * their column and visually collide with the field beside them. Narrower panel
 * or longer option text = worse. Adding `min-w-0` lets the track shrink so the
 * declared `gap` survives, exactly as it already does for the inputs.
 *
 * `min-w-0` on a div outside a flex/grid container is inert, so applying this
 * across every tab file is safe and keeps the primitives uniform.
 *
 * Idempotent: re-running is a no-op (each edit is skipped when already present).
 */

const fs = require('fs');
const path = require('path');

const PARTS = path.join(__dirname, '..', 'src', 'app', 'admin', 'sales-funnels', 'parts');
const UI = path.join(PARTS, 'ui.tsx');

let touched = 0;
const log = [];

// ---------------------------------------------------------------------------
// 1. Revert the h-[38px] guess in ui.tsx and correct its comment.
// ---------------------------------------------------------------------------
{
  const before = fs.readFileSync(UI, 'utf8');
  let after = before;

  after = after.replace(
    "export const selectClass = inputClass + ' h-[38px] cursor-pointer';",
    "export const selectClass = inputClass + ' cursor-pointer';",
  );

  // Replace the (incorrect) rationale block with the verified one.
  const oldComment = after.match(
    /\/\*\*\n \* `selectClass`, not `inputClass`, for every <select>\.[\s\S]*?\*\/\n/,
  );
  if (oldComment) {
    after = after.replace(
      oldComment[0],
      `/**
 * \`selectClass\`, not \`inputClass\`, for every <select>.
 *
 * This exists only to add \`cursor-pointer\`; a <select> is otherwise styled
 * identically to an <input>.
 *
 * It briefly carried \`h-[38px]\` to force selects and inputs to the same box.
 * That was a misdiagnosis of the reported field collision and is removed: the
 * collision was horizontal (grid tracks that could not shrink — see \`min-w-0\`
 * above and on the wrappers below), not vertical. A fixed height also risks
 * clipping a select's text where a platform renders its internal padding
 * differently, so it is not worth keeping speculatively.
 */
`,
    );
  }

  if (after !== before) {
    fs.writeFileSync(UI, after);
    touched++;
    log.push('ui.tsx: reverted h-[38px], corrected selectClass rationale');
  } else {
    log.push('ui.tsx: already correct (no-op)');
  }
}

// ---------------------------------------------------------------------------
// 2. Add min-w-0 to non-Field grid children across every tab file.
// ---------------------------------------------------------------------------
const files = fs
  .readdirSync(PARTS)
  .filter((f) => f.endsWith('.tsx') && f !== 'ui.tsx')
  .map((f) => path.join(PARTS, f));

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  const hits = [];

  // 2a. Bare <div> that wraps a label — these hold the <select> elements.
  //     Only touch <div> with NO attributes, so nothing existing is clobbered.
  const bareDivLabel = /<div>(\s*\r?\n\s*)<label className=\{labelClass\}>/g;
  const nBare = (after.match(bareDivLabel) || []).length;
  if (nBare) {
    after = after.replace(bareDivLabel, '<div className="min-w-0">$1<label className={labelClass}>');
    hits.push(`${nBare} select/label wrapper(s)`);
  }

  // 2b. Button wrappers: <div className="flex items-end"> (and items-center variant).
  const btnWrap = /className="flex items-(end|center)"(>\s*\r?\n\s*<button)/g;
  const nBtn = (after.match(btnWrap) || []).length;
  if (nBtn) {
    after = after.replace(btnWrap, 'className="flex min-w-0 items-$1"$2');
    hits.push(`${nBtn} button wrapper(s)`);
  }

  if (after !== before) {
    fs.writeFileSync(file, after);
    touched++;
    log.push(`${path.basename(file)}: ${hits.join(', ')}`);
  }
}

console.log('=== fix-grid-item-minwidth ===');
log.forEach((l) => console.log('  ' + l));
console.log(touched ? `\n${touched} file(s) changed.` : '\nNo changes needed (already applied).');
