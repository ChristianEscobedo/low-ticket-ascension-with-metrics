# Text Model Catalog Round (Claude Opus 5 / Fable 5 / Kimi K3) — Task

Status: **SHIPPED** (2026-07-28). System & port guide:
`TEXT_MODEL_CATALOG_SYSTEM_PORT.md`.

One ask: add **Kimi K3**, **Claude Opus 5**, and **Claude Fable 5** as models
to the selectors for outputs on all text generators. Shipped across the whole
suite — one registry entry point, one new provider, eleven generator files
wired, no migrations.

---

## 1. The registry (every selector)

`TEXT_MODELS` in `src/lib/mothermode/content/models.ts` is the single source
of truth every model `<select>` maps over (Generate drawer, Amplify, Batch,
Sheet forms, Variation Lab, Compliance panel). Three entries added, so all
selectors gained the options with zero UI changes:

| id | label | provider |
| --- | --- | --- |
| `claude-opus-5` | Claude Opus 5 | `anthropic` |
| `claude-fable-5` | Claude Fable 5 | `anthropic` |
| `kimi-k3` | Kimi K3 | `moonshot` (new) |

`TextProvider` widened to `'openai' | 'anthropic' | 'moonshot'`. The two
Claude models ride the existing Anthropic path with no plumbing changes.

## 2. The Moonshot (Kimi) provider

Kimi speaks the OpenAI-compatible chat API on its own base
(`https://api.moonshot.cn/v1`), so the generators reuse the OpenAI call shape
with a different base + key:

- `runtime-config.ts` — new `getMoonshotKey()` resolver, env-only like the
  Google image key: reads `MOONSHOT_API_KEY`, then `KIMI_API_KEY`.
- All **11 text generators** plumb it through: `openai-content`,
  `openai-email`, `openai-email-insights`, `openai-sales`, `openai-leadgen`,
  `openai-highticket`, `openai-community`, `openai-optin`, `openai-reel`,
  `openai-youtube`, `openai-compliance`.
  - Model picks (selector or `MOTHERMODE_AI_TEXT_MODEL` override) resolve the
    moonshot key when the catalog model's provider is `moonshot`, and degrade
    to Auto when the key is absent — never a hard fail.
  - `MOTHERMODE_AI_TEXT_PROVIDER=moonshot` works as a provider preference.
  - Auto keeps its historical order (Anthropic → OpenAI); Moonshot only wins
    when explicitly picked/preferred or when it is the only key present, so a
    Moonshot-only deployment works end to end.
  - The chat call is base-aware: `moonshot ? MOONSHOT_BASE : OPENAI_BASE`,
    with a matching missing-key message.
- The bulk wiring was applied by `scripts/add-moonshot-text-provider.cjs`
  (occurrence-asserted, idempotent, CRLF-safe) with `openai-email.ts` patched
  by hand as the reference implementation. Two image-API functions in
  `openai-content.ts` that shared the text missing-key line were reverted by
  hand (they have no moonshot scope — tsc caught it).

## 3. Config + docs

- `.env.example` documents `MOONSHOT_API_KEY` and the widened
  `MOTHERMODE_AI_TEXT_PROVIDER` ("anthropic" / "openai" / "moonshot") and the
  per-provider default models.
- `docs/CONTENT_GENERATE_SYSTEM_PORT.md` writer-model row lists the new
  catalog.

## 4. Verification

- `npx tsc --noEmit` — clean (two transient errors in `openai-content.ts`
  image functions found and fixed).
- New `tests/lib/text-models.test.ts` — 4/4 green: the three ids are
  selectable, provider mapping is exact, every option has a label + known
  provider + unique id, Auto/unknown resolve to undefined.
- Full `npx vitest run` — 929 passed / 39 failed; the 39 are the pre-existing
  Stripe/Supabase-env and two mothermode assertion failures, unchanged from
  the baseline before this round (+9 new tests green: 4 text-models + 5 email
  formatting from the previous task).

## Follow-ups

- The Moonshot key is env-only; if admins should manage it in-app, add a
  `moonshot` integration row like the `google` key precedent suggests and
  switch `getMoonshotKey()` to `resolve('moonshot', 'api_key', …)`.
- `DEFAULT_MOONSHOT_TEXT_MODEL = 'kimi-k3'` is the Auto fallback when Moonshot
  is the only provider; bump it here and in each generator if the Kimi line
  moves.
