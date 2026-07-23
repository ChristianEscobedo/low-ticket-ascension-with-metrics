# Claude Skills as Content Context — Task Spec

Load **Skills** (Claude-style skill folders: a `SKILL.md` plus optional
resources) into the app so they act as **authoritative writing context** for the
content suite — copywriting, video scripts, emails, community/high-ticket/lead-gen
kits, etc. A "Skill" is conceptually identical to a context source we already
resolve, so this is **additive plumbing on top of the existing two-way context
engine**, not a new subsystem.

> Status: **spec only — build later.** Nothing here is implemented yet.

## Why this is a small change

The suite already has a normalized **context bridge**
(`src/lib/mothermode/context/*`): a cheap `ContextRef` pointer is stored on an
intake/batch and resolved **at generation time** into a prompt-ready
`ContextPack`, then clamped and injected via `contextPacksToPromptBlock`. Adding
Skills = adding **one new `ContextSourceKind` (`'skill'`)** plus a tiny store +
adapter. Every generator that already accepts context packs gets skills for free.

Recap of the existing flow (unchanged):

```
ContextRef[]  ──resolveContextRefs()──▶  ContextPack[]  ──clampPacks()──▶  prompt block
   (stored)          (server, live)          (title/summary/prompt)         (system prompt)
```

- `types.ts` — `ContextSourceKind`, `ContextRef`, `ContextPack`,
  `normalizeContextRefs`.
- `sources.ts` — builds the picker options from the offer catalog + kit stores.
- `resolve.ts` — `resolveOne(ref)` switch → per-kind adapter → `clampPacks`.
- `prompt.ts` — `PACK_CHAR_CAP=1500`, `TOTAL_CHAR_CAP=6000`, `clampPacks`,
  `contextPacksToPromptBlock(packs, 'content' | 'kit')`.

## What a "Skill" is here

A Skill is a small, named, reusable **instruction set** the model should follow
when writing (e.g. "Direct-Response Hook Writing", "MRR Reseller Voice",
"LinkedIn Thought-Leadership"). Minimum shape:

- **name** + **slug** + optional **description** (one line shown in the picker).
- **body** — the `SKILL.md` content (markdown/plain text): principles, do/don't,
  formulas, examples. This is what gets injected.
- optional **resources** — extra reference snippets (swipe examples, checklists)
  concatenated after the body, subject to the same clamp caps.
- optional **status** (`draft` | `published`) so only published skills show to
  content generators.

This mirrors Anthropic's Agent Skills format (a `SKILL.md` + bundled files) so a
skill authored for Claude can be pasted in directly. We treat it as **context**,
not as native tool-loading (see "Decision" below).

## Changes (additive, back-compat)

### 1. `src/lib/mothermode/context/types.ts` — new kind
- Add `'skill'` to `ContextSourceKind` and `CONTEXT_SOURCE_KINDS`.
- It is **store-backed** (not inline), so `normalizeContextRefs` already handles
  it via the existing "needs a real id" branch — no change to the normalizer.

### 2. `src/lib/mothermode/skills/` — new store + types (mirrors the kit stores)
- `types.ts` — `Skill { id; slug; name; description?; body; resources?: string[]; status; updatedAt }`
  plus a `normalizeSkill` coercion for the JSONB boundary.
- `store.ts` (server-only, service-role) — `listSkillsForAdmin()`,
  `listPublishedSkills()`, `getSkillById(id)`, `upsertSkill()`, `deleteSkill()`,
  mirroring `community/store.ts` etc.
- Migration `supabase/migrations/<ts>_mothermode_skills.sql` — a `mothermode_skills`
  table (id, slug, name, description, body, resources jsonb, status, timestamps)
  with the same RLS pattern as the other kit tables.

### 3. `src/lib/mothermode/context/fromSkill.ts` — pure adapter (new)
- `fromSkill(skill): ContextPack` → `{ kind: 'skill', id, title: name, summary: description || first line, prompt: [body, ...resources].join('\n\n') }`.
- Pure (no network); unit-testable like `fromKits`/`fromOffer`.

### 4. `src/lib/mothermode/context/sources.ts` — list skills in the picker
- Add an isolated `try { listPublishedSkills() }` block pushing
  `{ kind: 'skill', id, label: name, hint: status }`, same defensive pattern as
  the other stores (one failure can't blank the picker).

### 5. `src/lib/mothermode/context/resolve.ts` — resolve the new kind
- Add `case 'skill': { const rec = await getSkillById(ref.id); return rec ? fromSkill(rec) : null; }`
  to the `resolveOne` switch. Everything downstream (`clampPacks`, prompt block)
  is unchanged.

### 6. Prompt framing (optional nicety) — `prompt.ts`
- `contextPacksToPromptBlock` currently frames packs as `'kit'` or `'content'`.
  Skills are **method/voice guidance**, not a promoted asset, so optionally split
  skill packs out with a dedicated intro line
  ("WRITING SKILLS (authoritative method + voice — follow these while writing):")
  while non-skill packs keep today's framing. Back-compat: if we skip this,
  skills still inject fine under the existing `'content'` framing.

### 7. Admin UI — `src/app/admin/skills/` (mirrors `admin/community`, etc.)
- `page.tsx` + `SkillsEditor.tsx` — list/create/edit skills (name, description,
  body via the existing `KitRichTextField`/textarea, resources, status).
- `src/app/api/admin/mothermode-skills/route.ts` — admin-guarded CRUD calling the
  store.
- Add a "Skills" link to `src/app/admin/AdminSidebar.tsx`.

### 8. Content picker — already works
- `ContextRefEditor` (`src/components/mothermode/context/ContextRefEditor.tsx`)
  renders whatever `buildContextSourceOptions()` returns, so once step 4 lists
  skills, they appear in the existing context picker on the content/kit editors
  with **no component change**. Selected skills persist as `ContextRef[]` exactly
  like kit/offer refs.

## Tests

Extend `tests/lib/context-packs.test.ts` (or a new `skills.test.ts`):
- `fromSkill` maps name→title, description→summary, and joins body + resources.
- `normalizeContextRefs` keeps a `{ kind: 'skill', id }` ref and drops one with
  an empty id (store-backed branch).
- `clampPacks` still enforces `PACK_CHAR_CAP` / `TOTAL_CHAR_CAP` with a skill in
  the mix (large `SKILL.md` bodies get truncated on a word boundary).

## Decision: context-injection vs native Anthropic Skills

- **This spec = context-injection (recommended).** Model-agnostic, reuses the
  existing OpenAI generators (`openai-content.ts`, `openai-email.ts`, …), no new
  vendor, and skills show up everywhere context does. A skill authored in
  Anthropic's `SKILL.md` format pastes straight into the `body` field.
- **Native Anthropic Agent Skills** (auto-loaded skill folders) require the
  Claude API / Agent SDK. That would be a **separate, additive route swap**: add
  an Anthropic client and point the skill-aware generation calls at Claude. Not
  in scope here; can layer on later without undoing this work.

## Files (to be) touched

- `src/lib/mothermode/context/types.ts` — add `'skill'` kind.
- `src/lib/mothermode/skills/types.ts` — `Skill` + `normalizeSkill` (new).
- `src/lib/mothermode/skills/store.ts` — service-role CRUD (new).
- `supabase/migrations/<ts>_mothermode_skills.sql` — `mothermode_skills` table (new).
- `src/lib/mothermode/context/fromSkill.ts` — pure adapter (new).
- `src/lib/mothermode/context/sources.ts` — list published skills.
- `src/lib/mothermode/context/resolve.ts` — resolve `'skill'`.
- `src/lib/mothermode/context/prompt.ts` — optional skill-specific framing.
- `src/app/admin/skills/page.tsx` + `SkillsEditor.tsx` — admin CRUD (new).
- `src/app/api/admin/mothermode-skills/route.ts` — admin API (new).
- `src/app/admin/AdminSidebar.tsx` — "Skills" nav link.
- `tests/lib/context-packs.test.ts` — skill coverage.
