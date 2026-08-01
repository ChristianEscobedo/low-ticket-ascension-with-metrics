/**
 * One-shot: bring MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md current with the
 * late-research wave + 1:1 Personalization.
 *
 *   1. Feature map: append rows 38 (Agent Skills), 39 (Mission Control),
 *      40 (1:1 Personalization) after row 37 (Research Lab).
 *   2. §2 migrations: the 20261101–20261119 rows (grouped).
 *   3. §3 env: PERSONALIZE_SECRET + research-source keys.
 *   4. §10 cross-refs: research-wave additions + personalization wave.
 *
 * Line-ending agnostic (works on LF or CRLF). Idempotent: skips anything
 * already present. Mirrors update-master-port-research-row.cjs.
 */
const fs = require('fs');
const path = require('path');

const DOC = path.join(__dirname, '..', 'docs', 'MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md');
const nl = (s) => (s.includes('\r\n') ? '\r\n' : '\n');

const src = fs.readFileSync(DOC, 'utf8');
if (src.includes('| 40 | **1:1 Personalization**')) {
  console.log('master port already current — nothing to do.');
  process.exit(0);
}
const EOL = nl(src);
let lines = src.split(/\r?\n/);

// ---------------------------------------------------------------------------
// 1. Feature map rows, inserted right after the row starting '| 37 |'
// ---------------------------------------------------------------------------
const FEATURE_ROWS = [
  '| 38 | **Agent Skills** (declarative skill registry: a skill is a ROW — an allowlisted HTTP request template with `{{input.*}}` vars, header-scoped `{{secret:NAME}}` resolution, dotted-path extraction, $/day caps, and a 5-failure breaker; drafts save imperfect, activation requires zero validator issues, test bench runs once live; ACTIVE skills bridge into the agent loop as first-class tools) (BUILT) | `src/lib/mothermode/research/skills/*` (types, store, template, run), `agent/skillBridge.ts`, `agent/toolDefs.ts`, `/admin/skills`, `/api/admin/mothermode-skills`, migration `20261116000000_research_skills.sql`, tests `tests/lib/research-skills.test.ts` + `tests/lib/research-skill-bridge.test.ts` | `AGENT_SKILLS_SYSTEM_PORT.md` |',
  '| 39 | **Mission Control + Gates + Command Palette** (the loop as the home screen: /admin strip with gates badge + today\'s fleet spend + job lane + active watches, crew presence, live cross-run event feed with 2s active / 30s idle polling; the phone-first /admin/gates Approve-Cancel screen; keyboard Command Palette mounted admin-wide) (BUILT) | `src/app/admin/MissionControl.tsx`, `src/app/admin/gates/page.tsx`, `src/app/admin/CommandPalette.tsx`, `recipes/crew.ts` (`missionSummary`, `gatedRuns`, `runProgress`), `/api/admin/mothermode-recipes` (+ `?activity=1`) + `/api/admin/mothermode-jobs`, tests `tests/lib/research-mission-control.test.ts` + `tests/lib/research-palette.test.ts` | `MISSION_CONTROL_SYSTEM_PORT.md` |',
  '| 40 | **1:1 Personalization** (every lead gets their own page: signed `?pp=` HMAC token on the email CTA, cached per-lead AI copy payload merged server-side onto funnel JSONB blocks — copy-only whitelist, price/Stripe/hrefs untouchable; off/overlay/**gated** modes with a decoy page for keyless visitors; capture-time + click-backstop generation; Hyperise-style dynamic per-recipient email images via a signed next/og endpoint; ESP pattern `?pp={{contact.pp_token}}`) (BUILT) | `src/lib/mothermode/personalize/*` (types, token, merge, context, store, generate, resolve, emailImage), `utils/integrations/openai-personalize.ts`, all `/funnel/*` + `/optin/*` routes, `/api/personalize/email-image`, `/admin/personalization` + `/api/admin/mothermode-personalize`, migration `20261119000000_mothermode_personalization.sql`, tests `tests/lib/personalize-token.test.ts` + `tests/lib/personalize-merge.test.ts` (29) | `PERSONALIZATION_SYSTEM_PORT.md` |',
];
const i37 = lines.findIndex((l) => l.startsWith('| 37 | '));
if (i37 === -1) {
  console.error('row 37 anchor not found — aborting without changes.');
  process.exit(1);
}
lines.splice(i37 + 1, 0, ...FEATURE_ROWS);

// ---------------------------------------------------------------------------
// 2. §2 migrations, appended after the kb_articles_audience row
// ---------------------------------------------------------------------------
const MIGRATION_ROWS = [
  '| `20261101000000`–`20261103000000` (3 files) | research lab core | Chat sessions/messages, session intake, agent call log (#37). See `RESEARCH_LAB_SYSTEM_PORT.md` |',
  '| `20261104000000`–`20261112000000` (9 files) | experts, lineage, evidence, recipes, jobs, watchlists, learnings, embeddings | The agentic arc: 8-expert crew, artifact envelopes, evidence base, declarative recipes, background job lane, weekly watches, cross-session learnings, semantic search (#37). See `AGENTIC_EXPERTS_RECIPES_ROADMAP_TASK.md` |',
  '| `20261113000000`–`20261115000000` (3 files) | message provenance, recipe run events, watchlist triggers | Live-follow runs in chat, the fleet event feed, cron-fired watches (#37, #39). See `RECIPES_VISIBILITY_UX_PORT.md` |',
  '| `20261116000000_research_skills.sql` | research skills | Declarative HTTP skill registry with host allowlist + secret scoping + breaker (#38). See `AGENT_SKILLS_SYSTEM_PORT.md` |',
  '| `20261117000000_recipe_run_shares.sql` | recipe run shares | Public read-only links for a recipe run (`/share/run/<token>`). See `RECIPES_VISIBILITY_UX_PORT.md` |',
  '| `20261118000000_phase4_cost_and_citations.sql` | cost telemetry + citations | Per-call cost rows and citation tracking for the agent fleet (#37, #39) |',
  '| `20261119000000_mothermode_personalization.sql` | personalization campaigns + lead personalizations | Per-funnel mode (off/overlay/gated) + cached per-lead AI copy payloads (#40). See `PERSONALIZATION_SYSTEM_PORT.md` |',
];
const iMig = lines.findIndex((l) => l.includes('`20261027000000_kb_articles_audience.sql`'));
if (iMig === -1) {
  console.error('migrations anchor not found — aborting without changes.');
  process.exit(1);
}
lines.splice(iMig + 1, 0, ...MIGRATION_ROWS);

// ---------------------------------------------------------------------------
// 3. §3 env additions, after the GOOGLE_SHEETS_* line
// ---------------------------------------------------------------------------
const ENV_LINES = [
  'PERSONALIZE_SECRET=        # optional HMAC for 1:1 personalization links/images (falls back to the service-role key)',
  'MONID_API_KEY=             # Research Lab social scraping (also settable in /admin/integrations)',
  'RAPIDAPI_KEY=              # Research Lab Amazon reviews (also settable in /admin/integrations)',
];
const iEnv = lines.findIndex((l) => l.startsWith('GOOGLE_SHEETS_*'));
if (iEnv !== -1) lines.splice(iEnv + 1, 0, ...ENV_LINES);

// ---------------------------------------------------------------------------
// 4. §10 cross-refs: extend the research wave, add the personalization wave
// ---------------------------------------------------------------------------
const iX = lines.findIndex((l) => l.includes('AGENTIC_EXPERTS_RECIPES_ROADMAP_TASK.md` (the agentic arc roadmap'));
if (iX !== -1) {
  lines.splice(
    iX + 1,
    0,
    '- `RECIPES_VISIBILITY_UX_PORT.md` (message provenance, live-follow runs in chat, expert identity everywhere, public run share links — SHIPPED)',
    '- `AGENT_SKILLS_SYSTEM_PORT.md` (declarative skill registry + agent bridge, SHIPPED) + `MISSION_CONTROL_SYSTEM_PORT.md` (Mission Control home, /admin/gates, Command Palette, SHIPPED) + `AGENTIC_GO_TO_ROADMAP_TASK.md` (the go-to arc roadmap)',
    '',
    '### Personalization wave (1:1 pages + per-recipient images)',
    '- `PERSONALIZATION_SYSTEM_PORT.md` (signed `?pp=` links, server-side copy merge with the money invariant, off/overlay/gated modes, capture-time AI payloads, dynamic per-recipient email images, ESP wiring — SHIPPED)',
  );
}

fs.writeFileSync(DOC, lines.join(EOL));
console.log('master port updated: feature rows 38-40, 7 migration rows, env, cross-refs.');
