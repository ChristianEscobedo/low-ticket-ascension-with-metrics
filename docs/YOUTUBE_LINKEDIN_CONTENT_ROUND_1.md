# YouTube + LinkedIn — Content Round 1 (paste into a fresh task)

**Goal:** Author the *first round* of real, platform-culture-specific content
pieces for the two newest channels — **YouTube long-form**, **YouTube Shorts**,
and **LinkedIn** — and wire them into the hub catalog. The plumbing (platform
union, labels/order/formats, sizes, brand icon, export adapters, and the
dedicated `YouTubePreview` / `LinkedInPreview` surfaces) already exists from
tasks #9 + #10 in `docs/CONTENT_HUB_NEXT_TASKS_2.md`. What is missing is the
**catalog copy itself** — there is no `youtube.ts` or `linkedin.ts` yet, and
`allContent` does not include them.

> Do this in **two commits** (YouTube, then LinkedIn). Run
> `npx tsc --noEmit -p tsconfig.json` + `npx vitest run` after each.

---

## Where content lives (the pattern to copy)

Each channel is its own file exporting a `ContentPiece[]`, all merged in
`src/lib/mothermode/content/index.ts` → `allContent`:

```
facebook.ts  → facebookContent
instagram.ts → instagramContent
x.ts         → xContent
tiktok.ts    → tiktokContent   (best reference for scripted video: hook, hooks[], media, script[])
pinterest.ts → pinterestContent
blog.ts      → blogContent
aeo.ts       → aeoContent
email.ts     → emailContent
ads.ts       → adsContent
```

Read `tiktok.ts` for the scripted-video shape (`hook`, `hooks[]`, `media`,
`script[]` beats, `caption`, `cta`, `hashtags`, `visual`) and `blog.ts` /
`facebook.ts` for the long-copy / feed-card shapes (`body[]`, `slides[]`).

### `ContentPiece` fields to use (see `src/lib/mothermode/content/types.ts`)
- `id` (unique, e.g. `yt-long-1`, `yt-short-1`, `li-feed-1`)
- `platform` (`'youtube'` | `'linkedin'`)
- `format` — **YouTube:** `'long'` (16:9 watch page) or `'reel'` (9:16 Shorts).
  **LinkedIn:** `'feed'` | `'carousel'` | `'article'` | `'video'`
  (from `PLATFORM_FORMATS` in `constants.ts` — do not invent new keys).
- `kind` (`'organic'`), `tone` (`'wedge'` | `'confidante'` | etc — match existing),
  `theme`, `title`, `hook`, `hooks[]` (2-3 variants)
- `media` `{ type, alt, aspect, hint, prompt }` — aspect `aspect-video`
  (`1280 x 720`) for `long`, `aspect-[9/16]` (`1080 x 1920`) for Shorts,
  `aspect-[1.91/1]` (`1200 x 627`) for LinkedIn feed, `aspect-[4/5]`
  (`1080 x 1350`) for LinkedIn document carousels. Reuse `IMAGE_STYLE`.
- `script[]` for video/long/reel; `slides[]` for carousels; `body[]` for
  article/long-form written description.
- `caption`, `cta`, `hashtags` (spread `CORE_HASHTAGS` where it fits the
  platform — keep LinkedIn hashtags professional/sparse), `visual`.

---

## Voice + audience rules (non-negotiable)

- **Global voice:** no em dashes, no NO-list words; every CTA routes back to the
  **$7 Brain Dump** front-end offer (`CONTENT_OFFER_URL`). Native, unpolished,
  human. (Same rules the other catalogs follow — see their file headers.)
- **YouTube culture:** search + watch-time driven. Long-form = a titled watch
  page with a strong title A/B, a real chaptered walkthrough, and a description
  with timestamps; Shorts = fast 9:16 hook-in-2s payoff loop like TikTok but
  YouTube-native. Audience is broad: overwhelmed mothers **and** working /
  career women who found the channel via search ("mental load", "how to stop
  carrying everything").
- **LinkedIn culture:** **founder's first-person POV.** She is the maker of the
  MotherMode app and writes as an operator sharing how *she* built and uses it.
  Audience = **career women and business women** (founders, execs, managers,
  professionals juggling a demanding role + home). Angle: the mental load is an
  invisible ops problem; she treats her own brain like a system. Tone is
  credible, specific, and quietly vulnerable — not mommy-blog. Reactions/metrics
  should read like a professional post (thoughtful comments, reposts).

---

## Deliverables — Round 1 piece list

### A. `src/lib/mothermode/content/youtube.ts` → `export const youtubeContent`

**Long-form (`format: 'long'`, `aspect-video`) — 2 pieces:**
1. `yt-long-1` — "The Mental Load Is an Operating System (Here's How I Empty
   Mine in 20 Minutes)". Chaptered `script[]` beats: Cold open / Why your brain
   won't quiet down / The weekly brain dump / Sorting the dump / Handing the
   load off / The $7 system. Description with timestamps in `body[]`.
2. `yt-long-2` — a working-woman angle: "Why High-Functioning Women Burn Out
   Quietly (and the 20-Minute Reset That Helped Me)". Same chaptered structure.

**Shorts (`format: 'reel'`, `aspect-[9/16]`) — 3 pieces:**
3. `yt-short-1` — "POV: 40 tabs open and none of them close" (hook-in-2s).
4. `yt-short-2` — "The invisible list you never agreed to carry."
5. `yt-short-3` — a career-woman Short: "You run projects at work. Nobody runs
   the one in your head." Each with a 5-beat `script[]` and a bio/link CTA.

### B. `src/lib/mothermode/content/linkedin.ts` → `export const linkedinContent`

All **founder POV**, career/business-women audience — one of each post type:
1. `li-feed-1` — text-forward **feed** post: "I built MotherMode because I was
   running a company and a household on the same overloaded brain." Story +
   lesson + soft $7 CTA.
2. `li-image-1` — single-image **feed** post (1200x627): a screenshot-style
   concept of her weekly brain dump with a one-line insight.
3. `li-carousel-1` — **document carousel** (`format: 'carousel'`, 4-5 `slides[]`,
   `aspect-[4/5]`): "5 signs the mental load is quietly running your career."
4. `li-article-1` — **article** (`format: 'article'`, cover image + `body[]`):
   "The invisible operations job every working mother is doing for free."
5. `li-video-1` — **video** (`format: 'video'`, `aspect-video`): founder
   talking-head with `script[]` on how she uses the app on a Sunday night.

> Aim for ~5 pieces per channel this round; keep IDs stable and unique.

### C. Wire into the catalog — `src/lib/mothermode/content/index.ts`

- `import { youtubeContent } from './youtube';`
- `import { linkedinContent } from './linkedin';`
- Add `...youtubeContent` and `...linkedinContent` to `allContent`, placed to
  match `PLATFORM_ORDER` (so `groupByPlatform` renders them in the right slot).

---

## Verification

- `npx tsc --noEmit -p tsconfig.json` clean.
- `npx vitest run` — pay attention to:
  - `tests/lib/content-export.test.ts` — if it asserts channel keys or per-piece
    export rows, adding YouTube/LinkedIn pieces may shift counts; update the
    expected channel-key map / counts for the new platforms if needed.
  - `tests/lib/platform-compliance.test.ts` — new copy must pass the voice pass
    (no em dashes, no NO-list words); fix any flagged lines.
- Manually open the hub → filter to YouTube and LinkedIn → confirm each piece
  renders in its dedicated preview (Shorts vertical, long-form watch page;
  LinkedIn feed / document pager / article / video), and that the founder POV
  reads correctly on LinkedIn.

---

## Notes / guardrails

- Do **not** touch the preview components or platform plumbing — this task is
  copy-only plus the one `index.ts` wiring change (and test-expectation updates
  if the export suite requires them).
- Keep the founder persona consistent across all LinkedIn pieces (same voice,
  same "I built this / I use this" framing). If a founder name/handle already
  exists in `previews/shared.tsx` (`DISPLAY_NAME`), reuse it; otherwise keep it
  generic and first-person.
- One channel per commit; run tsc + vitest between.
