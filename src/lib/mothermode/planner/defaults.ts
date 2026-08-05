// Default planner columns.
//
// These constants are the app-side twin of the seed in
// supabase/migrations/20261001000000_mothermode_planner.sql. They exist so the
// boards render correctly before anyone saves a custom set, and so the whole
// planner still works with Supabase unconfigured (tests, local dev).
//
// Columns are user-editable: rename, reorder, add, remove. The only rule is
// that a column `id` is permanent once cards reference it — the UI generates a
// new id from the label on create and never rewrites it on rename.

import type { PlannerColumn } from './types';

/** Content production pipeline: idea → shipped. */
export const DEFAULT_CONTENT_COLUMNS: PlannerColumn[] = [
  { id: 'idea', label: 'Idea', color: '#9CA3AF' },
  { id: 'writing', label: 'Writing', color: '#F59E0B' },
  { id: 'media', label: 'Media', color: '#8B5CF6' },
  { id: 'review', label: 'Review', color: '#3B82F6' },
  { id: 'approved', label: 'Approved', color: '#10B981' },
  { id: 'scheduled', label: 'Scheduled', color: '#06B6D4' },
  { id: 'published', label: 'Published', color: '#065F46', terminal: true },
];

/**
 * Lead pipeline. `autoEvents` map mothermode_sales_funnel_events.event_type
 * values onto columns so the board advances itself as the funnel fires — until
 * an admin drags a card, which sets stageManual and freezes the automation.
 *
 * Columns with no autoEvents (Nurturing, Call Booked, Closed *) are human-only:
 * nothing in the funnel can decide a call was booked or a deal was lost.
 */
export const DEFAULT_LEAD_COLUMNS: PlannerColumn[] = [
  { id: 'new', label: 'New', color: '#9CA3AF', autoEvents: ['optin_submit'] },
  { id: 'nurturing', label: 'Nurturing', color: '#F59E0B' },
  {
    id: 'engaged',
    label: 'Engaged',
    color: '#8B5CF6',
    autoEvents: ['sales_view', 'vsl_view'],
  },
  {
    id: 'checkout_started',
    label: 'Checkout Started',
    color: '#3B82F6',
    autoEvents: ['checkout_start'],
  },
  {
    id: 'customer',
    label: 'Customer',
    color: '#10B981',
    autoEvents: ['purchase'],
  },
  {
    id: 'upsell_taken',
    label: 'Upsell Taken',
    color: '#059669',
    autoEvents: ['upsell_yes'],
  },
  { id: 'call_booked', label: 'Call Booked', color: '#06B6D4' },
  { id: 'closed_won', label: 'Closed Won', color: '#065F46', terminal: true },
  { id: 'closed_lost', label: 'Closed Lost', color: '#B91C1C', terminal: true },
];

export const DEFAULT_CONTENT_BOARD_NAME = 'Content Pipeline';
export const DEFAULT_LEAD_BOARD_NAME = 'Lead Pipeline';

/** Fallback column set for a board kind. */
export function defaultColumns(kind: 'content' | 'leads'): PlannerColumn[] {
  return (
    kind === 'leads' ? DEFAULT_LEAD_COLUMNS : DEFAULT_CONTENT_COLUMNS
  ).map((c) => ({ ...c }));
}
