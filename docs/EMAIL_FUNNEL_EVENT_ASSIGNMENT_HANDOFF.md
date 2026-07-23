# Email Sequence → Funnel Event Assignment — Handoff

Status: **not started** — scoped handoff. The token + brand-HTML groundwork it
builds on is shipped (`docs/EMAIL_TOKENS_AND_BRAND_HTML_PORT.md`).

## Goal

Let an admin attach a saved email kit to a **funnel event** so the sequence
fires automatically at the right moment (opt-in, purchase, abandon, refund,
tag-added) with per-recipient tokens resolved at send time.

## What already exists (reuse, do not rebuild)

- **Token grammar** — `applyEmailTokens(text, values, { preserveUnknown:false })`
  fully resolves a marketing body into a transactional send.
  (`src/lib/mothermode/email/tokens.ts`)
- **Brand renderer** — `sequenceToHtml` / `renderEmail` produce the branded
  HTML + plaintext each send needs. (`src/lib/mothermode/email/export.ts`,
  `src/utils/email/layout.ts`)
- **Kit persistence** — `EmailKitRecord` + store already round-trip
  `campaignType`, `framework`, `contextRefs`, `sequence`, `status`.
  (`src/lib/mothermode/email/store.ts`)

## Proposed work (in order)

1. **Migration** — new table `mothermode_email_funnel_bindings`:
   `id`, `kit_id` (fk → `mothermode_email_kits`), `event_type`
   (enum: `optin | purchase | abandon | refund | tag_added`),
   `offer_slug` (nullable filter), `active bool`, `created_at`.
   Follow the timestamp-prefix migration convention already in
   `supabase/migrations/`.

2. **Types + store** — `EmailFunnelBinding` record + normalizer;
   `listBindings()`, `upsertBinding()`, `deleteBinding()`,
   `findBindingsForEvent(eventType, offerSlug)` (only `active` rows).

3. **Admin UI** — a "Triggers" section in `EmailKitEditor.tsx`: pick event
   type(s) + optional offer filter, list current bindings, add/remove. Persist
   through `/api/admin/mothermode-email` alongside the existing save payload
   (or a sibling `/api/admin/mothermode-email-bindings` route).

4. **Dispatch hook** — where funnel events already originate (Stripe webhook for
   `purchase`/`refund`, opt-in handler for `optin`), call
   `findBindingsForEvent(...)`, then for each email in `binding.kit.sequence`
   render with `applyEmailTokens(body, recipientValues, { preserveUnknown:false })`
   and enqueue via the existing transactional sender, honoring each email's
   `sendOffset` for scheduling.

5. **Tests** — `tests/lib/email-funnel.test.ts`: binding normalizer,
   `findBindingsForEvent` filtering (event + offer + active), and a
   render-with-values snapshot proving tokens resolve and the brand shell wraps.

## Open decisions for the next session

- Scheduler: reuse an existing queue/cron, or store `scheduled_for` rows a cron
  drains? Check what the receipt pipeline uses before adding infra.
- Unsubscribe/compliance: broadcast sends need `{{unsubscribe}}` populated —
  confirm the sender injects a real link before enabling `purchase`/`optin`
  broadcast triggers.

## Verify (when built)

```
npx tsc --noEmit
npx vitest run tests/lib/email-funnel.test.ts tests/lib/email-kit.test.ts
```
