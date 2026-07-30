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

## 1b. Round 2: audiences, buyer docs, in-app help, step-by-step rewrite

The original Help Center was a single flat set of articles. Round 2 turned it
into three surfaces on one table, plus a full content rewrite.

- **Audience split.** `mothermode_kb_articles` gained an `audience` column
  (`'admin' | 'buyer'`, default `'admin'`), migration
  `20261027000000_kb_articles_audience.sql`. RLS now lets anon read **only
  published buyer rows**; admin docs are read through the service role only.
  The 33 seeded guides are admin docs (how to run the app). A new
  `seedContent/buyerHelp.ts` holds 5 buyer-facing articles (access a purchase,
  use deliverables/worksheets, missing access email, devices and printing,
  billing and refunds), shown publicly at `/mothermode/help`.
- **In-app admin docs browser.** `/admin/help-docs` (`page.tsx` +
  `AdminDocsBrowser.tsx`) renders the admin-audience articles read-only with
  search, category grouping, and a reader pane. Deep-links via
  `?article=<slug>`. Added to the sidebar as "Help Docs".
- **Contextual help icon.** `help-docs/HelpIcon.tsx` floats top-right on every
  admin screen (wired in `app/admin/layout.tsx`) and deep-links to the relevant
  guide via `help-docs/helpLinks.ts` (`ADMIN_HELP_LINKS`, route -> slug).
- **Step-by-step rewrite + shared formatting.** All 33 guides were rewritten as
  numbered walkthroughs. `seedContent/helpers.ts` exports the formatting
  primitives (`step`, `callout`, `introBox`, `table`, `chip`, `media`), and
  `help/articleStyles.ts` holds the shared `.prose`-scoped stylesheet used by
  both the public article page and the admin live-preview iframe. The seed was
  split into one module per category under `seedContent/` with an `index.ts`
  barrel; `seedContent.ts` re-exports it, so `scripts/seed-help-center.cjs`
  (now TypeScript-compiled on the fly) and the editor keep working.
- **Expandable changelog.** `/mothermode/changelog` renders `ChangelogList.tsx`,
  a client component where each release is a card (type tag, version, date,
  title) that expands to the full body on click.

Store changes: `listPublishedArticles()` and `getArticleBySlug()` are
buyer-only; `listArticlesForAdmin(audience?)` filters; `upsertArticle` writes
`audience`. The admin editor (`HelpEditor.tsx`) has an audience selector and
badges. `ARTICLE_COLUMNS` includes `audience`.

---

## 2. Files

```
supabase/migrations/20260710000000_mothermode_help_center.sql   Two tables + RLS
supabase/migrations/20261027000000_kb_articles_audience.sql     audience column + RLS split
src/lib/mothermode/help/
  types.ts        KbArticle (+audience) / ChangelogEntry + row types + mappers
  store.ts        anon read (buyer-only) + service-role write + CRUD
  articleStyles.ts shared .prose-scoped stylesheet (step/callout/table/media)
  seedContent.ts            barrel re-export
  seedContent/helpers.ts    formatting primitives + SeedArticle/SeedChangelog
  seedContent/gettingStarted.ts offersFunnels.ts contentHub.ts planner.ts
  seedContent/kits.ts system.ts  admin seed guides, one module per category
  seedContent/buyerHelp.ts  buyer-facing seed articles (audience: 'buyer')
  seedContent/changelog.ts  seed changelog entries
  seedContent/index.ts      assembled HELP_CENTER_SEED_ARTICLES
src/app/api/admin/
  mothermode-help/route.ts        GET/POST/DELETE articles (admin-guarded, +audience)
  mothermode-changelog/route.ts   GET/POST/DELETE changelog (admin-guarded)
src/app/admin/help/
  page.tsx        Server page: loads admin lists, renders the editor
  HelpEditor.tsx  Client two-tab editor (+ audience selector/badges)
src/app/admin/help-docs/
  page.tsx        Admin docs browser (server, admin-audience articles)
  AdminDocsBrowser.tsx  searchable read-only reader (client)
  helpLinks.ts    ADMIN_HELP_LINKS route -> slug map + href builder
  HelpIcon.tsx    contextual help icon (client), wired in admin/layout.tsx
src/app/mothermode/help/page.tsx            Public KB index (buyer only)
src/app/mothermode/help/[slug]/page.tsx     Public single buyer article
src/app/mothermode/changelog/page.tsx       Public changelog (server)
src/app/mothermode/changelog/ChangelogList.tsx  expandable release cards (client)
src/app/admin/AdminSidebar.tsx              NAV: Help Center + Help Docs
src/app/admin/layout.tsx                    renders the contextual HelpIcon
scripts/seed-help-center.cjs                seeder (TS-compiled on the fly)
tests/lib/help-mappers.test.ts              Row->type mapper unit tests (+audience)
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
