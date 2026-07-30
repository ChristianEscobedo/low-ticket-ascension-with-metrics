# AI-fill failure: `Invalid API key` — root cause and fix

## Symptom

Dev log on the sales-funnel editor:

```
[mothermode-media] read failed: Invalid API key
```

AI-fill does nothing. The message names Supabase, not OpenAI/Anthropic —
"Invalid API key" with that `hint` wording is PostgREST's 401 response, not a
model-provider error. That distinction is what pointed at env rather than the AI
integration.

## Root cause

`.env.local` carried a `SUPABASE_SERVICE_ROLE_KEY` issued for a **different
Supabase project** than the one the app talks to:

| file | `NEXT_PUBLIC_SUPABASE_URL` project | `service_role` JWT `ref` |
| --- | --- | --- |
| `.env` | `vxnikdhgwmcmvanqjeug` | `vxnikdhgwmcmvanqjeug` ✅ |
| `.env.local` | `vxnikdhgwmcmvanqjeug` | `fljnvfwyymrivsypnpea` ❌ |

Next.js loads `.env.local` at **higher precedence** than `.env`, so the wrong key
won. Supabase validates that a JWT's `ref` claim matches the project being
addressed, so every service-role request 401'd.

Proven by direct REST probe against `/rest/v1/integrations` (not inferred):

```
.env service_role       : HTTP 200 []
.env.local service_role : HTTP 401 {"message":"Invalid API key", ...}
```

### Why this broke AI-fill specifically

`src/utils/integrations/store.ts` builds one module-scoped service-role client,
and it is the shared path for `getIntegration` / `listIntegrations` plus the
sales-funnel and media stores. With an unusable key, **every** server-side
service-role read fails at once — media reads (the logged line), the
`integrations` lookup that resolves provider keys, and the funnel load/save that
AI-fill performs around the model call. The model call was never the blocker.

Note both failures were *silent by design*: `listIntegrations` logs and returns
`[]` on error rather than throwing, so a hard credential failure degraded into
"no integrations configured" instead of a visible error.

## Fix applied

`scripts/fix-env-local-service-role.cjs` comments out (does not delete) the stale
line in `.env.local`, so `.env`'s correct same-project key becomes effective.
A one-time `.env.local.bak` is written. The script is idempotent and prints no
secrets.

Re-running `scripts/diagnose-ai-fill.cjs` after the fix shows the effective
`service_role` resolving to `vxnikdhgwmcmvanqjeug` and the probe returning
HTTP 200.

**Env files are only read at process boot — the dev server must be restarted.**

## Verification (not yet done in-browser)

1. Restart the dev server.
2. Open the Offer tab and click AI-fill.
3. The `[mothermode-media] read failed: Invalid API key` line should be gone.

Treat as confirmed only once AI-fill actually populates fields.

## Outstanding caveat: no OpenAI key anywhere

Two things the diagnostic surfaced that are *not* fixed by the above:

- The `integrations` table is **empty** (`HTTP 200 []`) even with the good key,
  so provider credentials resolve purely from env.
- `OPENAI_API_KEY` is absent from both `.env` and `.env.local`.
  `ANTHROPIC_API_KEY` is present.

`resolveTextConfig()` in `src/utils/integrations/openai-sales.ts` falls back to
Anthropic when the OpenAI key is missing, so text generation should still work —
but anything hardcoded to OpenAI (e.g. image generation) will not. If AI-fill
still fails after the restart, this is the next thing to check, not the DB key.

## Tools added

- `scripts/diagnose-ai-fill.cjs` — read-only. Reports project/key alignment,
  live REST probe, and which provider keys are visible. Prints no secrets.
- `scripts/fix-env-local-service-role.cjs` — applies the fix above.
