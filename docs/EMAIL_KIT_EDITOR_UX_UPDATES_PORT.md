# Email Kit Editor UX Updates — System Port

Small, high-signal usability upgrades to the admin Email Marketing Kit editor:
a **context/resource badge** on each saved sequence in the left rail, an
**auto-applied slug** derived from the name, and a confirmation of how
**per-email images persist**. All changes are contained to the client editor;
no schema, store, route, or type changes were required.

- Scope: `src/app/admin/email-marketing/EmailKitEditor.tsx`
- Depends on: the Email Marketing Kit (`EMAIL_MARKETING_KIT_SYSTEM_PORT.md`),
  the two-way context bridge (`TWO_WAY_CONTEXT_SYSTEM_PORT.md`), and the
  per-email Image Studio (`EMAIL_IMAGE_STUDIO_HANDOFF.md`).
- Verified: `npx tsc --noEmit` clean; `tests/lib/email-kit.test.ts` (13) and
  `tests/lib/context-packs.test.ts` (15) all pass.

---

## 1. Context / resource badge on the sequence card

**Goal.** At a glance, an admin should see which offers/kits a saved sequence
is built to promote without opening it.

**What.** Each kit in the left-rail list already renders campaign label · status
· email count. Below that row we now render up to three brass pill badges — one
per attached `ContextRef` — using the ref's own `label` when present, otherwise
the human `KIND_LABEL` for its `kind` (`Offer`, `Lead-gen kit`,
`High-ticket kit`, `Email kit`, etc.). More than three refs collapse into a
`+N` overflow indicator so the card height stays stable.

**Why it's safe.** `EmailKitRecord.contextRefs` is already normalized on read
(`rowToEmailKit` → `normalizeContextRefs`), so the list always has a
well-formed array. The badge is pure presentation — no new state, no fetch.

```tsx
{kit.contextRefs.length > 0 && (
  <div className="mt-1.5 flex flex-wrap gap-1">
    {kit.contextRefs.slice(0, 3).map((ref, i) => (
      <span
        key={i}
        className="inline-flex items-center rounded-full border border-brass/30 bg-brass/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brass/90"
        title={ref.label || KIND_LABEL[ref.kind]}
      >
        {ref.label || KIND_LABEL[ref.kind]}
      </span>
    ))}
    {kit.contextRefs.length > 3 && (
      <span className="text-[9px] text-bone/40 self-center">
        +{kit.contextRefs.length - 3}
      </span>
    )}
  </div>
)}
```

The `KIND_LABEL` map already covers every `ContextSourceKind` (including the
newer `email-kit`), so no label can render as `undefined`.

---

## 2. Auto-apply the slug from the name

**Goal.** A valid slug should always be present at save time without the admin
having to fill the Slug field manually — while still allowing a hand-picked
slug when they want one.

**What.** A new `slugTouched` boolean gates the behavior:

- While `slugTouched === false`, every keystroke in **Name** re-derives the slug
  via `slugify(name)`.
- The moment the admin types in the **Slug** field, `slugTouched` flips to
  `true` and the slug stops following the name (existing `onBlur` slugify is
  kept so a hand-typed slug is still normalized).
- `loadKit()` sets `slugTouched = true` (a saved kit already owns its slug, so
  we must not clobber it from the name).
- `startNew()` leaves `slugTouched` at its reset `false` so a fresh sequence
  auto-fills again.

```tsx
const [slug, setSlug] = useState('');
// While false, the slug auto-follows the name (slugified).
const [slugTouched, setSlugTouched] = useState(false);
const [name, setName] = useState('');

// Name input:
onChange={(e) => {
  const next = e.target.value;
  setName(next);
  if (!slugTouched) setSlug(slugify(next));
}}

// Slug input:
onChange={(e) => {
  setSlugTouched(true);
  setSlug(e.target.value);
}}
onBlur={() => slug && setSlug(slugify(slug))}
```

`loadKit` adds `setSlugTouched(true)` right after `setSlug(kit.slug)`. The Slug
placeholder now reads `"auto-filled from name"` to signal the behavior. The
existing `handleGenerate` fallback (fill slug from the generated sequence name
only when empty) is unchanged and still complements this.

**Edge cases.** Saving still requires a non-empty slug (`handleSave` guards it);
auto-fill guarantees one exists once the admin types a name. Loading an existing
kit never rewrites its slug because `slugTouched` is true.

---

## 3. Per-email images — persistence confirmed (no change needed)

Images attached through the per-email **Image Studio** were already durable and
required no edit. The chain, for reference:

- `EmailMessage.images: string[]` is part of the sequence JSON.
- `normalizeEmail` defensively coerces `images` (drops non-strings/blanks).
- The Studio writes back via `patchEmail(id, { images: next })`, so the array
  lives in editor `sequence` state.
- `handleSave` posts the whole `sequence`; the route
  (`/api/admin/mothermode-email`) runs `normalizeSequence` + `renderSequenceHtml`
  and `upsertKit` writes the `sequence` JSONB column. Images ride along
  untouched.

No migration, type, store, or route change is involved.

---

## Not included (follow-up, needs a fresh session)

**Images *inside* the rich-text body.** The email body uses `KitRichTextField`
(TipTap). Inserting an image *inline in the body* requires the
`@tiptap/extension-image` node, which is **not currently installed** (the app
has `@tiptap/starter-kit`, `-placeholder`, `-pm`, `-react` only). That work is a
dependency + node-wiring change (install the extension, register an opt-in Image
node on `KitRichTextField`, add an "insert into body" action from
`EmailImageStudio`, and confirm `renderSequenceHtml` preserves `<img>`), best
executed in a dedicated session. Tracked alongside
`EMAIL_IMAGE_IN_BODY_AND_FUNNEL_ASSETS_PORT.md`.

---

## Verify

```bash
npx tsc --noEmit
npx vitest run tests/lib/email-kit.test.ts tests/lib/context-packs.test.ts
```

Manual QA:

1. Open `/admin/email-marketing`, select a sequence that has attached context —
   its card shows brass badges (labels or kind names, `+N` past three).
2. Start a new sequence, type a Name — the Slug fills automatically and stays in
   sync until you type in Slug, after which it holds.
3. Load an existing kit — its saved slug is preserved (name edits don't rewrite
   it unless you clear/retype intentionally).
4. Attach/generate a per-email image, Save, reload — the image persists.
