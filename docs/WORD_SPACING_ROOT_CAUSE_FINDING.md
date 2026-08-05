# Word spacing does nothing — root cause finding

Status: **root cause found and fixed in code. Tests pass. NOT yet confirmed in a browser.**
Supersedes section 3 of `PREVIEW_SIZING_AND_RENDER_BUTTON_TASK.md`, which contains three
incorrect conclusions (documented below so they don't get re-investigated).

Two separate defects were making one symptom.

## CORRECTION (next session) — the "cannot drift" claim below was WRONG

This doc originally said both defects were fixed in `src/lib/mothermode/reel/captions.ts`,
"which both renderers read — so preview and burn move together and cannot drift." **That is
false, and it hid the fact that the fix never reached the render path.**

`render-worker/remotion-project/CaptionLayer.tsx` line 18 imports from
`'../src/lib/mothermode/reel/captions'`, which resolves to a **vendored copy** at
`render-worker/src/lib/mothermode/reel/captions.ts` — a separate 974-line file that had
already drifted 46 lines from the app's 1000-line version. The worker's `Dockerfile` does a
plain `COPY . ./`, so Railway builds that vendored copy, not the app module.

Net effect: after the "fix", the preview was correct and the MP4 was still broken. The
vendored copy still had the truthy gate (`def.wordSpacingEm ? {...} : {}`) and no
`whiteSpace`. Both fixes have now been applied to the vendored copy as well;
`tests/lib/caption-presets.test.ts` passes.

**Do not assume any `src/lib/**` edit reaches the renderer.** Before claiming preview/burn
parity, grep the worker's imports and check for a vendored twin. A guard test that asserts
the two `captions.ts` files agree on `captionCssFor` output is **now in place** —
`tests/lib/caption-vendor-parity.test.ts`. See "Guard against the next drift" below.



## Defect 1 — `0` was silently dropped (why you couldn't dial spacing OFF)

`captionCssFor` gated `wordSpacing` behind a truthy check while emitting `letterSpacing`
unconditionally, so `0` never reached the DOM and presets shipping a nonzero default could
never be dialled back — Clean Rise (0.12), Soft Card (0.08), Type Swift (0.1).

```ts
wordSpacing: `${def.wordSpacingEm ?? 0}em`,   // was: ...(def.wordSpacingEm ? {...} : {})
```

## Defect 2 — the whitespace was being trimmed away (why the dial looked DEAD)

This is the real answer to "word spacing does nothing while letter spacing works."

Confirmed chain of facts:

1. `KaraokeLine` (`src/app/(fullscreen)/admin/reel-studio/page.tsx:770`) renders the separator
   space **inside** each word span: `{text}{emoji ? \` ${emoji}\` : ''}{' '}`. `CaptionLayer.tsx`
   does the same.
2. `wordCss` sets `display:inline-block` on the active span for the `scale`, `box`, `boxGrow`
   and `big` looks (`captions.ts:575`, `580`, `586`) — and that covers most of the roster.
3. A trailing space at the end of an inline-block's own line box gets **trimmed** by normal
   white-space processing. The space is gone before `word-spacing` can act on it.
4. `word-spacing` only acts on real whitespace. No whitespace → the property is inert, at any
   value. `letter-spacing` needs no whitespace, which is exactly why it kept working.

Fix — preserve that space, in the shared style object so both renderers inherit it:

```ts
word:   { ...wordCss(def, def.wordColor, false),  whiteSpace: 'pre-wrap', ... },
active: { ...wordCss(def, def.activeColor, true), whiteSpace: 'pre-wrap', ... },
```

`pre-wrap` rather than `pre` so lines can still wrap. No JSX or DOM-structure change in either
renderer, so there's no risk of the two drifting apart.

Verified: `pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/render-plan.test.ts`
→ **31 passed** (both before and after each change; no snapshot asserted the old behaviour).

**What is still unverified:** that the gaps visibly move in the browser. The reasoning is solid
and the mechanism is confirmed from source, but CSS whitespace behaviour deserves one look with
real eyes. Cheapest check: drag word spacing on a `scale`/`box` preset (Hormozi 1, Beast) —
that's where it was most broken.

## Three earlier conclusions that are wrong — do not redo these

1. **"CaptionLayer.tsx has zero occurrences of wordSpacing/letterSpacing, so the burn path
   ignores both dials."** The grep was accurate; the inference was not.
   `render-worker/remotion-project/CaptionLayer.tsx:14` imports `captionCssFor` from the shared
   `src/lib/mothermode/reel/captions`, and line 124 spreads `css.line` onto the row `<p>`. Both
   dials arrive inside that object — the literal property names never appear because they don't
   need to. Adding the dials directly to `CaptionLayer.tsx` would still have been wrong: it
   would have duplicated them and *created* a third source of truth.
   **But the original "the burn path already had parity" conclusion was ALSO wrong** — see the
   CORRECTION at the top. That import resolves to a *vendored* `captions.ts` under
   `render-worker/`, which had drifted and still carried both defects. Right call, wrong reason.


2. **"KaraokeLine is a flex row of word spans, so `word-spacing` is inert and the fix is
   `gap`."** Not a flex row, and — correcting a claim an earlier draft of *this* file also got
   wrong — the separator is **not** a `{' '}` text node between spans. It is a trailing space
   *inside* each span (line 770, quoted above). The conclusion "the fix is not `gap`" was right;
   the stated reason was not.

3. **"The override isn't persisting."** `store.ts` / `types.ts` pass `captionOverrides` through
   as a whole object with no field whitelist, so `wordSpacing` survives the save.

Also ruled out: the slider bounds. `CaptionGallery.tsx:351-357` is `min={0} max={60} step={2}`
÷ 100 → **0–0.6em**, a healthy range with a working `onChange`.

## Guard against the next drift

The two `captions.ts` files are consistent again, but consistency that nothing enforces is
just a coincidence with good timing. This failure mode is **silent and render-path-only** —
no preview, no typecheck and no other test notices it — so it needs a guard, not a habit.

- **`tests/lib/caption-vendor-parity.test.ts`** — asserts the canonical
  `src/lib/mothermode/reel/captions.ts` and the vendored
  `render-worker/src/lib/mothermode/reel/captions.ts` are byte-identical, and that both
  emit the same `captionCssFor` output. Byte-identity is deliberate: the drift that caused
  this bug was in an export nobody had thought to name, so a checklist of known-risky
  properties would have missed it.
- **`scripts/sync-vendored-captions.cjs`** — copies canonical → vendored, so the fix for a
  red guard is one command, not a manual re-merge of two thousand lines.
- **`scripts/verify-caption-guard.cjs`** — mutation-tests the guard itself.

That last one matters more than it looks. A guard test that has only ever been observed
green proves nothing; it could be reading the wrong file and pass forever. Running it
reintroduces each real defect and confirms the guard goes **red**:

```
PASS  guard is GREEN on the real, synced tree
PASS  guard goes RED when the truthy wordSpacing gate returns
PASS  guard goes RED when a whiteSpace declaration is dropped
PASS  guard goes RED on unnamed drift (byte-identity, not just the 2 known bugs)
```

It restores the file in a `finally`, so a crash mid-run cannot leave the tree dirty.

A wrinkle worth remembering: the first version of that harness reported the **baseline** as
red while vitest run by hand was green. The cause was the harness, not the guard — Node ≥ 20
refuses to `spawn` a `.cmd` (`npx.cmd`) without `shell: true`, so every run "failed" and all
three mutations looked detected when nothing had been checked at all. It now distinguishes
"the test ran and failed" (exit 1) from "the test never ran" (any other exit) and throws on
the latter. Note the direction of that error: a broken harness fails *toward* looking
successful. Do not trust a mutation test that has not shown you its baseline.

## Blockers on end-to-end verification


- **13 commits unpushed** to `origin/main` (HEAD `56ae41d`). "Merge to main" is not done.
- Railway still serves the **old synchronous worker**, so the burned MP4 can't be checked for
  parity until it's redeployed.
- `src/app/(fullscreen)/admin/reel-studio/page.tsx` carries an **unverified** `VerticalFrame`
  9/19 → 9/16 edit — typechecks, never confirmed in a browser.
