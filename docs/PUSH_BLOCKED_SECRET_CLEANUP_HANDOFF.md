# Push blocked by committed secrets — cleanup handoff

**Status:** push to `origin/main` is BLOCKED. 15 unpushed commits. Railway/Vercel therefore
still run pre-fix code, so the caption MP4 parity fix is **not deployed and not verified**.

---

## Read this first: two corrections to earlier claims

1. **"Both renderers read one `captions.ts`, so they cannot drift."** — FALSE, retracted.
   `render-worker/remotion-project/CaptionLayer.tsx` imports `'../src/lib/mothermode/reel/captions'`,
   which resolves to a **vendored copy** at `render-worker/src/lib/mothermode/reel/captions.ts`.
   The worker Dockerfile does `COPY . ./`, so Railway builds that copy. Both files are now
   fixed and a parity guard test exists, but this claim hid the bug for a full session.

2. **"The scrub broke 4 tests."** — FALSE, retracted (I asserted this mid-session and acted on it).
   I "verified" it by checking out the pre-scrub file into the worktree and running vitest.
   The run produced `failures: 0`, which I read as green. It was actually vitest **failing to
   collect the file at all** and emitting an empty `assertionResults` array — zero tests ran, so
   zero failed. I then reverted good work on that bad signal.

   Corrected measurement, taken by resetting to the tag and re-running:
   - `backup/pre-filter-repo` (pre-scrub): **41 passed / 4 failed**
   - scrubbed HEAD: **41 passed / 4 failed**

   Identical ⇒ the scrub is behavior-neutral. The 4 failures are **pre-existing and unrelated**.

   *Lesson for the next session: a "0 failures" count is only meaningful alongside a nonzero
   "tests ran" count. Assert on passed-count too, never on failed-count alone.*

---

## Pre-existing bug found in passing (NOT caused by this work)

4 failures in `tests/lib/research-recap.test.ts`, all in `redactSecrets`:

- `redactSecrets masks OpenAI-style keys`
- `redactSecrets masks AWS access key ids`
- `redactSecrets masks GitHub + Slack token shapes`
- `buildRunRecap redacts credential shapes in turn content and tool summaries`

`src/lib/mothermode/research/redact.ts` is failing to mask credential shapes it claims to mask.
This is a **live security defect** — unmasked credentials can reach recap output — and it is
almost certainly related to why secrets keep ending up in committed artifacts. Fix this on its
own branch; it is not blocked by the push.

---

## The actual push blocker

GitHub push protection (GH013) has flagged, so far:

| Path | Line |
|---|---|
| `docs/RENDER_WORKER_DEPLOY_BLOCKED_SECRETS.md` | 12 |
| `tests/lib/research-recap.test.ts` | 48 |

Note the irony: the doc written to *describe* the blocked-secret problem pasted a real
credential into its prose. GitHub reveals blocked paths **one push at a time**, so assume more
will surface after these two are cleaned.

### Already done
- `.env.local.bak` purged from all history.
- Backup tag `backup/pre-filter-repo` exists (pre-rewrite state, nothing is lost).

### What did NOT work — don't repeat it
`git filter-branch --tree-filter` with **guessed regexes** for JWT / `sk-ant-` / `sbp_` / `ghp_`
shapes. Result: `WARNING: Ref 'refs/heads/main' is unchanged` — zero matches — while 3 commits
still contained a secret shape. The real values don't match those patterns and I never looked at
them, so I was guessing. Helper left at `C:/Users/artof/scrub-doc-secret.cjs` (ineffective as-is).

### Recommended approach
Use **exact literals**, not shapes. `git filter-repo --replace-text` takes a file of literal
`old==>new` pairs and needs no pattern guessing:

1. Read the two flagged lines to get the exact literal values:
   - `docs/RENDER_WORKER_DEPLOY_BLOCKED_SECRETS.md:12`
   - `tests/lib/research-recap.test.ts:48`
2. Write `replacements.txt` **outside the repo** with one `literal==><REDACTED-ROTATE-THIS>` per line.
3. `git filter-repo --replace-text ../replacements.txt --force`
4. Re-run the full suite and confirm **41 passed / 4 failed** (unchanged ⇒ neutral).
5. Push. If a new path is flagged, add it to `replacements.txt` and repeat.

Prefer `git-filter-repo` over `filter-branch` (faster, and `filter-branch` is deprecated).
`--replace-text` also scrubs the value everywhere it appears, not just the flagged line.

---

## ROTATE THESE CREDENTIALS — do this regardless of the scrub

Scrubbing git history does **not** un-leak a secret. These values existed in local commits and
may persist in shell scrollback, editor undo buffers, and CI logs. Treat as compromised:

- [ ] Supabase **service-role** key
- [ ] Anthropic API key
- [ ] Any other credential found at the flagged lines during cleanup

This is the highest-priority item in this document. It is not blocked by the push.

---

## Remaining work, in order

1. **Rotate the credentials above.** Not blocked by anything.
2. Finish the secret scrub via `--replace-text`; push the 15 commits.
3. Redeploy Railway, then **verify MP4 caption parity for real** — render a clip and confirm
   word-spacing and whitespace match preview. Neither preview correctness nor MP4 parity has
   been observed; both currently rest on reasoning alone. No gap has been seen to move.
4. Fix the 4 `redactSecrets` failures in `src/lib/mothermode/research/redact.ts`.
5. Item 2 from the original task (render button across three surfaces) — still untouched, as intended.

## Caption work that IS complete

- Both `captions.ts` copies carry the two fixes: `wordSpacing: ${def.wordSpacingEm ?? 0}em`
  (was a truthy gate that dropped `0`) and `whiteSpace: 'pre-wrap'` on the shared `word`/`active`
  styles, with comments recording the inline-block whitespace-trimming mechanism.
- `tests/lib/caption-vendor-parity.test.ts` asserts both copies produce identical `captionCssFor`
  output, so this silent render-path-only drift can't recur unnoticed.
- `tests/lib/caption-presets.test.ts` passes.


---

## CORRECTION (session 3): the scrub plan was wrong. Both remaining blocks are false positives.

The previous plan — rewrite all 16 commits with `git filter-repo --replace-text` — should
NOT be executed. Two independent reasons, both discovered by looking at the actual values
instead of guessing at their shape.

### 1. The naive literal extractor was dangerous

Extracting "any token >= 20 chars" from the flagged lines produced 23 "secrets", including:

| captured | what it actually is |
|---|---|
| `@/li...[len=43]`, `@/li...[len=40]` (6 total) | `@/lib/...` **import paths** |
| `cons...[len=22]`, `depl...[len=20]`, `back...[len=23]` | ordinary English prose |

A `--replace-text` pass over that list would have rewritten source import paths across
all 16 commits, silently breaking the build in every one. The generated `replacements.txt`
was deleted rather than run. **Never scrub on a shape you have not looked at.**

### 2. The two flagged values are not credentials

```
docs/RENDER_WORKER_DEPLOY_BLOCKED_SECRETS.md:12
tests/lib/research-recap.test.ts:48
```

Both are the same literal, masked as `sk_live_***p7dc [len=32]`. The body is
`4eC39HqLyjWDarjtT1zdp7dc` — **Stripe's own published documentation example key** — with
the `sk_live_` prefix swapped on to exercise the live-key branch of `redactSecrets`.
`research-recap.test.ts` is the *test suite for the redactor*; the fixture is the point of
the test. Scrubbing it would delete the test's reason to exist.

Note this doc's own triage table (lines 11-13) already said "Fake." That was correct and was
being ignored in favour of a mechanical scrub.

### The real secret is already handled

Line 11: the Anthropic key was **REAL**, but it lived in `.env.local.bak`, which is already
purged from history. This doc names only the `sk-ant-api03-…` prefix, not a usable value.
**It still must be rotated** — purging history does not un-leak a key that was pushed.

### Correct remedy: allow the false positive

Editing HEAD would not help; push protection scans every commit in the range, and the
literal exists in older blobs. Use the bypass:

https://github.com/ChristianEscobedo/low-ticket-ascension-with-metrics/security/secret-scanning/unblock-secret/3HTfupSaUG8XSPumkgenceRJ3KY

Choose **"It's used in tests"**. Then `git push origin main` (16 commits). If a second
detection appears for the other path, the push error prints its own unblock URL.

## Railway / Vercel: two separate actions

Code and credentials deploy through different channels — doing one without the other breaks
the worker:

1. **Code** — Railway auto-deploys on push to `main`. Once the push lands, the worker
   rebuilds and picks up the vendored-captions fix. Nothing to click.
2. **Credentials** — rotated keys live as **env vars in the Railway and Vercel dashboards**,
   not in git. Rotating the Anthropic key without updating both dashboards means the next
   deploy authenticates with a dead key.

Order: rotate → update Railway env vars → update Vercel env vars → redeploy.

## Still unverified

- **MP4 caption parity.** Unchanged from session 2: no gap has been observed closing. The
  vendored-copy fix and the parity guard are reasoned-about, not rendered. First render
  after the Railway redeploy is the actual test — compare letter-spacing and word-spacing
  against the preview.
- **Item 2 (render button across three surfaces)** remains untouched, as intended.
