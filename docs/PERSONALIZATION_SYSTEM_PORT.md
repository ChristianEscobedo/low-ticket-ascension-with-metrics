# 1:1 Personalization — System Port

**Status:** shipped (phase 1 + 2 core) · **Migration:** `supabase/migrations/20261119000000_mothermode_personalization.sql` · **Tests:** `tests/lib/personalize-token.test.ts`, `tests/lib/personalize-merge.test.ts` (29 passing)

One funnel, a different page for every lead. An email CTA carries a **signed
`?pp=` token** naming the recipient; the (already `force-dynamic`) funnel
route verifies it, loads the recipient's **cached AI payload**, and merges
sparse copy overrides onto the funnel's JSONB content blocks **before
render** — server-side hydration with zero client flicker, nothing sensitive
in the URL, and no API surface. In **gated** mode the offer renders only for
valid-token holders; everyone else gets a decoy page (competitor cloaking).

This is the server-owned answer to the HighLevel "stringified JSON in a 20k
URL param + client-JS hydration" play: same 1:1 outcome, minus the URL bloat,
flicker, and data exposure.

## Decision table

| mode \ token | valid `?pp=` + cached payload | valid token, no payload | no/invalid token |
|---|---|---|---|
| `off` (default) | generic page | generic page | generic page |
| `overlay` | **personalized page** | generic + generation backstop | generic page |
| `gated` | **personalized page** | generic + backstop (valid key ≠ decoy) | **decoy page** |

Admins always get base content (inline-editor stability). Gated-out visitors
never fire view/conversion events.

## Architecture

```
email CTA ─ ?pp=<b64url(JSON).<HMAC-SHA256>> ─► funnel route (force-dynamic)
    │                                            ├─ resolveSales/OptinPersonalization
    │                                            │    ├─ verifyPersonalizationToken (HMAC, exp, fid+kind bound)
    │                                            │    ├─ getPersonalizationSettings (mode)
    │                                            │    └─ getLeadPersonalization (cached payload)
    │                                            └─ mergeSales/OptinFunnelPayload  ← WHITELIST copy merge
    ▼                                                                                 (price/Stripe/hrefs untouchable)
capture routes ─ fire-and-forget ─► generateLeadPersonalization ─► aiGeneratePersonalization
    │                                   (context.ts: PII-minimal snapshot)   (openai-personalize.ts: JSON contract)
    └─ mothermode_lead_personalizations (unique per funnel+lead, upsert) ◄──┘
```

### Modules (`src/lib/mothermode/personalize/`)

| file | role |
|---|---|
| `types.ts` | settings/payload/token types + defensive normalizers; `toTokenPayload` |
| `token.ts` | HMAC sign/verify (timing-safe, exp, 2k cap), `buildPersonalizedUrl`. Deterministic per (funnel, email) → bulk ESP custom-field export works |
| `merge.ts` | **the money invariant**: whitelist copy-only merge onto funnel records; `{name}` templating (→ first name or 'there'); `validAccentColor` |
| `context.ts` | PII-minimal lead snapshot + funnel summary builders (email domain only, never the address) |
| `store.ts` | service-role CRUD for both tables + lead-facts readers (per-kind column lists — sales/optin lead tables differ) |
| `generate.ts` | generation orchestrator: mode-gated, skip-if-exists, admin-lock respect, in-flight de-dupe, batch |
| `resolve.ts` | the per-render seam: settings × token → merged funnel / gated / generic + click-time backstop |
| `emailImage.ts` | dynamic-image campaign keys, HMAC over (campaign, template), text sanitizers, path builder |
| `src/utils/integrations/openai-personalize.ts` | the AI pass: strict JSON contract, OpenAI JSON mode + Anthropic fallback, `normalizePayload` coercion |

### Data

- `mothermode_personalization_campaigns` — per-funnel: `mode` (off/overlay/gated), `guidance`, `base_image_url`, `email_image_enabled`. Default-off ⇒ applying the migration changes nothing.
- `mothermode_lead_personalizations` — cached AI payload per `(funnel_kind, funnel_id, lead_key)`; `source` = `ai` | `admin` (admin hand-edits are never machine-overwritten unless cleared).

### Surfaces

- **Routes**: all 10 `/funnel/[slug]/*` + 3 `/optin/[slug]/*` pass `searchParams.pp` into the resolve seam; `GatedPage.tsx` is the decoy. `loadSalesFunnelPage(slug, eventType, { pp })` → `{ funnel, isAdmin, gated, personalized, segment }`.
- **Capture**: `/api/funnel/capture` + `/api/optin/capture` fire `triggerAutoPersonalization` after a successful capture (void, swallowed — same pattern as email-kit enrollment).
- **Admin**: `/admin/personalization` (+ sidebar) over `/api/admin/mothermode-personalize` (save / generate / clear / payloads / link / image-link).
- **Email image**: `GET /api/personalize/email-image` — signed (campaign+template), `email_image_enabled` gate, per-IP rate limit, sanitized text, `next/og` PNG, CDN-cached, 1x1 GIF fallback (an email image never 500s).

## ESP wiring (GHL etc.)

1. `/admin/personalization` → set funnel to `overlay`/`gated`, save, generate.
2. Mint a signed link per lead (or bulk: token is deterministic per
   funnel+email, so it can be precomputed and uploaded as a custom field
   `{{contact.pp_token}}`).
3. CTA URL: `https://<domain>/funnel/<slug>?pp={{contact.pp_token}}`.
4. Email creative: `<img src="https://<domain>/api/personalize/email-image?c=…&tpl=name-card&name={{contact.first_name}}&sig=…">`
   (URL minted by the `image-link` action; recipient name renders at open time.)

## Security invariants

- Token: HMAC-SHA256, timing-safe compare, optional `exp`, 2k length cap, bound to funnel kind **and** funnel id (no cross-funnel replay).
- Merge: **copy-only whitelist** — `priceCents`, Stripe ids, product ids, CTA hrefs, media URLs cannot be overridden by AI output (test: "money invariant").
- AI input: email **domain** only; never the address.
- Email image: signature covers campaign+template only (dynamic text is ESP-supplied by design), endpoint default-closed, rate-limited, text length-capped; unfilled `{{merge}}` markers render as empty, never literal.
- Every public-path read degrades soft: missing tables/rows/bad token ⇒ generic page, never a 500.

## Phase 3 candidates (deliberately deferred)

- Per-lead evergreen deadlines (`dl` is already carried in the token), checkout form prefill (`fn` carried), AI hero images per hot segment (`heroImagePrompt` + `accentColor` already in the payload), lead-magnet cover personalization, kit-level personalization, utm_content-keyed anonymous personalization rules.

## Verification

- `npx vitest run tests/lib/personalize-token.test.ts tests/lib/personalize-merge.test.ts` — 29 passing (token tamper/expiry/determinism, URL builder, image sig/sanitize, merge whitelist + money invariant, `{name}` fallback, payload hygiene).
- `npx tsc --noEmit` — clean.
