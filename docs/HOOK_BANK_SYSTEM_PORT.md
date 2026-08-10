# Hook Bank — System Port

Status: **phase 1 built** (bank + beat-0 mount + vault mirror). Fetch-and-clip
and AI-sheet generation are the planned next phases.

Tests: `npx vitest run tests/lib/hook-bank.test.ts` (10 passing).

---

## What it is

A tagged, scored library of 0.5-3s **opening clips** — character reactions,
meme intros, "relative but extreme" pattern interrupts — that mount as **beat
0** on the reel timeline. The first ~1.5s decides the scroll; the hook plays,
then the content starts on a hard cut. That contrast is the interrupt.

Admin: `/admin/hook-bank` (sidebar: **Hook Bank**).

## The three sourcing paths (the roadmap)

1. **Upload** (BUILT) — drag a clip in, tag the reaction it triggers and the
   rights, it lands in the bank and in the studio's vault rail.
2. **Fetch & clip** (PLANNED) — paste a TikTok/IG/YT link; the Railway worker
   (yt-dlp + ffmpeg, already deployed) downloads it and the existing
   sceneCuts/silence/hookScore propose the punch cut. Runs on the worker, NOT
   Vercel — social platforms IP-block serverless.
3. **AI-generated reaction** (PLANNED) — a hook sheet = the twin's character
   sheet + a reaction preset (mind-blown, "wait—what", pointing at screen),
   rendered through the existing clone/Seedance pipeline into an on-brand
   1-2s reaction clip of the SAME character as the content. `sheet_ref`
   already carries the provenance.

## Data model

`mothermode_hook_clips` (migration `20261203000000_hook_bank.sql`):

| column | why |
|--------|-----|
| `source` | uploaded \| fetched \| generated |
| `reaction` | what the first second should make the viewer feel (shock, laugh, confusion, satisfaction, relatability, chaos, curiosity, awe) |
| `rights` | owned \| licensed \| meme-fair-use \| unknown — drives the **paid-safe** filter (only owned+licensed go in ads) |
| `hook_score` | 0-100 hold score; null until scored. The leaderboard (`rankHooksByScore`) ranks on it — manual now, metric-derived from ad stats later |
| `sheet_ref` | the clone sheet that generated it |
| `sprite_url`, `duration_sec`, `tags`, `notes` | card + grid |

## Files

```
supabase/migrations/20261203000000_hook_bank.sql

src/lib/mothermode/reel/hookBank.ts     # types, mappers, store, beat-0 mount,
                                        # leaderboard, paid-safe filter, vault mirror
src/app/api/admin/hook-bank/route.ts    # GET list + POST ingest/patch/delete
src/app/admin/hook-bank/page.tsx        # grid, upload sheet, reaction/rights/search
                                        # filters, paid-safe toggle, preview
src/app/admin/AdminSidebar.tsx          # nav entry

tests/lib/hook-bank.test.ts             # 10 tests: mount, mappers, leaderboard
```

## How it reaches the timeline

Two ways, both already live:

- **The beat-0 mount** (`hookToReelClip` + `mountHookOnClips`): a hook IS a
  `ReelClip` with id `hook-<id>` prepended to `project.clips`. The render
  plan's hard cut between clip 0 and clip 1 does the interrupt — no
  render-engine change. `mountHookOnClips` is idempotent (re-mounting the same
  hook never stacks it); `unmountHookFromClips` / `mountedHookId` manage it.
- **The vault mirror** (`syncHookToVault`, called on ingest): the hook also
  registers into the clipping vault as a `reaction` asset, so it shows up in
  the reel studio's **existing** vault rail (the picker `insertVaultHook`
  mounts from) with no studio UI change. Rights map onto vault provenance via
  `hookVaultSource` (owned→mine, licensed→licensed, meme/unknown→
  reference-only — a fetched meme never claims ownership). Best-effort: a
  vault miss never fails the bank write.

## Notes for the next session

- **Hook score is manual in phase 1.** The leaderboard ranks on it, but the
  metric join (hook → per-link ad hold/CTR) is the phase-4 leaderboard. The
  `hook_score` column and `rankHooksByScore` are ready; wire the ad-metrics
  rollup to write it.
- **Split-screen reaction format** is already unlocked by the existing
  `/api/admin/reel-splitscreen` endpoint — reaction clip on the bottom third,
  content on top. That's the highest-performing hook layout; surface it in the
  studio when the AI sheet lands.
- **Rights discipline**: `paidSafeHooks` is the guard for paid placements.
  Fetched clips default to `unknown`; keep the paid-safe filter on in the
  studio mount path for anything going into an ad.
- **Fetch & clip runs on the Railway worker.** Reuse the render-worker's
  yt-dlp/ffmpeg and the clipping-vault cutdown (`/api/admin/reel-cutdown`).
  Do not attempt the download on Vercel.
