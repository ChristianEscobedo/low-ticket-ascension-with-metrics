import { describe, expect, it } from 'vitest';
import {
  selectVisibleCtas,
  type VideoCTA
} from '@/app/courses/[id]/cta-visibility';

function makeCta(overrides: Partial<VideoCTA> & { id: string }): VideoCTA {
  return {
    id: overrides.id,
    title: overrides.title ?? 'Title',
    subtitle: overrides.subtitle ?? null,
    buttonText: overrides.buttonText ?? 'Go',
    link: overrides.link ?? 'https://example.com',
    linkTarget: overrides.linkTarget ?? '_blank',
    type: overrides.type ?? 'offer',
    style: overrides.style ?? 'solid',
    position: overrides.position ?? 'bottom-bar',
    showAfterSeconds: overrides.showAfterSeconds ?? 0,
    autoHideSeconds: overrides.autoHideSeconds ?? null,
    dismissable: overrides.dismissable ?? true,
    showOnce: overrides.showOnce
  };
}

describe('selectVisibleCtas', () => {
  it('returns empty array when ctas is null, undefined, or empty', () => {
    expect(selectVisibleCtas(null, 100, new Set(), new Set())).toEqual([]);
    expect(selectVisibleCtas(undefined, 100, new Set(), new Set())).toEqual([]);
    expect(selectVisibleCtas([], 100, new Set(), new Set())).toEqual([]);
  });

  it('hides CTAs whose showAfterSeconds has not yet elapsed', () => {
    const ctas = [
      makeCta({ id: 'a', showAfterSeconds: 30 }),
      makeCta({ id: 'b', showAfterSeconds: 60 })
    ];
    const visible = selectVisibleCtas(ctas, 45, new Set(), new Set());
    expect(visible.map((c) => c.id)).toEqual(['a']);
  });

  it('treats missing/zero showAfterSeconds as immediately visible', () => {
    const ctas = [makeCta({ id: 'a', showAfterSeconds: 0 })];
    expect(selectVisibleCtas(ctas, 0, new Set(), new Set())).toHaveLength(1);
  });

  it('excludes dismissed CTAs', () => {
    const ctas = [
      makeCta({ id: 'a', showAfterSeconds: 10 }),
      makeCta({ id: 'b', showAfterSeconds: 10 })
    ];
    const visible = selectVisibleCtas(ctas, 50, new Set(['a']), new Set());
    expect(visible.map((c) => c.id)).toEqual(['b']);
  });

  it('excludes auto-hidden CTAs', () => {
    const ctas = [
      makeCta({ id: 'a', showAfterSeconds: 10 }),
      makeCta({ id: 'b', showAfterSeconds: 10 })
    ];
    const visible = selectVisibleCtas(ctas, 50, new Set(), new Set(['b']));
    expect(visible.map((c) => c.id)).toEqual(['a']);
  });

  it('preserves declaration order of visible CTAs', () => {
    const ctas = [
      makeCta({ id: 'c', showAfterSeconds: 5 }),
      makeCta({ id: 'a', showAfterSeconds: 5 }),
      makeCta({ id: 'b', showAfterSeconds: 5 })
    ];
    const visible = selectVisibleCtas(ctas, 100, new Set(), new Set());
    expect(visible.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });
});
