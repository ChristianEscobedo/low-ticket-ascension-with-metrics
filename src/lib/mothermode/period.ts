/**
 * Lightweight period-key helpers for interactive resource workspaces. Not a
 * true ISO-8601 week calculation, deliberately simple: a stable, sortable
 * key plus a human label, good enough to let a buyer clone a resource
 * forward week to week or month to month and page back through history.
 */

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Sortable key for the Monday-start week containing `date`, e.g. '2026-07-13'. */
export function weekKey(date = new Date()): string {
  const m = mondayOf(date);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(
    m.getDate(),
  ).padStart(2, '0')}`;
}

/** Human label for the week containing `date`, e.g. 'Week of Jul 13'. */
export function weekLabel(date = new Date()): string {
  const m = mondayOf(date);
  return `Week of ${m.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/** The week key `offset` weeks from `date` (negative goes back, positive forward). */
export function shiftWeekKey(offset: number, date = new Date()): string {
  const d = mondayOf(date);
  d.setDate(d.getDate() + offset * 7);
  return weekKey(d);
}
export function shiftWeekLabel(offset: number, date = new Date()): string {
  const d = mondayOf(date);
  d.setDate(d.getDate() + offset * 7);
  return weekLabel(d);
}

/** Sortable key for the month containing `date`, e.g. '2026-07'. */
export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Human label for the month containing `date`, e.g. 'July 2026'. */
export function monthLabel(date = new Date()): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function shiftMonthKey(offset: number, date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return monthKey(d);
}
export function shiftMonthLabel(offset: number, date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return monthLabel(d);
}
