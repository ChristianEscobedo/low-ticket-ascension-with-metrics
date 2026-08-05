import { describe, it, expect } from 'vitest';
import { newManualPieceId, suggestUtm } from '@/lib/mothermode/planner/utm';

/**
 * The piece id for a hand-typed plan card.
 *
 * This is tested at all because a blank or mangled piece id is the one mistake
 * on the add-card path that cannot be repaired later: `piece_id` is the join key
 * for both the export bridge (`scheduleByPieceId`) and attribution
 * (`utm_content`), and by the time anyone notices it's wrong the link has been
 * published and the clicks are already unattributable.
 */
describe('newManualPieceId', () => {
  const fixedDate = new Date(2026, 6, 26); // 26 Jul 2026, local time
  const fixedRandom = () => 0; // first letter of the alphabet, every time

  it('is prefixed and date-stamped so its origin is legible in a report', () => {
    expect(newManualPieceId(fixedDate, fixedRandom)).toBe(
      'manual_20260726_bbbbb'
    );
  });

  it('pads single-digit months and days', () => {
    // Jan 5 must be 20260105, not 202615 — an unpadded stamp both sorts wrong
    // and collides (2026-1-15 and 2026-11-5 would both render as 2026115).
    expect(newManualPieceId(new Date(2026, 0, 5), fixedRandom)).toBe(
      'manual_20260105_bbbbb'
    );
  });

  it('does not repeat itself across calls', () => {
    const ids = new Set(
      Array.from({ length: 200 }, () => newManualPieceId(fixedDate))
    );
    // Same day, so the stamp is shared; the random tail has to carry uniqueness.
    expect(ids.size).toBe(200);
  });

  it('survives a URL untouched, because suggestUtm will not slugify it', () => {
    const id = newManualPieceId(fixedDate);
    // The contract that matters: what utm_content carries must equal the
    // piece_id byte for byte, or the join to the lead row silently fails.
    expect(suggestUtm({ pieceId: id }).content).toBe(id);
    expect(encodeURIComponent(id)).toBe(id);
  });
});
