# Hook Bank — Phase 3 Task: the AI reaction sheet

Status: **PLANNED** (phases 1 + 2 shipped — see `HOOK_BANK_SYSTEM_PORT.md`).
This is the build spec for the next session.

## The idea

The differentiator. A **hook sheet** = a twin's character sheet + a reaction
preset, rendered through the existing clone/Seedance pipeline into an on-brand
1-2s reaction clip of the SAME character the content features. Nobody else's
meme folder has your person in it. For the audience, the "relative but
extreme" version writes itself: 1.5s of chaos (kids, laundry avalanche,
kitchen on fire-ish) → hard cut → calm avatar.

## What's already in place (do not rebuild)

- `mothermode_hook_clips` carries `source='generated'` + `sheet_ref` for
  exactly this. The bank, the beat-0 mount, and the vault mirror already treat
  a generated hook like any other.
- The clone pipeline (`src/lib/mothermode/reel/clone.ts`, `cloneGenerate.ts`,
  `/api/admin/reel-clone-generate`) already turns a character sheet + prompt
  into a clip. The AI Twins foundry (`/admin/ai-twins`, `SheetStudio.tsx`)
  already produces the sheet.
- `CloneCastPicker.tsx` already picks a cast member inside the content hub —
  reuse its pick shape.

## Build

1. **Reaction presets** — a small registry in `hookBank.ts` (or a new
   `hookReactions.ts`): each preset is a prompt fragment + a default duration
   (1-2s) + the reaction it maps to. e.g. `mind-blown` → "eyes widen, slow
   lean toward camera, subtle head shake", `wait-what` → "double-take, brow
   furrow, freezes mid-motion", `pointing` → "looks off-screen left, points,
   eyebrows up". 6-8 presets covering the reaction taxonomy.
2. **Generate route** — `POST /api/admin/hook-generate` { sheetRef, preset,
   note? } → builds the prompt from the preset + the sheet's look, calls the
   existing clone-generate path, and on completion ingests into the bank with
   `source='generated'`, `sheetRef`, the mapped `reaction`, `rights='owned'`
   (it's your twin — always owned), and the probed duration. Mirror to the
   vault like any ingest.
3. **The sheet UI** — a "Generate" tab in the Add sheet (next to Upload |
   Fetch & clip): pick a twin (CloneCastPicker), pick a reaction preset, an
   optional steer line, Generate. Poll the clone job, preview, save.
4. **Studio surface** — the split-screen reaction layout (reaction on the
   bottom third, content on top) is already unlocked by
   `/api/admin/reel-splitscreen`. When a generated hook mounts, offer the
   split-screen toggle in the studio.

## Guardrails

- Generated hooks are `rights='owned'` by construction (your twin, your
  likeness) — they pass `paidSafeHooks` and can go straight into ads.
- Keep the reaction taxonomy the prompt's spine: the preset's prompt fragment
  IS the reaction, so the bank's filter chips stay honest.
- `sheet_ref` is the provenance — a generated hook always traces back to the
  twin that made it.

## Verify

- `npx tsc --noEmit` clean.
- A generated hook lands in the bank with `source='generated'` + `sheetRef` +
  `rights='owned'`, mirrors into the vault, and mounts as beat 0.
- The preset registry covers every `HookReaction` value (or explicitly
  documents the gap).
