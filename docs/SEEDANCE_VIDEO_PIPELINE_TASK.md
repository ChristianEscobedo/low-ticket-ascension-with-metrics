# Seedance Video Pipeline (Reel Director) — Task Spec

Turn the Content Hub's video tooling into a **story-first film director**: the
user gives an *idea*, and a layered agent pipeline produces a story, four
lookback-linked storyboards, a growing **Film Bible** for continuity, and
finally **Seedance** video clips (via MUAPI) rendered from the GPT-Image contact
sheets — optionally scored with ElevenLabs voiceover and music direction.

> Status: **spec + port doc only — build in a follow-up task.** Nothing here is
> implemented yet. The companion checklist is `SEEDANCE_VIDEO_PIPELINE_SYSTEM_PORT.md`.

## The core idea

> The app should never ask for scene prompts. It asks for a **story**. The AI
> becomes the director.

Pipeline:

```
Idea
  ↓ Story Agent           → story arc, emotional arc, hook, payoff, CTA + 4 chapters
Storyboard Agent          → 4 boards × 4 frames (uses lookback + Film Bible)
Continuity Agent          → Film Bible JSON (accumulates every creative decision)
Shot / Camera Director    → one cinematic prompt per frame
Seedance Prompt Builder   → final Seedance prompt per clip (the master meta prompt)
Voice Director (opt)      → narration script + pacing
Music Director (opt)      → music direction
Render (MUAPI/Seedance)   → mp4 clips → Supabase → stitched reel
```

The layering matters: **System Prompt → Brand Bible → Storyboard Rules → Scene
Data → Audio Layer → Output**. Each layer is reusable across brands (swap the
Brand Bible, keep the cinematic engine).

## What already exists (reuse — do not rebuild)

| Need | Already in repo |
| --- | --- |
| Storyboard packs with **lookback continuity** | `StoryboardPack`/`StoryboardBoard` in `src/lib/mothermode/content/review.ts` (has `imagePrompt`, `videoPrompt`, `scenes`, `lookbackSummary`, per-clip `startSec/endSec/segmentDuration`, `imageUrl`) |
| Script → clip-window segmentation (15/18s) | `src/lib/mothermode/content/scriptStoryboard.ts` |
| Contact-sheet render on **GPT Image 2** | `src/components/mothermode/content/ImageStudioModal.tsx` `renderStoryboard()` + `src/utils/integrations/openai-content.ts` (`/images/generations`, `gpt-image-2`) |
| **Voiceover** w/ char-level timing | `src/utils/integrations/elevenlabs.ts`, `src/lib/mothermode/content/voiceover.ts`, `voiceover/route.ts` |
| Two-way **context injection** (clamp + prompt block) | `src/lib/mothermode/context/*` (`resolve.ts`, `prompt.ts`, `sources.ts`, `types.ts`) |
| AI **agent dispatch** pattern | `src/app/api/mothermode/ai/route.ts` + `src/components/mothermode/content/aiClient.ts` |
| Media upload → Supabase public URL | `src/utils/mothermode/storage.ts` (`uploadVideoBuffer`, `uploadImageBuffer`, `uploadAudioBuffer`) |
| Final-cut video field on a piece | `PieceReview.video` (+ `withVideo`/`withoutVideo`) |

## What is genuinely new

1. **MUAPI / Seedance render** — no video-generation integration exists today
   (`content/video/route.ts` is upload-only). This is the largest new piece.
2. **Story Agent** — idea → story/emotional arc → exactly 4 storyboard chapters.
3. **Film Bible** — a single accumulating continuity JSON referenced by every
   board and shot (upgrades today's per-board `lookbackSummary` string).
4. **Brand Bible** — a structured, swappable brand-injection block.
5. **Layered prompt composer** — assembles the master meta prompt + wrappers in
   priority order (storyboard wins conflicts).

---

## Changes (additive, back-compat)

### 1. Env — `.env.example`
- `MUAPI_API_KEY` — MUAPI key.
- `MUAPI_BASE_URL` — default `https://api.muapi.ai` (override-able).
- `MUAPI_SEEDANCE_MODEL` — Seedance model id (kept in env so a model bump needs
  no code change), e.g. `seedance-1.0` / `seedance-1.0-pro`.
- Optional `MUAPI_POLL_TIMEOUT_MS` (default 180000), `MUAPI_POLL_INTERVAL_MS`
  (default 3000).

### 2. `src/utils/integrations/muapi-seedance.ts` (new, server-only)
Mirrors the shape of `fal-smart-resize.ts` / `openai-content.ts`:
- `submitSeedanceRender({ imageUrl, prompt, durationSec, aspectRatio, seed? })`
  → `{ taskId }`. **Image-to-video**: `imageUrl` is a rendered contact-sheet
  frame (start frame) so character/wardrobe/world continuity is preserved.
- `getSeedanceResult(taskId)` → `{ status: 'pending'|'succeeded'|'failed'; videoUrl?; error? }`.
- `renderSeedanceClip(args, { onProgress })` — submit + poll to completion,
  returns the remote `videoUrl`.
- Reads keys from env; throws clear "not configured" errors.

### 3. `src/lib/mothermode/content/filmBible.ts` (new, pure/testable)
The accumulating continuity object + merge math (no network):
```ts
interface FilmBible {
  film: { title: string; genre: string; aspectRatio: string; runtime: string };
  brand: { visualStyle: string; colorPalette: string; cameraLanguage: string };
  characters: ContinuityCharacter[];
  locations: ContinuityLocation[];
  cameraRules: string[];
  continuity: string[];
  emotionalArc: string[]; // e.g. ["Hook","Recognition","Release","Invitation"]
}
```
- `emptyFilmBible(seed?)` — start a bible from brand + story.
- `mergeContinuity(bible, delta)` — fold a board's Continuity Object into the
  bible (union characters/locations by id, append rules, dedupe).
- `filmBibleToPromptBlock(bible)` — compact, injection-ready text.
- `continuityFromBoard(board)` — extract a delta from a planned board.
- Unit tests in `tests/lib/film-bible.test.ts`.

### 4. `src/lib/mothermode/content/reelDirector.ts` (new, pure/testable)
Layered prompt composition + presets:
- `MASTER_VIDEO_META_PROMPT` — the versioned cinematic-director system prompt
  (storyboard is source of truth; motion expansion; camera language; realism;
  negatives; brand injection rules).
- `REEL_WRAPPERS` — the four presets: `silent`, `music`, `voice`, `voice+music`.
- `buildSeedancePrompt({ meta, brandBible, filmBible, board, frame, voice?, music?, camera? })`
  → the final per-clip Seedance prompt, assembled in **priority order**
  (Storyboard → Brand → Voice → Scene Notes → Camera → Music → general rules).
- `NEGATIVE_PROMPT` constant (no borders/panels/plastic skin/identity drift…).
- Unit tests in `tests/lib/reel-director.test.ts` (assert order, wrapper diffs,
  storyboard-wins-conflict rule, negative prompt always present).

### 5. Agent prompts — `src/utils/integrations/openai-reel.ts` (new, server-only)
Seven single-job agents, each a thin OpenAI JSON call (mirrors
`openai-content.ts`/`openai-youtube.ts`):
- `runStoryAgent(input)` → `{ title, coreEmotion, hook, arc, cta, chapters[4] }`.
- `runStoryboardAgent(story, filmBible)` → `StoryboardBoard[]` (4×4 frames) +
  per-board continuity delta.
- `runContinuityAgent(boards)` → Continuity Object (folded into Film Bible).
- `runShotDirector(board, filmBible, brandBible)` → per-frame cinematic prompt.
- `runVoiceDirector(story)` → narration script + pacing (feeds the existing
  ElevenLabs voiceover route).
- `runMusicDirector(story)` → music direction JSON.
- `runSeedanceBuilder(...)` → delegates to `reelDirector.buildSeedancePrompt`.

### 6. API routes
- Extend `src/app/api/mothermode/ai/route.ts` with new agent actions
  (`reel.story`, `reel.storyboard`, `reel.continuity`, `reel.shots`,
  `reel.voice`, `reel.music`) — same admin guard + dispatch style.
- New `src/app/api/mothermode/content/seedance/route.ts` (`nodejs`,
  admin-guarded): `POST` submits a clip render, `GET ?taskId=` polls; on success
  downloads the mp4 and re-hosts via `uploadVideoBuffer`, returns the Supabase
  URL. Clear 400 when MUAPI unconfigured.

### 7. Data model — additive on `review.ts`
- On `StoryboardBoard`: `videoUrl?: string`, `videoStatus?: 'idle'|'rendering'|'done'|'failed'`, `videoTaskId?: string`, `seedancePrompt?: string`.
- On `StoryboardPack`: `filmBible?: FilmBible`, `story?: ReelStory`, `reelUrl?: string` (stitched output), `wrapper?: 'silent'|'music'|'voice'|'voice+music'`.
- New `ReelStory` type (title/coreEmotion/hook/arc/cta/chapters).
- Pure helpers `withFilmBible`, `withReelStory`, `withBoardVideo(index, patch)`
  beside the existing `withStoryboardBoard`. No DB migration — same JSONB review.

### 8. Brand Bible — new context source (ties into the Skills doc)
- Add `'brand-bible'` to `ContextSourceKind` (store-backed).
- `src/lib/mothermode/brandbible/` store + types (mirrors the kit stores) OR
  reuse the `skills` store if built first — a Brand Bible is a specialized skill.
- `fromBrandBible(record)` adapter + `resolve.ts` case + `sources.ts` listing.
- Admin editor `src/app/admin/brand-bible/` (visual direction, color language,
  emotion, camera, negatives). Swapping the selected Brand Bible reskins the
  entire pipeline without touching the cinematic engine.

### 9. UI — `src/components/mothermode/content/ReelDirectorPanel.tsx` (new)
A new panel in the Content Hub (sibling of `StoryboardPanel`/`VideoScriptPanel`):
- **Step 1 Idea** → run Story Agent (shows arc + 4 chapters).
- **Step 2 Storyboards** → generate 4 boards with lookback; render contact
  sheets via the existing GPT-Image path; Film Bible panel updates live.
- **Step 3 Render** → per-board "Generate clip" (Seedance) with status/poll;
  wrapper preset picker (Silent / +Music / +Voice / +Voice+Music).
- **Step 4 Assemble** → per-clip players + a stitched-reel action + download.
- Wire client calls through `aiClient.ts` (`aiRunStoryAgent`, `aiRenderSeedance`, …).

## Tests (pure libs first)
- `tests/lib/film-bible.test.ts` — merge/union/dedupe + prompt block.
- `tests/lib/reel-director.test.ts` — prompt order, wrappers, negatives.
- `tests/lib/script-storyboard.test.ts` — already exists; extend for board↔clip mapping if changed.

## Decisions baked in (tell me to change any)
- **Image-to-video** off the GPT-Image contact-sheet frames (continuity) rather
  than pure text-to-video.
- **Seedance model id lives in env** (`MUAPI_SEEDANCE_MODEL`) so upgrades need no
  code change; the client is written against MUAPI's submit/poll task shape.
- **Brand Bible = admin-editable context source**, so the same engine serves
  MotherMode / Omega / Mass by swapping the filter.
- **Voiceover reuses the existing ElevenLabs system**; the Voice Director only
  writes the script + pacing, then hands off to `voiceover/route.ts`.
- **Reel state lives on `review.storyboard`** (+ additive fields) — no new store,
  no DB migration.

## Open items to confirm at build time
- Exact MUAPI Seedance request/response schema (submit + poll field names).
- Clip stitching: server-side concat vs client-side download of individual clips
  for the first release.
- Whether music is *direction only* (text) initially, or an actual audio-gen
  integration in a later pass.
