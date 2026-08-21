import { describe, expect, it } from 'vitest';
import { buildRenderPlan, shiftMediaCues } from '@/lib/mothermode/reel/render/plan';
import { normalizeProjectJson, projectToJson, type ReelClip } from '@/lib/mothermode/reel/types';
import { suggestCuesForWords } from '@/lib/mothermode/reel/cueSuggest';

const clip = (id: string, durationSec = 10): ReelClip => ({
  id,
  name: id,
  url: `https://cdn.example.com/${id}.mp4`,
  durationSec,
  trimEndSec: 0,
});

const WORDS = [
  { word: 'making', start: 0, end: 0.4 },
  { word: 'money', start: 0.5, end: 0.9 },
  { word: 'online', start: 1.0, end: 1.4 },
];

describe('media cues: normalization round-trip', () => {
  it('keeps cues that point at a real word; drops dangling ones', () => {
    const json = {
      clips: [clip('a')],
      captions: { a: WORDS },
      mediaCues: [
        { id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' },
        { id: 'c2', clipId: 'a', wordIndex: 99, url: 'https://cdn.example.com/x.png' }, // no word 99
        { id: 'c3', clipId: 'nope', wordIndex: 0, url: 'https://cdn.example.com/y.png' }, // no clip
        { id: 'c4', clipId: 'a', wordIndex: 0, url: 'notaurl' },
      ],
    };
    const normalized = normalizeProjectJson(json);
    expect(normalized.mediaCues).toHaveLength(1);
    expect(normalized.mediaCues?.[0]).toMatchObject({ id: 'c1', clipId: 'a', wordIndex: 1 });
  });

  it('projectToJson keeps mediaCues out of the payload when empty', () => {
    const withCues = projectToJson({
      clips: [clip('a')],
      audio: null,
      captions: { a: WORDS },
      mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' }],
    });
    expect(withCues.mediaCues).toHaveLength(1);
    const without = projectToJson({ clips: [clip('a')], audio: null, captions: {} });
    expect('mediaCues' in without).toBe(false);
  });
});

describe('shiftMediaCues: frame resolution', () => {
  it('times the cue from the word and holds past it, clamped to the clip', () => {
    const cues = shiftMediaCues(
      {
        clips: [clip('a', 1.2)],
        captions: { a: WORDS },
        mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' }],
      },
      30,
    );
    expect(cues).toHaveLength(1);
    // money starts at 0.5s → frame 15; holds to min(1.2, 0.9 + 1.0) = 1.2s → 36 - 15 = 21 frames.
    expect(cues[0]).toMatchObject({ fromFrame: 15, durationInFrames: 21, wordText: 'money' });
  });

  it('drops cues whose word was trimmed away', () => {
    const trimmed: ReelClip = { ...clip('a', 10), trimStartSec: 2 };
    const cues = shiftMediaCues(
      {
        clips: [trimmed],
        captions: { a: WORDS },
        mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' }],
      },
      30,
    );
    expect(cues).toHaveLength(0); // money ends at 0.9s, before the 2s in-point
  });

  it('the plan carries mediaCues (empty when none)', () => {
    const plan = buildRenderPlan({
      clips: [clip('a')],
      audio: null,
      captions: { a: WORDS },
      captionStyle: 'karaoke',
    });
    expect(plan.mediaCues).toEqual([]);
    const withCue = buildRenderPlan({
      clips: [clip('a')],
      audio: null,
      captions: { a: WORDS },
      captionStyle: 'karaoke',
      mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 2, url: 'https://cdn.example.com/online.png' }],
    });
    expect(withCue.mediaCues).toHaveLength(1);
    expect(withCue.mediaCues[0]).toMatchObject({ fromFrame: 30, wordText: 'online' });
  });
});

describe('media cues: style + motion (the keyframed fly-in)', () => {
  it('style clamps and round-trips; junk keys drop', () => {
    const json = {
      clips: [clip('a')],
      captions: { a: WORDS },
      mediaCues: [
        {
          id: 'c1',
          clipId: 'a',
          wordIndex: 1,
          url: 'https://cdn.example.com/cash.png',
          style: {
            widthPct: 240, // clamps to 90
            xPct: 12,
            yPct: -5, // clamps to 0
            radiusPx: 24,
            borderColor: '#ffd400',
            // no borderPx → defaults to 2 so the pick is never invisible
            shadow: false,
          },
        },
        {
          id: 'c2',
          clipId: 'a',
          wordIndex: 2,
          url: 'https://cdn.example.com/online.png',
          style: { nope: true, widthPct: 'wide' }, // all junk → style drops
        },
      ],
    };
    const normalized = normalizeProjectJson(json);
    expect(normalized.mediaCues).toHaveLength(2);
    expect(normalized.mediaCues?.[0].style).toEqual({
      widthPct: 90,
      xPct: 12,
      yPct: 0,
      radiusPx: 24,
      borderColor: '#ffd400',
      borderPx: 2,
      shadow: false,
    });
    expect(normalized.mediaCues?.[1].style).toBeUndefined();
  });

  it('motion keys clamp like clips; fewer than two keys drops the track', () => {
    const json = {
      clips: [clip('a')],
      captions: { a: WORDS },
      mediaCues: [
        {
          id: 'c1',
          clipId: 'a',
          wordIndex: 1,
          url: 'https://cdn.example.com/cash.png',
          motion: [
            { t: -1, scale: 99, panX: -500, panY: 4, rotateDeg: 360 },
            { t: 1.4, scale: 1, panX: 0, panY: 0, rotateDeg: 0 },
          ],
        },
        {
          id: 'c2',
          clipId: 'a',
          wordIndex: 2,
          url: 'https://cdn.example.com/online.png',
          motion: [{ t: 0, scale: 1.2 }], // one key can't interpolate → dropped
        },
      ],
    };
    const normalized = normalizeProjectJson(json);
    expect(normalized.mediaCues?.[0].motion).toEqual([
      { t: 0, scale: 4, panX: -50, panY: 4, rotateDeg: 45 },
      { t: 1.4, scale: 1, panX: 0, panY: 0, rotateDeg: 0 },
    ]);
    expect(normalized.mediaCues?.[1].motion).toBeUndefined();
  });

  it('style + motion survive the save → load round-trip and reach the plan verbatim', () => {
    const style = { widthPct: 48, xPct: 26, yPct: 30, radiusPx: 8, shadow: false };
    const motion = [
      { t: 0, scale: 0.2, panX: 0, panY: 0, rotateDeg: -6 },
      { t: 0.3, scale: 1, panX: 0, panY: 0, rotateDeg: 0 },
      { t: 1.4, scale: 1.12, panX: 2, panY: 0, rotateDeg: 0 },
    ];
    const saved = projectToJson({
      clips: [clip('a')],
      audio: null,
      captions: { a: WORDS },
      mediaCues: [
        { id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png', style, motion },
      ],
    });
    const loaded = normalizeProjectJson(saved);
    expect(loaded.mediaCues?.[0].style).toEqual(style);
    expect(loaded.mediaCues?.[0].motion).toEqual(motion);

    const cues = shiftMediaCues(
      {
        clips: [clip('a')],
        captions: { a: WORDS },
        mediaCues: loaded.mediaCues,
      },
      30,
    );
    expect(cues).toHaveLength(1);
    expect(cues[0].style).toEqual(style);
    expect(cues[0].motion).toEqual(motion);
    expect(cues[0]).toMatchObject({ fromFrame: 15, wordText: 'money' });
  });

  it('holdSec drives the window (word end + hold), clamped to the clip', () => {
    const cues = shiftMediaCues(
      {
        clips: [clip('a', 10)],
        captions: { a: WORDS },
        mediaCues: [
          {
            id: 'c1',
            clipId: 'a',
            wordIndex: 1,
            url: 'https://cdn.example.com/cash.png',
            holdSec: 3,
          },
        ],
      },
      30,
    );
    // money ends at 0.9s + 3s hold → 3.9s → frame 117; from 15 → 102 frames.
    expect(cues[0]).toMatchObject({ fromFrame: 15, durationInFrames: 102 });
  });

  it('holdSec clamps to 0.2–8 and round-trips through save → load', () => {
    const saved = projectToJson({
      clips: [clip('a')],
      audio: null,
      captions: { a: WORDS },
      mediaCues: [
        { id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png', holdSec: 2.5 },
        { id: 'c2', clipId: 'a', wordIndex: 2, url: 'https://cdn.example.com/online.png', holdSec: 99 },
      ],
    });
    const loaded = normalizeProjectJson(saved);
    expect(loaded.mediaCues?.[0].holdSec).toBe(2.5);
    expect(loaded.mediaCues?.[1].holdSec).toBe(8); // clamped
    // junk drops the key entirely (the default 1s hold owns it)
    const junked = normalizeProjectJson({
      clips: [clip('a')],
      captions: { a: WORDS },
      mediaCues: [
        { id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png', holdSec: 'long' },
      ],
    });
    expect(junked.mediaCues?.[0].holdSec).toBeUndefined();
  });

  it('ambient (float/wiggle) survives normalization and reaches the plan; junk drops', () => {
    const saved = projectToJson({
      clips: [clip('a')],
      audio: null,
      captions: { a: WORDS },
      mediaCues: [
        {
          id: 'c1',
          clipId: 'a',
          wordIndex: 1,
          url: 'https://cdn.example.com/cash.png',
          style: { widthPct: 40, ambient: 'wiggle' },
        },
        {
          id: 'c2',
          clipId: 'a',
          wordIndex: 2,
          url: 'https://cdn.example.com/online.png',
          style: { ambient: 'spin' as never }, // unknown → the key drops
        },
      ],
    });
    const loaded = normalizeProjectJson(saved);
    expect(loaded.mediaCues?.[0].style).toEqual({ widthPct: 40, ambient: 'wiggle' });
    expect(loaded.mediaCues?.[1].style).toBeUndefined(); // nothing usable survived

    const cues = shiftMediaCues(
      { clips: [clip('a')], captions: { a: WORDS }, mediaCues: loaded.mediaCues },
      30,
    );
    expect(cues[0].style?.ambient).toBe('wiggle');
  });

  it('a cue with no style/motion plans bare (the default card owns the render)', () => {
    const cues = shiftMediaCues(
      {
        clips: [clip('a')],
        captions: { a: WORDS },
        mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' }],
      },
      30,
    );
    expect(cues[0].style).toBeUndefined();
    expect(cues[0].motion).toBeUndefined();
  });
});

describe('suggestCuesForWords: deterministic proposals', () => {
  it('matches strong words to asset names/tags, one cue per pair, capped', () => {
    const proposals = suggestCuesForWords(
      [
        { word: 'the', start: 0, end: 0.2 },
        { word: 'money', start: 0.3, end: 0.6 },
        { word: 'rocket', start: 0.7, end: 1.0 },
        { word: 'money', start: 1.1, end: 1.4 }, // second money — asset already used
      ],
      [
        { url: 'https://cdn.example.com/cash.png', name: 'money stack' },
        { url: 'https://cdn.example.com/ship.png', tags: ['rocket', 'space'] },
      ],
    );
    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toMatchObject({ wordIndex: 1, url: 'https://cdn.example.com/cash.png' });
    expect(proposals[1]).toMatchObject({ wordIndex: 2, url: 'https://cdn.example.com/ship.png' });
  });

  it('skips glue words and junk assets', () => {
    const proposals = suggestCuesForWords(
      [{ word: 'this', start: 0, end: 0.2 }, { word: 'win', start: 0.3, end: 0.5 }],
      [
        { url: 'https://cdn.example.com/this.png', name: 'this' },
        { url: '', name: 'win' },
      ],
    );
    expect(proposals).toHaveLength(0);
  });
});

describe('media cues: animated stickers (the <Gif> branch)', () => {
  const GIF = 'https://media.giphy.com/media/abc123/giphy.gif';

  it('the animated flag survives the save → load round-trip', () => {
    const json = projectToJson({
      clips: [clip('a')],
      audio: null,
      captions: { a: WORDS },
      mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 1, url: GIF, animated: true }],
    });
    const normalized = normalizeProjectJson(json);
    expect(normalized.mediaCues?.[0]).toMatchObject({ id: 'c1', animated: true, url: GIF });
  });

  it('a missing/false flag normalizes away (the static <Img> path stays the default)', () => {
    const normalized = normalizeProjectJson({
      clips: [clip('a')],
      captions: { a: WORDS },
      mediaCues: [
        { id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' },
        { id: 'c2', clipId: 'a', wordIndex: 2, url: GIF, animated: false },
        { id: 'c3', clipId: 'a', wordIndex: 0, url: GIF, animated: 'yes' },
      ],
    });
    expect(normalized.mediaCues).toHaveLength(3);
    for (const c of normalized.mediaCues ?? []) {
      expect('animated' in c).toBe(false);
    }
  });

  it('the flag reaches the render plan verbatim (the composition reads cue.animated)', () => {
    const cues = shiftMediaCues(
      {
        clips: [clip('a')],
        captions: { a: WORDS },
        mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 1, url: GIF, animated: true }],
      },
      30,
    );
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ src: GIF, animated: true, wordText: 'money' });
    // …and a static cue plans without the key at all.
    const staticCue = shiftMediaCues(
      {
        clips: [clip('a')],
        captions: { a: WORDS },
        mediaCues: [{ id: 'c2', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' }],
      },
      30,
    );
    expect('animated' in staticCue[0]).toBe(false);
  });

  it('the composition renders the <Gif> branch for an animated cue (both copies)', () => {
    // The frame-driven <Gif> is what makes preview === render for a moving
    // sticker; this pins the branch so a refactor can't silently drop it back
    // to a frozen <Img> of the GIF's first frame.
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const app = readFileSync(join(__dirname, '..', '..', 'remotion-project', 'ReelComposition.tsx'), 'utf8');
    const worker = readFileSync(
      join(__dirname, '..', '..', 'render-worker', 'remotion-project', 'ReelComposition.tsx'),
      'utf8',
    );
    for (const [name, src] of [['app', app], ['worker', worker]] as const) {
      expect(src.includes("from '@remotion/gif'"), `${name} imports @remotion/gif`).toBe(true);
      expect(src.includes('cue.animated'), `${name} branches on cue.animated`).toBe(true);
      expect(src.includes('<Gif src={cue.src}'), `${name} renders <Gif> for the animated cue`).toBe(
        true,
      );
    }
    // The two compositions must stay byte-identical — the worker's is what
    // burns the MP4.
    expect(worker).toBe(app);
  });
});

describe('media cues: lottie stickers (the <Lottie> branch)', () => {
  const LOTTIE = 'https://cdn.example.com/stickers/confetti.json';

  it('the lottie flag survives the save → load round-trip', () => {
    const json = projectToJson({
      clips: [clip('a')],
      audio: null,
      captions: { a: WORDS },
      mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 1, url: LOTTIE, lottie: true }],
    });
    const normalized = normalizeProjectJson(json);
    expect(normalized.mediaCues?.[0]).toMatchObject({ id: 'c1', lottie: true, url: LOTTIE });
  });

  it('a missing/false flag normalizes away (the static <Img> path stays the default)', () => {
    const normalized = normalizeProjectJson({
      clips: [clip('a')],
      captions: { a: WORDS },
      mediaCues: [
        { id: 'c1', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' },
        { id: 'c2', clipId: 'a', wordIndex: 2, url: LOTTIE, lottie: false },
        { id: 'c3', clipId: 'a', wordIndex: 0, url: LOTTIE, lottie: 'yes' },
      ],
    });
    expect(normalized.mediaCues).toHaveLength(3);
    for (const c of normalized.mediaCues ?? []) {
      expect('lottie' in c).toBe(false);
    }
  });

  it('the flag reaches the render plan verbatim (the composition reads cue.lottie)', () => {
    const cues = shiftMediaCues(
      {
        clips: [clip('a')],
        captions: { a: WORDS },
        mediaCues: [{ id: 'c1', clipId: 'a', wordIndex: 1, url: LOTTIE, lottie: true }],
      },
      30,
    );
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ src: LOTTIE, lottie: true, wordText: 'money' });
    // …and a static cue plans without the key at all.
    const staticCue = shiftMediaCues(
      {
        clips: [clip('a')],
        captions: { a: WORDS },
        mediaCues: [{ id: 'c2', clipId: 'a', wordIndex: 1, url: 'https://cdn.example.com/cash.png' }],
      },
      30,
    );
    expect('lottie' in staticCue[0]).toBe(false);
  });

  it('the composition renders the <Lottie> branch for a lottie cue (both copies)', () => {
    // The frame-driven <Lottie> is what makes preview === render for a Lottie
    // sticker; this pins the branch so a refactor can't silently drop it back
    // to a frozen <Img> of the .json URL (which would render nothing).
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const app = readFileSync(join(__dirname, '..', '..', 'remotion-project', 'ReelComposition.tsx'), 'utf8');
    const worker = readFileSync(
      join(__dirname, '..', '..', 'render-worker', 'remotion-project', 'ReelComposition.tsx'),
      'utf8',
    );
    for (const [name, src] of [['app', app], ['worker', worker]] as const) {
      expect(src.includes("from '@remotion/lottie'"), `${name} imports @remotion/lottie`).toBe(true);
      expect(src.includes('cue.lottie'), `${name} branches on cue.lottie`).toBe(true);
      expect(
        src.includes('<Lottie src={cue.src}'),
        `${name} renders <Lottie> for the lottie cue`,
      ).toBe(true);
    }
    // The two compositions must stay byte-identical — the worker's is what
    // burns the MP4.
    expect(worker).toBe(app);
  });
});
