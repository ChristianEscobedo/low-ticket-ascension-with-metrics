# Caption Editor FX + Draft Render — Port

## Status
Batch 1 + Batch 2 landed.

## Batch 1 (this session)
- **Gradient black-in-render fix**: dual-layer wire restored — `renderGradientWord` paints solid shadow under clipped gradient fill (Remotion/Chromium silhouette bug).
- `--caption-grad-shadow` set from `captionCssFor` for every gradient fill.
- **Draft quality**: `draft | 720 | 1080` — draft = scale 0.5 + ultrafast/crf28 mezzanine.
- **Worker `GET /warm`**: keep-alive for Railway.
- **Studio**: `keepWorkerWarm` pings every 4 min while Reel Studio is open.
- Async queue already exists (`POST /render` → job id → poll `GET /render/:id`).

## Batch 2+ (effects backlog)
Frame-driven only (no CSS animation clocks):

| Effect | Notes |
|--------|--------|
| Type-on / mask reveal | clip-path or width wipe per word |
| Glow pulse / neon flicker | opacity/shadow sine on active |
| 3D tilt / perspective pop | rotateX/Y + perspective on entrance |
| Motion-blur trails | stacked opacity echoes offset by velocity |
| Growing background pill/bar | scaleX from word start |
| Emoji/sticker burst | keyword map + pop scale |
| Sound-reactive bounce | waveform amp → translateY |
| Camera punch-in | block scale keyed to page start |
| Split-color / dual-tone | two half fills or per-letter colors |
| Outline → fill | stroke then fill opacity |
| Spring bounce exits | overshoot scale on page out |
| Cinematic letterbox + rise | bars + caption y |
| Glitch / RGB split | short chromatic offset |
| Hand-drawn underline/circle | SVG path length |
| Number tick-up | parse digits, interpolate |
| Editor packs | MrBeast / faceless / luxury / podcast one-click stacks |

## Files
- `src/lib/mothermode/reel/render/captionLayer.tsx` (+ vendored worker copy)
- `src/lib/mothermode/reel/captions.ts`
- `render-worker/server.js`
- `src/app/(fullscreen)/admin/reel-studio/useRenderJob.ts`
- `src/app/(fullscreen)/admin/reel-studio/RenderPanel.tsx`
- `src/app/(fullscreen)/admin/reel-studio/page.tsx`

## Verify
```bash
node scripts/sync-vendored-captions.cjs
pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts
```

Pick **Draft** in Render panel for fast iteration; **1080** for final.


## Batch 3 (systematic)
- Full `CAPTION_ANIMS` list restored (incl. slam, tilt3d, outlineFill, dualTone, motionTrail, tickUp, …)
- Gallery **Entrance anim** chip row + **Highlight** mode chips (boxGrow = growing pill)
- **Wave bounce** blockFx (uses `plan.audioPeaks` when present, else sine)
- **Hand-drawn** underline / circle (SVG pathLength draw-on)
- `RenderPlan.audioPeaks?: number[]`
- Editor pack MrBeast sets `punchIn: true`

## Deploy + smoke checklist
1. Redeploy **Railway render worker** (captions + captionLayer vendored).
2. Confirm `NEXT_PUBLIC_RENDER_WORKER_URL` points at worker (studio /warm).
3. Reel Studio smoke:
   - [ ] Gradient preset → **Draft** render → colors match canvas (not black)
   - [ ] Ghost fade On → full ON hold OFF
   - [ ] Editor pack Faceless / MrBeast
   - [ ] Entrance anim: typeOn, tilt3d, slam
   - [ ] Highlight: boxGrow (pill grows)
   - [ ] Draw underline / Draw circle on active word
   - [ ] Punch-in + Letterbox + Spring exit + Wave bounce
   - [ ] Final **1080** render of one short clip
4. If worker OOM: stay on Draft/720 or upgrade Railway RAM.
