/**
 * Shim for the `utm_content` lead column while its migration rolls out.
 *
 * `utm_content` is added to `mothermode_sales_funnel_leads` and
 * `mothermode_optin_leads` by 20261005000000_planner_funnel_links_and_utm.sql.
 * Code and schema do not deploy atomically: between shipping the capture change
 * and running the migration there is a window where naming the column makes
 * PostgREST reject the whole statement —
 *
 *   select: `column ... utm_content does not exist`            (42703)
 *   insert: `Could not find the 'utm_content' column ...`      (PGRST204)
 *
 * Lead capture is the revenue path. It must degrade, not fail, so the column is
 * used optimistically and dropped for the life of the process the first time
 * the database says it isn't there — after which capture continues exactly as
 * it did before, minus per-piece attribution.
 *
 * The flag is per table and one-way. It is never re-enabled at runtime, because
 * flipping back would mean re-probing (and re-failing) on every request; a
 * deploy or a cold start picks the column up once the migration has run.
 *
 * DELETE THIS MODULE once the migration is applied to every environment. It is
 * scaffolding for a rollout, not a permanent abstraction.
 */

/** Minimal shape of a supabase-js result, so this stays client-agnostic. */
export interface UtmContentQueryResult<T> {
  data: T | null;
  error: { message?: string | null; details?: string | null; hint?: string | null } | null;
}

const unsupported = new Set<string>();

/** False once this process has proven the column is absent on `table`. */
export function supportsUtmContent(table: string): boolean {
  return !unsupported.has(table);
}

/** Append `utm_content` to a select list, unless it is known to be absent. */
export function withUtmContentColumn(table: string, columns: string): string {
  return supportsUtmContent(table) ? `${columns}, utm_content` : columns;
}

/**
 * The `utm_content` fragment of an insert/update row — an empty object when the
 * column is absent, so spreading it is always safe.
 */
export function utmContentFields(
  table: string,
  value?: string | null,
): Record<string, string | null> {
  if (!supportsUtmContent(table)) return {};
  return { utm_content: value || null };
}

/**
 * Is this error specifically "that column doesn't exist"? Both halves of the
 * test matter: a message mentioning utm_content could be a constraint violation,
 * and a "does not exist" could be about an entirely different column — retrying
 * either of those without the field would just fail a second time, slower.
 */
function isMissingUtmContent(
  error: { message?: string | null; details?: string | null; hint?: string | null } | null,
): boolean {
  const text = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ');
  if (!/utm_content/i.test(text)) return false;
  return /does not exist|could not find|schema cache/i.test(text);
}

/**
 * Run a query; if it failed *only* because `utm_content` is missing, mark the
 * table and run it again. The caller passes a thunk rather than a promise so the
 * second attempt rebuilds its column list and row from the now-updated flag.
 */
export async function withUtmContentFallback<T>(
  table: string,
  run: () => Promise<UtmContentQueryResult<T>>,
): Promise<UtmContentQueryResult<T>> {
  const first = await run();
  if (!first.error || !supportsUtmContent(table)) return first;
  if (!isMissingUtmContent(first.error)) return first;

  unsupported.add(table);
  console.warn(
    `[leadUtmContent] "${table}".utm_content is missing — apply ` +
      'supabase/migrations/20261005000000_planner_funnel_links_and_utm.sql. ' +
      'Continuing without per-piece attribution.',
  );
  return run();
}
