# Remaining mojibake glyphs — reel-studio page.tsx

## What happened

An earlier patch script rewrote two reel-studio files through a non-UTF-8
encoding. Every byte of each multi-byte UTF-8 character became a literal `?`.
Run length tells you the size of the original character:

| Run      | Original            | Status                          |
| -------- | ------------------- | ------------------------------- |
| `??`     | 2-byte (`·`)        | fixed (whitelist, 9)            |
| `???`    | 3-byte (`—` `→` `…`)| fixed by rule (243)             |
| `????`   | 4-byte emoji        | **left alone** (~25)            |
| `??????` | emoji + selector    | **left alone**                  |

`scripts/repair-mojibake.cjs` does the safe subset and is idempotent. Re-run
`node scripts/repair-mojibake.cjs` any time to see what is still outstanding.

## Why the rest was not auto-fixed

The remaining ~99 three-char runs are **icon glyphs**, not prose punctuation.
A run like `['???', 'Share']` could have been `↪`, `➦`, or an emoji — the
source no longer says which. Guessing would silently put the wrong icon in the
UI, which is worse than leaving a visible `???` that flags itself for review.

The two-char `??` that remain (165) are almost certainly real
nullish-coalescing operators. The repair script only touches `??` from an
explicit literal whitelist for exactly this reason — do not loosen that rule.

## What is left, grouped

1. **Social proof rails** — `[['???', '24K'], ['????', ...]]` in the TikTok /
   IG / X preview cards. These are like/comment/share/bookmark icons.
2. **Standalone button glyphs** — `<button>???</button>`, usually a close,
   play, or chevron affordance. Check the button's `onClick` to infer intent.
3. **Star ratings** — `{'???'.repeat(stars)}` is `★`.
4. **Select placeholders** — `<option value="">??? pick a funnel ???</option>`
   is the em dash pattern `— pick a funnel —`; the rule skipped it because
   there is no space before the first run.

Items 3 and 4 are unambiguous and safe to fix in a follow-up pass. Items 1 and
2 need someone to look at the rendered UI and decide.

## Guardrail

`scripts/check-mojibake.cjs` fails if any new `?{2,}` run appears outside the
known-good set, so this cannot silently spread to other files again. The root
cause was the patch script's encoding, not the source — any future codemod
should write with an explicit `'utf8'` encoding argument.
