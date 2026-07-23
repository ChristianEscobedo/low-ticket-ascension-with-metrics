# Offer ⇄ Kit Context Bridge — Task Spec

Make the front-end **offers** (and their **bonuses**) and the three admin AI
**kits** (Community, High Ticket, Lead Gen) usable as **context variables** in
each other's generators, in both directions:

1. **Offers → Kits.** When building a Community / High Ticket / Lead Gen kit, the
   admin can attach one or more front-end **offers** (whole offer, and/or just its
   **bonuses**) as authoritative context so the kit is generated *around* that
   offer (its promise, audience, mechanism, bonuses, price).
2. **Kits → Content.** When generating platform content in the Generate drawer,
   the admin can attach one or more **kits** (a community launch kit, a
   high-ticket offer, a lead magnet) as context so the content is written *around*
   that resource for each platform.

This is a symmetric feature built on **one shared abstraction** (`ContextPack`)
so we do not special-case every pairing. It reuses the existing
"inject-authoritative-text-into-the-system-prompt" pattern already used by
`frameworks` (Community/High Ticket) and `guides` / `BatchOfferContext`
(content generation).

---

## 1. Why this design

Every generator in the suite already accepts a block of authoritative, factual
context that it must not contradict:

- `openai-content.ts` → `BatchInput.offer: BatchOfferContext` (offer facts) and
  `BatchInput.guides?: string` (free-form guidance), both concatenated into
  `buildBatchSystem`.
- `openai-community.ts` / `openai-highticket.ts` → `*_FRAMEWORKS` strings injected
  per section.
- `openai-leadgen.ts` → `intakeContext()` injects the format `skeleton` +
  `styleNote` + the intake brief.

So the cleanest change is **not** new bespoke plumbing per pairing, but a single
normalized, prompt-ready **`ContextPack`** that any entity can emit, plus a small
resolver that turns a saved *reference* (a pointer) into a pack at generation
time. Then each generator just appends "0..N extra context packs" to the prompt.

---

## 2. The shared abstraction

### 2a. Types (`src/lib/mothermode/context/types.ts` — NEW)

```ts
export type ContextSourceKind =
  | 'offer'            // whole front-end offer
  | 'offer-bonuses'    // just the bonus stack of a front-end offer
  | 'community-kit'
  | 'high-ticket-kit'
  | 'lead-gen-kit';

/** A saved pointer to a context source. Cheap to store on an intake or a
 *  content batch; resolved to a ContextPack only at generation time. */
export interface ContextRef {
  kind: ContextSourceKind;
  /** offer slug, or kit id/slug depending on kind. */
  id: string;
  /** Optional label cached for display so the UI need not re-fetch. */
  label?: string;
}

/** A resolved, prompt-ready block. `title` + `summary` are for the UI; `prompt`
 *  is what actually goes into the system prompt (already compact + voice-safe). */
export interface ContextPack {
  kind: ContextSourceKind;
  id: string;
  title: string;
  /** One-line human summary for chips/cards. */
  summary: string;
  /** The authoritative text injected into the generator. Plain text, no HTML. */
  prompt: string;
}
```

### 2b. Adapters (pure, unit-testable)

One adapter per source, each producing a `ContextPack`. They live next to the
data they read and are **pure** (no network, no DB) so they can be tested and
reused on server and client:

- `src/lib/mothermode/context/fromOffer.ts`
  - `offerToContextPack(offer: MotherModeOffer): ContextPack`
  - `offerBonusesToContextPack(offer: MotherModeOffer): ContextPack | null`
  - Reuses the same field selection already proven in
    `openai-content.ts` `buildBatchSystem` (name, category, tagline, audience,
    promise, scene, problem, mechanism, inside outcomes, method steps,
    old/new way, price). The bonuses variant flattens `offer.bonuses.items[]`
    (`title`, `description`, `value`, `tag`) + `totalValue`.
- `src/lib/mothermode/context/fromKits.ts`
  - `communityKitToContextPack(rec: CommunityKitRecord): ContextPack`
  - `highTicketKitToContextPack(rec: HighTicketKitRecord): ContextPack`
  - `leadGenKitToContextPack(rec: LeadGenKitRecord): ContextPack`
  - These wrap the **existing** `export.ts` text renderers each kit already ships
    (`kitToText` / `docToText`) and add a short typed header. No new rendering
    logic; we are reusing the renderer that already knows the kit shape.

### 2c. Resolver (server-only) — `src/lib/mothermode/context/resolve.ts` (NEW)

```ts
export async function resolveContextRefs(refs: ContextRef[]): Promise<ContextPack[]>
```

- `offer` / `offer-bonuses` → `getOffer(id)` from the static catalog (sync).
- `community-kit` → `getKitById(id)` from `community/store.ts`.
- `high-ticket-kit` → `getKitById(id)` from `highticket/store.ts`.
- `lead-gen-kit` → `getKitById(id)` from `leadgen/store.ts`.
- Unknown/deleted refs are dropped (never throw); returns only resolvable packs.
- Caps total injected size (e.g. clamp each pack to ~1,500 chars and the whole
  set to ~6,000 chars) so prompts stay bounded regardless of how many refs.

### 2d. Prompt joining helper

`contextPacksToPromptBlock(packs: ContextPack[], role: 'about' | 'promote')` →
a single string:

- `role: 'about'` (Offers → Kits): "Build this kit around the following owner
  assets. Treat every fact as authoritative and do not contradict it:" + packs.
- `role: 'promote'` (Kits → Content): "You are creating content that promotes /
  teaches the following resource. Stay accurate to it and route the CTA to it:"
  + packs.

---

## 3. Direction A — Offers/bonuses → Kits

### 3a. Data
Add `contextRefs?: ContextRef[]` to each kit **intake** type
(`CommunityIntake`, `HighTicketIntake`, `LeadGenIntake`) and normalize it in the
existing `normalizeIntake` (default `[]`, drop malformed). It already persists
because intake is a JSONB column — **no migration required**.

### 3b. Generators
In `openai-community.ts`, `openai-highticket.ts`, `openai-leadgen.ts`:
- Accept resolved `ContextPack[]` (the route resolves refs before calling).
- Append `contextPacksToPromptBlock(packs, 'about')` to each system prompt,
  after the frameworks/format spec and before the voice rules close. The
  frameworks still win on structure; the packs win on **facts** (names, promise,
  price, bonuses).

### 3c. Routes
`/api/mothermode/community-ai`, `/highticket-ai`, `/leadgen-ai`:
- On every generating action, read `intake.contextRefs`, call
  `resolveContextRefs`, pass the packs into the generator.

### 3d. UI (each kit editor)
Add a small **"Context (optional)"** card to `CommunityEditor` /
`HighTicketEditor` / `LeadGenEditor`:
- An **offer picker** (from `OFFERS`) with an **"include bonuses only"** toggle
  per selection (adds `offer` vs `offer-bonuses` refs).
- Selected refs render as removable chips (using `ContextPack.summary`).
- Refs save with the intake via the existing CRUD route; no new endpoint.

---

## 4. Direction B — Kits → Content generation

### 4a. Data
Extend `BatchInput` in `openai-content.ts`:
```ts
/** Extra authoritative context (kits/offers) to promote in this batch. */
contextPacks?: ContextPack[];
```
Extend the client `generateBatch(...)` input and the `/api/mothermode/ai`
(content batch action) body with `contextRefs?: ContextRef[]`; the route resolves
them to `contextPacks` server-side (never trust client-sent prompt text).

### 4b. Generator
In `buildBatchSystem`, after the offer `facts` block, append
`contextPacksToPromptBlock(input.contextPacks, 'promote')` when present. The
existing `offer` stays the primary CTA target unless a kit pack is present and the
admin marks it primary (optional v2; for v1 the offer remains the CTA and kits
are supporting context).

### 4c. Kit listing for the picker
The Generate drawer needs to list selectable kits. Add a read-only endpoint:
- `GET /api/mothermode/content/context-sources` (admin-guarded) →
  `{ success, offers: [{slug,name}], kits: [{kind,id,title,status}] }`
  aggregating `listKitsForAdmin()` from the three kit stores (optionally filtered
  to `status in ('active')` for content use). Reuses each store's existing lister.

### 4d. UI (`BatchPanel.tsx`)
Add an **"Add resource context"** multi-select under the existing **Offer** and
**Prompt guides** controls:
- Grouped options: Community Kits, High Ticket Kits, Lead Gen Kits (and, for
  completeness, other offers/their bonuses).
- Selected items render as removable chips; passed as `contextRefs` to
  `generateBatch`.
- Copy hint: "Content will be written to promote / teach these, in the
  MotherMode voice, adapted per platform."

---

## 5. Files

```
NEW  src/lib/mothermode/context/types.ts        ContextRef / ContextPack / ContextSourceKind
NEW  src/lib/mothermode/context/fromOffer.ts     offerToContextPack, offerBonusesToContextPack
NEW  src/lib/mothermode/context/fromKits.ts      community/highTicket/leadGen → ContextPack (wrap export.ts)
NEW  src/lib/mothermode/context/resolve.ts       resolveContextRefs (server-only), size caps
NEW  src/lib/mothermode/context/prompt.ts        contextPacksToPromptBlock
NEW  src/app/api/mothermode/content/context-sources/route.ts   admin list for the content picker
NEW  tests/lib/context-packs.test.ts             pure adapter + join + clamp tests

EDIT src/lib/mothermode/community/types.ts        + contextRefs on intake + normalize
EDIT src/lib/mothermode/highticket/types.ts       + contextRefs on intake + normalize
EDIT src/lib/mothermode/leadgen/types.ts          + contextRefs on intake + normalize
EDIT src/utils/integrations/openai-community.ts    accept + inject ContextPack[]
EDIT src/utils/integrations/openai-highticket.ts   accept + inject ContextPack[]
EDIT src/utils/integrations/openai-leadgen.ts      accept + inject ContextPack[]
EDIT src/app/api/mothermode/community-ai/route.ts  resolve intake.contextRefs → packs
EDIT src/app/api/mothermode/highticket-ai/route.ts resolve intake.contextRefs → packs
EDIT src/app/api/mothermode/leadgen-ai/route.ts    resolve intake.contextRefs → packs
EDIT src/app/admin/community/CommunityEditor.tsx   Context card (offer + bonuses picker)
EDIT src/app/admin/high-ticket/HighTicketEditor.tsx Context card
EDIT src/app/admin/lead-gen/LeadGenEditor.tsx       Context card
EDIT src/utils/integrations/openai-content.ts       BatchInput.contextPacks + inject in buildBatchSystem
EDIT src/app/api/mothermode/ai/route.ts             accept contextRefs, resolve to packs
EDIT src/components/mothermode/content/generatedClient.ts  pass contextRefs
EDIT src/components/mothermode/content/BatchPanel.tsx       "Add resource context" multi-select
```

No new environment variables. No new tables (intake/doc are already JSONB; content
batches are ephemeral request input).

---

## 6. Guardrails

- **Server-only resolution.** The client sends `ContextRef[]` (pointers), never
  prompt text. The route resolves refs to packs so injected facts can't be spoofed
  and stay in sync with the source of truth.
- **Size caps** in `resolveContextRefs` keep prompts bounded (per-pack + total).
- **Voice rules still win.** Packs are facts; `VOICE_RULES` and the compliance
  pass remain the final authority on wording (no dashes, no NO-list words).
- **Fail soft.** Deleted/unknown refs are dropped; generation proceeds without
  them rather than erroring.
- **No circular blow-up.** Kits reference offers and offers-bonuses; content
  references kits/offers. We do not recursively expand a kit's own attached offer
  refs when using that kit as content context (one level only), to keep prompts
  bounded and predictable.

---

## 7. Build order

1. `context/types.ts` + `fromOffer.ts` + `fromKits.ts` + `prompt.ts` +
   `tests/lib/context-packs.test.ts` (pure, no I/O) — get these green first.
2. `context/resolve.ts` (server-only) wiring to the three stores + `getOffer`.
3. Direction A: add `contextRefs` to the three intakes + normalizers; inject into
   the three kit generators; resolve in the three kit AI routes; add the Context
   card to the three editors.
4. Direction B: `BatchInput.contextPacks` + `buildBatchSystem` injection;
   `context-sources` endpoint; `generatedClient` + `/api/mothermode/ai` wiring;
   `BatchPanel` multi-select.
5. Verify (§8).

---

## 8. Verification checklist

- `npx tsc --noEmit` exits 0; `npx vitest run tests/lib/context-packs.test.ts`
  green (adapters produce non-empty, dash-free prompts; clamps enforced; unknown
  refs dropped).
- **Offers → Kits**: attach an offer (and separately, just its bonuses) to a
  Community/High Ticket/Lead Gen intake; generate; the output reflects the offer's
  promise/price/bonuses and never contradicts them.
- **Kits → Content**: in the Generate drawer, attach a saved kit; the batch reads
  as content promoting/teaching that kit, adapted per platform, on-voice.
- Removing a ref and regenerating removes its influence.
- Deleting a referenced kit then generating degrades gracefully (ref dropped).
- Prompt size stays bounded with several large refs attached.

---

## 9. Docs to update on completion

- New deep-dive: `docs/OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md`.
- `docs/MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md`: add a feature-map row + a short
  section, and note the shared `context/*` module in the architecture map.
- Cross-link from `COMMUNITY_KIT_SYSTEM_PORT.md`, `HIGH_TICKET_KIT_TASK.md`,
  `LEAD_GEN_KIT_SYSTEM_PORT.md`, and `CONTENT_GENERATE_SYSTEM_PORT.md` (each gains
  an optional context-refs input).
