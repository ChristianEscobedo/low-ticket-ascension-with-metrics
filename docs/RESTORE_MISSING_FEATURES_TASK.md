# RESTORE MISSING FEATURES — Task Doc

**What's missing:** Research agent functionality, skills, experts, recipes, content hub, prompt bank, asset hub, high ticket features. These DON'T exist in the current working tree at `f097480`.

**Where it went:** Commit `d1ebce4` has "huge updates on agents research recipes skills before adding video timeline" — that's the research agent functionality. But `d1ebce4` is NOT in HEAD's history. It's on a different branch or was never merged into main.

**Current state:**
- `f097480` is the current HEAD (main branch)
- The render worker is live on Railway (Remotion caption rendering works)
- The reel-studio editor works (RemotionPreview wired into the stage)
- But the research/content hub/prompt bank features are GONE

---

## What to do

### 1. Find the branch with the features

```bash
# Find which branch has d1ebce4
git branch --contains d1ebce4

# Or find all branches with the research files
git log --all --oneline -- src/lib/mothermode/research
```

### 2. Restore the features

**Option A: Merge the branch**
```bash
git checkout main
git merge <branch-with-d1ebce4>
```

**Option B: Cherry-pick the specific commits**
```bash
git checkout main
git cherry-pick d1ebce4
```

**Option C: Restore specific directories from d1ebce4**
```bash
git checkout d1ebce4 -- src/lib/mothermode/research
git checkout d1ebce4 -- src/app/admin/research
git checkout d1ebce4 -- src/app/admin/recipes
git checkout d1ebce4 -- src/app/admin/skills
git checkout d1ebce4 -- src/app/admin/experts
git checkout d1ebce4 -- src/lib/mothermode/content/promptBank.ts
git checkout d1ebce4 -- src/components/mothermode/content
```

### 3. Resolve conflicts

The render worker (`render-worker/`) and Remotion caption rendering are NEW features added AFTER `d1ebce4`. Merging `d1ebce4` might conflict with these. Keep the render worker and Remotion caption rendering — they work.

### 4. Verify the build

```bash
pnpm run build
```

### 5. Push

```bash
git push origin main
```

---

## What's currently working (don't break these)

| Feature | Status |
|---------|--------|
| Remotion caption rendering (RemotionPreview + CaptionLayer + buildRenderPlan) | ✅ Working |
| Render worker (Railway Docker container) | ✅ Live |
| Reel-studio editor (Remotion toggle in the stage) | ✅ Working |
| ffmpeg resolver (linux-x64 binary + pnpm walk) | ✅ Fixed |
| next.config (serverComponentsExternalPackages) | ✅ Fixed |

## What's missing (restore these)

| Feature | Where it went |
|---------|---------------|
| Research agent (research lab, chat, evidence, experts) | `d1ebce4` |
| Skills (agent skills, HTTP tools, breaker) | `d1ebce4` |
| Experts (research, strategy, copy, lead magnets, email, design, compliance, analyst) | `d1ebce4` |
| Recipes (16 plays, the expert crew, Plays rail) | `d1ebce4` |
| Content hub (generated content, prompt bank, amplify, variation lab) | `d1ebce4` |
| Prompt bank (1000+ prompts, test lab, actions) | `d1ebce4` |
| Asset hub (offer systems view, media library) | `d1ebce4` |
| High ticket (high ticket kit, call scripts) | `d1ebce4` |

## The layout issue

The reel-studio page is LIGHT-themed when it should be dark (`bg-ink` background, `text-bone` text). The `(fullscreen)/layout.tsx` might not be applying the dark background, OR the page.tsx's root element doesn't have the dark class. Check `src/app/(fullscreen)/layout.tsx` and `src/app/(fullscreen)/admin/reel-studio/page.tsx` for the dark background classes.

## The caption rendering issue

The Remotion render worker rendered the video but the captions aren't showing. Possible causes:
1. The plan's `words` array is empty (no captions transcribed — hit CC on a clip first)
2. The `captionStyle` or `captionLayout` isn't being passed correctly to the worker
3. The CaptionLayer isn't rendering (check the worker logs on Railway)

## Files to check

- `src/app/(fullscreen)/admin/reel-studio/page.tsx` — the editor (has the Remotion toggle)
- `src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx` — the preview component
- `render-worker/server.js` — the Railway worker
- `render-worker/remotion-project/` — the composition (same as the preview)
- `src/lib/mothermode/reel/render/plan.ts` — buildRenderPlan
- `src/lib/mothermode/reel/captions.ts` — caption functions

## Commits (current state)

| Commit | What |
|--------|------|
| `f097480` | Current HEAD — render worker + Remotion caption rendering + constants.ts fix + tsconfig exclusion |
| `7b924bf` | Make render-worker self-contained + lazy Supabase client |
| `0f81df2` | Add render-worker/package-lock.json |
| `357b421` | Fix Dockerfile paths (relative to render-worker build context) |
| `3b8bb4a` | Copy remotion-project into render-worker/ |
| `0ca8e72` | Fix next.config key + remove ffmpeg-static fallback |
| `50b3b90` | Wire RemotionPreview into the stage |
| `4c675f4` | Create RemotionPreview component |

## Docs (already written)

- `docs/RENDER_WORKER_RAILWAY_SETUP.md` — complete Railway deploy guide
- `docs/CAPTION_RENDERING_REMOTION_PORT.md` — complete port doc on all caption updates for rendering
- `docs/REMOTION_ONLY_RENDER_HANDOFF.md` — the original handoff doc
- `src/lib/mothermode/help/seedContent/changelog.ts` — changelog entry `1.9.0`

## The user's frustration

The user is extremely frustrated with the crashes and the missing features. They want everything restored. The render worker and Remotion caption rendering are NEW features that work — don't break them. The research/content hub/prompt bank features are OLD features that were lost — restore them from `d1ebce4`.
