# Preview: caption drag + realistic platform glyphs

Two confirmed regressions in Reel Studio's preview, both scoped, neither started.
Written at the end of a session that ran out of context — do these first in a fresh window.

## 1. Captions can no longer be dragged on the preview canvas

**Was:** captions could be grabbed and moved anywhere directly on the preview canvas.
**Now:** gone. Position is only settable through the side panel, if at all.

Likely cause: the drag handler lived in the preview component and did not survive the
`d1ebce4` merge, or it survived but is no longer wired to the caption layer. The merge
resolved 3 files as a union; `RemotionPreview.tsx` was NOT one of them, so if the drag
code came in on the restored side it may simply never have been re-attached.

Files to read first:
- `src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx` — the canvas + Player host
- `render-worker/remotion-project/CaptionLayer.tsx` — how caption position is consumed
- `src/lib/mothermode/reel/captions.ts` and `types.ts` — is there an x/y or anchor field?
- `src/lib/mothermode/reel/render/plan.ts` — does the plan carry the position through?

Check git history for the handler before rewriting it:
`git log --oneline --all -- src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx`
`git show d1ebce4 -- src/app/\(fullscreen\)/admin/reel-studio/RemotionPreview.tsx`

Key requirement: the dragged position must round-trip to the render. A drag that only
moves the preview and is ignored by `buildRenderPlan` is worse than no drag at all —
it silently lies about the output. Verify the position field is read by the plan AND by
`CaptionLayer` in the worker's Remotion project, not just the browser preview.

Do NOT change the Remotion Player's built-in play/settings controls. Confirmed as wanted.

## 2. Platform / publish view uses "old skool glyphs"

**Was/should be:** platform representations as close to the real thing as possible.
**Now:** ASCII or emoji-ish text glyphs that look dated.

Start at:
- `src/lib/mothermode/planner/platformGlyph.ts` — almost certainly the source of the glyphs
- `src/components/mothermode/planner/PublishBadges.tsx` — renders them
- `src/lib/mothermode/content/platformSizes.ts` — real per-platform dimensions
- `src/components/mothermode/content/previews/TikTokPreview.tsx` and `FacebookPreview.tsx`
  — these already exist and may be the "realistic" pattern to extend to other platforms

Prefer inline SVG brand marks over an icon font or emoji: they stay crisp at any size,
theme correctly, and don't depend on the host OS's emoji set (which is why the current
ones probably look different on your machine than they did originally). Note there is
an `docs/ICON_REGISTRY_SYSTEM_PORT.md` — check whether a registry already exists before
adding a parallel one.

## Still open from earlier, unrelated to the above

- Light-theme / layout regression.
- Captions not rendering animations or respecting platform sizing. The standing
  hypothesis is that the plan's `words` array is empty — verify against
  `render/plan.ts`, `CaptionLayer.tsx`, `ReelComposition.tsx` BEFORE changing anything.
- Simplify the render button.
- Thumbnail failures: cause still unconfirmed. `/api/admin/reel-thumbnail` now returns
  503 for a config problem and 502 with real ffmpeg stderr for a per-clip problem.
  One request tells you which.

## Safety net

`git reset --hard backup/pre-restore-main` reverts the whole restore.
Current HEAD after this session's fixes builds clean: `npx tsc --noEmit` → 0 errors.
