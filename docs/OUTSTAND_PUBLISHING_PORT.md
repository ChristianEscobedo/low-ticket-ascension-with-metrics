# Outstand Publishing — System Port

> Outstand is the social-publishing backend: one API key in
> /admin/integrations turns the planner's schedule into real published posts
> across the connected accounts. Spec: `OUTSTAND_PUBLISHING_TASK.md`.

## The pieces

| Piece | Where | What |
|---|---|---|
| The client | `src/utils/integrations/outstand.ts` | `outstandConnected()` (is a key saved) + `outstandPublish(input)` — publish now or schedule a post across the chosen accounts. The key resolves through the runtime config (DB-first, env fallback). |
| The route | `/api/admin/outstand-publish` | The admin-gated publish endpoint the planner calls. |
| The integration card | `/admin/integrations` | The `outstand` provider row — one `api_key` field (`CONFIG_KEYS.outstand = ['api_key']`). |
| The planner wiring | `SchedulePanel.tsx` + the planner store | A scheduled card with a date publishes through Outstand at its time; the publish state system (`PUBLISH_STATE_SYSTEM_PORT.md`) tracks draft → scheduled → published on the card. |

## The shape

```
planner card (scheduled, with a date)
  → /api/admin/outstand-publish
  → outstandPublish(input)         (publish now, or schedule for the date)
  → the connected social accounts
```

## Notes for a port

- The integration is credential-only: the key's presence IS the config, no
  "Enabled" gate (the same `ALWAYS_ON_PROVIDERS` rule Stripe rides — see
  `runtime-config.ts`).
- Publish state lives on the planner card, not in Outstand — Outstand is the
  delivery pipe, the board is the source of truth for what went out.
- A failed publish surfaces on the card; the board never silently drops a
  scheduled piece.
