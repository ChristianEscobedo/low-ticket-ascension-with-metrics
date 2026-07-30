# Research Lab System Port

The Research Lab (`/admin/research`) is the offer-planning and research
workspace: a chat with a tool-calling agent that pulls outside data (social
scraping via Monid, Amazon reviews via RapidAPI, model-native web search),
inside data (the tracked-link metrics), and Context Bridge packs, then emits
persistent **artifacts** (briefs, plans, concepts) that hand off to the
Planner, the Lead Gen Kit, the Email Kit, and the Sales Funnel builder.

This doc is the what/where/how for porting it into another Next.js + Supabase
codebase, in dependency order.

---

## 1. What ships

| Piece | Where |
|-------|-------|
| Full-viewport chat UI with reasoning trace + artifacts rail | `src/app/(fullscreen)/admin/research/` (`page.tsx`, `ResearchWorkspace.tsx`, `ReasoningTrace.tsx`, `ArtifactView.tsx`, `Markdown.tsx`, `researchClient.ts`) + `src/app/(fullscreen)/layout.tsx` (same auth gate, no admin chrome) |
| Agent loop (max 8 tool rounds, SSE events) | `src/lib/mothermode/research/agent/loop.ts` |
| System prompt + artifact contract (+ deep-mode addendum) | `src/lib/mothermode/research/agent/prompt.ts` |
| Tool definitions, pure (8 core + 3 deep-only, filtered per session) | `src/lib/mothermode/research/agent/toolDefs.ts` |
| Tool executor (deep gate + depth-scaled caps) | `src/lib/mothermode/research/agent/tools.ts` |
| Provider-agnostic tool-calling model layer (Anthropic tool_use / OpenAI + Moonshot function calling) + native web search | `src/utils/integrations/research-agent.ts` |
| Monid gateway (discover/inspect/run, endpoint pins, cache) + the deep lane (topPosts / postComments / voiceDeepDive) | `src/utils/integrations/monid.ts` |
| Amazon reviews via RapidAPI | `src/utils/integrations/amazon-rapidapi.ts` |
| Pure scraper normalizers (no service imports) | `src/lib/mothermode/research/scrapeNormalize.ts` |
| Pure comment-language rollup (phrases + questions, deterministic) | `src/lib/mothermode/research/commentLanguage.ts` |
| Internal metrics rollup for the agent | `src/lib/mothermode/research/metrics.ts` |
| Sessions/messages/artifacts store + scraper cache | `src/lib/mothermode/research/store.ts`, `cache.ts` |
| Handoffs | `src/lib/mothermode/research/handoff.ts` + `src/app/api/admin/mothermode-research/handoff/route.ts` |
| Chat SSE route | `src/app/api/mothermode/research/chat/route.ts` |
| Session/artifact CRUD | `src/app/api/admin/mothermode-research/route.ts` |
| Migration (4 tables) | `supabase/migrations/20261101000000_mothermode_research_lab.sql` |
| Integration cards (Monid, RapidAPI) | `src/app/admin/integrations/page.tsx` ("Research Lab sources"), `actions.ts` (`VALID_PROVIDERS` + `CONFIG_KEYS`), `utils/integrations/types.ts`, `runtime-config.ts` |
| Tests | `tests/lib/research-lab.test.ts`, `research-metrics.test.ts`, `research-integrations.test.ts`, `research-intake.test.ts`, `research-deep.test.ts` (77 tests) |
| Help article | `src/lib/mothermode/help/seedContent/researchLab.ts` |

## 2. Onboarding (the research brief)

**An offer name is not a research query.** A low-ticket product has no public
footprint, so searching its name on Reddit/Amazon/X returns nothing. Every
session carries an `intake` brief (migration
`20261102000000_research_session_intake.sql`, `intake jsonb` on
`mothermode_research_sessions`):

```
goal, audience,
problemKeywords[]      the problem space ("mental load", "5pm chaos")
categoryKeywords[]     phrases that EXIST on Amazon ("mom planner")
competitorProducts[]   names / links / ASINs to mine reviews on
competitorVoices[]     {handle, platform, url} influencers to watch
subreddits[]           for reddit_deep_dive
seedLinks[]            anything else the user dropped
```

Two engines draft it (`src/lib/mothermode/research/suggestIntake.ts`, route
`/api/admin/mothermode-research/intake`):

- **Suggest from offer** (`mode: 'suggest'`) — one cheap model call over the
  offer/context packs. No external data.
- **Find research context** (`mode: 'find'`) — 3 model-native web searches
  (products, voices, communities; NO Monid/RapidAPI spend), then one
  assembly pass. Returns `sources` so the panel can label the draft
  "found via web, verify before paid runs".

The panel (`IntakePanel.tsx`, toggle "Brief" in the workspace header) is
suggest-then-edit: chips for every list (hard-capped at 320px with truncate),
structured voices, a **Suggest book links** button (one cheap model call names
5-7 real related products with working links — `amazonProductLink`: canonical
/dp/ when the ASIN is certain, exact-title search URL otherwise, never a
fabricated ASIN), and a link-drop that classifies pasted URLs
(`classifySeedLink` in `intake.ts`: amazon link → canonical short URL with
ASIN; social profile → voice with platform+handle; subreddit → subreddits;
else seed link). Saving a brief with no active session CREATES the session;
on save the panel collapses and a "Brief saved" notice fades after 5s.

**Evidence modes** (`intake.mode`, header 3-way toggle): `external` (live
data is the primary evidence), `internal` (tracked metrics are the spine,
external explains the why), `auto` (default — the agent weighs internal_metrics
and leans external while numbers are thin, internal as they thicken). The
MODE GUIDANCE block in `agent/prompt.ts` switches on it.

**Research depth** (`intake.depth`, header 2-way toggle + the same toggle in
the brief panel): `standard` (default) is the everyday eight tools at the
everyday caps; `deep` unlocks the paid performance/comment lane (see §5.3).
The flag rides the intake JSONB, so it needed NO migration: pre-depth rows
normalize to `standard` (the paid lane is opt-in only), and the panel's
engine drafts never overwrite it (`depth: prev.depth` in the merge — spend
is an owner decision, not a model's).

**Broad scan vs specific dig** (panel toggle + prompt rule): specific focuses
the Find engine on the goal; broad fans its web searches across distinct
niche angles, and the agent is instructed to sweep reddit + socials + web
across DIFFERENT brief keywords and deliver a themes digest first.

The agent's system prompt carries the brief as ACTIVE RESEARCH BRIEF
(`intakeBriefBlock`) plus a SEARCH DISCIPLINE block: never search the offer
name, prefer the brief's seeds, and when the brief is empty and a search
returns nothing, ASK for one seed instead of guessing.

## 3. Data model

One migration, four tables, all RLS-on-no-policies (service-role only, like
the other admin kits):

- `mothermode_research_sessions` — title, `offer_slug`, `context_refs` JSONB
  (the shared Context Bridge pointer shape), status.
- `mothermode_research_messages` — role, content, `tool_calls` JSONB (the
  reasoning trace: `[{id, name, inputSummary, status, resultSummary, ms}]`),
  model. Cascade-deletes with the session.
- `mothermode_research_artifacts` — type (research-brief | offer-brief |
  content-plan | lead-magnet | ad-angles | email-outline | notes), title,
  markdown, `structured` JSONB (the handoff payload), status,
  `handed_off_to` JSONB.
- `mothermode_research_cache` — `cache_key` PK, payload, `expires_at`. Monid
  and RapidAPI bill per run; every scraper call reads/writes this first.

## 3. Environment / credentials

DB-first through `/admin/integrations` ("Research Lab sources"), env fallback:

| Env | In-app key | Purpose |
|-----|-----------|---------|
| `MONID_API_KEY` | `monid.api_key` | Social scraping (Bearer) |
| `MONID_BASE_URL` | `monid.base_url` | Default `https://api.monid.ai` |
| — | `monid.endpoint_{x,tiktok,instagram,reddit,youtube}` | Optional per-platform endpoint pins (skip `/v1/discover`) |
| `RAPIDAPI_KEY` | `rapidapi.api_key` | Amazon data (`x-rapidapi-key`) |
| `RAPIDAPI_AMAZON_HOST` | `rapidapi.amazon_host` | Default `real-time-amazon-data.p.rapidapi.com` |
| `APIFY_API_TOKEN` | `apify.api_token` | Amazon fallback engine (Bearer) |
| `APIFY_REVIEWS_ACTOR` | `apify.reviews_actor` | Default `apify/amazon-reviews-scraper` |

The agent model reuses the existing AI keys (Anthropic preferred, then
OpenAI, then Moonshot) and the `TEXT_MODELS` picker; no new AI key is
needed. `web_search` runs model-native (Claude `web_search_20250305`, else
OpenAI `web_search_options`).

## 4. The agent loop

`runResearchTurn` (`agent/loop.ts`):

1. Persist the user message; title the session from the first one.
2. Rebuild history as plain user/assistant text (last 24). Tool transcripts
   never leave the turn they happened in.
3. Resolve the session's ContextRefs (+ scoped offer) into clamped packs and
   build the system prompt (`agent/prompt.ts`), which carries the artifact
   structured-payload contract the handoffs parse.
4. Up to 8 rounds of `callAgentModel` → run each tool call → feed results
   (9k char cap each) back. Each call emits SSE events:
   `status | tool | artifact | message | done | error`.
5. Persist the assistant turn WITH the trace so the reasoning UI survives
   reload.

The model layer (`research-agent.ts`) is provider-agnostic: Anthropic
`tool_use` ↔ OpenAI/Moonshot `function` mapping, internal transcript type
`AgentMessage`, resolution order explicit picker id → configured override →
provider default (`claude-opus-4-8` / `gpt-5.5` / `kimi-k3`).

## 5. The tools

| Tool | Backs onto | Notes |
|------|-----------|-------|
| `web_search` | `runWebSearch` (research-agent.ts) | Cited one-shot answer |
| `social_search` | `monid.ts socialSearch` | Pin → discover → inspect → mapped run → cache → 6k compact |
| `voice_audit` | `monid.ts voiceAudit` | Profile posts ranked by engagement RATE (likes+comments ÷ followers) + top comments on the strongest 3. Posts say what hooks work; comments say what the audience wants next |
| `reddit_deep_dive` | `monid.ts redditDeepDive` | Threads by score + top comments on the strongest 3; optional subreddit scope; **falls back to pullpush.io when Monid fails or returns nothing usable** |
| `amazon_reviews` | `amazon-rapidapi.ts amazonReviewDigest` | Query→product (≥50 ratings preferred)→reviews; low-star slice kept; **Apify engine preference + fallback** (`apifySearchAsin` resolves queries with no RapidAPI key) |
| `internal_metrics` | `metrics.ts readInternalMetrics` | Totals + top pieces + top campaigns from `mothermode_utm_links` + both lead tables; paid/organic via `adMetrics.trafficType`; failed reads never become zeros |
| `get_context` | `context/resolve.ts` | Session refs + scoped offer, clamped |
| `create_artifact` | `store.ts upsertArtifact` | Validated type/title/markdown + structured passthrough |
| `top_posts` **(deep only)** | `monid.ts topPosts` | Topic/hashtag search with results RANKED by real performance (engagement rate, then views); URLs kept so winners feed post_comments. The structured sibling of social_search |
| `post_comments` **(deep only)** | `monid.ts postComments` | Top comments on ONE post/reel/video URL — what the audience says under a specific winner; cached per URL, empty threads never cached |
| `voice_deep_dive` **(deep only)** | `monid.ts voiceDeepDive` | One call = the influencer picture: longer post ladder ranked + comments on the top posts + the deterministic comment-language rollup (phrases repeated, questions asked) |

## 5.1 The scraper resilience stack (do not regress)

The gateway rejects runs through THREE channels, all handled:

1. **Async acks** — blockrun endpoints return `{runId, status:"RUNNING"}`; `runMonid` polls to completion (both poll shapes, 60s cap). A 548-char "success" that is a job handle was the first fake-data bug.
2. **HTTP 400/5xx** — `runWithVariants` cycles CLEAN input pairs: `{query}`, `{q}`, `{searchTerm}`, `{searchTerms:[...]}`, `{hashtags:[...]}`, `{keyword}`, `{searchQuery}`. Strict actors 400 on ANY unknown field, so **platform rides along ONLY on the unified surf endpoint** (`isUnifiedEndpoint`), plural query fields go as ARRAYS, and every failure lists `(input shapes tried: ...)`.
3. **200-with-FAILED-body** — `failedPayloadError` detects `{status:"FAILED"}` payloads that transport checks sail past.

Plus: **pullpush.io fallback** for reddit (reddit.com JSON 403s datacenter IPs; pullpush works — empty results try the full query then its first word), **no caching of empty digests** (a 7-day "nothing found" pins a recovered source), the **Apify dual-engine** for Amazon (`getAmazonEngine` = `rapidapi.engine`, default rapidapi-first with Apify fallback), and the **529 backoff retry** on Anthropic overload.

## 5.2 Integrations persistence rules

- `api_token` is in `SECRET_KEYS` — blank re-saves preserve it like every other secret.
- monid/rapidapi/apify are **always-on** in runtime-config: presence = enabled (no event fan-out, so the "Enabled" toggle never gates them).
- The card shows `Saved ••••last4. Leave blank to keep.` in brass under each secret field.

## 5.3 Deep research mode (the advanced lane)

Deep mode answers the two questions the standard lane can't: **which posts
perform best** (real engagement numbers, ranked) and **what are people saying
in the comments** (the audience's exact words under a winner). It exists so
the standard experience stays exactly as shipped: same eight tools, same
caps, same prompt, same spend.

The gate is `intake.depth` (`'standard' | 'deep'`), and it is enforced in
THREE places, any one of which is sufficient:

1. **The defs** — `agent/toolDefs.ts buildResearchToolDefs({deep})` returns
   the core eight; deep appends `top_posts`, `post_comments`,
   `voice_deep_dive` (`DEEP_TOOL_NAMES`). The loop passes
   `{deep: session.intake.depth === 'deep'}`.
2. **The executor** — `runResearchTool` re-checks depth per call and returns
   a readable "flip the Research depth toggle" refusal on a standard session
   (defense in depth: a stale def list can never spend deep money).
3. **The prompt** — deep sessions get the `TOOL_GUIDANCE_DEEP_ADDENDUM`
   (workflow: top_posts → post_comments on the standouts; voice_deep_dive
   for voices; ONE dive per turn unless the owner asks for a sweep; name the
   spend plainly).

What deep changes elsewhere: `voice_audit` caps scale up (topPosts 10→15,
commentsPerPost 10→15, comment mining on the top 3→5 posts — the executor
clamps per depth; monid's ceilings are the deep maxima), and the workspace
swaps its voice suggestion card for the deep-dive one.

The deep lane in `monid.ts`:

- **Shared helpers** — `resolveCommentsEndpoint(platform)` (pin
  `endpoint_{platform}_comments` → discover, null when none exists),
  `fetchPostComments` (mapped thread-mode input first, then clean-pair
  variants `{url}`, `{postUrl}`, `{videoUrl}` cycling on retryable failures),
  `fetchCreatorPosts` + `rankSocialPosts` (the voice_audit lane, extracted
  and shared unchanged).
- **Cache keys** — `monid:top:v1`, `monid:comments:v1`, `monid:voice-deep:v1`,
  all parameterized; `voice_audit`'s key gained `commentPosts` (old entries
  simply miss once and re-cache).
- **The rollup is computed, not generated** — `commentLanguage.ts
  rollUpCommentLanguage` counts 2-3-word phrases (stopword/link/hashtag
  filtered, count ≥ 2 to surface, longer phrases swallow shorter ones at the
  same count) and collects literal questions (deduped, best score kept). The
  model reads the raw comments AND the counted rollup; it never invents the
  counts.
- **Empty digests are never cached** in the deep lane either (top_posts
  returns a rawPreview instead; post_comments errors readable) — the same
  recovered-source rule as reddit.

Spend honesty: a voice_deep_dive is 1 posts run + up to 6 comment runs
(default 5). That is why the lane is opt-in per session, and why the prompt
tells the agent to say what a dive costs.

## 6. Handoffs (Draft, Build, and the Full System builder)

`handoff.ts runHandoff({artifactId, target, session, generate?})` —
server-side, via each target's OWN store (never raw inserts). Two depths:

- **Draft** (`generate: false`, the default): create with intake pre-filled;
  the owner presses Generate in the target editor.
- **Build** (`generate: true`): create AND run the target's own pipeline —
  `aiGenerateDoc` for lead magnets, `aiGenerateSequence` (with the resolved
  research-context packs) for email kits — so the owner lands on a drafted
  editor. The artifact drawer shows Draft and Build buttons side by side.
  The sales funnel stays Draft-only: its autofill pipeline lives in its own
  editor. Route has `maxDuration = 300` for the two-pipeline system build.

Targets: `planner-cards` ← content-plan/ad-angles items (idempotent via the
planner's piece_id+offer_slug conflict key); `leadgen-kit` ← lead-magnet
concept; `email-kit` ← email outline; `sales-funnel` ← offer brief;
`system` ← offer brief, the **Full System builder**: one brief fans out into
a Lead Gen Kit (built), an opt-in funnel (linked `leadGenSlug` + `offerSlug`),
a nurture Email Kit (built, research-context stamped), a sales funnel draft,
and planner cards (one per angle). The manifest (`SystemBuildPart[]`) is
persisted on the artifact's `structured.systemManifest`; `handed_off_to`
gets `kind: 'system'`.

The **research-context preset** (`researchContextRefs(session)`): the offer
ref plus the session's research brief as an inline text pack, stamped onto
every generated kit's `context_refs`, so downstream generators inherit the
research language, not just the target intake.

## 7. Port checklist

1. Run the migration.
2. Copy `src/lib/mothermode/research/**`, `src/utils/integrations/{research-agent,monid,amazon-rapidapi}.ts`.
3. Copy the routes: `api/mothermode/research/chat`, `api/admin/mothermode-research{,/handoff}`.
4. Copy `src/app/(fullscreen)/**` (the group layout carries the auth gate with no admin chrome; URL stays `/admin/research`); add the sidebar link.
5. Add `monid` + `rapidapi` to the integrations provider union, runtime-config
   getters, `actions.ts` (`VALID_PROVIDERS`, `CONFIG_KEYS`), and the page cards.
6. Wire the target stores for handoffs (planner, leadgen, email, sales) — or
   delete the targets you don't have.
7. `tests/lib/research-*.test.ts` (77 tests) should pass: `npx vitest run tests/lib/research-*`.

## 8. Standing rules (do not regress)

- **Honest data.** Tool numbers are quoted exactly; failed sources are said
  out loud (the reasoning trace shows the short reason, `failed: <why>`);
  attributed revenue is never summed with Stripe totals (the
  `ATTRIBUTED_REVENUE_FLOOR_SHORT` note rides every metrics answer).
- **Pay once.** Every Monid/RapidAPI call goes through the cache table.
- **Scraper resilience.** Monid runs cycle input-key variants
  (`query/searchTerm/keyword/searchQuery`) on a 400 and remember the winner
  (`viaKey`); RapidAPI 429s get one delayed retry; the RapidAPI host is
  sanitized (`sanitizeRapidApiHost`: URL or pasted `x-rapidapi-host:` line);
  a RapidAPI failure falls through to the Apify reviews actor when a token is
  configured; a reddit run that normalizes to zero returns the raw payload
  preview instead of a dead 404.
- **Query discipline.** The agent never searches the offer/product name; it
  searches the brief's seeds, 1-4 words, title-like, one topic per call.
- **Voice.** Anything customer-facing the agent drafts obeys the house rules
  (no em/en dashes, no hype words, periods over exclamation points).
- **Handoffs write through the target's own store.** No raw inserts into
  planner/kit/funnel tables.
- **Deep is opt-in, standard is untouched.** The deep lane exists ONLY when
  `intake.depth === 'deep'` (defs, executor gate, prompt addendum). A
  standard session gets the same eight tools, the same voice_audit caps, and
  the same prompt it always had — no deep tool leaks in, and comment/phrase
  counts are always computed in code (`commentLanguage.ts`), never estimated
  by the model.
