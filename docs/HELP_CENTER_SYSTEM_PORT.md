# Help Center — Knowledge Base + Changelog (System / Port Guide)

A database-backed, in-app-editable Help Center for the MotherMode admin area:
knowledge base articles and a product changelog, both authored in `/admin/help`
and served on public viewer pages without a redeploy. This is the shipped
version of the plan in `ADMIN_KNOWLEDGE_BASE_CHANGELOG_TASK.md`.

It mirrors the Deliverables conventions on purpose so the two systems read the
same: `requireAdminRoute()`-guarded admin API routes returning
`{ success, admin, items }`, a `store.ts` with an anon (published-only) read
client plus a lazy service-role write client, `revalidatePath` after writes, and
an `AdminSidebar` NAV entry.

---

## 1. What it does

- **Knowledge base**: articles grouped by `category`, each with a URL `slug`,
  one-line `excerpt`, HTML `body`, `published` flag, and per-category
  `sort_order`. Public index at `/mothermode/help`, single article at
  `/mothermode/help/[slug]`.
- **Changelog**: release notes with optional `version`, a `released_on` date, a
  typed tag (`added` / `improved` / `fixed` / `removed`), a title, and an HTML
  body. Public list at `/mothermode/changelog`, newest first.
- **Admin editor** at `/admin/help`: two tabs (Articles, Changelog), a
  master/detail layout, a live HTML preview iframe, publish toggle, and delete.
- Drafts (`published = false`) are visible only to admins. Publishing makes an
  item visible to anon readers and revalidates the affected public paths.

---

## 2. Files

```
supabase/migrations/20260710000000_mothermode_help_center.sql   Two tables + RLS
src/lib/mothermode/help/
  types.ts        KbArticle / ChangelogEntry + row types + row->type mappers
  store.ts        anon read client + service-role write client + CRUD
src/app/api/admin/
  mothermode-help/route.ts        GET/POST/DELETE articles (admin-guarded)
  mothermode-changelog/route.ts   GET/POST/DELETE changelog (admin-guarded)
src/app/admin/help/
  page.tsx        Server page: loads admin lists, renders the editor
  HelpEditor.tsx  Client two-tab editor (modeled on DeliverablesEditor)
src/app/mothermode/help/page.tsx            Public KB index
src/app/mothermode/help/[slug]/page.tsx     Public single article
src/app/mothermode/changelog/page.tsx       Public changelog
src/app/admin/AdminSidebar.tsx              NAV entry: { /admin/help, 'Help Center' }
tests/lib/help-mappers.test.ts              Row->type mapper unit tests
```

---

## 3. Data model (`20260710000000_mothermode_help_center.sql`)

Two tables, both with RLS enabled.

`mothermode_kb_articles`
- `id uuid pk default gen_random_uuid()`
- `slug text unique not null`, `title text not null`, `category text not null
  default 'General'`
- `excerpt text`, `body text not null default ''`
- `published boolean not null default false`
- `sort_order int not null default 0`
- `updated_at timestamptz`, `updated_by text`
- Index on `(published, category, sort_order)` for the public index query.

`mothermode_changelog`
- `id uuid pk default gen_random_uuid()`
- `version text`, `released_on date not null default now()`
- `entry_type text not null default 'improved'` (check constraint on the four
  allowed values)
- `title text not null`, `body text not null default ''`
- `published boolean not null default false`
- `updated_at timestamptz`, `updated_by text`
- Index on `(published, released_on desc)`.

RLS policies (same shape as Deliverables):
- **anon SELECT** allowed only `WHERE published = true` on each table. This is
  what lets the viewer pages stay cacheable.
- **All writes** (insert/update/delete) go through the service role, which
  bypasses RLS. No anon or authenticated write policy exists.

---

## 4. Types + mappers (`help/types.ts`)

- `ChangelogType = 'added' | 'improved' | 'fixed' | 'removed'`, plus the
  `CHANGELOG_TYPES` array for select options.
- `KbArticle` / `ChangelogEntry`: camelCase domain types used everywhere in the
  app (`sortOrder`, `releasedOn`, `entryType`, `updatedAt`, `updatedBy`).
- `KbArticleRow` / `ChangelogRow`: the snake_case DB shape.
- `rowToArticle` / `rowToChangelogEntry`: pure row->type mappers.
- `toChangelogType(value)`: normalizes any string to a valid `ChangelogType`,
  defaulting unknown/empty to `improved`. Unit-tested in
  `tests/lib/help-mappers.test.ts`.

Keeping the mappers pure (no Supabase import) is what makes them testable
without a DB.

---

## 5. Store (`help/store.ts`)

Two lazy clients, created on first use so the module never throws on missing env
at import time:
- `anonClient()` — `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  cookie-free, used only for published reads.
- `serviceClient()` — `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`,
  used for admin reads (drafts included) and every write.

Public reads swallow errors and return `[]` / `null` so a missing table or
unconfigured Supabase degrades gracefully rather than 500-ing a public page.

Functions:
- `listPublishedArticles()`, `getArticleBySlug(slug)` — anon, published only.
- `listArticlesForAdmin()` — service role, drafts included.
- `upsertArticle(UpsertArticleInput)`, `deleteArticle(id)` — service role.
- `listPublishedChangelog()` — anon, published, newest first.
- `listChangelogForAdmin()` — service role, newest first.
- `upsertChangelogEntry(UpsertChangelogInput)`, `deleteChangelogEntry(id)`.

Upserts use `onConflict: 'id'`: insert when `id` is absent, update in place
otherwise. `updated_at` is stamped server-side on every write.

---

## 6. Admin API routes

`/api/admin/mothermode-help` and `/api/admin/mothermode-changelog`, each with:
- `GET` — returns `{ success: true, admin, items }` where `items` is the admin
  list (drafts included). `admin` is the identity from `requireAdminRoute()`.
- `POST` — validates the body, calls the matching `upsert*`, then
  `revalidatePath` on the affected public paths, returns `{ success: true }`.
- `DELETE` — `?id=...`, calls the matching `delete*`, revalidates, returns
  `{ success: true }`.

Every handler starts with `requireAdminRoute()`; on failure it returns the
guard's 401/403 and never touches the store. `updatedBy` is set from the
resolved admin identity, not from the client.

Revalidation targets:
- articles -> `/mothermode/help` and `/mothermode/help/[slug]` (plus the exact
  slug path when known).
- changelog -> `/mothermode/changelog`.

---

## 7. Admin editor (`/admin/help`)

- `page.tsx` is a server component (`dynamic = 'force-dynamic'`) that loads both
  admin lists in parallel and passes them to `HelpEditor`.
- `HelpEditor.tsx` is the client component. Two tabs (Articles, Changelog),
  each a master/detail: a left list (articles grouped by category with a
  published/draft badge; changelog with a colored type tag + date) and a right
  editor panel.
- Article editor: title (auto-suggests the slug until the slug is manually
  edited), slug, category, sort order, excerpt, HTML body, publish toggle,
  save, delete, and an "Open live page" link when published.
- Changelog editor: version, released-on date, type select, title, HTML body,
  publish toggle, save, delete.
- Both panels render a sandboxed **live preview iframe** of the HTML body.
- Save/delete call the admin routes; on success the component calls
  `router.refresh()` so the server page re-fetches. This is the same
  request/refresh loop as `DeliverablesEditor`.

---

## 8. Public viewer pages

All three are server components with `revalidate = 3600`, styled in the brand
shell (`bg-bone` / `text-ink` / `text-brass`).
- `/mothermode/help` — groups published articles by category, links to each.
- `/mothermode/help/[slug]` — renders the article; `notFound()` when the slug is
  not a published article; `generateMetadata` from the article title/excerpt.
- `/mothermode/changelog` — published entries newest first, colored type tags,
  human-formatted dates.

Article/changelog bodies are rendered with `dangerouslySetInnerHTML`. This is
**trusted, hand-authored admin content**, never buyer input, which is why the
raw-HTML render is acceptable here. If you ever open authoring to untrusted
users, sanitize the body first.

---

## 9. Port order

1. Apply the migration; verify both tables + the anon-published-only RLS.
2. Port `help/types.ts` (+ the mapper test), then `help/store.ts`.
3. Add the two admin API routes; confirm `requireAdminRoute()` exists in the
   target and returns the same `{ success, admin }` shape used elsewhere.
4. Add `/admin/help` (`page.tsx` + `HelpEditor.tsx`) and the `AdminSidebar` NAV
   entry.
5. Add the three public viewer pages.
6. Verify: `npx tsc --noEmit` and `npx vitest run tests/lib/help-mappers.test.ts`.

### Verification checklist
- `npx tsc --noEmit` exits 0.
- `npx vitest run tests/lib/help-mappers.test.ts` green.
- Create a draft article -> not visible on `/mothermode/help`; publish -> visible
  and the page updates without a deploy.
- Anon client cannot read a draft (RLS); admin list shows it.
- Changelog type tag colors match on the editor list and the public page.

---

## 10. Notes

- Reuses the exact patterns from `DELIVERABLES_RESOURCES_SYSTEM_PORT.md`; read
  that first if a convention here is unclear.
- No new environment variables: reuses the Supabase URL, anon key, and service
  role key already required by the base template.
- The HTML body is a deliberate simplicity choice. A future round could swap the
  textarea for a rich-text editor without changing the store or the schema.
