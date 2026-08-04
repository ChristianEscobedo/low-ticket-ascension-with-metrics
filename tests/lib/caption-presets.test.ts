import { describe, expect, it } from 'vitest';
import {
  CAPTION_ANIMS,
  CAPTION_STYLE_DEFS,
  assFor,
  captionAnimCss,
  captionAnimKeyframes,
  captionCssFor,
  captionDefFor,
  captionRows,
  captionWindow,

  emojiFor,
  isPowerWord,
  powerKey,
  resolveCaptionStyle,
} from '@/lib/mothermode/reel/captions';
import type { ReelWord } from '@/lib/mothermode/reel/types';

describe('R17 caption preset gallery (structured model)', () => {
  it('ships ~24 presets with unique ids and required fields', () => {
    expect(CAPTION_STYLE_DEFS.length).toBeGreaterThanOrEqual(20);
    const ids = CAPTION_STYLE_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of CAPTION_STYLE_DEFS) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.font.length).toBeGreaterThan(0);
      expect(d.wordColor.length).toBeGreaterThan(0);
      expect(d.activeColor.length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(d.wordsPerLine);
    }
  });

  it('every preset renders a valid CSS object (line + word + active)', () => {
    for (const d of CAPTION_STYLE_DEFS) {
      const css = captionCssFor(d);
      expect(typeof css.line.fontFamily).toBe('string');
      expect(css.line.fontFamily).toContain(d.font);
      expect(css.word.color).toBe(d.wordColor);
      if (d.gradient) {
        // gradient presets fill the active word via background-clip:text (transparent fill)
        expect(String(css.active.backgroundImage ?? '')).toContain('linear-gradient');
        expect(String(css.active.WebkitTextFillColor ?? '')).toBe('transparent');
      } else {
        expect(css.active.color).toBe(d.activeColor);
      }
      expect(css.upper).toBe(d.upper);
      expect(css.wordsPerLine).toBe(d.wordsPerLine);
    }
  });

  it('box-highlight presets draw a highlight box behind the active word', () => {
    const kelly = captionDefFor('kelly2');
    const css = captionCssFor(kelly);
    expect(css.active.backgroundColor).toBe(kelly.activeBg);
    const beast = captionDefFor('beast');
    expect(captionCssFor(beast).active.backgroundColor).toBe('#FDE047');
  });

  it('stroke presets emit a paint-order text stroke (the Hormozi outline)', () => {
    const hormozi = captionDefFor('hormozi1');
    const css = captionCssFor(hormozi);
    expect((css.active as Record<string, unknown>).WebkitTextStroke).toContain('2px');
  });

  it('the legacy shim maps all 4 old ids to defs (old reels never break)', () => {
    expect(captionDefFor('karaoke').id).toBe('karaoke');
    expect(captionDefFor('beast').id).toBe('beast');
    expect(captionDefFor('hormozi').id).toBe('hormozi1');
    expect(captionDefFor('minimal').id).toBe('minimal');
  });

  it('captionDefFor falls back to karaoke on junk/undefined', () => {
    expect(captionDefFor('neon-rainbow').id).toBe('karaoke');
    expect(captionDefFor(undefined).id).toBe('karaoke');
    expect(captionDefFor(null).id).toBe('karaoke');
  });

  it('resolveCaptionStyle merges color wells over the preset (never mutates)', () => {
    const base = captionDefFor('hormozi1');
    const out = resolveCaptionStyle(base, { colors: ['#111111', '#FF0000'] });
    expect(out.wordColor).toBe('#111111');
    expect(out.activeColor).toBe('#FF0000');
    // base untouched
    expect(base.wordColor).toBe('#FFFFFF');
    // no overrides → same def back
    expect(resolveCaptionStyle(base, null)).toBe(base);
  });

  it('captionWindow honors wordsPerLine (1-word beat vs phrase)', () => {
    // 1-word: just the active word
    expect(captionWindow(10, 4, 1)).toEqual({ from: 4, to: 5 });
    // 2-word: the FIXED chunk containing idx 4 → words 4..5
    expect(captionWindow(10, 4, 2)).toEqual({ from: 4, to: 6 });
    // 3-word phrase: the FIXED chunk containing idx 4 → words 3..5
    expect(captionWindow(10, 4, 3)).toEqual({ from: 3, to: 6 });
  });

  it('walks the highlight across the line instead of pinning it (R22 regression)', () => {
    // THE bug: the window used to re-centre on the active word, so the lit slot
    // (activeIdx - from) never changed — only the last word ever highlighted.
    const slots: number[] = [];
    for (let idx = 0; idx < 9; idx += 1) {
      const w = captionWindow(9, idx, 3);
      slots.push(idx - w.from);
      // the active word must always be INSIDE its own line
      expect(idx).toBeGreaterThanOrEqual(w.from);
      expect(idx).toBeLessThan(w.to);
    }
    // The slot cycles 0,1,2 per chunk — proof the highlight travels.
    expect(slots).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
    // and it is NOT a constant (the pinned-highlight signature)
    expect(new Set(slots).size).toBeGreaterThan(1);
  });

  it('captionRows walks the active word across the row (R22 regression)', () => {
    const slots: number[] = [];
    for (let idx = 0; idx < 6; idx += 1) {
      const rows = captionRows(6, idx, 3, 1);
      slots.push(idx - rows[0].from);
    }
    // used to be [2,2,2,2,2,2] — the active word parked on the last slot
    expect(slots).toEqual([0, 1, 2, 0, 1, 2]);

    // clamped at the edges
    expect(captionWindow(3, 0, 3)).toEqual({ from: 0, to: 3 });
    // idx clamps to the last word (4), whose chunk is 3..4
    expect(captionWindow(5, 99, 3)).toEqual({ from: 3, to: 5 });
    expect(captionWindow(0, 0, 3)).toEqual({ from: 0, to: 0 });

  });

  it('emojiFor maps keywords and strips punctuation; junk → empty', () => {
    expect(emojiFor('money')).toBe('💰');
    expect(emojiFor('Money!')).toBe('💰');
    expect(emojiFor('FIRE')).toBe('🔥');
    expect(emojiFor('zzz-no-match')).toBe('');
  });

  it('assFor emits a karaoke-accurate ASS doc (exact Whisper timings, Active style)', () => {
    const words: ReelWord[] = [
      { word: 'hello', start: 0.2, end: 0.5 },
      { word: 'world', start: 0.5, end: 0.9 },
    ];
    const ass = assFor(words, captionDefFor('hormozi1'));
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('Anton'); // the def's font
    // every spoken word is an Active-styled Dialogue event at its EXACT centisecond window
    expect(ass).toContain('Dialogue: 0,0:00:00.20,0:00:00.50,Active,,0,0,0,,HELLO'); // upper
    expect(ass).toContain('Dialogue: 0,0:00:00.50,0:00:00.90,Active,,0,0,0,,WORLD');
  });

  it('assFor keeps centisecond precision and drops zero-length words', () => {
    const words: ReelWord[] = [
      { word: 'precise', start: 1.234, end: 1.876 },
      { word: 'skip', start: 2.0, end: 2.0 }, // zero-length — must not render
    ];
    const ass = assFor(words, captionDefFor('devin'));
    expect(ass).toContain('0:00:01.23'); // centisecond floor, not drifted
    expect(ass).toContain('0:00:01.88');
    expect(ass).not.toContain(',skip');
  });

  it('assFor maps positionPct to MarginV and escapes ASS-special words', () => {
    const words: ReelWord[] = [{ word: 'a{b}c', start: 0, end: 0.4 }];
    const ass = assFor(words, captionDefFor('devin'), { positionPct: 50, playResY: 1920 });
    expect(ass).toContain(',960,'); // 50% of 1920
    expect(ass).toContain('a\\{b\\}c');
  });
});

describe('R24 modern caption tier (anims, highlights, spacing, power words)', () => {
  it('every CaptionAnim has BOTH keyframes and an animation shorthand (≤ 220ms)', () => {
    for (const anim of CAPTION_ANIMS) {
      const kf = captionAnimKeyframes(anim);
      const css = captionAnimCss(anim);
      expect(kf, `${anim} keyframes`).toContain('@keyframes');
      expect(css, `${anim} css`).toContain('cap-');
      // nothing slower than 220ms — longer reads as laggy at 30fps
      const ms = Number(css.match(/(\d+)ms/)?.[1] ?? 0);
      expect(ms, `${anim} duration`).toBeLessThanOrEqual(220);
    }
  });

  it('the modern presets use the new primitives and stay valid', () => {
    const ids = ['opus', 'neon-pulse', 'clean-rise', 'impact-shake', 'glitch-tape',
      'soft-card', 'mono-beat', 'bounce-box', 'gradient-flow', 'type-swift'];
    for (const id of ids) {
      const def = captionDefFor(id);
      expect(def.id).toBe(id); // resolved directly, not the karaoke fallback
      expect(def.anim, `${id} anim`).toBeTruthy();
      expect(CAPTION_ANIMS).toContain(def.anim);
      const css = captionCssFor(def);
      expect(css.line.fontFamily).toContain(def.font);
    }
    // glow: the active word blooms in the accent color
    expect(String(captionCssFor(captionDefFor('opus')).active.textShadow)).toContain('#FFFFFF');
    // boxGrow: the highlight box grows in behind the word
    expect(captionCssFor(captionDefFor('bounce-box')).active.backgroundColor).toBe('#4ADE80');
    // soft-card: the whole LINE gets a rounded card
    expect(captionCssFor(captionDefFor('soft-card')).line.backgroundColor).toContain('rgba');
  });

  it('spacing is a first-class dial: preset fields + customizer overrides merge', () => {
    // preset-level spacing flows into the line CSS
    const rise = captionCssFor(captionDefFor('clean-rise'));
    expect(rise.line.letterSpacing).toBe('0.02em');
    expect(String(rise.line.wordSpacing)).toBe('0.12em');
    // customizer overrides win over the preset (and clamp junk)
    const merged = resolveCaptionStyle(captionDefFor('clean-rise'), {
      letterSpacing: 0.5, // over the 0.3 cap
      wordSpacing: -1, // under the 0 floor
    });
    const css = captionCssFor(merged);
    expect(css.line.letterSpacing).toBe('0.3em');
    // wordSpacing clamped at the 0 floor — never negative (0 emits no property, which is fine)
    expect(String(css.line.wordSpacing ?? '0em')).toBe('0em');
    expect(merged.wordSpacingEm).toBe(0);
    // base preset untouched
    expect(captionDefFor('clean-rise').letterSpacingEm).toBe(0.02);
  });

  it('powerKey normalizes; isPowerWord matches case/punctuation-insensitively', () => {
    expect(powerKey('Money!')).toBe('money');
    expect(powerKey("don't")).toBe("don't");
    expect(powerKey('!!!')).toBe('');
    const list = ['money', 'free', 'secret'];
    expect(isPowerWord('MONEY', list)).toBe(true);
    expect(isPowerWord('free?', list)).toBe(true);
    expect(isPowerWord('random', list)).toBe(false);
    expect(isPowerWord('money', undefined)).toBe(false);
    expect(isPowerWord('money', [])).toBe(false);
    expect(isPowerWord('!!!', list)).toBe(false);
  });
});
