# Video Voiceover (ElevenLabs) Port

One-click **ElevenLabs voiceover** for Video production — generate spoken audio
for a script as **one combined track** (with per-beat timing marks) or **one
clip per beat** (section-aligned). It reuses the existing `VideoScript` beats +
`review` store and the same Supabase bucket as video/images, so the feature is
mostly *wiring a TTS call into the script panel* rather than a new subsystem. It
is **additive and back-compat** — no new store, no DB migration.

## How it fits what already exists

- **`VideoScriptPanel`** generates a `VideoScript` — contiguous **beats** over
  `0..totalSeconds`, each with an exact `voiceover` line, shot/on-screen, and
  b-roll prompt. Beats persist on `review.videoScript` (`VideoScript`).
- **`uploadVideoBuffer`** already hosts the final cut in a public Supabase
  bucket; **`reviewClient`** already exposes pure setters
  (`setReviewVideoScript`, `setReviewVideo`) that patch the `review` store.
- So the voiceover flow feeds beat VO text to ElevenLabs, uploads the resulting
  mp3 to the **same bucket**, and writes the URL(s) back onto the same
  `review.videoScript` the panel already reads.

## The timing problem: keeping beats in sync

ElevenLabs returns **raw MP3 with no per-line markers**, so a naive call loses
the beat timing the script planned. The fix is the
**`/text-to-speech/{voice}/with-timestamps`** endpoint, which returns the audio
**plus a character alignment array** (`characters`, `character_start_times_seconds`,
`character_end_times_seconds`). From that alignment we recover timing:

- **Combined track:** concatenate all beat VO into one string with a consistent
  joiner, recording the **character offset** where each beat starts. Mapping each
  offset → its start time in the alignment yields per-beat **time marks**
  (`{ index, startSec, endSec }`) inside the single file. Each mark is compared
  to the script's planned window to surface **drift**
  (e.g. "beat 3 starts 9.4s, script says 9.0s"). Drift is **reporting-only** —
  the natural audio is never padded.
- **Per-section:** one clip per beat; the alignment's **last** end time is the
  clip's exact duration, shown next to the beat's window
  ("VO 3.2s / 3.0s window"). Inherently section-aligned.

Both paths always use `with-timestamps` so durations/marks are reliable either
way.

## Changes (small, additive, back-compat)

### 1. `.env.example` — ElevenLabs keys
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (optional default voice),
  `ELEVENLABS_MODEL_ID` (optional, default `eleven_multilingual_v2`).

### 2. `src/utils/integrations/elevenlabs.ts` — server-only client (new)
- `generateSpeechWithTimestamps(text, { voiceId, modelId, stability, similarityBoost, style })`
  → `{ audioBase64, mimeType, alignment }` (POSTs to the `with-timestamps`
  endpoint).
- `listVoices()` → `{ id, name }[]` for the picker.
- Reads keys from env; throws clear, user-facing errors when unconfigured so the
  route can return a clean 400.

### 3. `src/utils/mothermode/storage.ts` — host audio
- `ALLOWED_AUDIO_MIMES` (`audio/mpeg`, `audio/mp3`) +
  `uploadAudioBuffer(buffer, mime, folder = 'mothermode-audio')` → hosted public
  URL, mirroring `uploadVideoBuffer` (same bucket, same signing).

### 4. `src/lib/mothermode/content/voiceover.ts` — pure timing math (new)
Server-safe, no browser/network imports, fully unit-testable.
- `buildCombinedVoText(beats)` → `{ text, offsets[] }` — joins trimmed beats with
  a consistent joiner and records each beat's start **character offset** (empty
  beats preserved to keep index alignment).
- `alignmentDurationSec(alignment)` → the last `character_end_times_seconds`
  entry (0 for empty alignment).
- `beatMarksFromAlignment(offsets, alignment)` → contiguous per-beat
  `{ index, startSec, endSec }` windows; offsets past the alignment length are
  clamped.
- `beatDriftSec(actualStartSec, plannedStartSec)` → signed drift (positive = VO
  lands later than planned).

### 5. `src/lib/mothermode/content/review.ts` — additive types + helpers
- `VideoScriptBeat` gains optional **`voiceoverAudio?`** and
  **`voiceoverDurationSec?`** (per-section clips). All optional → existing scripts
  unchanged.
- New **`VideoScriptVoiceover`** on `VideoScript.voiceover?`:
  `{ audioUrl; durationSec; mode: 'combined' | 'sections'; beatMarks?: { index; startSec; endSec }[]; voiceId?; model?; generatedAt? }`.
- Pure helpers **`withVoiceover`** / **`withoutVoiceover`** patch the script
  immutably.

### 6. `src/components/mothermode/content/reviewClient.ts` — store setters
- **`setReviewVoiceover`** / **`clearReviewVoiceover`** for the combined track.
  Per-beat clips reuse the existing `setReviewVideoScript` (they live on beats).

### 7. `src/app/api/mothermode/content/voiceover/route.ts` — API (new, `nodejs`, admin-guarded)
- Body: `{ mode: 'combined' | 'sections', beats: { index; text }[], voiceId?, modelId?, stability?, similarityBoost?, style? }`.
- **combined:** `buildCombinedVoText` → one `with-timestamps` call →
  `uploadAudioBuffer` → `beatMarksFromAlignment` + `alignmentDurationSec` →
  `{ audioUrl, durationSec, beatMarks, voiceId, model, generatedAt }`.
- **sections:** loop beats → one call each → upload each mp3 →
  `{ clips: [{ index, url, durationSec }] }`.
- `GET` returns `listVoices()` for the picker.
- Returns a clear **400** when ElevenLabs isn't configured.

### 8. `src/components/mothermode/content/aiClient.ts` — client wrappers
- **`aiGenerateVoiceover(args)`** and **`aiListVoices()`** around the new route,
  plus the exported **`AiVoice`** type.

### 9. `src/components/mothermode/content/VideoScriptPanel.tsx` — the new UX
When a script exists, a **"Voiceover (ElevenLabs)"** card appears with:
- a **voice picker** (loaded from `listVoices` on mount, seeded from any saved
  `voiceover.voiceId`) with a **manual voice-ID** override, a **model** select
  (multilingual v2 / turbo v2.5), and compact **stability/style** sliders,
- **"Generate one track"** (combined) — posts all beats, writes the result with
  `setReviewVoiceover`, then renders a single `<audio>` player, a **timeline
  strip** of beat marks with **drift badges** (`beatDriftSec` vs each beat's
  planned start), plus download + clear,
- **"Generate per beat"** (sections) — posts all beats, maps the returned clips
  onto beats via `setReviewVideoScript`,
- a per-beat **play + regen** control inside each beat row showing actual VO
  duration vs the beat window.

## Design choices

- **Default model = `eleven_multilingual_v2`** (natural); `eleven_turbo_v2_5`
  exposed as the fast option.
- **Audio hosted in Supabase** (same bucket as video/images) → public URL,
  consistent with the rest of the hub, so `<audio src>` and download "just work".
- **Both modes always use `with-timestamps`** so durations/marks are reliable in
  either path.
- Combined-track drift is **reporting-only** (keeps ElevenLabs output natural;
  no forced silence padding).
- Voiceover **reuses `review.videoScript`** (combined on `.voiceover`, per-beat
  on the beats) — **no new store, no DB migration**.

## Tests

`tests/lib/voiceover.test.ts` covers the pure timing math (10 tests):
- `buildCombinedVoText`: joins beats with the joiner and records start offsets;
  trims each beat but preserves empty beats for index alignment; handles a single
  beat with no joiner.
- `alignmentDurationSec`: returns the last character end time; 0 for empty.
- `beatMarksFromAlignment`: maps offsets to contiguous per-beat windows; clamps
  offsets past the alignment length; zeroed marks for an empty alignment.
- `beatDriftSec`: positive when VO lands later than planned; negative when
  earlier.

Run:

```
npx vitest run tests/lib/voiceover.test.ts
```

## Env setup

```
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # optional default voice
ELEVENLABS_MODEL_ID=eleven_multilingual_v2 # optional default model
```

## Files touched

- `.env.example` — ElevenLabs keys.
- `src/utils/integrations/elevenlabs.ts` — server-only TTS client (new).
- `src/utils/mothermode/storage.ts` — `ALLOWED_AUDIO_MIMES` +
  `uploadAudioBuffer`.
- `src/lib/mothermode/content/voiceover.ts` — pure timing math (new).
- `src/lib/mothermode/content/review.ts` — beat VO fields, `VideoScriptVoiceover`
  type, `withVoiceover`/`withoutVoiceover`.
- `src/components/mothermode/content/reviewClient.ts` — `setReviewVoiceover` /
  `clearReviewVoiceover`.
- `src/app/api/mothermode/content/voiceover/route.ts` — combined/sections +
  voices route (new).
- `src/components/mothermode/content/aiClient.ts` — `aiGenerateVoiceover`,
  `aiListVoices`, `AiVoice`.
- `src/components/mothermode/content/VideoScriptPanel.tsx` — voiceover card,
  combined timeline + drift badges, per-beat play/regen.
- `tests/lib/voiceover.test.ts` — timing-math unit tests.


