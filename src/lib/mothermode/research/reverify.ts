/**
 * Re-verify with diff (roadmap 4.5): a line-level diff between two
 * artifacts' markdown (the previous research brief and the fresh one),
 * so "what changed since the last run" is a computed answer, not a vibe.
 *
 * Pure: no imports.
 */

export interface ArtifactDiff {
  /** Lines only in the fresh artifact. */
  added: string[];
  /** Lines only in the previous artifact. */
  removed: string[];
  /** Lines present in both (count only — the proof of what held). */
  held: number;
}

function lines(markdown: string): string[] {
  return (markdown || '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

/**
 * Diff previous → fresh, order-preserving on both sides. A line appearing
 * in both counts once per occurrence (a repeated phrase that vanishes
 * twice shows as two removals).
 */
export function diffArtifacts(
  previous: string,
  fresh: string,
): ArtifactDiff {
  const prev = lines(previous);
  const next = lines(fresh);
  const nextCounts = new Map<string, number>();
  for (const l of next) nextCounts.set(l, (nextCounts.get(l) ?? 0) + 1);
  const prevCounts = new Map<string, number>();
  for (const l of prev) prevCounts.set(l, (prevCounts.get(l) ?? 0) + 1);

  const removed: string[] = [];
  let held = 0;
  const usedNext = new Map<string, number>();
  for (const l of prev) {
    const inNext = nextCounts.get(l) ?? 0;
    const used = usedNext.get(l) ?? 0;
    if (used < inNext) {
      held += 1;
      usedNext.set(l, used + 1);
    } else {
      removed.push(l);
    }
  }
  const usedPrev = new Map<string, number>();
  const added: string[] = [];
  for (const l of next) {
    const inPrev = prevCounts.get(l) ?? 0;
    const used = usedPrev.get(l) ?? 0;
    if (used >= inPrev) added.push(l);
    else usedPrev.set(l, used + 1);
  }
  return { added, removed, held };
}

/** The one-line answer: "4 new lines, 2 gone, 11 held". */
export function reverifySummary(diff: ArtifactDiff): string {
  const parts: string[] = [];
  if (diff.added.length > 0)
    parts.push(`${diff.added.length} new line${diff.added.length === 1 ? '' : 's'}`);
  if (diff.removed.length > 0)
    parts.push(`${diff.removed.length} gone`);
  parts.push(`${diff.held} held`);
  return parts.join(' · ');
}
