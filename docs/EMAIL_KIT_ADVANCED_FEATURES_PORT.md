# Email Kit — Advanced Editor Features — Port Guide

Status: **BUILT**. Companion to `EMAIL_MARKETING_KIT_SYSTEM_PORT.md` (the base
kit). This guide covers the five capabilities layered on top of the base Email
Marketing Kit after it shipped:

1. **Rich-text (TipTap) body editing** with prompt/export sanitization.
2. **Body formatting + length controls** (plain/rich, short/default/long, global + per-email).
3. **Branching** (`branch` + `parentId`) — basic conditional emails off the linear trunk.
4. **Sequence extension / deep-nurture** (`extend` action) + "add one email" with full look-back.
5. **Per-email Image Studio** (generate / edit / multi-seed) with hosted image URLs.
6. **Post-Script (P.S.) selling frameworks** — soft-sell P.S. bolt-ons per email.

All six ride on the existing `sequence` JSONB column and the existing
`/api/mothermode/email-ai` action switch — only **one** of them (nothing here)
requires a DB migration. Every field is added defensively to `normalizeEmail()`
so old rows keep loading.

> Port order: bring the base kit + context bridge first, then this guide. Within
> this guide the pieces are independent; do them in any order, but the editor
> wiring for each should be done with `EmailKitEditor.tsx` read in full.

---

## 0. File map (touched by these features)

```
src/lib/mothermode/richtext.ts                          (new) HTML → prompt text
src/lib/mothermode/context/prompt.ts                    clampPack() flattens kit HTML
src/components/mothermode/context/KitRichTextField.tsx  (new) HTML-emitting TipTap field
src/components/mothermode/email/EmailImageStudio.tsx    (new) per-email image popup
src/lib/mothermode/email/types.ts                       branch/parentId/psFramework/images fields
src/utils/integrations/openai-email.ts                  extend + P.S. + length/format threading
src/app/api/mothermode/email-ai/route.ts                'extend' action + bodyLength/bodyFormat parse
src/app/admin/email-marketing/EmailKitEditor.tsx        all UI wiring
tests/lib/richtext.test.ts                              (new) sanitizer tests
tests/lib/email-kit.test.ts                             normalizer + round-trip cases
```

No migration: `branch`, `parentId`, `psFramework`, and `images` all serialize
inside the existing `sequence` JSONB (`store.ts` stringifies the whole sequence).

---

## 1. Rich-text (TipTap) body editing

TipTap is already a dependency (`@tiptap/react`, `@tiptap/starter-kit`,
`@tiptap/pm`, `@tiptap/extension-placeholder`). Kit fields store **HTML**; the
prompt and flat-export boundaries flatten it to clean text.

### Foundation
- **`src/lib/mothermode/richtext.ts`** — server-safe, DOM-free HTML→text:
  `htmlToPromptText(html)` (blocks/`<br>`/`<li>` → newlines, `<li>` → `- `,
  `<a href>` → `text (href)`, strips tags, decodes entities, collapses
  whitespace; plain text passes through), `looksLikeHtml(s)`, and
  `kitTextForPrompt(s)` (flatten-if-HTML, null-safe).
- **`context/prompt.ts`** — `clampPack()` runs `htmlToPromptText(pack.prompt)`
  before `tidy()`, so any kit HTML injected as context is neutralized. Plain
  text is unchanged (verified by `context-packs.test.ts`).
- **`KitRichTextField.tsx`** — the HTML-emitting editor. Props:
  `{ value; placeholder?; minHeight?; disabled?; onChange:(html)=>void }`.
  Accepts stored HTML **or** legacy plain text (wraps bare text in `<p>`); empty
  editor emits `''` (not `<p></p>`); toolbar = bold, italic, bullet + numbered
  list, undo/redo.

### Controlled-sync fix (important)
The field uses a **controlled sync that compares the incoming `value` against the
editor's own `getHTML()`** (treating the empty doc `<p></p>` as `''`), rather than
a fragile `lastEmitted`/`isSyncing` guard. This makes AI rewrites / kit loads
reliably repaint while typing never resets the cursor; `onChange` is kept in a
ref so the editor instance stays stable. Port this exact behavior — the older
guard drops AI-written bodies intermittently.

### Editor wiring
Swap each email body `<textarea>` for `KitRichTextField`:
```tsx
<KitRichTextField
  value={email.bodyText}
  minHeight="180px"
  disabled={busy !== null}
  placeholder="Email body"
  onChange={(html) => patchEmail(email.id, { bodyText: html })}
/>
```
Leave single-line inputs (subject, preview, CTA label/url) as plain `<input>`.

### Export sanitization
Wherever a kit field is written to a flat export, wrap it in `htmlToPromptText()`
(`email/export.ts`, and the sibling `community/`, `highticket/`, `leadgen/`
exports). Generators need no change — they only see kit HTML via context packs,
which `clampPack()` already flattens.

---

## 2. Body formatting + length controls

Two global selectors in the generate toolbar plus a per-email length override.
All ride along in **every** `callAi` payload so both full generation and
per-email rewrites honor them.

- **`bodyFormat: 'text' | 'html'`** — whether AI writes plain text or
  lightly-formatted HTML (bold, bullets). Both are flattened wherever they feed a
  prompt, so either stays compliant.
- **`bodyLength: 'default' | 'short' | 'long'`** — the target body length.
- **Per-email length** — `emailLength: Record<emailId, 'default'|'short'|'long'>`
  in the editor. The per-email `expand` call sends
  `bodyLength: emailLength[email.id] ?? bodyLength` so a single email can be
  tightened/expanded without changing the global setting.

Server side (`openai-email.ts` + route): `bodyFormat` and `bodyLength` are parsed
from the request body and threaded into `expand` / `generate` / `extend`. The
route already parses both; the editor just needs to include them in the POST.

---

## 3. Branching (basic conditional emails)

Lets an email fire only under a recipient condition, branching off the linear
trunk.

### Data model (`email/types.ts`)
- `EMAIL_BRANCH_CONDITIONS` union + `EmailBranchCondition` type.
- `EmailMessage` gains `branch: EmailBranchCondition` and
  `parentId: string | null`.
- `blankEmail()` defaults `branch: 'always'`, `parentId: null` (the linear
  trunk). `normalizeEmail()` coerces both defensively via `toEmailBranchCondition()`;
  a malformed/absent value degrades to `always`/`null`, so every existing linear
  sequence stays valid.

### Editor wiring
Per email card: a `branch` `<select>` over `EMAIL_BRANCH_CONDITIONS`
(`always` labeled "always (trunk)", others "if <cond>"). When `branch !== 'always'`
show a `parentId` `<select>` over **earlier** emails (default "vs. previous
email"). Reverting to `always` clears `parentId` (returns the email to the trunk).
Both fields are part of the saved `sequence` — the store persists the whole JSONB,
so just don't strip them when building email objects client-side.

---

## 4. Sequence extension / deep-nurture + "add one email"

### Generator (`openai-email.ts`)
`aiExtendSequence(intake, campaignType, kitFramework, existing, count, packs,
bodyFormat, bodyLength, mode)`:
- `EmailExtendMode = 'continue' | 'deep-nurture' | 'reengage'` (default
  `deep-nurture`).
- Plans N new emails with **full look-back** (the existing roster is in the
  outline prompt), then expands each with `existing + new` as context so nothing
  repeats. Returns **only** the new emails. `count` is clamped 1–12.

### Route (`email-ai/route.ts`)
`action: 'extend'` → `{ success, emails }`; reads `emails`, `count`, `mode`
(plus the shared `intake`/`campaignType`/`framework`/`contextRefs`/`bodyFormat`/
`bodyLength`).

### Editor wiring
- **Extend controls**: a count input (1–12) + a mode `<select>` (`deep-nurture`
  default, `continue`, `reengage`) + an "Extend sequence" button that POSTs
  `action: 'extend'` and appends the returned `emails` to `sequence.emails`.
- **Add one email**: appends a `blankEmail()` (role `nurture`, `branch: 'always'`,
  `parentId: null`); the admin then clicks "Write body" (an `expand` call passing
  the full current sequence) so the new email sees prior emails.

---

## 5. Per-email Image Studio

From an image placeholder on each email, open a focused popup to generate or edit
a hero image using multiple seed/reference images. **No new API route or DB
migration** — the shared AI endpoint already supports it and images ride in the
`sequence` JSON.

### Data field (`email/types.ts`)
- `EmailMessage` gains `images: string[]` (first = primary/hero).
- `blankEmail()` adds `images: []`.
- `normalizeEmail()` keeps only non-empty strings:
  ```ts
  images: Array.isArray(raw.images)
    ? raw.images.filter((s): s is string => typeof s === 'string' && !!s.trim())
    : [],
  ```

### Reused building blocks (do not re-implement)
- `POST /api/mothermode/ai` actions: `image`, `imageEdit` (seed + ≤4 refs),
  `imagePrompts`, `hostImage`.
- `aiClient.ts` wrappers: `aiGenerateImage(prompt, format?, model?)`,
  `aiEditImage({prompt, seed, references?, format?, model?})`,
  `aiImagePrompts({count, hook, guides?, avoid?, context?})`, `aiHostImage(dataUrl)`.
  `aiGenerateImage`/`aiEditImage` already return **hosted** public URLs; only
  local uploads/data URLs need `aiHostImage`.
- Model constants from `@/lib/mothermode/content`: `IMAGE_MODELS`,
  `EDIT_IMAGE_MODELS`, `AUTO_MODEL`, `MAX_EDIT_REFERENCES` (=4).
- `downloadUrl` from `@/utils/mothermode/download`.

### Component (`EmailImageStudio.tsx`)
Self-contained client component (modeled on `ImageStudioModal.tsx` but **not**
coupled to `ContentPiece`). Props:
```ts
{ open; onClose; images; onChange:(next)=>void; hook?; context?:{theme?;tone?} }
```
- **Generate tab**: prompt textarea + "Write with AI" (calls `aiImagePrompts`
  with `hook`/`context`), model select (Auto + `IMAGE_MODELS`), Generate →
  `aiGenerateImage(prompt, 'feed', model||undefined)` then `onChange([...images, url])`.
- **Edit tab**: seed picker (choose from gallery or upload → `aiHostImage`),
  references multi-upload (enforce `room = MAX_EDIT_REFERENCES - references.length`),
  edit instructions, model select (Auto + `EDIT_IMAGE_MODELS`), Edit →
  `aiEditImage({...})` then append URL.
- **Gallery**: set-as-hero (move to index 0), download, remove; hero badge on
  index 0.

### Editor wiring
Per email: an image placeholder button (hero thumbnail + "N" badge when present,
or "+ Image" tile). Track `imageFor: string | null` (the open email id). Render a
single studio instance bound to the active email:
```tsx
<EmailImageStudio
  open={imageFor !== null}
  onClose={() => setImageFor(null)}
  images={active.images}
  onChange={(next) => patchEmail(active.id, { images: next })}
  hook={active.subject || active.summary}
  context={{ theme: intake.audience, tone: intake.tone }}
/>
```
The save payload already sends the whole `sequence`, so `images` persists with no
extra plumbing.

---

## 6. Post-Script (P.S.) selling frameworks

A P.S. is the most-read line after the subject. These frameworks bolt a proven,
soft-sell P.S. onto an email's body **without** changing its main framework.

### Data model (`email/types.ts`)
- `EMAIL_PS_FRAMEWORKS` (const tuple) + `EmailPsFramework` type:
  `none`, `free-or-paid-resource`, `offer-limited-spots`, `offer-promotion`,
  `sending-traffic`, `handling-objections`, `booking-call`, `low-ticket-offer`.
- `EMAIL_PS_FRAMEWORK_LABELS: Record<EmailPsFramework, string>` — picker labels.
- `EmailMessage.psFramework: EmailPsFramework` (default `none`).
- `blankEmail()` sets `psFramework: 'none'`; `normalizeEmail()` uses
  `toEmailPsFramework()` (safe fallback to `none`).

### Generator (`openai-email.ts`)
Each P.S. framework (except `none`) maps to a guidance block telling the model how
to write the P.S.; it is appended when the email body is (re)written. `none`
leaves the body untouched.

### Editor wiring
Per email: a `psFramework` `<select>` over `EMAIL_PS_FRAMEWORKS` labeled with
`EMAIL_PS_FRAMEWORK_LABELS`. It is included in the save payload and honored on the
next `expand`/`generate` for that email.

---

## 7. Verify

```bash
npx tsc --noEmit
npx vitest run tests/lib/richtext.test.ts tests/lib/context-packs.test.ts \
  tests/lib/email-kit.test.ts
```

Add/keep these assertions:
- `richtext.test.ts` — sanitizer cases (11) incl. `<a>` → `text (href)` and
  `<script>` neutralization.
- `email-kit.test.ts` — `normalizeEmail({})` yields `branch: 'always'`,
  `parentId: null`, `psFramework: 'none'`, `images: []`; a round-trip through
  `rowToEmailKit` preserves a non-default `branch`; malformed `images` are
  dropped.
- An export test asserting HTML is flattened (`expect(exported).not.toContain('<p>')`).

### Windows note
`npx tsc --noEmit > tsc.txt 2>&1; type tsc.txt` — an empty file means no errors.
