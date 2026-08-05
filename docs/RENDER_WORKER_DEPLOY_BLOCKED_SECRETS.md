# Render worker deploy blocked by GitHub push protection — FINDING

> ## RESOLVED. The deploy is not blocked. Do not act on this document.
>
> Measured against the live worker, `commit ef518dd`:
>
> ```
> curl https://…up.railway.app/health
>   {"ok":true,"bundled":true,"build":{"commit":"ef518dd",…}}
> curl https://…up.railway.app/render/probe123
>   {"success":false,"error":"Unknown job id — the render worker restarted…"}
> curl -X POST -d '{}' https://…up.railway.app/render
>   {"success":false,"error":"Invalid plan — no clips."}   HTTP 400
> ```
>
> Both error strings are the **exact literals in current `server.js`**, em-dash and all,
> so the async job API is deployed and has been for some time. The push completed with no
> secret-scanning challenge; `origin/main` had already advanced past the commits this doc
> describes as stuck.
>
> **Why this doc was wrong, and it is worth naming precisely.** The "not deployed" verdict
> was inferred from a 404 on `GET /render/:jobId`. But a 404 there is the *documented,
> intended* response for an unknown job id — it is what a correctly deployed worker returns.
> The observation was compatible with both hypotheses and was read as confirming only one.
> That is the same error as reading "0 failures" from a suite where 0 tests ran.
>
> `/health` now echoes `RAILWAY_GIT_COMMIT_SHA`, so deploy freshness is a value you read
> rather than a state you infer from error-page shapes. **Check `build.commit` first.**

**Correction to the first version of this doc.** It claimed three real credentials
were committed. That was wrong, and it overstated the problem. Verified below:
**one** real credential, two false positives.

## What is actually in the commits

| Flagged | Where | Verdict |
|---|---|---|
| `ANTHROPIC_API_KEY` | `.env.local.bak:42`, commit `6f01559` | **REAL.** `sk-ant-api03-…`, 108 chars. Rotate it. |
| `sk_live_4eC39HqLyjWDarjtT1zdp7dc` | `tests/lib/research-recap.test.ts:48` | **Fake.** Stripe's own documentation example key. |
| `hooks.slack.com/services/T00000000/B00000000/XXXX…` | same file, line 66 | **Fake.** All-zero / all-X placeholder. |

The two fakes are fixtures in a test that asserts `redactSecrets()` masks them —
the test's whole purpose is proving we scrub this shape of string. GitHub's
scanner matches on pattern, not on liveness, so it flagged them anyway.

## Current state (verified, not assumed)

- `origin/main` **unchanged**. `git branch -r` shows only `origin/main` — the
  `deploy/render-worker` branch was never created. The push genuinely did not land.
- All 12 local commits intact, including the `d1ebce4` restore merge (`e1f00af`).
- The Anthropic key has **never reached GitHub**: `git log origin/main -- .env.local.bak`
  and `git branch -r --contains 6f01559` are both empty. Local-only exposure.
- `pnpm exec tsc --noEmit` passes.
- Live Railway worker is still the **old synchronous build** — `GET /render/:jobId`
  returns an Express HTML 404, so the async job API is not deployed yet.

## Done in this session

- `git rm --cached .env.local.bak` and added it to `.gitignore`. This stops future
  commits but does **not** remove it from commit `6f01559`, so the push stays blocked
  until history is rewritten.

## Remaining, in order

1. **Rotate the Anthropic key** at console.anthropic.com. Do this first and it stops
   mattering what happens to the old string. The two Stripe/Slack fixtures need no action.
2. **Purge `.env.local.bak` from history.** Surgical, file-scoped, does not touch code:
   ```
   git filter-repo --invert-paths --path .env.local.bak
   ```
   Rewrites all 12 commit SHAs and drops the `origin` remote — re-add it afterward.
   Tag first: `git tag backup/pre-filter-repo`.
   (Requires `pip install git-filter-repo`. `git filter-branch` is the built-in
   fallback but is slower and deprecated.)
3. **The two test fixtures** will still trip the scanner after the purge. Use GitHub's
   "allow" links for those two only — they publish nothing, because there is nothing
   real in them. Do not use the link for the Anthropic key; purge that one properly.
4. `git push origin main:deploy/render-worker`, point Railway at that branch, verify
   the async `jobId` + polling path.

## Safety nets

`git reset --hard backup/pre-restore-main` for the restore work. Add
`git tag backup/pre-filter-repo` before step 2. Neither `origin/main` nor production
has been touched at any point.
