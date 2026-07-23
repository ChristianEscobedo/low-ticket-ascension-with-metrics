# Admin Knowledge Base, Help Docs, and Changelog — Task Spec

Scoped, build-ready spec for a new database-backed, in-app-editable Knowledge
Base / Help Docs / Changelog system that lives in the admin area. Written so it
can be handed to a fresh task and built without further discovery. Mirrors the
existing **Deliverables** system conventions almost exactly (DB-backed, admin
CRUD, service-role writes, anon public reads), so reuse those patterns.

> No code has been written for this yet. This doc is the plan. It is also
> registered in `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` so it travels with the
> port docs.

---

## 1. Goal

An admin can create, edit, reorder, publish, and unpublish three kinds of
content entirely through the app (no deploy):

1. **Knowledge Base / Help Docs** — categorized help articles (title, slug,
   category, body, published flag, sort order).
2. **Changelog** — dated, versioned release entries (version, date, entry type,
   title, body, published flag).

All content is fetched from Supabase. The admin section reads and edits it; an
optional in-app viewer renders published items.

Non-goals for round 1: comments, per-user read state, AI authoring, full-text
search infra (a simple `ilike` filter is enough to start).

---

## 2. Reuse these existing patterns

- **Auth**: every admin API route guards with `requireAdminRoute()` from
  `@/utils/courses/admin-route-guard` and returns `{ success, admin, items }`
  shaped JSON. See `src/app/api/admin/mothermode-deliverables/route.ts`.
- **DB access split**: an anon, cookie-free client for public reads and a
  lazy service-role client for admin writes, both created inside a `store.ts`
  with `try/catch` returning safe empties. See
  `src/lib/mothermode/deliverables/store.ts`.
- **Cache**: call `revalidatePath(...)` on the affected public route(s) after
  a write, exactly like the deliverables route does.
- **Admin nav**: add entries to the `NAV` array in
  `src/app/admin/AdminSidebar.tsx`.
- **Admin editor UX**: model the pages on
  `src/app/admin/deliverables/*` (`page.tsx` server wrapper +
  `DeliverablesScopePicker.tsx` + `DeliverablesEditor.tsx` client editor).
- **Voice rules** still apply to any shipped seed copy: no em dashes, no en
  dashes, no NO-list words, periods over exclamation points.

---

## 3. Data model (new migration)

Create `supabase/migrations/2026XXXXXXXXXX_mothermode_help_center.sql` with two
tables. Match the RLS posture of `mothermode_deliverables`: anon may `SELECT`
only rows where `published = true`; all writes are service-role only.

```sql
-- Knowledge base / help articles
create table if not exists mothermode_kb_articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,          -- url-safe, stable
  title        text not null,
  category     text not null default 'General',
  excerpt      text,                           -- one-line summary for lists
  body         text not null,                  -- trusted admin markdown/HTML
  published    boolean not null default false,
  sort_order   integer not null default 0,     -- within a category
  updated_at   timestamptz not null default now(),
  updated_by   text
);
create index if not exists idx_kb_articles_pub on mothermode_kb_articles (published, category, sort_order);

-- Changelog entries
create table if not exists mothermode_changelog (
  id           uuid primary key default gen_random_uuid(),
  version      text,                           -- e.g. "1.4.0" (optional)
  released_on  date not null default current_date,
  entry_type   text not null default 'improved', -- added | improved | fixed | removed
  title        text not null,
  body         text not null,                  -- trusted admin markdown/HTML
  published    boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   text
);
create index if not exists idx_changelog_pub on mothermode_changelog (published, released_on desc);

-- RLS: anon reads published only; service role does everything.
alter table mothermode_kb_articles enable row level security;
alter table mothermode_changelog enable row level security;

create policy kb_public_read on mothermode_kb_articles
  for select using (published = true);
create policy changelog_public_read on mothermode_changelog
  for select using (published = true);
-- (No anon insert/update/delete policies. Service role bypasses RLS.)
```

`body`/`excerpt` are **trusted admin authored** content (like
`DeliverableDoc.html`), never buyer input. Pick markdown or sanitized HTML and
be consistent between the editor and the viewer.

---

## 4. Types + store

`src/lib/mothermode/help/types.ts`

```ts
export interface KbArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt?: string | null;
  body: string;
  published: boolean;
  sortOrder: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export type ChangelogType = 'added' | 'improved' | 'fixed' | 'removed';

export interface ChangelogEntry {
  id: string;
  version?: string | null;
  releasedOn: string;      // ISO date
  entryType: ChangelogType;
  title: string;
  body: string;
  published: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}
```

`src/lib/mothermode/help/store.ts` (mirror `deliverables/store.ts`):
- `listPublishedArticles()`, `getArticleBySlug(slug)`, `listArticlesForAdmin()`
  (all rows), `upsertArticle(input)`, `deleteArticle(id)`.
- `listPublishedChangelog()`, `listChangelogForAdmin()`,
  `upsertChangelogEntry(input)`, `deleteChangelogEntry(id)`.
- Anon client for the published reads; service-role client for admin reads +
  all writes. Every function wrapped in `try/catch` returning `[]`/`null`.

---

## 5. API routes (admin, guarded)

`src/app/api/admin/mothermode-help/route.ts` (articles) and
`.../mothermode-changelog/route.ts` (changelog). Each:
- `GET` -> `requireAdminRoute()`, return all rows for the admin editor.
- `POST` -> validate + `upsert...`, `updatedBy: guard.email`,
  `revalidatePath('/mothermode/help')` (and the article path), return
  `{ success: true }`.
- `DELETE` -> by `id`, revalidate, return `{ success: true }`.

Keep the same 400/500 error JSON shape as the deliverables route.

Optional public read routes are not required if the viewer pages fetch through
the store directly in server components (preferred, cacheable).

---

## 6. Admin UI

Add to `AdminSidebar.tsx` NAV: `{ href: '/admin/help', label: 'Help Center' }`.

`src/app/admin/help/page.tsx` — server wrapper (admin-gated) that renders a
client editor with two tabs:
- **Articles tab**: list grouped by category with published badge + sort order;
  create/edit form (title, slug auto-suggested from title, category, excerpt,
  body, published toggle, sort order); delete with confirm.
- **Changelog tab**: reverse-chronological list; create/edit form (version,
  released_on date, entry_type select, title, body, published toggle); delete.

Reuse the editor scaffolding from `src/app/admin/deliverables/DeliverablesEditor.tsx`
(save state, dirty tracking, error surface). A live preview pane is a nice-to-have.

---

## 7. In-app viewer (published surface)

Decide scope with the owner. Recommended round 1:
- `src/app/mothermode/help/page.tsx` — KB index (categories + article links)
  reading `listPublishedArticles()`.
- `src/app/mothermode/help/[slug]/page.tsx` — single article via
  `getArticleBySlug`.
- `src/app/mothermode/changelog/page.tsx` — published changelog, newest first,
  grouped by version/date with type tags.

Render `body` with the same brand styling as `ResourceDocument.tsx`. These are
server components so published content stays cacheable (revalidated on write).

If the owner wants help/changelog **only** inside admin for now, render the same
viewer components inside `/admin/help` read-only tabs and skip the public routes;
the store + admin CRUD are unchanged.

---

## 8. Verification

- `npx tsc --noEmit` exits 0.
- Migration applies cleanly; RLS: anon can read only published rows, cannot
  write; service role can read/write all.
- Admin CRUD round trip: create draft -> not visible on public viewer ->
  publish -> visible after revalidate -> edit -> delete.
- Slug uniqueness enforced (DB unique + friendly editor error).
- Voice-rule scan on any seeded copy.
- Add a small unit test for the store's row->type mappers if practical.

---

## 9. Build order (for the fresh task)

1. Migration + RLS.
2. `help/types.ts` + `help/store.ts`.
3. Admin API routes (articles, changelog).
4. `AdminSidebar` NAV entry + `/admin/help` editor (both tabs).
5. Public viewer pages (or admin read-only tabs).
6. Optional seed (a few starter articles + initial changelog entry, on-voice).
7. Verify per §8.

---

## 10. Port-doc follow-up

When built, author `docs/HELP_CENTER_SYSTEM_PORT.md` (mirror the structure of
`DELIVERABLES_RESOURCES_SYSTEM_PORT.md`) and flip this feature's row in the
`MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` feature map from "planned" to done with
its file inventory, migration name, and env note (`SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_*` only, no new keys).
