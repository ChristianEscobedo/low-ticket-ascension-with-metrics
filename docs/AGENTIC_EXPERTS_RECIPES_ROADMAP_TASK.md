# Agentic Experts + Recipes Roadmap (TASK)

The north-star plan for turning the Research Lab into the industry go-to for
agentic marketing + sales: a **compounding evidence base**, a **crew of
Experts** (config-driven agents), and **Recipes** (declarative multi-expert
workflows) — built on the loop we already trust.

This doc is the canonical handoff for the arc. Each task is session-sized:
pure logic in importable modules, vitest pinned, the matching
`*_SYSTEM_PORT.md` refreshed, help seed touched when user-facing.

---

## 1. The thesis (why this wins)

Chat is copyable. What is not copyable:

1. **The evidence base** — every quote, comment, rollup, and metric persisted
   with provenance, compounding per offer. Competitors reset to zero each
   session; we compound.
2. **The closed loop** — research → build → publish → measure → learn, in one
   system. "This brief made $X" is the stickiest sentence in SaaS.
3. **The crew** — Experts trained on the house (brand bible, voice rules,
   real writing examples, past winners) that never forget the brand, passing
   typed artifact envelopes with full lineage. A team, not a tool.

Standing guardrails for every task below: deterministic where possible
(compute in code, generate in prose), honest data (quote exactly, say
failures out loud), pay once (cache-first), budgets before autonomy, evals
green on every merge.

## 2. The two primitives

**Experts** are configs, not code — DB rows: persona prompt, model
preference, tool policy (allowlist from the shared registry), context pack
refs (brand + writing examples + style cards), artifact contract, handoff
manners (accepts/emits artifact types). One generalized loop
(`runExpertTurn(config)`) runs them all — the deep-mode def-filtering
pattern, generalized. Starter crew maps to existing pipelines: Research
(exists), Strategist, Copy, Design, Lead Magnet, Email, Sales Page, Ads,
Compliance, Analyst.

**Handoff etiquette**: agents never read each other's chats — they pass
typed, versioned artifact envelopes `{type, title, markdown, structured,
provenance, lineage}`. The existing normalizers are the border control.
Lineage stamps parent id + expert + timestamp, so "how was this made" is a
real tree from evidence to published asset.

**Recipes** are declarative step lists (`mothermode_recipes` +
`mothermode_recipe_runs`): `{expert, instructionTemplate, inputFrom,
outputArtifact, gate(auto|approve)}`, run by one sequential interpreter with
human gates, per-run budgets, and a mission UI. The Full System builder is
recipe #1 rewritten as data. (Name note: prompt-bank recipes already exist —
these are **Agent Recipes**; keep them distinct in schema and UI, or call
them Plays.)

## 3. Sequencing logic

1. **Evals before refactors** — the agent cannot silently regress while we
   rebuild its chassis.
2. **Expert runtime before Recipes** — recipes are configs driving that
   runtime.
3. **Evidence table before watchlists/personas/semantic search** — they are
   read-models over it.
4. **Budgets + kill switches before autonomy** — Phase 4 cannot start before
   task 2.4.

## 4. The tasks

### Phase 0 — Speed & trust foundation

| # | Task | Status |
|---|------|--------|
| 0.1 | **Parallel tool rounds** — independent calls in one round run via `Promise.all` (serial today; ~3x on sweeps). Transcript order preserved; events stream as calls complete | SHIPPED |
| 0.2 | **Token streaming** — `callAgentModel({onTextDelta})` streams (Anthropic content_block_delta + OpenAI delta.content, tool_use/input_json and tool_calls chunks assembled to the identical contract; streamed failure falls back to the normal lane); the loop emits 'text-delta' SSE events; the workspace renders the streamed text in the streaming card | SHIPPED |
| 0.3 | **Cost meter + call telemetry** — `mothermode_research_call_log` (per-call cost/status, migration 20261103000000); live spend meter in the trace header | SHIPPED |
| 0.4 | **Freshness + cache badges** — `freshness.ts` (formatAge ladder + isCachedSummary, pure); the trace's brass `[cached]` chip on cached calls + the age chip (3d, 2w) on every evidence rail item | SHIPPED |
| 0.5 | **Agent eval suite** — golden-set harness in vitest (mocked model + tool layer): offer-name refusal, seed-ask when empty, failure honesty, exact quoting, round-cap + parallel-round loop contracts | SHIPPED |

### Phase 1 — Expert runtime (the chassis)

| # | Task | Status |
|---|------|--------|
| 1.1 | **Expert config model + migration** — `mothermode_experts` (migration 20261104000000); `experts/types.ts` + `experts/store.ts` (reads degrade to the code default) | SHIPPED |
| 1.2 | **Runtime generalization** — `runResearchTurn` takes `expert?/expertSlug?` → resolves to `DEFAULT_RESEARCH_EXPERT` (zero behavior change, evals prove it); persona roleOverride + model pref + artifact-contract enforcement | SHIPPED |
| 1.3 | **Tool registry + policies** — `filterToolDefs` + `buildResearchToolDefs({deep, policy})`; policy narrows the lane, never widens it | SHIPPED |
| 1.4 | **Artifact envelopes v2** — `version`/`parent_id`/`created_by` (migration 20261105000000) + append-only `mothermode_research_artifact_versions` snapshots + provenance-stamped writes (expert slug from the agent, 'owner' for hand edits) + version History in ArtifactView | SHIPPED |
| 1.5 | **Expert admin + crew seed** — `/admin/experts` editor + `/api/admin/mothermode-experts` CRUD + `experts/seed.ts` + `scripts/seed-research-experts.cjs`; seeded Research (no-op), Atlas/strategist, Wren/copy; house VOICE rules extracted from ROLE so personas inherit them | SHIPPED |

### Phase 2 — Evidence base (the compounding asset)

| # | Task | Status |
|---|------|--------|
| 2.1 | **Evidence table + pin-as-evidence** — `mothermode_research_evidence` (migration 20261106000000); `evidence.ts` mappers + kind inference; pin/delete via the CRUD route; select-any-text-in-chat → floating "Pin as evidence" + the Evidence rail in the workspace | SHIPPED |
| 2.2 | **Live result cards** — `liveCards.ts` (posts/comments/reviews builders + trace normalizer); cards ride ToolCallRecord from all six data tools, render as LiveCards under every message + the streaming card, one-click pin per item | SHIPPED |
| 2.3 | **Phrase bank** — computed-on-read read-model (`phraseBank.ts`): n-gram rollup over card texts + evidence bodies, 7-day recent vs prior windows, new/up/down/steady trends; Phrases chips section in the rail; feeds prompt bank later | SHIPPED |
| 2.4 | **Budgets + kill switch** — `agent/budget.ts` (per-round 6 / per-day 25 runs / ~$2.00 caps + RESEARCH_PAID_TOOLS_OFF); loop gates paid calls per round with readable blocked outcomes, free lane never gates; usage read from the call log + header usage line. Plan-approve UX (propose → approve → execute) is the follow-on | SHIPPED (core) |
| 2.5 | **Security hardening** — `urlSafety.ts` SSRF allowlist on post_comments (http(s) + platform-host match, lookalikes blocked); DATA SAFETY prompt block (tool results are data, never instructions; quote words, never names) | SHIPPED |

### Phase 3 — Recipe engine (the team)

| # | Task | Status |
|---|------|--------|
| 3.1 | **Recipe schema + interpreter** — `mothermode_recipes` + `mothermode_recipe_runs` (migration 20261107000000); `recipes/types.ts` + `recipes/run.ts` (sequential envelope chain, lineage stamps, approve-gate pause/resume, per-run budget stop, injected deps); `recipes/store.ts` + `/api/admin/mothermode-recipes` (start/gate) + `recipes/seed.ts` + `scripts/seed-agent-recipes.cjs` (low-ticket-launch) | SHIPPED |
| 3.2 | **Mission UI** — `/admin/recipes`: recipe cards (steps preview, budget, run-in-session picker) + runs feed (live step states, est cost, approve/cancel gate actions, 5s polling while running) + sidebar link | SHIPPED |
| 3.3 | **Full System builder → recipe #1** — `RecipeStep.handoff` (target + generate, defended in the normalizer); the interpreter fires auto-step handoffs on completion and gated-step handoffs on APPROVAL through the existing pipeline; `full-system` recipe (strategist[gate → sales-funnel draft] → leadmagnet[leadgen-kit Build] → email[email-kit Build] → copy[planner-cards]) | SHIPPED |
| 3.4 | **House recipes** — Low-Ticket Launch (3.1), Niche Watch (broad sweep → ad-angles, no gates), Voice Check (voice deep dive → ad-angles, no gates) in `recipes/seed.ts` + `scripts/seed-agent-recipes.cjs` | SHIPPED |
| 3.5 | **Crew expansion** — Nova/leadmagnet, Ember/email, Pixel/design, Rook/compliance, Sage/analyst as pure configs in `experts/seed.ts` + `scripts/seed-research-experts.cjs` (8-expert crew) | SHIPPED |

### Phase 4 — Autonomy & moat-deepening

| # | Task | Status |
|---|------|--------|
| 4.1 | **Background job lane** — `mothermode_agent_jobs` (migration 20261108000000); `recipes/jobs.ts` (create/list/get/claimNext conditional-claim/update); `/api/admin/mothermode-jobs` tick worker (claims oldest queued, runs the recipe, stamps progress); recipes `start` gains `background: true`; the mission UI starts in background and ticks on its 5s poll | SHIPPED |
| 4.2 | **Watchlists + weekly digest** — `mothermode_research_watchlists` (migration 20261109000000); `watchlists.ts` (due rule: active + never run or stale 7d); cron-auth on the jobs route (CRON_SECRET bearer) running the digest (queue a background run per due watch); vercel.json daily 8am cron; watch/unwatch actions + the mission UI's Watch weekly toggle. Digest lands as the Niche Watch artifact in the watched session — the owner-email half waits on a transactional sender | SHIPPED (email pending) |
| 4.3 | **Endpoint learning** — `mothermode_monid_endpoint_stats` (migration 20261110000000); `endpointStats.ts` (best-effort recording, pure rankEndpoints: successes lead, recent-3-day failures sink, unknowns keep discovered order); runMonid records every outcome; discoverMonid orders the pool winner-first | SHIPPED |
| 4.4 | **Cross-session memory** — `mothermode_research_learnings` (migration 20261111000000); `learnings.ts` (parseLearnings + learningsBlock, pure) + `distill.ts` (one cheap call over the newest brief + evidence → 3-5 lines, upserted per offer); the loop injects them as CROSS-SESSION MEMORY; the tick worker distills after done runs; route entity 'distill' | SHIPPED |
| 4.5 | **Re-verify with diff** — `reverify.ts` (pure occurrence-aware line diff: added/removed/held + the one-line summary); route entity 'reverify' (one fresh turn, then diff the new research-brief against the old); the workspace's Re-verify button + the dismissible diff card | SHIPPED |
| 4.6 | **Post-publish learning** — `outcome.ts` (pure instruction: scope named honestly, standing rules ride); route entity 'outcome' (one analyst turn → research-brief digest, lineage-stamped to the research that produced the work); the workspace's Outcomes button + saved notice | SHIPPED |
| 4.7 | **Semantic evidence search** — `mothermode_research_evidence_embeddings` (migration 20261112000000, pgvector ext); `embeddings.ts` (OpenAI text-embedding-3-small, lazy key import, pure cosine + rankBySimilarity, best-effort write on pin, backfill entity, JS-side scoring); the rail's semantic search box with % scores | SHIPPED |

**Deliberately deferred:** public share links, portfolio view, persona cards,
playbook marketplace, multi-user RLS enforcement.

## 5. Risks carried through every phase

| Risk | Mitigation shipped with |
|------|------------------------|
| Spend runaway | 0.3 telemetry, 2.4 budgets + kill switch, per-recipe budgets (3.1) |
| Silent agent regressions | 0.5 eval suite, run on every merge |
| Hallucinated evidence | deterministic rollups (shipped), 2.1 provenance pins, 0.4 freshness |
| Prompt injection via scraped content | 2.5 delimiters + SSRF allowlist; tool output never spawns actions (standing) |
| Persona theater (fake experts) | mechanical differentiation only: tools, packs, contracts, model tiers (1.x) |
| Compounding error chains | typed envelopes + validation + human gates (1.4, 3.1) |
| Vendor death (Monid) | existing fallback lanes + 4.3 stats; raw payload archive pattern |

## 6. Session log

- **Session 26 (the deep research fleet + the in-chat Plays rail):** 10
  plays become 16, and runs are visible where they happen. The deep
  research fleet: **Influencer Panel** (research × 2: voices 1-2 then
  voices 3-4 with post_comments on the standouts → hook bank),
  **Comment Mining Sweep** (top_posts across keywords → post_comments on
  the 5-8 winners → hooks verbatim), **Cross-Channel Sweep** (X/TikTok/IG
  one keyword each + YouTube/Reddit, cited web passes on LinkedIn and
  Facebook — honestly labeled, no scrape lane exists), **Reddit Rabbit
  Hole** (every brief subreddit, objections ranked), **Video Deep Dive**
  (TikTok/YouTube winners + creator dives → video content-plan), and the
  flagship **Audience Mosaic** (research × 3 → strategist's unified themes
  map → the master hook bank, gate → planner cards, ~$4.50 with the
  daily-gate caveat in the description). The five intelligence plays are
  UNGATED and artifact-only like the watchers — pinned in tests. Also this
  session: `RecipeRunsPanel` in the research chat's right rail — the
  session's runs with live step glyphs, gate actions, a start-in-session
  picker, and the 5s poll+tick; when a run settles the workspace reloads
  so the expert turns stream into the transcript and the artifacts land in
  the rail. Help article, port doc (§6.1 fleet tables), and counts
  refreshed. 213 tests green (+1), tsc clean.
- **Session 25 (the builder fleet):** the recipes section grows from 4 plays
  to 10. The one engine unlock: `'system'` joins the recipe step handoff
  targets (`RecipeStepHandoff.target` + the defended normalizer + the
  interpreter's deps type) — the Full System fan-out that existed in
  `handoff.ts` is now reachable from a gated recipe step, so approving the
  offer brief builds the whole machine. The six new house recipes
  (`recipes/seed.ts`, mirrored in `scripts/seed-agent-recipes.cjs`):
  **Bulk Content Engine** (research → 30-day content plan, gate → planner →
  design → compliance), **Full Funnel Build** (research → offer, gate →
  system fan-out → post-purchase kit Build → compliance), **Paid Launch
  System** (research → offer, gate → sales funnel → 5 paid angles/platform,
  gate → paid cards → design → paid-claims review), **Email Sequence Build**
  (research → nurture kit Build → launch outline, gate → second kit Build →
  compliance), **Repurpose Engine** (analyst reads our numbers → 15-20
  re-cuts of the winners, gate → planner → design), and **Launch Week**
  (the mega-recipe: research → offer, gate → system → paid angles, gate →
  paid cards → organic calendar → planner → cart open-close kit Build →
  design → compliance, ~$4.50 budget). Fleet patterns: gates sit where
  money or judgment matters, advisory steps (design/compliance) run auto
  AFTER the handoffs, compliance always last. Tests: the well-formed pin
  now asserts the UNGATED set (niche-watch/voice-check) instead of
  whitelisting gated plays, a builder-fleet pin locks every chain + handoff,
  and the normalizer defense covers 'system'. Help article + port doc
  (§6.1) refreshed. 212 tests green (+2), tsc clean.
- **Session 1 (this doc + Phase 0 start):** roadmap doc captured; 0.5 eval
  suite shipped (`tests/evals/research-loop.eval.test.ts`: scripted model +
  mocked store/tools, 13 cases — persistence/history, round + parallel
  contracts, artifact events, failure honesty, round cap, steering); 0.1
  parallel tool rounds shipped (`Promise.all` per round, events stream on
  completion, trace/transcript stay call-ordered). 90 tests green
  (77 research + 13 eval), tsc clean.
- **Session 24 (0.2 token streaming):** the assistant's text streams, not
  just tool events. `callAgentModel` gains `onTextDelta`: Anthropic
  streams content_block_delta (text_delta out, input_json_delta
  assembled per tool_use block), OpenAI/Moonshot stream delta.content
  (tool_calls chunks assembled by index) — the resolved result is the
  IDENTICAL contract, and a streamed network failure falls back to the
  normal request (streaming is an enhancement, never a new failure
  mode). The loop emits 'text-delta' SSE events; the workspace
  accumulates and renders them in the streaming card as Markdown. The
  eval harness pins the order: deltas arrive before the persisted
  message. 210 tests green (+1 eval), tsc clean. **Roadmap complete:
  27/27.**
- **Session 23 (0.4 freshness + cache badges):** "how old is this" and
  "did that cost anything" are visible. `freshness.ts` — formatAge
  (just now / 5m / 2h / 3d / 2w / 4mo, junk and future dates degrade
  safely) and isCachedSummary (the 0.3 "(cached)" stamp, paren-anchored
  so plain text never false-positives). The ReasoningTrace shows the
  brass `[cached]` chip on cached calls; every evidence rail item shows
  its age. Also this session: the seed scripts fixed — `dotenv` was
  never installed, so both scripts ran with NO env (the swallowed
  require); both now use the zero-dependency `scripts/lib/load-env.cjs`,
  and the recipes seed is self-explaining when the migration is
  missing. All 8 experts + 4 recipes seeded live. 209 tests green (+3),
  tsc clean.
- **Session 22 (4.7 semantic evidence search):** the evidence base is
  searchable by MEANING. `mothermode_research_evidence_embeddings`
  (migration 20261112000000, pgvector enabled for when the corpus
  outgrows JS scoring) + `embeddings.ts`: OpenAI text-embedding-3-small
  with the key import LAZY (the integrations layer boots a service
  client at import time — tests stay off it), pure cosine +
  rankBySimilarity, the pin route embeds best-effort, 'embed-evidence'
  backfills, and searchEvidenceSemantically embeds the query and scores
  JS-side. The Evidence rail gains the semantic search box with %
  scores. 206 tests green (+4), tsc clean. **Phase 4 complete.**
- **Session 21 (4.6 post-publish learning):** the loop closes. Research
  → build → publish → MEASURE → learn. `outcome.ts
  outcomeDigestInstruction` names the scope honestly (the offer slug
  when scoped, the whole account when not) and carries the standing
  rules (exact quotes, paid/organic split, thin data said out loud). The
  CRUD route's 'outcome' entity runs ONE analyst turn → an "Outcome
  digest" research-brief, then lineage-stamps it to the research-brief
  that produced the work — "this brief made $X" is a real, linked
  sentence in the artifact tree. The workspace gains the Outcomes
  button + a saved notice. 202 tests green (+3), tsc clean.
- **Session 20 (4.5 re-verify with diff):** "what changed since the last
  run" is a computed answer. `reverify.ts` — the pure occurrence-aware
  line diff (added/removed/held, whitespace-normalized so formatting
  never fakes a change) plus reverifySummary ("2 new lines · 1 gone ·
  11 held"). The CRUD route's 'reverify' entity runs one fresh research
  turn (re-check the brief's key claims, save an updated brief) and
  diffs the new research-brief against the previous one. The workspace
  gains a Re-verify button (visible when a research-brief exists) and a
  dismissible diff card with the added/removed lines. 199 tests green
  (+6), tsc clean.
- **Session 19 (4.4 cross-session memory):** the agent starts each
  session knowing what past research proved. `mothermode_research_
  learnings` (migration 20261111000000) + the distiller: one cheap model
  call over the session's newest research-brief and pinned evidence →
  3-5 one-line learnings (parseLearnings strips markers, drops chatter,
  caps at 5), upserted per offer (house-wide when unscoped). The loop
  injects them as the CROSS-SESSION MEMORY block right under the brief
  (empty = byte-identical silence, pinned by test). The tick worker
  distills after every done run, best-effort; the CRUD route gains the
  'distill' entity for on-demand. 193 tests green (+6), tsc clean.
- **Session 18 (4.3 endpoint learning):** the gateway learns which
  endpoints work. `mothermode_monid_endpoint_stats` (migration
  20261110000000) — every runMonid records ok/fail per endpoint,
  best-effort swallowed like telemetry. discoverMonid now orders its
  pool winner-first via the pure rankEndpoints: successes minus failures,
  with a failure in the last 3 days costing double (a recently-broken
  endpoint sinks even with a good lifetime record; unknowns score 0 and
  keep discovered order; the admin pin still wins outright). 187 tests
  green (+4), tsc clean.
- **Session 17 (4.2 watchlists):** the retention engine exists.
  `mothermode_research_watchlists` (migration 20261109000000) + the due
  rule (active AND never-run-or-stale-by-7-days, junk timestamps never
  read as ran). The jobs route's GET now accepts the Vercel cron
  (CRON_SECRET bearer) and runs the digest: one queued background run
  per due watchlist, last_run_at stamped, one bad watch never stops the
  rest. vercel.json gains the daily 8am cron. The recipes route gains
  watch/unwatch and the mission UI a "Watch weekly" toggle per recipe
  card (one watch per session+recipe, re-adding reactivates). The
  digest lands as the Niche Watch artifact + run in the watched session;
  the owner-email half is honestly deferred until a transactional sender
  exists. 183 tests green (+5), tsc clean.
- **Session 16 (4.1 background lane):** long agent work no longer holds an
  HTTP request open. `mothermode_agent_jobs` (migration 20261108000000),
  `recipes/jobs.ts` (the conditional claim: two ticks never take the same
  job), and the `/api/admin/mothermode-jobs` tick worker — claims the
  oldest queued job, runs the recipe to a finish state, stamps progress
  and errors honestly. The recipes `start` action gains `background:
  true` (queue + return immediately); the mission UI starts in background
  and POSTs tick on its existing 5s poll, so the lane drives itself
  without a cron (a Vercel cron can hit the same endpoint). 178 tests
  green (+4), tsc clean.
- **Session 15 (3.3 full-system as data):** the fan-out is a recipe.
  `RecipeStep.handoff` ({target, generate}, defended in the step
  normalizer) and the interpreter fires it through the EXISTING handoff
  pipeline: auto steps on completion, gated steps on APPROVAL (never
  before review — the sales funnel drafts only after the owner approves
  the offer). A handoff failure fails the step honestly with the reason
  on it. The `full-system` recipe: strategist (gate → sales-funnel
  draft) → leadmagnet (leadgen-kit Build) → email (email-kit Build) →
  copy (planner-cards), ~$2.00 budget. 174 tests green (+5), tsc clean.
- **Session 14 (3.5 crew expansion):** the crew is eight. Nova/leadmagnet
  (lead-magnet concepts bridging to the offer), Ember/email (sequences
  from evidence phrases, one job per email), Pixel/design (visual
  direction notes), Rook/compliance (claims/platform-rule flags with
  safer rewrites), Sage/analyst (internal_metrics digests, exact quotes,
  paid/organic split) join research/Atlas/Wren as pure configs — each
  persona names its ACTUAL tool lane, each contract is artifact-typed.
  The seed script mirrors them; the seed-shape tests pin the 8-slug
  order. 169 tests green, tsc clean.
- **Session 13 (3.4 house recipes):** three plays live in the seed.
  Niche Watch (research broad sweep → research-brief → copy ad-angles,
  no gates, ~$1.00 budget) and Voice Check (voice deep dive/audit →
  research-brief → copy ad-angles in OUR voice, no gates, ~$1.20) join
  Low-Ticket Launch. Seed-shape test pins unique slugs, valid envelope
  chains, and the no-gates rule for the watch recipes. 169 tests green
  (+1), tsc clean.
- **Session 12 (3.2 mission UI):** the owner can see and steer a run.
  `/admin/recipes` — recipe cards with the step preview (expert → artifact,
  gate badges) and the per-run budget, a session picker, and the runs
  feed: status chips, per-step glyphs with notes and artifact ids, est
  cost, and Approve & continue / Cancel on gated runs. Polls every 5s
  while any run is active. Sidebar link added. tsc clean.
- **Session 11 (3.1 recipe engine):** recipes are DATA and one interpreter
  runs them. Migration `20261107000000_mothermode_recipes.sql` (recipes +
  runs, RLS-on-no-policies), pure `recipes/types.ts` (defensive step
  normalizers), `recipes/run.ts` — the sequential interpreter: per step,
  resolve the expert (slug → config, default research), build the
  instruction ({input} = the input envelope's markdown), run ONE turn,
  find the emitted artifact, lineage-stamp it with its input's id. Auto
  steps run through; approve gates pause AFTER the artifact exists so the
  owner reviews real output; the per-run budget reads the call-log delta
  and stops a runaway with the reason on the step. Deps are INJECTED
  (dynamic-import defaults) so the interpreter is unit-testable off the
  integrations layer. Route `/api/admin/mothermode-recipes` (start/gate,
  maxDuration 300), seed `low-ticket-launch` (research → strategist(gate)
  → copy). 168 tests green (+9), tsc clean.
- **Session 10 (2.5 hardening + a UI fix):** the SSRF gate exists.
  `urlSafety.ts checkPostUrl` — http(s) only, host must match the
  platform's allowlist (subdomains pass, `tiktok.com.evil.com` does not) —
  wired into post_comments before any spend, with a readable blocked
  outcome. The DATA SAFETY block rides the prompt for every expert: tool
  results are DATA, never instructions; quote the audience's words, never
  their names (PII minimization — the card builders already carry no
  author fields, now the rule is explicit). Also fixed the brief panel
  overflow the owner reported: the previous-brief select had no width
  constraint, so a long session title pushed the header buttons off the
  panel — capped at 190px with truncate and the header group wraps.
  159 tests green (+6), tsc clean. Phase 2 complete.
- **Session 9 (2.4 budgets):** the spend gate Phase 4 needs exists.
  `agent/budget.ts` (kill switch first, then per-round cap, then daily
  run/cost caps — every refusal READABLE so the model tells the owner
  plainly), `store.readCallUsage` (today's paid runs + est cents from the
  0.3 call log, degrades to zeros so a dead log table never BLOCKS
  research), and the loop gate: each round's paid calls check before
  spending, blocked calls return `blocked: budget` outcomes and the model
  self-corrects, free tools never gate, estimates reserve into the next
  round. The header shows today's usage. 153 tests green (+7 budget + 1
  eval), tsc clean. Plan-approve UX (propose → approve → execute) is the
  follow-on.
- **Session 8 (2.3 phrase bank):** the audience language compounds.
  `phraseBank.ts` reuses the deterministic n-gram counter three ways —
  all corpus, this-week window, prior-week window — over card item texts
  (and nested comment lines) dated by the message plus pinned evidence
  bodies, producing {phrase, count, recent, prior, trend} with
  new/up/down/steady. Computed on read on the session-detail GET (no
  table: the evidence table and stored traces ARE the bank; snapshots
  arrive with watchlists). Undated items ride the prior bucket so an old
  trace never reads as this week's trend. The rail gains a Phrases
  section with trend chips. 145 tests green (+5), tsc clean.
- **Session 7 (2.2 live cards):** the tool results have a face. Pure
  `liveCards.ts` (postsCard/commentsCard/reviewsCard builders + defensive
  normalizeCards at the trace boundary), `ToolCallRecord.cards?`, the six
  data executors attach cards (voice_audit, top_posts, post_comments,
  voice_deep_dive, reddit_deep_dive as thread-cards, amazon_reviews), the
  loop carries them into the SSE tool event AND the persisted trace, and
  the workspace renders LiveCards under every assistant message and the
  streaming card — engagement meta chips, source links, nested comment
  lines, one-click pin per item into the evidence rail (pinned items show
  a check). 140 tests green (+9), tsc clean.
- **Session 6 (2.1 evidence base):** the compounding asset exists.
  `mothermode_research_evidence` migration (session cascade, offer index,
  provenance columns: source_url/source_tool/expert/created_by), pure
  `evidence.ts` (defensive mapper + `inferEvidenceKind`: ≤4 words =
  phrase, digit-carrying line = metric, longer = quote), store
  pinEvidence/listEvidence/deleteEvidence, route entities pin-evidence/
  delete-evidence + evidence on the session-detail GET, and the workspace
  UX: select any text in the chat → floating "Pin as evidence" (kind
  inferred, offer_slug carried) → the Evidence rail above the artifacts
  rail with per-item delete. 131 tests green (+8), tsc clean.
- **Session 5 (1.5 crew + admin):** the crew exists. `experts/seed.ts`
  (research = no-op default, Atlas/strategist, Wren/copy — every persona
  names its ACTUAL tool lane because the shared guidance describes the
  research lane) + `scripts/seed-research-experts.cjs` (idempotent upsert
  by slug). `upsertExpert`/`seedExperts` in the store, CRUD route
  `/api/admin/mothermode-experts`, the `/admin/experts` editor (cards +
  config form: persona, model, tool policy chips, artifact contract chips,
  accepts/emits, archive), and the sidebar link. HOUSE VOICE extracted
  from ROLE into SEARCH_DISCIPLINE so the voice rules survive persona
  swaps (pinned by test). Seed shapes validated: registry names, artifact
  types, persona lanes. 123 tests green (+6), tsc clean.
- **Session 4 (1.4 envelopes):** artifact envelopes v2 shipped. Migration
  `20261105000000_artifact_lineage.sql` (version/parent_id/created_by on
  artifacts + the append-only `mothermode_research_artifact_versions`
  table). `upsertArtifact` bumps ONLY on content change
  (`shouldBumpArtifactVersion`: type/title/markdown/structured — status and
  handoff flips never version) and snapshots every creation + bump; the
  live row keeps its stable id so handoffs never move. Provenance: the
  executor stamps the expert slug, the admin route stamps 'owner' on hand
  edits. ArtifactView shows `v3 · by research` with a lazy-loaded History
  list and read-only version viewing. 117 tests green (+4 lineage), tsc
  clean.
- **Session 3 (Phase 1 chassis: 1.1 + 1.2 + 1.3):** the expert runtime
  shipped. `mothermode_experts` migration (RLS-on-no-policies), pure
  `experts/types.ts` (rowToExpert, DEFAULT_RESEARCH_EXPERT as the provable
  no-op config, expertAllowsArtifact with model-correctable reasons),
  `experts/store.ts` (reads DEGRADE to the code default — nothing breaks
  pre-seed). The loop resolves `expert ?? expertSlug ?? DEFAULT`, swaps the
  ROLE via `roleOverride` (SEARCH_DISCIPLINE extracted from ROLE so the
  house contracts survive a persona swap byte-identically), applies
  `policy` AFTER the lane (narrow-only), prefers the expert's model, and
  the executor blocks tools outside policy + artifacts outside contract
  with readable reasons. 113 tests green (11 experts + 2 new eval cases),
  tsc clean.
- **Session 2 (0.3 telemetry):** call telemetry + spend meter shipped —
  migration `20261103000000_research_agent_call_log.sql` (RLS-on-no-policies
  house pattern), pure cost model `agent/cost.ts` (cached = free, failed/
  blocked = free, estimates marked "est."), `store.logAgentCall`, loop
  telemetry (parallel writes, swallowed per call — telemetry never breaks a
  turn), trace-header meter via `formatSpendLine(summarizeCalls(calls))`,
  and `(cached)` markers added to the four result summaries that were
  missing them (voice_audit, voice_deep_dive, reddit_deep_dive,
  amazon_reviews). 100 tests green, tsc clean.
