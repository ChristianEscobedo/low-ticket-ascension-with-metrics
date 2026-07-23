# Email Sequence Controls — Handoff (editor UI wiring)

Status of this session's work. The **backend + data model + rich-text fix are DONE and
self-consistent**; only the `EmailKitEditor.tsx` client wiring remains. Handing off the
editor because the context window filled and a ~600-line client edit should be done with the
file read in full first.

## DONE (verified, committed in this session)

1. **Branching data model** — `src/lib/mothermode/email/types.ts`
   - `EMAIL_BRANCH_CONDITIONS` union + `EmailBranchCondition` type.
   - `EmailMessage` now has `branch: EmailBranchCondition` and `parentId: string | null`.
   - `blankEmail()` defaults `branch: 'always'`, `parentId: null`.
   - `normalizeEmail()` coerces both defensively; `toEmailBranchCondition()` exported.
   - Every existing linear sequence stays valid (default trunk = `always` / `null`).

2. **Tiptap rendering fix** — `src/components/mothermode/context/KitRichTextField.tsx`
   - Replaced the fragile `lastEmitted`/`isSyncing` guard with a **controlled sync that
     compares incoming `value` against the editor's own `getHTML()`** (empty doc `<p></p>`
     treated as `''`). AI rewrites / kit loads now reliably paint; typing never resets the
     cursor. `onChange` kept in a ref so the editor instance is stable.

3. **Extend generator** — `src/utils/integrations/openai-email.ts`
   - `aiExtendSequence(intake, campaignType, kitFramework, existing, count, packs, bodyFormat, bodyLength, mode)`.
   - `EmailExtendMode = 'continue' | 'deep-nurture' | 'reengage'` (default `deep-nurture`).
   - Plans N new emails with **full look-back** (existing roster in the outline prompt), then
     expands each with `existing + new` as context so nothing repeats. Returns ONLY the new
     emails. `count` clamped 1–12.

4. **Route: extend action + per-email length passthrough** — `src/app/api/mothermode/email-ai/route.ts`
   - New `action: 'extend'` → `{ success, emails }`. Reads `emails`, `count`, `mode`.
   - `bodyLength` (`'short'|'long'|'default'`) already parsed from the body and passed to
     `expand` / `generate` / `extend`. **The per-email Length control just needs the editor to
     send `bodyLength` on the `expand` call.**

## TODO (editor only) — `src/app/admin/email-marketing/EmailKitEditor.tsx`

Read the whole file first. Wire these four UI pieces (the AI client helper in this file posts
to `/api/mothermode/email-ai`; reuse its existing fetch wrapper):

1. **Per-email Length control**
   - Add a small select per email: Short / Default / Long → local state keyed by email id, or
     a transient arg passed into the regenerate handler.
   - On the per-email "regenerate/expand" action, include `bodyLength` in the POST body
     (`action: 'expand'`). Route + generator already honor it.

2. **Add one email (look-back)**
   - Button appends a `blankEmail()` (role `nurture`, `branch: 'always'`, `parentId: null`) to
     `sequence.emails`, then immediately calls `action: 'expand'` for that new email with
     `emails: <full current sequence>` so it sees prior emails. Merge the returned email by id.

3. **Extend sequence / Deep Nurture (look-back)**
   - Controls: a count input (1–12) + a mode select (`deep-nurture` default, `continue`,
     `reengage`) + a "Extend sequence" button.
   - POST `action: 'extend'` with `{ intake, campaignType, framework, emails: <current>, count,
     mode, contextRefs, bodyFormat, bodyLength }`. Append the returned `emails` to
     `sequence.emails`.

4. **Branch UI (basic)**
   - Per email, expose `branch` (select over `EMAIL_BRANCH_CONDITIONS`) and optional
     `parentId` (select over earlier email ids, or "previous"). Include both in the save
     payload (they already round-trip through the store + normalizer).

### Save payload note
`EmailMessage` now carries `branch` + `parentId`; the editor's save handler must include them
when it builds the `sequence` it PUTs to `/api/admin/mothermode-email` (the store column
already persists the whole `sequence` JSONB, so no store change is needed — just don't strip
the new fields when constructing email objects in the client).

## Verify (after editor wiring)
```
npx tsc --noEmit
npx vitest run tests/lib/email-kit.test.ts
```
Consider adding an `email-kit.test.ts` case asserting `normalizeEmail({})` yields
`branch: 'always'` and `parentId: null`, and a round-trip through `rowToEmailKit` preserves a
non-default `branch`.
