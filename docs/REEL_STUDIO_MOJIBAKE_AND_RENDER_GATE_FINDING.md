# Finding: the `???` glyphs and the "Not configured" render gate

Investigated after the restore merge (`e1f00af`). Three separate problems were
tangled together under "the preview is broken." They have different causes and
different fixes. None of them is a regression from the merge.

---

## 1. The `???` glyphs — the file was born this way

**Nothing was lost in the merge.** I walked the full git history of
`src/app/(fullscreen)/admin/reel-studio/page.tsx` (`scripts/find-clean-reel-studio.cjs`):

```
 bad  50b3b90aa  glyph=368 emoji=25  Wire RemotionPreview into the stage
 bad  4c675f448  glyph=368 emoji=25  Add RemotionPreview component
 bad  280a71f15  glyph=368 emoji=25  Reel Studio: Clipping Studio page   <-- first commit
```

Only three revisions have ever touched this file, and **all three are corrupt,
identically, including the very first one.** There is no clean version to
restore. The file was written through a non-UTF-8 encoding at the moment it was
first created and committed that way. The restore merge did not cause this and
`git reset --hard backup/pre-restore-main` will not fix it.

### Why `scripts/repair-mojibake.cjs` fixes zero of them

I ran it. It reports `0 dots + 0 glyphs, 99 left for review`. Its rules were
written against a much narrower guess at the damage and none of them match.

More importantly, **the damage is lossy and cannot be fully automated.** Every
byte of a multi-byte character became a literal `?`, so run length is all that
survives:

| run | original was | recoverable? |
|-----|--------------|--------------|
| `??` | `·` — but also the real `??` operator | only from a literal whitelist |
| `???` | one of `—` `→` `…` `•` | **ambiguous — 4 candidates, 1 clue** |
| `????` / `??????` | an emoji, ~any of thousands | no |

A `???` in `Write a comment???` is obviously `…`; a `???` in
`['???', 'Share']` is a share icon and could be any of several glyphs. There
are ~99 of the former kind and 25 emoji. Guessing at all of them and calling it
"repaired" would quietly put wrong characters in your UI, which is worse than
the current visible breakage — at least `???` is obviously wrong.

**Recommendation:** this needs one focused pass where each glyph is decided
deliberately, most of them from surrounding context (`Share`, `Like`, `Repost`
labels make the intent clear), and the emoji chosen fresh rather than
"restored." That is a real chunk of work on a 7,388-line file and I did not want
to rush it at the end of a long session. It is cosmetic — it does not affect
rendering.

---

## 2. "Not configured" on the render button is correct behavior, not a bug

```
.env.local:  RENDER_WORKER_URL -> PRESENT BUT EMPTY
```

The key exists but has no value. The UI reads that as "no worker" and disables
the button. **This is the code working as designed.** No amount of editing
`RenderPanel.tsx`, `plan.ts`, or the route will turn this button on, because
there is nothing on the other end of it to call.

The worker is real and complete — it lives in `render-worker/` with its own
`Dockerfile` and `server.js`. It has simply never been deployed. The steps are
already written up in `docs/RENDER_WORKER_RAILWAY_SETUP.md`. Once it is running
on Railway, set `RENDER_WORKER_URL` to its public URL and the button lights up.

This is a deploy/ops task, not a coding task. It has probably looked like a code
bug for a while because the symptom shows up in the UI.

---

## 3. Why captions have no animation — likely the same root cause

```
.env.local:  ASSEMBLYAI_API_KEY -> ABSENT
```

The earlier task doc guessed that the render plan's `words` array is empty, and
this is the most likely reason why. Word-level timing is what AssemblyAI
returns; karaoke highlighting and per-word animation in `CaptionLayer.tsx` are
driven entirely by that array. With no API key there is no transcription, so
there are no word timings, so the captions render as static text — exactly the
symptom described.

That makes the fix order matter:

1. Set `ASSEMBLYAI_API_KEY`, re-run transcription, and confirm `words` is
   actually populated in the plan.
2. **Only then** judge whether `CaptionLayer.tsx` / `ReelComposition.tsx` have a
   real animation bug.

Changing the caption components before step 1 means debugging animation code
that is being handed nothing to animate. I deliberately did not touch them.

---

## Summary

| Item | Cause | Fix |
|---|---|---|
| `???` glyphs | file committed in wrong encoding at creation; no clean revision exists | one careful manual pass; ~99 glyphs + 25 emoji, cosmetic only |
| "Not configured" | `RENDER_WORKER_URL` empty; worker never deployed | deploy `render-worker/`, set the URL — ops, not code |
| No caption animation | `ASSEMBLYAI_API_KEY` absent → no word timings → empty `words` | set the key, verify `words`, *then* look at the components |

Two of the three are configuration, not code. That is worth knowing before more
time goes into editing the render pipeline.
