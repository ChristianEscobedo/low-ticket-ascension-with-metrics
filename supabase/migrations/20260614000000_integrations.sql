/**
* INTEGRATIONS
* Per-provider configuration for outbound systems wired into the admin UI:
*   - generic_webhook  (Zapier / Make / custom hooks)
*   - ghl              (GoHighLevel contact upsert + tagging)
*   - mass             (mass.new — scaffolded, no dispatch yet)
*   - stripe           (admin-editable mirror of the env keys; runtime
*                       reads env vars, this row is the editable source of
*                       truth in the admin UI)
* `events` is a list of `page_type` values that should trigger dispatch
* (e.g. ['fe','oto1','oto2','oto3','oto4']). Empty array = all events.
* `config` is provider-shaped JSON; the dispatcher knows how to read each.
*/
create table integrations (
  provider text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  events text[] not null default array[]::text[],
  updated_at timestamp with time zone not null default timezone('utc', now())
);

-- Lock the table down. Only the service role (used by /utils/integrations
-- helpers, the webhook handler, and admin server actions) may read or write.
alter table integrations enable row level security;
-- No policies = no access for anon / authenticated roles by default.
