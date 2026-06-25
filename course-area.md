# Courses Area — Clean Transfer Manifest

Everything required to move the Courses area to another app, grouped by category.
**Copy-as-is** files are separated from **partial-extract / integration-touch** files.

---

## 1. App Router — User-facing pages (copy whole)

| File | Purpose |
|------|---------|
| `src/app/courses/page.tsx` | Course list / hub |
| `src/app/courses/[id]/page.tsx` | Course viewer + lesson player |

## 2. App Router — User API (copy whole folder)

`src/app/api/courses/` — all routes:

- `route.ts` — list courses the user has access to
- `[id]/route.ts` — fetch single course + lessons
- `access/route.ts` — check access gate
- `transcribe/route.ts` — lesson video transcription
- `generate-content/route.ts` — AI lesson content generation
- `generate-description/route.ts` — AI course description generation
- `generate-resource/route.ts` — AI attached-resource generation
- `resources/route.ts` — list/create published lesson resources
- `resources/[slug]/route.ts` — public published-resource viewer endpoint

## 3. App Router — Admin API (copy whole folder)

`src/app/api/admin/courses/` — all routes:

- `route.ts` — list + create courses (admin)
- `reorder/route.ts` — reorder courses
- `[id]/route.ts` — update/delete course
- `[id]/clone/route.ts` — clone course
- `[id]/lessons/route.ts` — list + create lessons
- `[id]/lessons/reorder/route.ts` — reorder lessons
- `[id]/lessons/[lessonId]/route.ts` — update/delete lesson
- `[id]/lessons/[lessonId]/clone/route.ts` — clone lesson

Plus:

- `src/app/api/admin/user-course-access/route.ts` — grant/revoke per-user access

## 4. Components (copy whole)

Admin:

- `src/components/admin/CoursesPanel.tsx` — main admin CRUD for courses & lessons
- `src/components/admin/CourseAccessPanel.tsx` — grant access to users
- `src/components/admin/CourseAccessSelector.tsx` — reusable access picker

User-facing course UI:

- `src/components/LessonVideoPanel.tsx` — video player + transcript + CTAs config
- `src/components/LessonResourceManager.tsx` — attached resource management
- `src/components/CourseVideoOverlay.tsx` — in-canvas lesson video overlay
- `src/components/VideoCTAOverlay.tsx` — time/percent/pause-triggered CTAs on videos
- `src/components/shared/CourseAccessLinks.tsx` — reusable "View courses" shortcut

## 5. Types (copy whole)

- `src/types/courses.ts` — `Course`, `Lesson`, `VideoCTA`, `VideoCTAType`, `VideoCTAPosition`, `VideoCTAStyle`, `VideoCTAAnimation`, `VideoCTAEngagementTrigger`, publishing types

Re-export barrel touch: `src/types/index.ts` currently has `export * from "./courses";` — add the same line in the destination app.

## 6. Database migrations (copy, run in this order)

Core course schema:

1. `supabase/migrations/20260124_courses.sql` — `courses`, `lessons`, `user_course_access`
2. `supabase/migrations/20260125_lesson_transcriptions.sql`
3. `supabase/migrations/20260126_lesson_thumbnails.sql`
4. `supabase/migrations/20260127_course_publishing_system.sql` — `published_resources` etc.
5. `supabase/migrations/20260128_package_course_access.sql` — access via bundles
6. `supabase/migrations/20260209_workflow_course_video.sql` — links workflow → lesson video (only needed if target app has workflows)
7. `supabase/migrations/20260213_new_feature_lessons.sql`
8. `supabase/migrations/20260214_course_lesson_content_type.sql`
9. `supabase/migrations/20260216_product_course_assignments.sql` — Stripe product → course grants
10. `supabase/migrations/20260219_lesson_ctas.sql` — `lessons.ctas` JSONB + indexes

**Only if you want the pre-seeded content:**

- `20260126_installation_course.sql`
- `20260127_node_banana_installation_course.sql`
- `20260127_storyflow_advanced_course.sql`
- `20260206_stripe_setup_testing_course.sql`

Skip these unless relevant: the `20260128_*_longform.sql` pair, `20260125_lead_magnets_trials.sql` (mentions courses only tangentially).

## 7. Shared files — EXTRACT (don't wholesale copy)

These files exist in the target app in some form — surgical edits only:

### `src/lib/getSmartRedirect.ts`

Copy the `checkCourseAccess(supabase, userId, email)` helper + the `/courses` branch in the redirect priority list. Pulls from `user_course_access` and `package_course_access`.

### `src/middleware.ts`

- Add `/courses` to `PUBLIC_ROUTES` (or gated list, depending on target app).
- Copy the `user_course_access` lookup block (~lines 343–358) into your access-check function.

### `src/store/workflowStore.ts` *(only if target app uses React Flow workflows)*

Extract these slices:

- Import: `import type { VideoCTA } from "@/types/courses";`
- State keys: `courseVideoUrl`, `showCourseVideo`, `courseLessonId`, `courseLessonCTAs`
- Actions: `setCourseVideoUrl`, `setShowCourseVideo`, `setCourseLessonInfo`
- Initial values + the reset/load blocks at lines ~11062, ~11098, ~11552
- `courseVideoUrl` handling on `Workflow` interface (~line 658)

### `src/hooks/useFeatureFlags.ts`

Add `course_access: boolean` and `course_area_enabled: boolean` to `FeatureFlags` + `DEFAULT_FLAGS`.

### `src/components/admin/index.ts`

Re-export: `CoursesPanel`, `CourseAccessPanel`.

### `src/app/admin/page.tsx`

- Import the two panels
- Add `"courses"` and `"access"` to `TabType` + `validTabs`
- Add the two `{activeTab === ... && <...Panel />}` lines

### `src/lib/tenantQuotas.ts` *(only if target app uses tenant quotas)*

- `max_courses: number | null` on `TenantLimits`
- `courses: { current, limit }` on the usage shape

### `src/lib/emailTemplateHtml.ts`

Copy `courseAccessGrantedHtml()` and the `course_access_granted` registry entry (~line 623). Variables used: `{{course_name}}`, `{{course_url}}`.

### `src/lib/resourceTypeConfig.ts` *(only if target app uses the resource generator)*

Copy the `course: { ... }` block (~line 234) — course-material content type preset.

## 8. Files that only *link* to `/courses` (update URLs, don't copy logic)

These reference `/courses` as an anchor/CTA only — decide per-page whether to repoint them to the new host or strip the link:

- `src/app/page.tsx`, `src/app/hub/page.tsx`
- `src/app/onboarding/user/page.tsx`
- `src/app/masterclass/replay/page.tsx`, `src/app/masterclass/slides/slidesData.tsx`
- `src/app/micro-saas-corporate/success/page.tsx`, `src/app/micro-saas-weekend/success/page.tsx`, `src/app/source-code/success/page.tsx`
- `src/app/resources/[slug]/edit/page.tsx`
- `src/app/tools/[templateId]/ToolPageClient.tsx`
- `src/components/install/CompleteStep.tsx`, `src/components/offer/ThankYouPage.tsx`
- `src/components/tools/PublishWizard.tsx`, `src/components/FloatingActionBar.tsx`
- `src/components/admin/CheckoutBuilderPanel.tsx`, `StoreBuilderPanel.tsx`, `OfferFormInputs.tsx`, `ResourcesPanel.tsx`, `EmailTemplatesPanel.tsx`, `DashboardOverview.tsx`, `ToolGatingPanel.tsx`
- `src/components/nodes/OfferCreateNode.tsx`
- `src/app/docs/tool-ascension/page.tsx`

## 9. Considerations (non-file)

### Supabase tables the courses area reads/writes

- `courses`, `lessons`
- `user_course_access` (direct grants)
- `package_course_access` (grants via bundles) → requires `packages` table
- `product_course_assignments` (Stripe product → course) → requires `products`
- `published_resources` (lesson attached HTML/PDF publishing)
- `platform_settings` (`course_area_enabled` flag)
- `users` (for access linking; email + id)

If the target app doesn't have `packages` or `products`, drop migration #5 and #9 above and remove those branches from `getSmartRedirect.ts` / middleware.

### Storage buckets (Supabase Storage)

Courses upload to default buckets; verify these exist on the destination project:

- Lesson videos — typically served from a `videos` or `lessons` bucket (check current upload targets in `LessonVideoPanel.tsx` / admin lesson upload route).
- Lesson thumbnails — `lesson_thumbnails` column expects a public URL.
- Published resource HTML — served via `/api/courses/resources/[slug]`.

Set RLS policies on any buckets you create: anonymous read for thumbnails, authenticated read for videos (or signed URLs).

### Environment variables

No new vars beyond what's already used by the target app:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (used by `generate-content`, `generate-description`, `transcribe`)
- `OPENAI_API_KEY` (optional, used by resource generation if configured)

### Platform settings rows

After migrations, insert/verify these in `platform_settings`:

- `course_area_enabled` (boolean) — gates `/courses` visibility via `useFeatureFlags`
- Any Stripe product IDs tied to course grants (if using `product_course_assignments`)

### RBAC / middleware

- `/courses/*` must be in `PUBLIC_ROUTES` in middleware (it currently is) so logged-out users can hit paywall/login smoothly.
- Admin routes (`/api/admin/courses/*`) require the target app's admin-role check; every route file calls the shared admin auth helper — confirm the import path resolves.

### Device-ID / auth pattern

The APIs use the hybrid pattern (Supabase Auth cookie preferred, `x-device-id` header fallback). If the target app doesn't use device IDs, simplify the access-check helpers to auth-only.

### Workflow-video linking (optional)

Migration `20260209_workflow_course_video.sql` adds a `course_video_url` column to `workflows` and the related store actions. Skip entirely if the destination app has no React Flow workflows.

### Cost calculator / credits

`generate-content`, `generate-description`, and `generate-resource` deduct credits through `src/lib/credits.ts`. Verify the credit system exists in the target app, or strip the credit-deduction calls.

### Feature-flag default

`course_access` and `course_area_enabled` default to `false` — flip them on in `platform_settings` after migration, otherwise `/courses` 404-style redirects via `useFeatureFlags`.

### Email integration

`courseAccessGrantedHtml` is referenced by the admin access-granting flow (`/api/admin/user-course-access`). Make sure the email sender utility (`sendEmail` or the transactional provider) is present on the destination, and register `course_access_granted` in that app's template registry.

---

## Suggested transfer order

1. Run migrations 1–10 in order on the destination Supabase project.
2. Create/verify storage buckets and RLS.
3. Copy `src/types/courses.ts`, add the re-export line in `src/types/index.ts`.
4. Copy all `src/app/api/courses/**` and `src/app/api/admin/courses/**` + `user-course-access/route.ts`.
5. Copy all components (admin + user-facing + VideoCTAOverlay).
6. Copy both page routes under `src/app/courses/`.
7. Integrate the extracts in shared files (middleware, smart-redirect, feature flags, admin page, email templates).
8. Flip `course_area_enabled = true` in `platform_settings`.
9. Smoke test: create a course in admin, grant access, view as user, upload a video, attach CTAs, publish a resource.

