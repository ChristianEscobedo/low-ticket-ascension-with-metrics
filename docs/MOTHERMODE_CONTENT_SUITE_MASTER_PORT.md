# MotherMode Content Suite — Master Documentation & Port Guide

This is the single source of truth for every feature added to the MotherMode
content system, and the step-by-step guide for porting the whole suite into
another Next.js + Supabase codebase.

It is intentionally an **index + runbook**. Each feature has a short
"what/where/how" section here. Features that already ship a dedicated deep-dive
port doc are cross-referenced instead of repeated. Features with no other doc
are documented in full below.

> Voice rules apply to every generated string in this system: no em dashes, no
> en dashes, no NO-list words (mama, thrive, journey, hustle, empower, balance,
> girlboss, etc.), periods over exclamation points, soft $7 CTA. Enforced in
> `constants.ts`, the compliance agent, and every server prompt (`VOICE_RULES`).

---

## 0. Feature map (what the user asked to port)

| # | Feature | Primary code | Dedicated doc |
|---|---------|--------------|---------------|
| 1 | Content Hub + catalog + previews | `src/lib/mothermode/content/*`, `src/components/mothermode/content/*` | `CONTENT_HUB_FEATURES_PORT.md` |
| 2 | AI content generation (Generate/Review drawer) | `BatchPanel.tsx`, `openai-content.ts`, `/api/mothermode/ai` | `CONTENT_GENERATE_SYSTEM_PORT.md` |
| 3 | Image edit + reference images (logos on content) | `ImageStudioModal.tsx`, `aiClient.ts`, `constants.ts` EDIT_PRESETS | `IMAGE_EDIT_SYSTEM_PORT.md` |
| 4 | Text-on-image overlay + **in-place text editor / drag-resize** | `imageOverlay.ts`, `OverlayPanel.tsx` | `IMAGE_OVERLAY_SYSTEM_PORT.md` + §6 below |
| 5 | Story & carousel images (multi-frame packs) | `framePack.ts`, `FramePackPanel.tsx` | `FRAME_PACK_SYSTEM_PORT.md` |
| 6 | Storyboard packs + Variation Lab (fal smart-resize) | `variationLab.ts`, `StoryboardPanel.tsx`, `fal-smart-resize.ts` | `STORYBOARD_VARIATION_LAB_PORT.md` |
| 7 | B-roll + second-by-second video scene generator | `VideoScriptPanel.tsx`, `/api/mothermode/content/video` | `VIDEO_SCRIPT_SYSTEM_PORT.md` |
| 8 | Compliance audit agent (brand + platform score/fix) | `compliancePass.ts`, `platformCompliance.ts`, `CompliancePanel.tsx`, `openai-compliance.ts` | `COMPLIANCE_AGENT_SYSTEM_PORT.md` |
| 9 | Export (CSV / GHL / Metricool / Sheets / schedule) | `src/lib/mothermode/content/export/*` | `CONTENT_EXPORT_SYSTEM.md` |
| 10 | **Story autoplay + preview surfaces** | `ContentSheet.tsx`, `previews/*` | §5 below |
| 11 | **YouTube + LinkedIn surfaces + YouTube Studio kit** | `youtube.ts`, `linkedin.ts`, `YouTubeStudioPanel.tsx`, `openai-youtube.ts`, `previews/YouTubePreview.tsx`, `previews/LinkedInPreview.tsx` | `YOUTUBE_LINKEDIN_SYSTEM_PORT.md` + §4 below |
| 12 | **Deliverables admin + buyer resource workspaces** | `src/lib/mothermode/deliverables/*`, `resourceEntries.ts`, workspace parts | `DELIVERABLES_RESOURCES_SYSTEM_PORT.md` + §7 below |
| 13 | **Admin Knowledge Base / Help Docs / Changelog** | `src/lib/mothermode/help/*`, `/admin/help`, `/api/admin/mothermode-help` + `mothermode-changelog`, `/mothermode/help`, `/mothermode/changelog` | `HELP_CENTER_SYSTEM_PORT.md` (built; spec: `ADMIN_KNOWLEDGE_BASE_CHANGELOG_TASK.md`) |
| 14 | **Community Kit** (name, description, paid/free qualifying questions, DM + sales-call scripts, ads content style, first pinned post) (BUILT) | `src/lib/mothermode/community/*` (types + store + `frameworks/*`), `utils/integrations/openai-community.ts`, `/admin/community` (page + `CommunityEditor`), `/api/mothermode/community-ai` (generate + regenerate) + `/api/admin/mothermode-community` (CRUD), migration `20260715000000_mothermode_community_kits.sql`, test `tests/lib/community-mappers.test.ts` | `COMMUNITY_KIT_SYSTEM_PORT.md` (built; spec: `COMMUNITY_KIT_TASK.md`) |
| 15 | **High Ticket Kit** (offer/program name, full high-ticket offer stack, give-away value resource, 15-min triage script, sales-call script, optional ads angle) (PLANNED) | planned: `src/lib/mothermode/highticket/*` (types + store + export + `frameworks/*`), `utils/integrations/openai-highticket.ts`, `/admin/high-ticket` (page + `HighTicketEditor`), `/api/mothermode/high-ticket-ai` (generate + regenerate) + `/api/admin/mothermode-high-ticket` (CRUD), migration `mothermode_high_ticket_kits`, test `tests/lib/high-ticket-mappers.test.ts` | `HIGH_TICKET_KIT_TASK.md` (spec); `HIGH_TICKET_KIT_SYSTEM_PORT.md` to author once built |
| 16 | **Lead Gen Kit** (AI lead-magnet builder: 10 formats, length-driven multi-pass long-form generation, per-section expand, typed content blocks, self-contained styled-HTML publish to Deliverables) (BUILT) | `src/lib/mothermode/leadgen/*` (types + store + export + `formats/*`), `utils/integrations/openai-leadgen.ts`, `/admin/lead-gen` (page + `LeadGenEditor`), `/api/mothermode/leadgen-ai` (fillIntake/outline/generate/expand) + `/api/admin/mothermode-leadgen` (CRUD + publish), migration `20260725000000_mothermode_lead_gen_kits.sql` | `LEAD_GEN_KIT_SYSTEM_PORT.md` (built; spec: `LEAD_GEN_KIT_TASK.md`) |
| 17 | **Offer ↔ Kit Context Bridge** (shared context layer: `ContextRef[]` + resolver that turns an offer or another kit into prompt-ready `ContextPack`s for any generator) (BUILT) | `src/lib/mothermode/context/*` (types + resolve + fromOffer + fromKits + prompt), consumed by the Email Kit and `/api/mothermode/content/generated` | `OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md` (built; spec: `OFFER_KIT_CONTEXT_BRIDGE_TASK.md`) |
| 18 | **Email Marketing Kit** (AI campaign builder: 8 campaign blueprints, 9 per-email frameworks, timing-style scaling, deterministic skeleton + outline/expand generation, context-native, plain-text-source-of-truth + styled-HTML/CSV export) (BUILT) | `src/lib/mothermode/email/*` (types + store + export + `campaigns/*` + `frameworks/*`), `utils/integrations/openai-email.ts`, `/admin/email-marketing` (page + `EmailKitEditor`), `/api/mothermode/email-ai` (fillIntake/outline/expand/generate) + `/api/admin/mothermode-email` (CRUD), migration `20260730000000_mothermode_email_kits.sql`, test `tests/lib/email-kit.test.ts` | `EMAIL_MARKETING_KIT_SYSTEM_PORT.md` (built; spec: `EMAIL_MARKETING_KIT_TASK.md`) |
| 19 | **Two-Way Context (Kits ⇄ Content)** (round-2 extension of #17: adds an `email-kit` context source so a saved email sequence can be attached to the content generator, and rolls the `context_refs` selector out to the Community/High-Ticket/Lead-Gen kits) (PART B BUILT; Part A migration in, per-kit wiring remaining) | `src/lib/mothermode/context/*` (`types.ts`, `sources.ts`, `fromKits.ts` `fromEmailKit`, `resolve.ts`), `EmailKitEditor.tsx`, migration `20260731000000_mothermode_kit_context_refs.sql` | `TWO_WAY_CONTEXT_SYSTEM_PORT.md` |
| 20 | **Kit rich-text editing** (TipTap HTML kit fields; prompt + export sanitized via `htmlToPromptText`) (foundation BUILT; per-editor swaps ongoing) | `src/lib/mothermode/richtext.ts`, `context/prompt.ts` (`clampPack`), `KitRichTextField.tsx`, test `tests/lib/richtext.test.ts` | `KIT_RICH_TEXT_EDITING_PORT.md` |
| 21 | **Email Kit advanced editor** (rich-text bodies, body format + length controls global/per-email, branching `branch`+`parentId`, sequence extension/deep-nurture `aiExtendSequence`, per-email Image Studio, P.S. selling frameworks) (BUILT) | `email/types.ts` (branch/parentId/psFramework/images), `openai-email.ts` (extend + P.S. + length), `email-ai/route.ts` (`extend`), `EmailImageStudio.tsx`, `EmailKitEditor.tsx` (no migration — rides `sequence` JSONB) | `EMAIL_KIT_ADVANCED_FEATURES_PORT.md` |
| 22 | **Email image in-body + Studio round-trip + funnel asset library** (insert hosted image into body via Studio trigger/slash; re-open gallery image as seed for text/overlay/edit; polymorphic `funnel_assets` join to attach any kit to a funnel, resolved via Context Bridge) (sanitizer `<img>` handling BUILT; rest PLANNED) | `richtext.ts` (`<img>`→`[image]`), `KitRichTextField.tsx` (opt-in `@tiptap/extension-image`), `EmailImageStudio.tsx`, `email/export.ts` (HTML `<img>` width cap), new `funnel-assets/` + migration `20260805000000_mothermode_funnel_assets.sql` | `EMAIL_IMAGE_IN_BODY_AND_FUNNEL_ASSETS_PORT.md` |





Sections 4-7 below give the full detail for the features that are new in this
round; the rest point to their existing deep-dive docs.

---

## 1. Architecture at a glance

```
src/lib/mothermode/
  brand.ts                         Brand constants, palette, storage keys
  content/
    types.ts                       ContentPiece, formats, platforms, tones
    constants.ts                   Labels, IMAGE_STYLE, EDIT_PRESETS, VOICE, CTA
    index.ts                       allContent aggregator + helpers + pieceToText
    facebook.ts instagram.ts x.ts tiktok.ts
    youtube.ts linkedin.ts         NEW per-platform catalogs
    pinterest.ts blog.ts aeo.ts email.ts ads.ts
    models.ts promptStyles.ts      Text/image model registry + prompt styles
    review.ts                      Per-piece review state (images, YT kit, etc.)
    compliancePass.ts              Brand voice scan/fix contract
    platformCompliance.ts          Per-platform hard limits + checks
    platformSizes.ts               Aspect/dimension source of truth
    imageOverlay.ts                Text-on-image overlay model + geometry
    framePack.ts                   Multi-frame carousel/story pack model
    variationLab.ts                Smart-resize variation model
    amplify.ts                     Cross-post amplification
    export/*                       Schedulers + ad managers + sheets
  community/                       NEW admin AI community launch-kit builder
    types.ts store.ts export.ts frameworks/*
  highticket/                      PLANNED admin AI high-ticket offer kit builder
    types.ts store.ts export.ts frameworks/*
  deliverables/                    NEW admin-editable buyer deliverables
    types.ts store.ts index.ts resolve.ts kit.ts
    brain-dump/*                   Per-resource content builders
components/mothermode/content/     Hub UI, drawers, previews, studio
components/mothermode/parts/workspace/  NEW interactive buyer workspaces
app/api/mothermode/                ai, community-ai, high-ticket-ai, content/video,
                                   content/export, content/generated, resource-entries
app/api/admin/mothermode-deliverables, mothermode-community, mothermode-high-ticket
utils/integrations/                openai-content, openai-compliance,
                                   openai-youtube, openai-community, openai-highticket,
                                   fal-smart-resize, google-sheets
```

All AI is server-only. Keys are read through `runtime-config` helpers
(`getOpenAiKey`, `getAnthropicKey`, plus admin overrides), never `process.env`
in the browser. The client talks to thin API routes; the routes call the
integration modules.

---

## 2. Data model / Supabase migrations

Five migrations back the new persistence (a sixth, `mothermode_high_ticket_kits`,
is PLANNED with the High Ticket Kit). Run them in order.

| Migration | Table(s) | Purpose |
|-----------|----------|---------|
| `20260628000000_mothermode_generated_content.sql` | generated content + per-piece review | The AI content **library** and review state (images, hooks, YT kit) |
| `20260701000000_mothermode_deliverables.sql` | deliverable overrides | Admin-editable copy/structure for buyer deliverables |
| `20260705000000_mothermode_resource_entries.sql` | resource entries | Buyer-entered data in interactive resource workspaces, scoped by email |
| `20260710000000_mothermode_help_center.sql` | kb articles + changelog | Admin-editable Help Center (anon reads published only). See `HELP_CENTER_SYSTEM_PORT.md` |
| `20260715000000_mothermode_community_kits.sql` | community kits | Admin-only AI community launch kits (intake + kit as JSONB). See `COMMUNITY_KIT_SYSTEM_PORT.md` |
| `20260720000000_mothermode_high_ticket_kits.sql` | high ticket kits | Admin-only AI high-ticket offer kits (intake + kit as JSONB). See `HIGH_TICKET_KIT_TASK.md` |
| `20260725000000_mothermode_lead_gen_kits.sql` | lead gen kits | Admin-only AI lead-magnet kits (intake + doc as JSONB). See `LEAD_GEN_KIT_SYSTEM_PORT.md` |
| `20260730000000_mothermode_email_kits.sql` | email kits | Admin-only AI email campaign kits (intake + context_refs + sequence as JSONB). See `EMAIL_MARKETING_KIT_SYSTEM_PORT.md` |
| (none) | — | The **Context Bridge** (§8f) adds no table; it reads existing offer + kit tables. See `OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md` |
| `20260731000000_mothermode_kit_context_refs.sql` | community + high-ticket + lead-gen kits | Adds `context_refs` JSONB to the three kits so each carries a context selector like the Email Kit (§8g). See `TWO_WAY_CONTEXT_SYSTEM_PORT.md` |


Port notes:
- These assume Supabase with RLS. Admin routes use the service role; buyer
  routes scope by `mothermode_buyer_email` (see `brand.ts` STORAGE + `useBuyerEmail`).
- If the target codebase has no Supabase, the library and review state fall back
  to local behavior, but persistence (library, deliverable overrides, resource
  entries) requires the tables.

---

## 3. Environment variables

Add to `.env` (server) / configure in the admin runtime-config panel:

```
OPENAI_API_KEY=            # text + image generation
ANTHROPIC_API_KEY=         # optional alternate text provider
FAL_KEY=                   # fal.ai smart-resize (Variation Lab / frame packs)
# Supabase (already present in the base template)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Optional export/integration targets
GOOGLE_SHEETS_*            # service-account creds for Sheets export
```

Provider/model overrides can also be set at runtime by an admin
(`getTextProviderOverride`, `getTextModelOverride`) so you do not have to
redeploy to switch models.

---

## 4. YouTube + LinkedIn (NEW)

Full deep dive: **`YOUTUBE_LINKEDIN_SYSTEM_PORT.md`**. Summary here.

### 4a. Platform plumbing
`youtube` and `linkedin` are first-class `ContentPlatform`s in `types.ts`, added
to `PLATFORM_LABEL`, `PLATFORM_FORMATS`, `PLATFORM_ORDER`, `countByPlatform`,
`PLATFORM_BRAND` (icon tint), and `platformSizes.ts`. Formats used:
- YouTube: `long` (16:9 watch page, chaptered script + timestamped description)
  and `reel` (9:16 Shorts, hook in the first 2 seconds).
- LinkedIn: `feed` (text or single image 1200x627), `carousel` (document,
  1080x1350), `article` (1200x627 cover + body), `video` (16:9 talking head).

### 4b. Content catalogs
- `src/lib/mothermode/content/youtube.ts` — 2 long-form + 3 Shorts. Long-form
  uses `script[]` (chaptered beats: `at`, `onScreen`, `voiceover`, `visual`) and
  `body[]` for the timestamped-chapter description. Audience: overwhelmed mothers
  and working/career women arriving via search.
- `src/lib/mothermode/content/linkedin.ts` — one of each native type, all in the
  **founder's first-person POV** ("I built and use MotherMode"), targeting career
  and business women, framing the mental load as an operations problem.
- Both are spread into `allContent` in `index.ts` in `PLATFORM_ORDER` position
  (youtube then linkedin, before pinterest).

### 4c. YouTube Studio kit (server generator)
`src/utils/integrations/openai-youtube.ts` turns any piece into a
publish-ready kit: A/B `titles`, an SEO `description`, search `tags`, valid
`chapters` (normalized to start at 0 and strictly increase; only planned when
runtime >= 120s), and `thumbnails` (16:9 image prompt + big overlay-text idea).
Same key handling and JSON-mode call pattern as `openai-content.ts`. Kit types
live in `review.ts` (`YouTubeChapter`, `YouTubeThumbnail`). Thumbnails are
concepts; the actual render reuses the existing `aiGenerateImage` client action,
then the URL is stitched back into the kit. UI: `YouTubeStudioPanel.tsx`.

### 4d. Previews
`previews/YouTubePreview.tsx` (watch page + Shorts) and
`previews/LinkedInPreview.tsx` (feed/carousel/article/video), both routed through
`PlatformPreview.tsx`.

### Port order
Types/labels/sizes -> previews -> catalogs (`youtube.ts`, `linkedin.ts`) ->
wire into `index.ts` -> `openai-youtube.ts` + `YouTubeStudioPanel.tsx` +
`/api/mothermode/ai` action. Verify with `tsc` and the `content-export` +
`platform-compliance` vitest suites.

---

## 5. Story autoplay + preview surfaces (NEW)

### What it does
Multi-frame Stories, Reels, and carousels **autoplay** in the review preview so
a draft reads like a live post: frames advance on a timer with an animated
progress sweep, loop at the end, and pause on hover/focus so a reviewer can
study a frame. A manual frame pick pauses autoplay and persists the choice;
autoplay is otherwise **preview-only and never written to the store**.

### Where
- `components/mothermode/content/ContentSheet.tsx` owns the autoplay state
  machine: `autoplay` (default on), `previewIndex` (transient override), the
  `FRAME_MS = 3500` cadence, `canAutoplay = (isDeck || isVertical) && frameCount > 1`,
  the advance-on-timer `useEffect`, and hover-to-pause. The frame shown is the
  autoplay override when present, otherwise the persisted choice, clamped to the
  live frame count.
- `previews/PlatformPreview.tsx` accepts `autoplay` + `frameDurationMs` and
  passes them down.
- `previews/shared.tsx` defines the shared props (`autoplay?`, `frameDurationMs?`)
  and the progress-bar animation used by the story/reel surfaces.
- `previews/InstagramPreview.tsx` / `FacebookPreview.tsx` (and the vertical
  surfaces) consume `animate={view.autoplay}` + `durationMs={view.frameDurationMs}`.

### Port notes
Pure client/UI. No API, no DB. Port `previews/*` first (they are the render
layer), then the `ContentSheet` autoplay block. Keep `frameCount` derived from
the piece's `slides`/frames + review images so the timer clamps correctly.

---

## 6. Text-on-image overlay: in-place editor + drag-resize (NEW on top of overlay v2)

Base overlay is documented in **`IMAGE_OVERLAY_SYSTEM_PORT.md`**. This round adds:
- **In-place text edit**: double-click/click-to-edit a text block directly on the
  canvas instead of only in a side field.
- **Drag-to-resize handles**: resize the text box on-canvas; freeform anchor-based
  positioning with a sticky preview (the burn matches the preview exactly).
- Overlay burns are hosted (host overlay burns) so the saved image carries the
  overlay, and the gallery is not clobbered on recipe save.

### Where
- `src/lib/mothermode/content/imageOverlay.ts` — the overlay model (blocks,
  anchor, position, size, style) and geometry math. Unit-tested in
  `tests/lib/image-overlay.test.ts`.
- `src/components/mothermode/content/OverlayPanel.tsx` — the interactive editor
  (drag, resize handles, on-canvas edit, anchor positioning).
- Integrated in `ImageStudioModal.tsx` and rides along into the library via the
  review images pipeline (`reviewClient.ts` / `setReviewImages`).

### Port notes
Client-side rendering + a server/host step to burn the overlay onto the image.
Bring `imageOverlay.ts` + its test first (pure functions), then `OverlayPanel`,
then wire into the Image Studio. No new env or DB.

---

## 7. Logos on content generation (reference-image edits)

"Logos on content" is the **reference-image edit pipeline** in Image Studio, not
a separate feature. Detail is in `IMAGE_EDIT_SYSTEM_PORT.md`; the logo-specific
bits:
- `constants.ts` ships an `EDIT_PRESETS` entry `{ id: 'logo', label: 'Add logo' }`
  whose `inject` string tells the model to incorporate the mark from the attached
  reference image(s) tastefully, keep edges clean, and never invent a different
  logo.
- `MAX_EDIT_REFERENCES = 4` — up to four reference images (character, logo,
  product, environment) can be sent with a seed edit.
- `aiClient.ts` `aiGenerateImage` / the edit action accept the seed + reference
  images (data URLs or hosted URLs) and return a hosted public URL.
- Base generation prompts still forbid *baked-in* logos in scenes
  (`IMAGE_STYLE`, `framePack.ts`, `openai-content.ts`) so logos only appear when
  explicitly added via the edit preset. Keep that distinction when porting.

---

## 8. Bulk image creation in Generate/Review

The Generate drawer (`BatchPanel.tsx`) is where copy and imagery are produced
together at volume (documented in `CONTENT_GENERATE_SYSTEM_PORT.md`). Bulk image
specifics:
- Compose N pieces, then in Review each draft can render **1-4 image variants**
  in one click from its hook-anchored `media.prompt` (`renderImage` loops
  `aiGenerateImage`), or open Image Studio for edits/overlays.
- Draft galleries live locally (`draftImages`, `draftImageIndex`) until save;
  on save they are attached to each piece via `setReviewImages` so they show in
  the hub and can post to GoHighLevel.
- For text-on-image at volume, combine this with the overlay editor (§6) and
  frame packs (§5/`FRAME_PACK_SYSTEM_PORT.md`).

---

## 8b. Community Kit (NEW)

Full deep dive: **`COMMUNITY_KIT_SYSTEM_PORT.md`**. An admin-only tool that turns
a short intake into a complete community launch kit: name options + a chosen
name, public description, exactly-three qualifying questions for paid and free
communities, a DM script, a sales-call script, an ad content style (angle +
primary text/headline/description + image prompt), a lead form, and the first
pinned post. It fuses the two suite patterns: DB-backed admin CRUD with
service-role writes (like Deliverables / Help Center) and server-only JSON-mode
AI behind an action-switch route (like `/api/mothermode/ai` + `openai-content.ts`).
Owner guidance lives in `src/lib/mothermode/community/frameworks/*` — typed data
modules the generator injects as authoritative guidance, swappable without
touching generation logic.

---

## 8c. High Ticket Kit (PLANNED)

Spec: **`HIGH_TICKET_KIT_TASK.md`** (build-ready; not yet coded). The
high-ticket sibling of the Community Kit: from a short intake it generates an
offer/program name, the full high-ticket offer stack (promise, mechanism,
includes, timeline, price + payment, guarantee, bonuses, positioning), a
give-away value resource (lead magnet), a 15-minute triage/qualification call
script, a full sales-call closing script, and an optional ads angle. Same two
patterns as the Community Kit (DB-backed admin CRUD + server-only JSON-mode AI
behind an action-switch route), same editor UX (intake, generate wizard,
per-section Regenerate/Copy, Copy-all/Export-PDF). Owner frameworks + the
give-away resource load into `src/lib/mothermode/highticket/frameworks/*`; stub
until they land. Author `HIGH_TICKET_KIT_SYSTEM_PORT.md` once built.

---

## 8d. Lead Gen Kit (NEW)

Full deep dive: **`LEAD_GEN_KIT_SYSTEM_PORT.md`**. An admin-only AI lead-magnet
builder that turns a short intake into a complete, buyer-ready document in any of
ten formats (guide, ebook, checklist, cheatsheet, worksheet, template, swipe
file, SOP, course, mini-course). It reuses the suite's DB-backed admin CRUD +
service-role writes and server-only JSON-mode AI behind an action-switch route,
and adds two things worth calling out when porting:

- **Length-driven multi-pass long-form generation.** The intake `length`
  (`short|standard|ultra`) drives *both* section count (`sectionTarget`) and
  per-section depth (`sectionDepth`, 2-4 → 7-12 blocks with subheadings, lists,
  notes, worked examples). Generation is outline-first then per-section expand, so
  ultra-long-form ebooks stay coherent without exhausting one context window.
- **Self-contained styled-HTML publish.** `export.ts` renders the structured doc
  to buyer-facing HTML with a scoped `<style>` block (every selector namespaced
  under `.lead-gen-doc`) that travels with the body, so a published magnet renders
  as a polished, print-ready document anywhere the HTML lands — no host-page CSS.
  Publishing writes a `DeliverableDoc` into the existing deliverables store, so it
  surfaces at `/mothermode/resource/<slug>/<key>` with no new buyer read path. The
  admin editor has a **Styled preview** toggle that renders the exact buyer view.

Format specs live in `src/lib/mothermode/leadgen/formats/*` (label/hint/skeleton/
styleNote/usesLessons per format), injected into every prompt like the Community/
High-Ticket frameworks and swappable without touching generation logic.

---

## 8e. Email Marketing Kit (NEW)

Full deep dive: **`EMAIL_MARKETING_KIT_SYSTEM_PORT.md`**. The campaign-producing
sibling of the document kits. From a short intake plus attached context sources it
produces a complete email **sequence**: an ordered `EmailMessage[]`, each with a
role, a send-offset, a per-email framework, and full copy as plain text (source of
truth) plus derived, escaped HTML. It reuses the suite's DB-backed admin CRUD +
service-role writes and server-only JSON-mode AI behind an action-switch route, and
adds two things worth calling out when porting:

- **Deterministic blueprint, model writes only copy.** Eight campaign specs in
  `src/lib/mothermode/email/campaigns/*` fix the arc (`emailRoles`), timing
  (`defaultTiming`), and per-role framework; `buildSkeleton` materializes the
  sequence in code, then the passes only fill copy (`aiFillIntake` → `aiOutline` →
  `aiExpandEmail`, orchestrated by `aiGenerateSequence`). The model never decides
  how many emails to write or what each is for. `scaleOffset`/`scaleTiming` reshape
  any blueprint by the intake `timingStyle` (aggressive/standard/gentle), unit-tested.
- **Context-native + text-is-truth export.** The kit stores `ContextRef[]` and
  resolves them server-side via the Context Bridge (§8f) at generation time. Export
  (`export.ts`, pure) treats `bodyText` as canonical and derives HTML from it;
  `renderSequenceHtml` re-runs on **every save** so stored HTML never drifts, and
  `sequenceToRows` flattens the sequence for a scheduler/ESP CSV import.

Nine per-email frameworks live in `src/lib/mothermode/email/frameworks/*`
(soap-opera, pas, value-longform, story-lesson, quick-win, founder-note,
case-study, objection-crusher, listicle), swappable without touching generation.
Verified by `tests/lib/email-kit.test.ts` (13 cases) + `tsc --noEmit`.

---

## 8f. Offer ↔ Kit Context Bridge (NEW, shared infrastructure)

Full deep dive: **`OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md`**. Not a user-facing
feature but the shared layer that lets any generator build on top of an existing
offer or another kit. It defines a `ContextRef` (a typed pointer to an offer or a
Community/High-Ticket/Lead-Gen kit) and a server-side resolver
(`src/lib/mothermode/context/*`) that loads the referenced record and flattens it
into prompt-ready `ContextPack`s. `contextPacksToPromptBlock(packs, mode)` renders
those packs into a prompt block tuned per consumer (`content`, etc.).

Key port rule: `ContextRef[]` is stored with the consuming kit, but refs are always
**re-resolved server-side** at generation time and never trusted from the client,
so a kit reflects the live state of its sources. The Email Kit (§8e) and
`/api/mothermode/content/generated` are the first consumers; add the bridge before
either. Covered by `tests/lib/context-packs.test.ts`.

---

## 8g. Two-Way Context (Kits ⇄ Content) (NEW, extends §8f)

Full deep dive: **`TWO_WAY_CONTEXT_SYSTEM_PORT.md`**. Round-2 of the Context
Bridge that closes the loop so context flows in **both** directions.

- **Part B (BUILT, type-checked):** a new `email-kit` source kind makes a saved
  Email Marketing Kit sequence attachable as authoritative context to the content
  Generate drawer. Added to `context/types.ts` (`ContextSourceKind` +
  `CONTEXT_SOURCE_KINDS`), `context/sources.ts` (`buildContextSourceOptions`
  block over `email/store` `listKitsForAdmin`), `context/fromKits.ts`
  (`fromEmailKit` pure adapter), `context/resolve.ts` (the `email-kit` case), and
  the `EmailKitEditor` KIND_LABEL map. No route change: the content generator
  already resolves + injects `contextRefs`, and every picker reads the shared
  `CONTEXT_SOURCE_KINDS` list.
- **Part A (migration in; per-kit wiring remaining):** migration
  `20260731000000_mothermode_kit_context_refs.sql` adds `context_refs` to the
  community, high-ticket, and lead-gen kit tables. The remaining work is the
  same seven-step selector rollout the Email Kit already ships (types → store →
  `openai-<kit>` → `<kit>-ai` route → admin route → page → editor), done
  **atomically per kit** so the build stays green. The port doc has the exact
  per-file checklist.

---

## 9. Consolidated port runbook


Do this in order in the target codebase.

1. **Prereqs**: confirm Next.js App Router + Supabase + a `runtime-config` key
   layer. Add env vars (§3). Install `lucide-react` and any fal client used by
   `fal-smart-resize.ts`.
2. **Migrations** (§2): apply the five SQL files in order; verify tables + RLS.
3. **Foundation libs**: port `brand.ts`, then `content/types.ts`,
   `constants.ts`, `models.ts`, `promptStyles.ts`, `platformSizes.ts`.
4. **Catalogs**: port every `content/<platform>.ts` including `youtube.ts` and
   `linkedin.ts`, then `index.ts` (the aggregator + `pieceToText`). Confirm
   `allContent` order matches `PLATFORM_ORDER`.
5. **Previews** (§5): `previews/*` including YouTube/LinkedIn, then
   `PlatformPreview` and the autoplay wiring in `ContentSheet`.
6. **Integrations** (server): `openai-content.ts`, `openai-compliance.ts`,
   `openai-youtube.ts`, `openai-community.ts`, `fal-smart-resize.ts`,
   `google-sheets.ts`.
7. **API routes**: `/api/mothermode/ai`, `/api/mothermode/community-ai`,
   `/api/mothermode/content/video`, `/api/mothermode/content/export`,
   `/api/mothermode/content/generated`, `/api/mothermode/resource-entries`,
   `/api/admin/mothermode-deliverables`, `/api/admin/mothermode-community`.
8. **Feature libs + panels**: compliance (`compliancePass`, `platformCompliance`,
   `CompliancePanel`), overlay (`imageOverlay`, `OverlayPanel`), frame packs
   (`framePack`, `FramePackPanel`), variation lab/storyboard, video scripts,
   export panel, YouTube Studio, Generate/Review drawer, Image Studio,
   Community Kit (`community/*`, `CommunityEditor`).
9. **Deliverables + workspaces** (§ `DELIVERABLES_RESOURCES_SYSTEM_PORT.md`):
   `deliverables/*`, `resourceEntries.ts`, `parts/workspace/*`, admin pages.
10. **Tests**: port `tests/lib/*` (`content-export`, `platform-compliance`,
    `image-overlay`, `frame-pack`, `community-mappers`) and run them plus
    `tsc --noEmit`.
11. **High Ticket Kit** (PLANNED, § `HIGH_TICKET_KIT_TASK.md`): once built, add
    its migration, `highticket/*`, `openai-highticket.ts`, the two routes, the
    `/admin/high-ticket` editor, and `tests/lib/high-ticket-mappers.test.ts`.

### Verification checklist
- `npx tsc --noEmit` exits 0.
- `npx vitest run tests/lib/content-export.test.ts tests/lib/platform-compliance.test.ts tests/lib/image-overlay.test.ts tests/lib/frame-pack.test.ts tests/lib/community-mappers.test.ts` all green.
- Compliance scan over new catalogs: no em/en dashes, no exclamation points,
  no NO-list words in copy fields.
- Generate drawer produces on-voice drafts; image render + overlay burn work;
  export files open cleanly in the target scheduler.

---

## 10. Cross-referenced deep-dive docs

- `CONTENT_HUB_FEATURES_PORT.md`
- `CONTENT_GENERATE_SYSTEM_PORT.md`
- `IMAGE_EDIT_SYSTEM_PORT.md`
- `IMAGE_OVERLAY_SYSTEM_PORT.md`
- `FRAME_PACK_SYSTEM_PORT.md`
- `STORYBOARD_VARIATION_LAB_PORT.md`
- `VIDEO_SCRIPT_SYSTEM_PORT.md`
- `COMPLIANCE_AGENT_SYSTEM_PORT.md`
- `CONTENT_EXPORT_SYSTEM.md`
- `YOUTUBE_LINKEDIN_SYSTEM_PORT.md` (new, this round)
- `DELIVERABLES_RESOURCES_SYSTEM_PORT.md` (new, this round)
- `HELP_CENTER_SYSTEM_PORT.md` (new, this round; spec `ADMIN_KNOWLEDGE_BASE_CHANGELOG_TASK.md`)
- `COMMUNITY_KIT_SYSTEM_PORT.md` (new, this round; spec `COMMUNITY_KIT_TASK.md`)
- `HIGH_TICKET_KIT_TASK.md` (spec, PLANNED; `HIGH_TICKET_KIT_SYSTEM_PORT.md` to author once built)
- `LEAD_GEN_KIT_SYSTEM_PORT.md` (new, this round; spec `LEAD_GEN_KIT_TASK.md`)
- `OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md` (new, this round; spec `OFFER_KIT_CONTEXT_BRIDGE_TASK.md`)
- `EMAIL_MARKETING_KIT_SYSTEM_PORT.md` (new, this round; spec `EMAIL_MARKETING_KIT_TASK.md`)
- `TWO_WAY_CONTEXT_SYSTEM_PORT.md` (new, this round; extends the Context Bridge — email-kit as content source + kit selector rollout)
- `KIT_RICH_TEXT_EDITING_PORT.md` (new, this round; TipTap HTML kit fields + prompt/export sanitization)
- `EMAIL_KIT_ADVANCED_FEATURES_PORT.md` (new, this round; rich-text bodies, format/length controls, branching, sequence extension, per-email Image Studio, P.S. selling)
- `EMAIL_IMAGE_IN_BODY_AND_FUNNEL_ASSETS_PORT.md` (new, this round; insert image into body via Studio trigger, round-trip gallery image for text/overlay, polymorphic funnel-asset library)
- `YOUTUBE_LINKEDIN_CONTENT_ROUND_1.md` (the copy-authoring spec for the catalogs)




