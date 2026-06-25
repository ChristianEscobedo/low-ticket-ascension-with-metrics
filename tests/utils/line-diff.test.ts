import { describe, it, expect } from 'vitest';
import { collapseUnchanged, lineDiff } from '@/utils/text/line-diff';

describe('lineDiff', () => {
  it('reports zero changes when inputs are identical', () => {
    const { summary, lines } = lineDiff('a\nb\nc', 'a\nb\nc');
    expect(summary).toEqual({ added: 0, removed: 0, unchanged: 3 });
    expect(lines.every((l) => l.op === 'equal')).toBe(true);
  });

  it('detects pure additions at the end', () => {
    const { summary, lines } = lineDiff('a\nb', 'a\nb\nc');
    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(0);
    const added = lines.filter((l) => l.op === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe('c');
    expect(added[0].rightNo).toBe(3);
    expect(added[0].leftNo).toBeNull();
  });

  it('detects pure removals from the middle', () => {
    const { summary, lines } = lineDiff('a\nb\nc', 'a\nc');
    expect(summary.removed).toBe(1);
    const removed = lines.filter((l) => l.op === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].text).toBe('b');
    expect(removed[0].leftNo).toBe(2);
    expect(removed[0].rightNo).toBeNull();
  });

  it('treats a line change as one removal + one addition', () => {
    const { summary } = lineDiff('a\nfoo\nc', 'a\nbar\nc');
    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(1);
    expect(summary.unchanged).toBe(2);
  });

  it('handles empty inputs symmetrically', () => {
    const a = lineDiff('', 'x\ny');
    expect(a.summary.removed).toBe(1); // single empty line on the left
    expect(a.summary.added).toBe(2);
    const b = lineDiff('x\ny', '');
    expect(b.summary.removed).toBe(2);
    expect(b.summary.added).toBe(1);
  });

  it('keeps original line numbers stable for unchanged lines', () => {
    const { lines } = lineDiff('a\nb\nc\nd', 'a\nX\nc\nd');
    const equals = lines.filter((l) => l.op === 'equal');
    expect(equals.map((l) => [l.leftNo, l.rightNo])).toEqual([
      [1, 1],
      [3, 3],
      [4, 4]
    ]);
  });
});

describe('collapseUnchanged', () => {
  const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].join('\n');
  const after = ['a', 'b', 'c', 'D', 'e', 'f', 'g', 'h', 'i', 'j'].join('\n');

  it('keeps context lines around each change', () => {
    const diff = lineDiff(before, after);
    const rows = collapseUnchanged(diff, 2);
    // Expect: gap(1), b, c, -d, +D, e, f, gap(4)
    const kinds = rows.map((r) =>
      r.kind === 'gap' ? `gap(${r.count})` : r.op
    );
    expect(kinds).toEqual([
      'gap(1)',
      'equal',
      'equal',
      'removed',
      'added',
      'equal',
      'equal',
      'gap(4)'
    ]);
  });

  it('returns a single full row stream when everything is changed', () => {
    const rows = collapseUnchanged(lineDiff('a\nb', 'X\nY'), 2);
    expect(rows.every((r) => r.kind === 'line')).toBe(true);
  });

  it('emits only a single gap when nothing changed', () => {
    const rows = collapseUnchanged(lineDiff('a\nb\nc', 'a\nb\nc'), 2);
    expect(rows).toEqual([{ kind: 'gap', count: 3 }]);
  });
});
