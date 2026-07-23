# Seedance Video Pipeline (Reel Director) — System Port Checklist

Port-Checklist companion to `SEEDANCE_VIDEO_PIPELINE_TASK.md`. This is the
build-order, file-by-file checklist plus the **verbatim agent prompts** and the
**Master Video Meta Prompt** so nothing is lost between planning and
implementation.

> Status: **not started.** Build in a dedicated follow-up task. Every item below
> is additive and back-compatible — no existing behavior changes.

## Architecture (layers)

```
System Meta Prompt  (reelDirector.MASTER_VIDEO_META_PROMPT)   ← cinematic engine, constant
      ↓
Brand Bible         (context source 'brand-bible')            ← swappable per client
      ↓
Film Bible          (filmBible.ts, accumulates continuity)    ← grows across boards
      ↓
Storyboard Rules    (StoryboardBoard, existing + lookback)    ← source of truth
      ↓
Scene Data          (Shot Director per-frame prompts)
      ↓
Audio Layer         (Voice Director + ElevenLabs; Music Director)
      ↓
Output              (Seedance clips via MUAPI → Supabase → reel)
```

Priority order (conflicts resolve top-down): **Storyboard → Brand → Voice →
Scene Notes → Camera → Music → general cinematic rules.** The storyboard always
wins.

## Build order (do in this sequence)

### Phase 0 — Env + data model (no behavior change)
- [ ] `.env.example`: add `MUAPI_API_KEY`, `MUAPI_BASE_URL`,
      `MUAPI_SEEDANCE_MODEL`, optional `MUAPI_POLL_TIMEOUT_MS`,
      `MUAPI_POLL_INTERVAL_MS`.
- [ ] `src/lib/mothermode/content/review.ts`: add additive fields
      (`StoryboardBoard.videoUrl/videoStatus/videoTaskId/seedancePrompt`,
      `StoryboardPack.filmBible/story/reelUrl/wrapper`), `ReelStory` type, and
      pure helpers `withFilmBible`, `withReelStory`, `withBoardVideo`. Extend
      `isEmptyReview` awareness only if needed (packs already counted).

### Phase 1 — Pure libs + tests (no network, TDD)
- [ ] `src/lib/mothermode/content/filmBible.ts` + `tests/lib/film-bible.test.ts`
      (`emptyFilmBible`, `mergeContinuity`, `continuityFromBoard`,
      `filmBibleToPromptBlock`).
- [ ] `src/lib/mothermode/content/reelDirector.ts` +
      `tests/lib/reel-director.test.ts` (`MASTER_VIDEO_META_PROMPT`,
      `REEL_WRAPPERS`, `NEGATIVE_PROMPT`, `buildSeedancePrompt` — assert
      priority order, wrapper diffs, negatives always present).

### Phase 2 — Integrations (server-only)
- [ ] `src/utils/integrations/muapi-seedance.ts` (`submitSeedanceRender`,
      `getSeedanceResult`, `renderSeedanceClip`).
- [ ] `src/utils/integrations/openai-reel.ts` (the seven agents).

### Phase 3 — API routes (admin-guarded, `nodejs`)
- [ ] Extend `src/app/api/mothermode/ai/route.ts`: actions `reel.story`,
      `reel.storyboard`, `reel.continuity`, `reel.shots`, `reel.voice`,
      `reel.music`.
- [ ] `src/app/api/mothermode/content/seedance/route.ts`: `POST` submit render,
      `GET ?taskId=` poll → download mp4 → `uploadVideoBuffer` → Supabase URL.

### Phase 4 — Brand Bible (context source)
- [ ] `context/types.ts`: add `'brand-bible'` kind.
- [ ] `src/lib/mothermode/brandbible/{types,store}.ts` (+ migration) or reuse the
      `skills` store from `CLAUDE_SKILLS_CONTEXT_TASK.md`.
- [ ] `context/fromBrandBible.ts` adapter + `resolve.ts` case + `sources.ts` list.
- [ ] `src/app/admin/brand-bible/` editor + `AdminSidebar` link.

### Phase 5 — Client + UI
- [ ] `aiClient.ts`: `aiRunStoryAgent`, `aiRunStoryboardAgent`,
      `aiRunContinuity`, `aiRunShots`, `aiRunVoiceDirector`, `aiRunMusicDirector`,
      `aiRenderSeedance` (submit + poll helper).
- [ ] `reviewClient.ts`: `setReelStory`, `setFilmBible`, `setBoardVideo`.
- [ ] `src/components/mothermode/content/ReelDirectorPanel.tsx` (4-step flow) +
      mount in `ContentHub.tsx` alongside `StoryboardPanel`/`VideoScriptPanel`.

### Phase 6 — Verify
- [ ] `pnpm exec tsc --noEmit` clean.
- [ ] `pnpm exec vitest run tests/lib/film-bible.test.ts tests/lib/reel-director.test.ts` green.
- [ ] Manual: idea → 4 boards → contact sheets → 1 Seedance clip → hosted URL.

---

## Master Video Meta Prompt (store as `reelDirector.MASTER_VIDEO_META_PROMPT`)

> You are an award-winning cinematic director, commercial filmmaker, storyboard
> interpreter, cinematographer, editor, and visual storyteller. Your job is NOT
> to invent stories. Your job is to faithfully transform a storyboard into a
> premium cinematic film while preserving the exact narrative, emotional
> progression, character continuity, and visual language. The storyboard is the
> source of truth. Every generated scene must feel as though it belongs inside
> the same film. Expand motion, realism, atmosphere, emotion, and camera language
> between storyboard frames without altering the intended story.
>
> **Inputs (use any subset; ignore missing; never fabricate):** storyboards,
> shot lists, moodboards, brand system, voiceover, music, scene notes, product
> info, camera references, aspect ratio, runtime.
>
> **Priority order:** 1 Storyboard, 2 Brand System, 3 Voiceover, 4 Scene Notes,
> 5 Camera Style, 6 Music, 7 General cinematic rules. If two instructions
> conflict, the storyboard always wins.
>
> **Storyboard interpreter:** treat every panel as a locked keyframe. Never
> reorder, skip, merge, or invent scenes, and never change emotional
> progression. Preserve scene order, camera progression, and continuity of
> character/lighting/environment/wardrobe/hair/age/emotion/time-of-day/visual
> escalation. Expand the movement *between* panels.
>
> **Motion expansion:** breathing, eye movement, blinking, micro-expressions,
> weight shifts, hair/fabric/hand movement, environmental reactions, lighting
> variation, natural pauses, momentum, camera settling. Nothing frozen or
> robotic.
>
> **Camera language:** premium movement — handheld intimacy, slow push-ins,
> slider, shoulder tracking, low-angle hero shots, close emotional portraits,
> wide establishing shots, natural operator imperfections, real lens inertia.
> Motion supports emotion; never random.
>
> **Cinematic realism:** everything photographed — natural skin, real
> imperfections, physical/motivated lighting, natural shadows, filmic contrast,
> organic depth of field, authentic reflections, real lens behavior. Never
> over-sharpen, oversaturate, or create AI plastic skin.
>
> **Transitions:** motivated only — match cuts, motion wipes, rack focus, whip
> pans, lens flares, foreground occlusion, natural cuts, action continuity.
> Avoid gimmicks.
>
> **Emotional arc:** start intimate, build tension, increase weight, reach
> payoff, allow breathing room. Never jump emotionally; earn every climax.
>
> **Environment & character continuity:** one connected world; perfect identity
> consistency (age, body proportions, hair, eyes, wardrobe, accessories, facial
> features, movement style, energy, expressions). No drift, no regeneration.
>
> **Performance:** actors, not subjects — micro reactions, thought before
> speech, natural eye focus, physical weight, authentic posture, subtle
> hesitation, real breathing, quiet moments.
>
> **Visual quality:** premium commercial / feature-film / luxury-brand /
> editorial realism; beautiful but restrained; never over-stylized or synthetic.
>
> **Brand injection:** if a Brand System is provided it becomes the visual and
> emotional filter over the storyboard **without changing the story** — inject
> visual identity, art direction, color/lighting philosophy, typography refs,
> emotional tone, subject styling, wardrobe language, editorial refs, camera
> behavior, composition rules, brand pacing/atmosphere/symbolism/emotion.
>
> **Audio (optional):** if voiceover exists, sync pacing to narration, allow
> visual pauses, never compete with dialogue, natural lip sync when speaking; if
> none, tell the story visually. If music exists, sync edits to emotional
> rhythm, respect crescendos, avoid music-video editing; if none, pace edits
> through cinematic timing.
>
> **Output goal:** a premium cinematic short film that feels professionally
> directed, emotionally authentic, visually cohesive, and unmistakably aligned
> with the supplied storyboard and brand system.

### `NEGATIVE_PROMPT` (always appended)
> storyboard borders, panel numbers, annotations, production notes, timing
> guides, arrows, contact sheets, text overlays, artificial smiles, plastic
> skin, hyper-saturated colors, cartoon motion, video-game animation, AI
> artifacts, scene hallucinations, random wardrobe changes, identity drift,
> environment drift.

### Wrappers (`REEL_WRAPPERS`)
- **`silent`** — master prompt + Storyboard + Brand only.
- **`music`** — adds music direction, edit rhythm, pacing synced to soundtrack.
- **`voice`** — adds voiceover script, lip-sync rules, pacing around narration.
- **`voice+music`** — all layers together (the "commercial" preset).

## MotherMode Brand Filter (seed the first `brand-bible` record)
- **Visual:** editorial intelligence, maternal warmth, modern minimalism,
  magazine-quality photography, natural women, real homes, quiet luxury,
  sophisticated simplicity, coffee-table editorial, generous negative space.
  Never influencer / Pinterest / Instagram-mom / stock. Women as protagonists,
  not ad subjects.
- **Color:** bone neutrals, deep charcoal, aubergine accents, warm natural
  daylight, muted interiors, rich shadows, premium editorial grade. Avoid
  oversaturation and pastels.
- **Emotion:** grounded, truthful, quiet confidence, emotional honesty, no
  forced smiles, calm authority, permission over persuasion — like an honest
  late-night conversation with someone who understands modern motherhood.

---

## Agent prompts (store in `openai-reel.ts`, one function each)

**1. Story Agent** — Award-winning commercial writer/creative director. Do NOT
write scene prompts. Create cinematic stories that become short-form videos.
Input: Brand System, Offer, Audience, Desired Reaction, Length, Platform.
Output: Story Title, Core Emotion, Hook, Story Arc (Beginning, Conflict,
Escalation, Breakthrough, Payoff), CTA. Then divide into exactly four storyboard
chapters (1–4), each with Purpose, Emotional State, Visual Goal, Transition. No
camera prompts, no lighting — only story.

**2. Storyboard Agent** — Hollywood storyboard artist. Convert the story into
four pages, each with exactly four cinematic frames. Per frame: Scene Number,
Shot Purpose, Visual Description, Character Action, Emotion, Camera Angle, Lens
Suggestion, Movement, Transition Into Next Frame. Return continuity info
separately. Never repeat prior descriptions; progress naturally.

**3. Continuity Agent** — Continuity supervisor. Read every storyboard, extract
everything that must stay consistent, return **JSON only**: characters
(hair/wardrobe/age/expressions), props, environment, lighting, weather, lens,
camera style, film grade, brand style, time of day, color palette. This object
is injected into every future scene (folded into the Film Bible).

**4. Shot Director** — Academy-Award cinematographer. Using Storyboard +
Continuity Object + Brand System, generate one premium cinematic video prompt
per frame. Expand motion naturally; never change continuity, invent characters,
or change environments; only evolve what exists. Each prompt reads as one
uninterrupted film.

**5. Voice Agent** — Create narration matching emotional pacing. No visuals, no
camera. Output: Voice, Pacing, Pause Timing, Emotion, Reading Speed, Final
Script. (Final Script feeds the existing ElevenLabs `voiceover/route.ts`.)

**6. Music Agent** — Cinematic music direction. Return Genre, Instrumentation,
Tempo, Energy Curve, Beat Timing, Transition Moments, Ending Resolution. Never
overpower narration; amplify emotion.

**7. Seedance Prompt Builder** — Receives Brand System → Continuity JSON →
Storyboard → Voice → Music → Camera Style → Scene Notes, and emits the final
Seedance prompt (delegates to `reelDirector.buildSeedancePrompt`, which prepends
`MASTER_VIDEO_META_PROMPT` and appends `NEGATIVE_PROMPT`).

## Film Bible (accumulating continuity object)

```jsonc
{
  "film":  { "title": "Motherhood, Redesigned", "genre": "Editorial cinematic documentary",
             "aspect_ratio": "9:16", "runtime": "30s" },
  "brand": { "visual_style": "Editorial intelligence, maternal warmth, unapologetic modernity",
             "color_palette": "Bone, charcoal, aubergine",
             "camera_language": "Slow handheld, intimate, observational" },
  "characters": [ /* id, hair, age, wardrobe, emotion … unioned across boards */ ],
  "locations":  [ /* id, location, weather, lighting … */ ],
  "camera_rules": [ /* appended, deduped */ ],
  "continuity":   [ /* appended, deduped */ ],
  "emotional_arc": ["Hook", "Recognition", "Release", "Invitation"]
}
```

Every new storyboard and every shot references the **Film Bible first**, then
the previous storyboard's `lookbackSummary`, then the current scene. This is the
"AI as real film director" differentiator: consistent characters, camera,
lighting, pacing, and brand identity across a whole reel series with the user
never thinking about continuity.

## Notes / gotchas
- Seedance render is async — the route submits then polls; keep `maxDuration`
  high and re-host the finished mp4 to Supabase (never hand the client a
  time-boxed MUAPI URL).
- Image-to-video needs a **public** start-frame URL — use the contact-sheet
  `imageUrl` already hosted by the GPT-Image render path.
- Keep `MASTER_VIDEO_META_PROMPT` a versioned constant; bumping it should be a
  visible diff, not a runtime string edit.
- Brand Bible clamps through the same `PACK_CHAR_CAP`/`TOTAL_CHAR_CAP` as other
  context packs, so a long brand doc won't crowd out the storyboard.
