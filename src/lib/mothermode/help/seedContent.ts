/**
 * Starter content for the MotherMode Help Center.
 *
 * The seed is split into one module per category under `seedContent/` plus a
 * `helpers.ts` for the shared formatting primitives (media slots, step cards,
 * callouts, intro boxes, chips, tables) and `changelog.ts` for release notes.
 * This file is a thin barrel that re-exports the assembled arrays, so existing
 * consumers (`scripts/seed-help-center.cjs`, the /admin/help editor, tests) keep
 * working unchanged.
 *
 * Voice rules apply everywhere: no em dashes, no en dashes, no NO-list words,
 * periods over exclamation points.
 */

export {
  HELP_CENTER_SEED_ARTICLES,
  type SeedArticle,
  type SeedChangelog,
} from './seedContent/index';
export { HELP_CENTER_SEED_CHANGELOG } from './seedContent/changelog';
