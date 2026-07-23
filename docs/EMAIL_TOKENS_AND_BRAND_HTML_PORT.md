# Email Merge Tokens + Brand HTML Export — System Port

Status: **shipped & verified** (`npx tsc --noEmit` clean; `email-kit.test.ts`
13/13 and `context-packs.test.ts` 15/15 green).

## What this adds

Marketing email sequences now speak the same `{{token}}` language as the
transactional receipt pipeline, and every exported email is wrapped in the
Editorial Warm brand shell instead of raw `<p>` soup.

### 1. Token catalog — `src/lib/mothermode/email/tokens.ts`

Pure, dependency-free module shared by the editor, export renderers, and tests.

- `EmailMergeToken { token, key, label, description }`
- `EMAIL_MERGE_TOKENS: EmailMergeToken[]` — the advertised set. Marketing-first
  tokens (`first_name`, `name`, `email`, `sender_name`, `brand`, `offer_name`,
  `cta_url`, `unsubscribe`, `signoff`) precede the receipt superset
  (`amount`, `currency`, `product`, `ref`).
- `EMAIL_MERGE_TOKEN_KEYS` — bare-key list for fast validation.
- `applyEmailTokens(text, values, opts)` — substitutes markers. Default
  `preserveUnknown: true` (marketing export → the ESP fills the blanks);
  pass `preserveUnknown: false` for a fully-resolved transactional render.
  `escapeHtml: true` when rendering into HTML.
- `extractUsedTokens(text)` — distinct tokens referenced by a piece of copy.

Token syntax matches `src/utils/email/render.ts` so a sequence and a receipt
share one grammar.

### 2. Barrel export — `src/lib/mothermode/email/index.ts`

Re-exports the token catalog so consumers import from `@/lib/mothermode/email`.

### 3. Brand HTML wrapper — `src/lib/mothermode/email/export.ts`

`sequenceToHtml` renders each email through the shared brand renderer
(`renderEmail` from `src/utils/email/layout.ts`) rather than emitting bare
paragraphs:

- Each email's rich body is flattened with `htmlToPromptText`, split into
  paragraph/bullet `EmailSection`s, and passed as an `EmailDoc`
  (`preheader` ← preview, `title` ← subject, `cta` ← CTA).
- Tokens are left intact (`{{...}}`) through the render so the ESP fills them.
- Output carries the MotherMode header/footer, brass accents, and inline CSS
  that are email-client-safe (table + inline styles).

### 4. Editor "Available tokens" panel — `EmailKitEditor.tsx`

A single reference section (between "Attached context" and "Generate actions")
lists every `EMAIL_MERGE_TOKENS` entry as a click-to-copy chip
(`copyToClipboard(t.token, t.token)`), with the description on hover. Applies to
the whole sequence, so it renders once rather than per-email.

## Verify

```
npx tsc --noEmit
npx vitest run tests/lib/email-kit.test.ts tests/lib/context-packs.test.ts
```
