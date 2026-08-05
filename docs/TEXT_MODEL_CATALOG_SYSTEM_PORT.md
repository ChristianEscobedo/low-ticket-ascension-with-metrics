# Text Model Catalog & Provider Plumbing — System & Port Guide

Status: **BUILT** (round: Claude Opus 5, Claude Fable 5, Kimi K3 + the
Moonshot provider, spec `TEXT_MODEL_CATALOG_ROUND_TASK.md`).

Every text-writing surface in the suite — content hub generate, rewrite,
amplify, batch, variation lab, compliance, reel director, YouTube, and every
kit generator (email, sales, lead-gen, high-ticket, community, opt-in, email
insights) — picks its writer from ONE catalog and resolves that choice through
ONE provider pattern. An admin chooses a model in a `<select>` (or leaves
Auto), the choice travels as a plain model id to the server, and the
generator maps it to the provider that serves it, degrading gracefully to
Auto when the provider's key is missing.

The design rule: **the catalog is the only place models are added, and each
provider is plumbed exactly once per generator file.** No UI change is ever
needed to ship a new model — the selectors map the catalog.

---

## 1. File map

```
src/lib/mothermode/content/models.ts        TEXT_MODELS / IMAGE_MODELS registry
                                            (client-safe; selectors + resolvers
                                            share it). TextProvider union.
src/utils/integrations/runtime-config.ts    Key resolvers (DB-first, env-fallback):
                                            getOpenAiKey / getAnthropicKey /
                                            getMoonshotKey / getGoogleKey,
                                            getTextModelOverride / getTextProviderOverride
src/utils/integrations/openai-content.ts    Content hub generator (resolver-style)
src/utils/integrations/openai-reel.ts       Reel director (resolver-style)
src/utils/integrations/openai-youtube.ts    YouTube scripts (resolver-style)
src/utils/integrations/openai-compliance.ts Compliance agent (resolver-style)
src/utils/integrations/openai-email.ts      Email kit (TextConfig-style)
src/utils/integrations/openai-email-insights.ts  Email insights (TextConfig-style)
src/utils/integrations/openai-sales.ts      Sales funnel AI (TextConfig-style)
src/utils/integrations/openai-leadgen.ts    Lead gen kit (TextConfig-style)
src/utils/integrations/openai-highticket.ts High ticket kit (TextConfig-style)
src/utils/integrations/openai-community.ts  Community kit (TextConfig-style)
src/utils/integrations/openai-optin.ts      Opt-in kit (TextConfig-style)
scripts/add-moonshot-text-provider.cjs      The occurrence-asserted patch script
                                            that applied the moonshot wiring
tests/lib/text-models.test.ts               Registry pins
.env.example                                MOONSHOT_API_KEY + provider docs
```

Selectors consuming the catalog (no changes needed, ever): `BatchPanel`,
`AmplifyPanel`, `CompliancePanel`, `SheetForms`, `VariationLabPanel`.

---

## 2. The registry (`models.ts`)

```ts
export type TextProvider = 'openai' | 'anthropic' | 'moonshot';

export interface TextModelOption {
  id: string;              // the provider's API model name
  label: string;           // selector label
  provider: TextProvider;  // who serves it
  note?: string;           // shown beside the label
}
```

Current catalog: `claude-opus-5`, `claude-fable-5`, `claude-opus-4-8`
(anthropic), `gpt-5.5` (openai), `kimi-k3` (moonshot).

- `AUTO_MODEL = ''` — the "let the server decide" selector value.
- `getTextModel(id)` — catalog lookup; undefined for Auto/unknown, which is
  what triggers the server-side fallback chain.
- The module is client-safe (no env, no server imports) so the browser
  selectors and the server resolvers share one source of truth.

---

## 3. Key resolution (`runtime-config.ts`, server-only)

DB-first (enabled `integrations` rows), env-fallback, 30s cache:

- `getOpenAiKey()` / `getAnthropicKey()` — DB row `openai` / `anthropic`
  `api_key`, else `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.
- `getMoonshotKey()` — **env-only** (the `google`-key precedent):
  `MOONSHOT_API_KEY`, then `KIMI_API_KEY`.
- `getTextModelOverride()` — global model override (`text_model` rows, else
  `MOTHERMODE_AI_TEXT_MODEL`). Resolved through `getTextModel`, so only
  catalog ids ever take effect.
- `getTextProviderOverride()` — coarse provider preference
  (`MOTHERMODE_AI_TEXT_PROVIDER`): `"anthropic" | "openai" | "moonshot"`.

---

## 4. The two generator patterns

All eleven generators implement the same contract in one of two shapes.
Both honor: **an explicit catalog pick wins when its provider has a key;
anything else degrades to Auto — never a hard fail.**

### 4a. Resolver-style (content, reel, youtube, compliance)

```ts
availableTextProvider(preferred?)      // anthropic → openai → moonshot (only when
                                       // preferred or the only key present)
resolveTextModel(requested?)           // getTextModel(requested) → key check →
                                       // provider override → model override → Auto
```

Dispatch is a two-way ternary with the OpenAI-compatible side provider-aware:

```ts
const raw =
  provider === 'anthropic'
    ? await anthropicJson(system, user, model)
    : await openAiJson(system, user, model, provider);

async function openAiJson(system, user, model, provider = 'openai') {
  const moonshot = provider === 'moonshot';
  const key = moonshot ? await getMoonshotKey() : await apiKey();
  const res = await fetch(
    `${moonshot ? MOONSHOT_BASE : OPENAI_BASE}/chat/completions`, …);
}
```

Kimi needs no special casing beyond base + key: it speaks the
OpenAI-compatible chat API (`response_format: { type: 'json_object' }`
included) on `https://api.moonshot.cn/v1`.

### 4b. TextConfig-style (email, insights, sales, leadgen, highticket,
community, optin)

One `resolveTextConfig()` returns `{ provider, model, key }` for a single
`callOpenAiJson` whose else-branch picks the base:

```ts
const base = cfg.provider === 'moonshot' ? MOONSHOT_BASE : OPENAI_BASE;
```

Resolution order inside: catalog model override → provider preference
(`anthropic` / `openai` / `moonshot`) → Anthropic default → Moonshot default
(only when it is the sole key) → OpenAI default. The no-keys guard reads
`if (!openaiKey && !anthropicKey && !moonshotKey)`.

Each file carries `MOONSHOT_BASE` and `DEFAULT_MOONSHOT_TEXT_MODEL =
'kimi-k3'` constants beside the existing OpenAI/Anthropic ones (house style
keeps these per-file; the suite duplicates `OPENAI_BASE` the same way).

---

## 5. Adding the next model (the recipe)

**A model on an existing provider** (e.g. the next Claude or GPT): add ONE
entry to `TEXT_MODELS`. Selectors, per-request picks, and the env override
all start accepting it immediately. Nothing else to touch.

**A model on a new provider:**

1. `models.ts` — widen `TextProvider`, add the catalog entry.
2. `runtime-config.ts` — add a `get<Provider>Key()` resolver (env-only is
   fine; promote to DB-backed via `resolve('<provider>', 'api_key', …)` when
   admins should manage it in-app).
3. Every generator (11 files): fetch the key next to the others, add the
   provider to the pick ternary / preference chain / no-keys guard, and make
   the chat call base-aware (or add a sibling call function when the API
   shape differs from OpenAI-compatible).
4. `.env.example` — document the key.
5. `tests/lib/text-models.test.ts` — the pins fail until the entry exists.

`scripts/add-moonshot-text-provider.cjs` is the worked example of step 3:
occurrence-asserted string edits, idempotent (skips applied edits), CRLF-safe
(normalizes line endings and writes them back). Reuse its `apply()` runner
for the next provider.

---

## 6. Config

```bash
MOONSHOT_API_KEY=            # Kimi models (KIMI_API_KEY is the fallback)
MOTHERMODE_AI_TEXT_PROVIDER= # anthropic | openai | moonshot (Auto when unset)
MOTHERMODE_AI_TEXT_MODEL=    # global override; must be a TEXT_MODELS id
```

Auto behavior summary: a selector on Auto (or a pick whose provider has no
key) falls to Anthropic when its key exists, then OpenAI, then Moonshot —
Moonshot never steals Auto, it only wins when chosen or when it is the only
key, so Moonshot-only deployments work.

---

## 7. Port order (sibling codebase)

1. Port `models.ts` wholesale (registry + unions + helpers).
2. Port the key resolvers from `runtime-config.ts` (openai, anthropic,
   moonshot; google if image models come along).
3. Port ONE generator end to end — `openai-email.ts` is the reference
   implementation for TextConfig-style; `openai-reel.ts` for resolver-style.
4. Replicate the pattern into the remaining generators (use the patch script
   as the checklist: import, base const, default-model const, key load +
   guard, pick ternary, provider pref, fallback, call base).
5. `.env.example` entries, then `tests/lib/text-models.test.ts`, then
   `npx tsc --noEmit`.

### Verification

- `npx tsc --noEmit` exits 0 (watch for shared missing-key lines in
  non-text functions — that was the one regression tsc caught this round).
- `npx vitest run tests/lib/text-models.test.ts` — 4 green.
- Pick each model in the Generate drawer with only that provider's key set:
  output lands; switch the key off and it degrades to Auto instead of erroring.

---

## 8. Follow-ups

- Promote `getMoonshotKey()` to a DB-backed `moonshot` integration row when
  admins should rotate the key in-app (mirror `getOpenAiKey`'s `resolve()`).
- `DEFAULT_MOONSHOT_TEXT_MODEL` is the Auto model when Moonshot is the only
  provider — bump it with the Kimi line, per file.
- The selectors render in catalog order; newest-first is the current
  convention (Opus 5, Fable 5, Opus 4.8, GPT-5.5, Kimi K3).
