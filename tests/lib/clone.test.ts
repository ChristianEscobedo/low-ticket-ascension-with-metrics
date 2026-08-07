/**
 * AI Clone — the clone asset, the manifest normalizer, voice programming,
 * and the cost tables. Pure-logic coverage, house style.
 */
import { describe, expect, it } from 'vitest';
import {
  beatDurationForWords,
  beatGridForWords,
  beatLineForTts,
  beatWordCount,
  blankClonePlan,
  characterSheetPrompt,
  CLONE_BEAT_MAX_WORDS,
  CLONE_COSTS,
  CLONE_FRAMEWORKS,
  CLONE_VIDEO_TYPES,
  cloneBeatCost,
  cloneFrameworkFor,
  clonePlanCost,
  cloneVideoTypeFor,
  lookBibleString,
  makeCloneId,
  normalizeClonePlan,
  resolveBeatVoiceParams,
  type CloneBeat,
  type ReelClone,
} from '@/lib/mothermode/reel/clone';
import { normalizeProjectJson, projectToJson } from '@/lib/mothermode/reel/types';

const CLONE: ReelClone = {
  id: 'clone-test01',
  name: 'The Founder',
  refPhotos: ['https://cdn.example.com/sheet.png'],
  sheetUrl: 'https://cdn.example.com/sheet.png',
  lookBible: {
    wardrobe: 'navy crewneck',
    backdrop: 'warm gray wall',
    lighting: 'soft key left',
    lens: '50mm',
  },
  voice: { voiceId: 'el-voice-1', name: 'Loni', stability: 0.5, similarityBoost: 0.75, style: 0.3 },
  createdAt: '2026-08-07T00:00:00.000Z',
};

function makeBeat(partial: Partial<CloneBeat> = {}): CloneBeat {
  return {
    id: 'beat-1',
    index: 0,
    kind: 'avatar',
    line: 'This is the hook line that stops the scroll cold.',
    shot: 'medium',
    durationSec: 5,
    refs: ['https://cdn.example.com/sheet.png'],
    status: 'planned',
    ...partial,
  };
}

describe('the look bible', () => {
  it('builds one locked string from the filled parts only', () => {
    expect(lookBibleString(CLONE.lookBible)).toBe(
      'Wardrobe: navy crewneck. Backdrop: warm gray wall. Lighting: soft key left. Lens: 50mm',
    );
    expect(lookBibleString({ wardrobe: 'hoodie', backdrop: '', lighting: '', lens: '' })).toBe(
      'Wardrobe: hoodie',
    );
    expect(lookBibleString({ wardrobe: '', backdrop: '', lighting: '', lens: '' })).toBe('');
  });
});

describe('the character-sheet foundry prompt', () => {
  it('quotes the look bible verbatim and names the person', () => {
    const prompt = characterSheetPrompt({
      description: 'A 38-year-old founder with short black hair',
      lookBible: CLONE.lookBible,
    });
    expect(prompt).toContain('A 38-year-old founder with short black hair.');
    expect(prompt).toContain('Wardrobe: navy crewneck. Backdrop: warm gray wall.');
    expect(prompt).toContain('2x2 turnaround grid');
    expect(prompt).toContain('expressions (neutral, excited, serious)');
    expect(prompt).not.toContain('full-body');
  });

  it('adds the full-body cell only on demand (walking b-roll shots)', () => {
    const prompt = characterSheetPrompt({
      description: 'A coach',
      lookBible: CLONE.lookBible,
      includeFullBody: true,
    });
    expect(prompt).toContain('full-body walking pose');
  });
});

describe('the 5/10/15s honesty grid', () => {
  it('maps word counts to seconds at ~2.5 words/sec', () => {
    expect(beatDurationForWords(12)).toBe(5);
    expect(beatDurationForWords(25)).toBe(10);
    expect(beatDurationForWords(38)).toBe(16);
    expect(beatGridForWords(12)).toBe(5);
    expect(beatGridForWords(25)).toBe(10);
    expect(beatGridForWords(30)).toBe(15);
  });

  it('counts words honestly', () => {
    expect(beatWordCount('  one two  three ')).toBe(3);
    expect(beatWordCount('')).toBe(0);
    // the cap the script writer works to: 25 words ≈ 10s
    expect(CLONE_BEAT_MAX_WORDS).toBe(25);
  });
});

describe('voice programming', () => {
  it('resolves energy + pace into ElevenLabs params, similarity never moves', () => {
    const high = resolveBeatVoiceParams(CLONE.voice, { pace: 'fast', energy: 'high' });
    expect(high.speed).toBe(1.15);
    expect(high.style).toBeCloseTo(0.55, 2); // (0.3 + 0.8) / 2
    expect(high.stability).toBeCloseTo(0.43, 2); // (0.5 + 0.35) / 2
    expect(high.similarityBoost).toBe(0.75);

    const low = resolveBeatVoiceParams(CLONE.voice, { pace: 'slow', energy: 'low' });
    expect(low.speed).toBe(0.85);
    expect(low.stability).toBeCloseTo(0.6, 2); // (0.5 + 0.7) / 2

    const neutral = resolveBeatVoiceParams(CLONE.voice);
    expect(neutral.speed).toBe(1);
  });

  it('clamps the blend to 0..1 even at the extremes', () => {
    const hot = resolveBeatVoiceParams(
      { voiceId: 'v', name: 'v', stability: 0.95, similarityBoost: 1, style: 0.9 },
      { pace: 'fast', energy: 'high' },
    );
    expect(hot.stability).toBeLessThanOrEqual(1);
    expect(hot.style).toBeLessThanOrEqual(1);
    expect(hot.similarityBoost).toBe(1);
  });

  it('weaves emphasis + pauses into the TTS text', () => {
    const out = beatLineForTts('nobody is coming to save you', {
      pace: 'natural',
      energy: 'high',
      emphasis: ['nobody', 'you'],
      pauseAfterWord: 4,
    });
    expect(out).toBe('NOBODY is coming to … save YOU');
  });

  it('leaves the line untouched without direction', () => {
    expect(beatLineForTts('just a line')).toBe('just a line');
  });
});

describe('the cost tables', () => {
  it('prices an avatar beat: avatar seconds + ElevenLabs chars', () => {
    const cost = cloneBeatCost(makeBeat({ durationSec: 10 }), 'seedance-2.0');
    expect(cost.video).toBeCloseTo(10 * CLONE_COSTS.avatarPerSec, 3);
    expect(cost.voice).toBeCloseTo(
      (makeBeat().line.length / 1000) * CLONE_COSTS.elevenlabsPer1kChars,
      3,
    );
    expect(cost.total).toBeCloseTo(cost.video + cost.voice, 3);
  });

  it('prices b-roll beats by Seedance tier, beat override wins', () => {
    const plan20 = cloneBeatCost(makeBeat({ kind: 'broll', durationSec: 5 }), 'seedance-2.0');
    expect(plan20.video).toBeCloseTo(5 * CLONE_COSTS.seedancePerSec['seedance-2.0'], 3);
    const hero = cloneBeatCost(
      makeBeat({ kind: 'broll', durationSec: 5, seedanceTier: 'seedance-2.5' }),
      'seedance-2.0',
    );
    expect(hero.video).toBeCloseTo(5 * CLONE_COSTS.seedancePerSec['seedance-2.5'], 3);
  });

  it('the plan readout charges the sheet ONCE per character, never per video', () => {
    const withSheet = blankClonePlan(CLONE);
    withSheet.beats = [makeBeat(), makeBeat({ id: 'beat-2', index: 1, kind: 'broll' })];
    const cost = clonePlanCost(withSheet);
    expect(cost.sheet).toBe(0); // the clone already has a sheet
    expect(cost.beats).toHaveLength(2);
    expect(cost.total).toBeCloseTo(cost.voiceTotal + cost.videoTotal, 3);

    const noSheet = blankClonePlan({ ...CLONE, sheetUrl: undefined });
    noSheet.beats = withSheet.beats;
    expect(clonePlanCost(noSheet).sheet).toBe(CLONE_COSTS.characterSheetImage);
    expect(clonePlanCost(noSheet).total).toBeCloseTo(
      clonePlanCost(noSheet).voiceTotal +
        clonePlanCost(noSheet).videoTotal +
        CLONE_COSTS.characterSheetImage,
      3,
    );
  });
});

describe('video types + frameworks', () => {
  it('every video type points at a real framework', () => {
    for (const t of CLONE_VIDEO_TYPES) {
      expect(CLONE_FRAMEWORKS.some((f) => f.id === t.framework)).toBe(true);
    }
    // the VSL structure from the repo is a first-class framework
    expect(cloneFrameworkFor('vsl').beats).toContain('mechanism');
    expect(cloneVideoTypeFor('hook-ad').beatSec).toBe(5);
    expect(cloneVideoTypeFor('nope')).toEqual(CLONE_VIDEO_TYPES[0]);
  });
});

describe('the manifest normalizer', () => {
  it('round-trips a plan through the project JSON unchanged', () => {
    const plan = blankClonePlan(CLONE);
    plan.videoType = 'ugc';
    plan.framework = 'pas';
    plan.approvedAt = '2026-08-07T01:00:00.000Z';
    plan.seedanceTier = 'seedance-2.5';
    plan.beats = [
      makeBeat({
        voice: { pace: 'fast', energy: 'high', emphasis: ['hook'], pauseAfterWord: 3 },
        audioUrl: 'https://cdn.example.com/beat1.mp3',
        videoUrl: 'https://cdn.example.com/beat1.mp4',
        voiceRequestId: 'req-voice-1',
        videoRequestId: 'req-video-1',
        continuesFrom: 'https://cdn.example.com/frame.png',
        status: 'generated',
      }),
      makeBeat({ id: 'beat-2', index: 1, kind: 'broll', line: '', brollPrompt: 'walks the gym' }),
    ];
    const json = projectToJson({ clips: [], audio: null, clonePlan: plan });
    const back = normalizeProjectJson(json).clonePlan;
    expect(back).not.toBeNull();
    expect(back!.clone.name).toBe('The Founder');
    expect(back!.clone.sheetUrl).toBe(CLONE.sheetUrl);
    expect(back!.videoType).toBe('ugc');
    expect(back!.framework).toBe('pas');
    expect(back!.approvedAt).toBe('2026-08-07T01:00:00.000Z');
    expect(back!.seedanceTier).toBe('seedance-2.5');
    expect(back!.beats).toHaveLength(2);
    const [b1, b2] = back!.beats;
    expect(b1.voice).toEqual({ pace: 'fast', energy: 'high', emphasis: ['hook'], pauseAfterWord: 3 });
    expect(b1.audioUrl).toBe('https://cdn.example.com/beat1.mp3');
    expect(b1.videoRequestId).toBe('req-video-1');
    expect(b1.continuesFrom).toBe('https://cdn.example.com/frame.png');
    expect(b1.status).toBe('generated');
    expect(b2.kind).toBe('broll');
    expect(b2.brollPrompt).toBe('walks the gym');
  });

  it('drops plans without a usable clone, beats without lines, junk refs', () => {
    expect(normalizeClonePlan(null)).toBeNull();
    expect(normalizeClonePlan({ clone: { name: '' } })).toBeNull();
    expect(normalizeClonePlan({ clone: 42 })).toBeNull();

    const plan = normalizeClonePlan({
      clone: { ...CLONE, refPhotos: ['not-a-url', CLONE.refPhotos[0]] },
      beats: [
        makeBeat(), // good
        { ...makeBeat({ id: 'x', index: 1 }), line: '   ' }, // avatar with no line — dropped
        { ...makeBeat({ id: 'y', index: 2 }), refs: ['javascript:alert(1)'] }, // junk ref dropped
      ],
    });
    expect(plan).not.toBeNull();
    expect(plan!.clone.refPhotos).toEqual([CLONE.refPhotos[0]]);
    expect(plan!.beats).toHaveLength(2);
    expect(plan!.beats[1].refs).toEqual([]);
  });

  it('sorts beats by index and clamps durations to the grid ceiling', () => {
    const plan = normalizeClonePlan({
      clone: CLONE,
      beats: [
        makeBeat({ id: 'b', index: 5, durationSec: 99 }),
        makeBeat({ id: 'a', index: 0 }),
      ],
    });
    expect(plan!.beats.map((b) => b.id)).toEqual(['a', 'b']);
    expect(plan!.beats[1].durationSec).toBe(15);
  });

  it('defaults unknown enums instead of throwing', () => {
    const plan = normalizeClonePlan({
      clone: CLONE,
      seedanceTier: 'seedance-9.9',
      beats: [
        { ...makeBeat(), shot: 'dutch', status: 'exploded', voice: { pace: 'ludicrous', energy: 'mega' } },
      ],
    });
    expect(plan!.seedanceTier).toBe('seedance-2.0');
    expect(plan!.beats[0].shot).toBe('medium');
    expect(plan!.beats[0].status).toBe('planned');
    expect(plan!.beats[0].voice).toEqual({ pace: 'natural', energy: 'medium' });
  });

  it('a project without a plan stays plan-less', () => {
    const json = projectToJson({ clips: [], audio: null });
    expect(normalizeProjectJson(json).clonePlan).toBeUndefined();
    expect(normalizeProjectJson({ clonePlan: 'garbage' }).clonePlan).toBeUndefined();
  });

  it('ids are unique enough to key beats', () => {
    expect(makeCloneId()).not.toBe(makeCloneId());
  });
});
