/**
 * The planner → export bridge.
 *
 * These tests pin the precedence rule, because it is the only place where two
 * independently reasonable sources of truth for "when does this post go out"
 * meet: the calendar card the user dragged, and the `scheduledFor` hint stored
 * on a saved version. If this order ever flips, the calendar silently stops
 * driving exports and the bug is invisible until a client's posts go out on the
 * wrong day.
 */
import { describe, it, expect } from 'vitest';
import { buildExportRows } from '../../src/lib/mothermode/content/export/schedule';

// Minimal shape: buildExportRows only reads id/platform/kind/week plus whatever
// the caption builder can find. Cast keeps the fixture readable.
function piece(id: string, week = 1) {
  return {
    id,
    week,
    platform: 'instagram',
    kind: 'post',
    title: `Piece ${id}`,
    caption: `Caption ${id}`,
  } as any;
}

const options = {
  scope: 'all',
  campaignStart: '2026-01-05', // a Monday
  defaultTime: '10:00',
} as any;

describe('buildExportRows schedule precedence', () => {
  it('falls back to computed campaignStart + week when nothing is planned', () => {
    const rows = buildExportRows({ pieces: [piece('a')], options });
    expect(rows).toHaveLength(1);
    // Week 1, first slot → campaign start day at the default time.
    expect(rows[0].scheduledAt.getFullYear()).toBe(2026);
    expect(rows[0].scheduledAt.getMonth()).toBe(0);
    expect(rows[0].scheduledAt.getDate()).toBe(5);
    expect(rows[0].scheduledAt.getHours()).toBe(10);
  });

  it('prefers the planner date over the computed date', () => {
    const rows = buildExportRows({
      pieces: [piece('a')],
      options,
      scheduleByPieceId: { a: '2026-02-17T15:30:00.000Z' },
    });
    expect(rows[0].scheduledAt.toISOString()).toBe('2026-02-17T15:30:00.000Z');
  });

  it('prefers the planner date over a scheduled version', () => {
    const rows = buildExportRows({
      pieces: [piece('a')],
      options,
      versionsByPiece: {
        a: { scheduledFor: '2026-03-01T09:00:00.000Z' } as any,
      },
      scheduleByPieceId: { a: '2026-02-17T15:30:00.000Z' },
    });
    expect(rows[0].scheduledAt.toISOString()).toBe('2026-02-17T15:30:00.000Z');
  });

  it('still honours a scheduled version for pieces the planner has not touched', () => {
    const rows = buildExportRows({
      pieces: [piece('a'), piece('b')],
      options,
      versionsByPiece: {
        b: { scheduledFor: '2026-03-01T09:00:00.000Z' } as any,
      },
      scheduleByPieceId: { a: '2026-02-17T15:30:00.000Z' },
    });
    // Sorted ascending: planned 'a' in Feb, then versioned 'b' in Mar.
    expect(rows.map((r) => r.piece.id)).toEqual(['a', 'b']);
    expect(rows[1].scheduledAt.toISOString()).toBe('2026-03-01T09:00:00.000Z');
  });

  it('ignores an unparseable planner date instead of emitting Invalid Date', () => {
    const rows = buildExportRows({
      pieces: [piece('a')],
      options,
      scheduleByPieceId: { a: 'not-a-date' },
    });
    expect(Number.isNaN(rows[0].scheduledAt.getTime())).toBe(false);
    expect(rows[0].scheduledAt.getDate()).toBe(5); // computed fallback
  });

  it('re-sorts rows by the planner date, not by the computed order', () => {
    // 'a' is week 1 and 'b' is week 6, so the computed order is a→b. Planning
    // 'b' earlier must invert the export order.
    const rows = buildExportRows({
      pieces: [piece('a', 1), piece('b', 6)],
      options,
      scheduleByPieceId: { b: '2026-01-01T08:00:00.000Z' },
    });
    expect(rows.map((r) => r.piece.id)).toEqual(['b', 'a']);
  });
});
