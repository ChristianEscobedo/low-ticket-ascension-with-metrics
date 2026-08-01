# Mission Control + Gates + Command Palette — System Port

**Status:** shipped (roadmap UI thread) · **Migrations:** rides the research-wave tables (`20261108000000_agent_jobs.sql`, `20261114000000_recipe_run_events.sql`, `20261109000000` + `20261115000000` watchlists) — no dedicated migration · **Tests:** `tests/lib/research-mission-control.test.ts`, `tests/lib/research-palette.test.ts` · **Roadmap context:** `AGENTIC_EXPERTS_RECIPES_ROADMAP_TASK.md`

The loop as the home screen. Once Agents run in the background, three admin
surfaces answer the questions the old Overview never could: **is anything
waiting on me** (gates), **what is the crew doing right now** (Mission
Control), and **how do I get anywhere fast** (Command Palette).

## Surfaces

### 1. Mission Control — `/admin` (home), `src/app/admin/MissionControl.tsx`

One read-only panel: the strip (gates badge, today's fleet spend in cents,
the job lane, active watches), **crew presence** (who is working, on what,
which step), and the fleet's live event feed (cross-run, newest first, 12
rows).

- Polls `/api/admin/mothermode-recipes` (+ `?activity=1`) and
  `/api/admin/mothermode-jobs` every **2s while anything is active or
  gated, 30s when idle** — so a cron-fired watch run still surfaces. SSE is
  the documented later upgrade, not a requirement.
- **Read-only by design**: gate decisions happen on the run page or the
  Gates screen; Mission Control is the thing that TELLS you one is waiting.
- Pure helpers in `src/lib/mothermode/research/recipes/crew.ts`:
  `missionSummary`, `gatedRuns`, `runProgress`, `isRunActive`,
  `expertDisplayName`, `formatAgo` — the unit-testable half
  (`research-mission-control.test.ts`).

### 2. Gates — `/admin/gates`, `src/app/admin/gates/page.tsx`

The mobile gate screen: every run paused on a human yes, with the gated
step's note and two BIG tap targets (Approve / Cancel) — nothing else.
Phone-first (full-width cards, 48px buttons), 5s poll while any gate waits.
Decisions POST `{ action: 'approve' | 'cancel', runId }` to
`/api/admin/mothermode-recipes`.

### 3. Command Palette — `src/app/admin/CommandPalette.tsx`

Keyboard-first navigation + actions across the admin (pages, recipes,
gates, jobs). The searchable command index is pure
(`tests/lib/research-palette.test.ts` pins ranking/labels), mounted in
`src/app/admin/layout.tsx` so it works from every admin page.

## Backing APIs

| Route | Role |
|---|---|
| `/api/admin/mothermode-recipes` | recipes + runs + watchlists + crew directory; `?activity=1` event feed; POST approve/cancel/run/draft |
| `/api/admin/mothermode-jobs` | the background job lane (`mothermode_agent_jobs`): queued/running/done with `{step, total, note}` progress stamps — the tick worker Mission Control watches |

## Port notes

- No new tables: the surfaces read the recipes/jobs/watchlists/events rows
  from the research wave — port those FIRST (see `RESEARCH_LAB_SYSTEM_PORT.md`
  and `AGENTIC_EXPERTS_RECIPES_ROADMAP_TASK.md`).
- The polling cadence (2s active / 30s idle / 5s gates-waiting) is the whole
  liveness story; keep it when porting and only upgrade to SSE deliberately.
- Everything visual is dark admin theme (bone/ink/brass) like the rest of
  `/admin`.

## Verification

- `npx vitest run tests/lib/research-mission-control.test.ts tests/lib/research-palette.test.ts`
- `npx tsc --noEmit`
