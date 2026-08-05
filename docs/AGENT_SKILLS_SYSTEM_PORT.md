# Agent Skills — System Port

**Status:** shipped (Phase 3 of the agentic arc) · **Migration:** `supabase/migrations/20261116000000_research_skills.sql` · **Tests:** `tests/lib/research-skills.test.ts`, `tests/lib/research-skill-bridge.test.ts` · **Roadmap context:** `AGENTIC_EXPERTS_RECIPES_ROADMAP_TASK.md`

A **declarative skill** is a ROW, never code: a validated HTTP request
template (allowlisted host, declared `{{input.*}}` vars, scoped-secret
headers, dotted-path extraction) that any Expert or Recipe can call as a
tool. `/admin/skills` is the registry: drafts save imperfect, **activation
requires zero validator issues**, and a test bench runs any skill once,
live, with the outcome unrecorded.

The standing guardrail: nothing is ever `eval`'d. The validator
(`skills/types.ts`) decides what can even BE a row, and the template engine
(`skills/template.ts`) is the only thing that ever "runs" one.

## Pieces

| Piece | Where | What |
|---|---|---|
| Row shape + validator | `src/lib/mothermode/research/skills/types.ts` | `ResearchSkill`, `SkillExecutor` (`kind: 'http'` only — a "prompt skill" is an Expert, adding kinds is a considered change), `skillDraftErrors` (the same validation the API enforces at activation), `SKILL_BREAKER_FAILURES = 5` (auto-pause breaker) |
| Template engine | `skills/template.ts` | Fills `{{input.*}}` / `{{secret:NAME}}` markers; secrets resolve ONLY from `SKILL_SECRET_<NAME>` env vars and ONLY ever in headers — URLs and bodies refuse secrets by construction |
| Store | `skills/store.ts` | Service-role CRUD on `mothermode_research_skills`, lazy client, degrades to [] like every mothermode store |
| Run (one call) | `skills/run.ts` | Executes one skill once: fills the template, fires the request, pulls `extract` dotted paths out of the JSON response, stamps cost + failure counters |
| Agent bridge | `src/lib/mothermode/research/agent/skillBridge.ts` | Exposes ACTIVE skills to the agent loop as first-class tools next to the built-in registry (`agent/toolDefs.ts`); a paused/drafted skill is invisible to the agent |
| Registry UI | `src/app/admin/skills/page.tsx` | Draft editor (input keys, allowed hosts, method, URL template, header/body templates, extract paths, $/call est., calls/day cap), activate/pause/delete, and the one-shot test bench with live JSON result |
| Admin API | `src/app/api/admin/mothermode-skills/route.ts` | `requireAdminRoute`-guarded; GET full registry, POST upsert/activate/pause/delete/test — activation re-validates and refuses with the error list |

## Table

`mothermode_research_skills`: `slug` (unique), `name`, `description`,
`input_keys jsonb`, `allowed_hosts jsonb`, `executor jsonb`,
`cost_est_cents`, `max_calls_per_day`, `status ('draft'|'active'|'paused')`,
`consecutive_failures`, `last_called_at`, timestamps. Service-role only
(RLS on, no anon policies — the mothermode default).

## Invariants worth keeping on a port

1. **Data, not code.** If a feature needs logic, it is an Expert or a code
   tool — never a skill. The executor stays HTTP-only.
2. **Host allowlist is the security boundary.** `allowed_hosts` are bare
   hostnames (subdomains allowed); the template engine refuses any URL not
   under them.
3. **Secrets never leave headers.** `{{secret:NAME}}` in a URL or body
   template is a validation error, so a key can never land in a logged URL.
4. **The breaker.** 5 consecutive failures auto-pauses a skill and the row
   says so (`consecutive_failures`) — a dead endpoint never silently burns
   the daily call budget.
5. **Activation is earned.** Drafts may be imperfect; `active` requires
   `skillDraftErrors` empty, enforced BOTH in the editor and in the API.

## Verification

- `npx vitest run tests/lib/research-skills.test.ts tests/lib/research-skill-bridge.test.ts`
- `npx tsc --noEmit`
