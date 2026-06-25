// Tiny line-level diff using the standard LCS table. Used by the admin
// template editor to show a side-by-side draft-vs-saved view before saving.
// Not optimised for huge inputs — receipt templates are at most a few KB.

export type DiffOp = 'equal' | 'removed' | 'added';

export interface DiffLine {
  op: DiffOp;
  leftNo: number | null;
  rightNo: number | null;
  text: string;
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export interface DiffResult {
  lines: DiffLine[];
  summary: DiffSummary;
}

function splitLines(s: string): string[] {
  // Preserve empty trailing line so newline-only changes register.
  return s.split(/\r?\n/);
}

/**
 * Compute a unified line-by-line diff between `before` and `after`.
 * Returns one entry per emitted row in either the left or right gutter.
 */
export function lineDiff(before: string, after: string): DiffResult {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;

  // Build LCS table.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let leftNo = 1;
  let rightNo = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ op: 'equal', leftNo, rightNo, text: a[i] });
      i++;
      j++;
      leftNo++;
      rightNo++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ op: 'removed', leftNo, rightNo: null, text: a[i] });
      i++;
      leftNo++;
    } else {
      lines.push({ op: 'added', leftNo: null, rightNo, text: b[j] });
      j++;
      rightNo++;
    }
  }
  while (i < n) {
    lines.push({ op: 'removed', leftNo, rightNo: null, text: a[i] });
    i++;
    leftNo++;
  }
  while (j < m) {
    lines.push({ op: 'added', leftNo: null, rightNo, text: b[j] });
    j++;
    rightNo++;
  }

  const summary: DiffSummary = { added: 0, removed: 0, unchanged: 0 };
  for (const line of lines) {
    if (line.op === 'added') summary.added++;
    else if (line.op === 'removed') summary.removed++;
    else summary.unchanged++;
  }

  return { lines, summary };
}

export interface DiffGap {
  kind: 'gap';
  /** Number of unchanged lines hidden by this gap. */
  count: number;
}

export type DiffRow = ({ kind: 'line' } & DiffLine) | DiffGap;

/**
 * Hide long runs of unchanged lines while keeping `context` lines of padding
 * around every change. Returns a flat row stream the panel can render as a
 * mix of normal diff lines and "· · ·" gaps.
 */
export function collapseUnchanged(
  diff: DiffResult,
  context: number = 2
): DiffRow[] {
  const lines = diff.lines;
  if (lines.length === 0) return [];
  const keep = new Array<boolean>(lines.length).fill(false);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].op !== 'equal') {
      for (
        let j = Math.max(0, i - context);
        j <= Math.min(lines.length - 1, i + context);
        j++
      ) {
        keep[j] = true;
      }
    }
  }
  const out: DiffRow[] = [];
  let hidden = 0;
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      if (hidden > 0) {
        out.push({ kind: 'gap', count: hidden });
        hidden = 0;
      }
      out.push({ kind: 'line', ...lines[i] });
    } else {
      hidden++;
    }
  }
  if (hidden > 0) out.push({ kind: 'gap', count: hidden });
  return out;
}
