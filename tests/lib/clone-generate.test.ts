/**
 * AI Clone — the per-beat generation step: step resolution, the spend gate,
 * the deterministic prompts, and the assemble helpers. Pure-logic coverage,
 * house style (the network lives in the route + integrations).
 */
import { describe, expect, it } from 'vitest';
import {
  blankClonePlan,
  type CloneBeat,
  type ReelClone,
} from '@/lib/mothermode/reel/clone';
import {
  CLONE_AVATAR_MODEL,
  CLONE_CONTINUITY_NOTE,
  CLONE_SEEDANCE_MODELS,
  cloneAssembleBeats,
  cloneAvatarPrompt,
  cloneBeatForReroll,
  cloneBrollPrompt,
  cloneExtendBeat,
  cloneGenerationBlockers,
  cloneGenProgress,
  cloneGenStep,
  cloneRefImagesFor,
  cloneSceneName,
  cloneShotFraming,
} from '@/lib/mothermode/reel/cloneGenerate';
import { characterSheetAssets } from '@/lib/mothermode/reel/mediaLibrary';
import {
  cloneLibraryEntries,
  isTwinReel,
  normalizeClonePlan,
  twinReelName,
  twinRoster,
} from '@/lib/mothermode/reel/clone';

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

describe('the generation step resolver', () => {
  it('avatar beats voice first, then video, then done', () => {
    expect(cloneGenStep(makeBeat())).toBe('voice');
    expect(cloneGenStep(makeBeat({ status: 'voiced', audioUrl: 'https://cdn.example.com/a.mp3' }))).toBe('video');
    expect(
      cloneGenStep(
        makeBeat({ status: 'generated', audioUrl: 'https://cdn.example.com/a.mp3', videoUrl: 'https://cdn.example.com/v.mp4' }),
      ),
    ).toBe('done');
  });

  it('a visual-only b-roll beat goes straight to video; one with a line voices first', () => {
    expect(cloneGenStep(makeBeat({ kind: 'broll', line: '', brollPrompt: 'walks the gym' }))).toBe('video');
    expect(cloneGenStep(makeBeat({ kind: 'broll', brollPrompt: 'walks the gym' }))).toBe('voice');
  });

  it('a failed beat re-enters at the step that failed', () => {
    expect(cloneGenStep(makeBeat({ status: 'failed', error: 'tts down' }))).toBe('voice');
    expect(
      cloneGenStep(
        makeBeat({ status: 'failed', audioUrl: 'https://cdn.example.com/a.mp3', error: 'muapi 422' }),
      ),
    ).toBe('video');
  });

  it('progress rolls up generated / voiced / failed honestly', () => {
    const plan = blankClonePlan(CLONE);
    plan.beats = [
      makeBeat({ status: 'generated', videoUrl: 'https://cdn.example.com/v.mp4' }),
      makeBeat({ id: 'b2', index: 1, status: 'voiced', audioUrl: 'https://cdn.example.com/a.mp3' }),
      makeBeat({ id: 'b3', index: 2, status: 'failed', error: 'x' }),
      makeBeat({ id: 'b4', index: 3 }),
    ];
    const p = cloneGenProgress(plan);
    expect(p).toMatchObject({ total: 4, generated: 1, voiced: 1, failed: 1 });
    expect(p.ratio).toBeCloseTo(0.25, 3);
    expect(cloneGenProgress(blankClonePlan(CLONE)).ratio).toBe(0);
  });
});

describe('the spend gate', () => {
  it('an unapproved plan blocks with the gate message', () => {
    const plan = blankClonePlan(CLONE);
    plan.beats = [makeBeat()];
    const blockers = cloneGenerationBlockers(plan);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/approve the storyboard/i);
  });

  it('an approved plan passes; an approved-but-broken plan fails closed', () => {
    const plan = blankClonePlan(CLONE);
    plan.approvedAt = '2026-08-07T02:00:00.000Z';
    plan.beats = [makeBeat()];
    expect(cloneGenerationBlockers(plan)).toEqual([]);

    plan.beats = [makeBeat({ refs: [] })];
    const broken = { ...plan, clone: { ...CLONE, sheetUrl: undefined, refPhotos: [] } };
    expect(cloneGenerationBlockers(broken).some((i) => i.includes('@reference 1'))).toBe(true);
  });
});

describe('the prompts (deterministic, bible verbatim)', () => {
  it('the avatar prompt frames the shot, directs the delivery, quotes the bible', () => {
    const beat = makeBeat({ shot: 'close', voice: { pace: 'fast', energy: 'high' } });
    const prompt = cloneAvatarPrompt(beat, CLONE);
    expect(prompt).toContain('tight close-up, head and shoulders');
    expect(prompt).toContain('high energy, fast pace');
    expect(prompt).toContain('Wardrobe: navy crewneck. Backdrop: warm gray wall.');
    expect(prompt).toContain('reference image');
  });

  it('shot framing covers all three angles with a medium default', () => {
    expect(cloneShotFraming('close')).toContain('close-up');
    expect(cloneShotFraming('wide')).toContain('wide shot');
    expect(cloneShotFraming('medium')).toContain('medium shot');
    // no voice programming → the neutral read
    expect(cloneAvatarPrompt(makeBeat(), CLONE)).toContain('medium energy, natural pace');
  });

  it('the b-roll prompt leads with the visual and addresses @image1 always, @image2 with a variant', () => {
    const beat = makeBeat({ kind: 'broll', line: '', brollPrompt: 'She walks the gym floor' });
    const prompt = cloneBrollPrompt(beat, CLONE);
    expect(prompt.startsWith('She walks the gym floor')).toBe(true);
    expect(prompt).toContain('@image1 is the character');
    expect(prompt).not.toContain('@image2');
    expect(prompt).toContain('Lens: 50mm');

    const withVariant = cloneBrollPrompt(
      makeBeat({
        kind: 'broll',
        line: '',
        brollPrompt: 'Holds the bottle',
        refs: ['https://cdn.example.com/sheet.png', 'https://cdn.example.com/product.png'],
      }),
      CLONE,
    );
    expect(withVariant).toContain('@image2 is the variant reference');
  });

  it('ref images are dense and in slot order', () => {
    expect(cloneRefImagesFor(makeBeat(), CLONE)).toEqual(['https://cdn.example.com/sheet.png']);
    expect(
      cloneRefImagesFor(
        makeBeat({ refs: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png'] }),
        CLONE,
      ),
    ).toEqual(['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png']);
    // the master backfills an empty slot 1
    expect(cloneRefImagesFor(makeBeat({ refs: [] }), CLONE)).toEqual([CLONE.sheetUrl]);
  });
});

describe('assemble (beats → scenes)', () => {
  it('scene names read position + shot, b-roll says so', () => {
    expect(cloneSceneName(makeBeat({ shot: 'close' }), 1)).toBe('Clone 2 · close');
    expect(cloneSceneName(makeBeat({ kind: 'broll' }), 0)).toBe('Clone 1 · b-roll');
  });

  it('only generated beats with a video land, in manifest order', () => {
    const plan = blankClonePlan(CLONE);
    plan.beats = [
      makeBeat({ id: 'c', index: 2, status: 'generated', videoUrl: 'https://cdn.example.com/c.mp4' }),
      makeBeat({ id: 'a', index: 0, status: 'generated', videoUrl: 'https://cdn.example.com/a.mp4' }),
      makeBeat({ id: 'b', index: 1 }), // still planned — not on the timeline
      makeBeat({ id: 'd', index: 3, status: 'generated' }), // no videoUrl — skipped
    ];
    const ready = cloneAssembleBeats(plan);
    expect(ready.map((b) => b.id)).toEqual(['a', 'c']);
  });
});

describe('the model tables', () => {
  it('every Seedance tier has a model slug and the avatar model is pinned', () => {
    expect(CLONE_SEEDANCE_MODELS['seedance-2.0']).toBeTruthy();
    expect(CLONE_SEEDANCE_MODELS['seedance-2.5']).toBeTruthy();
    expect(CLONE_AVATAR_MODEL).toBe('omnihuman-1');
  });
});

describe('extend (the look-back)', () => {
  it('appends after the last index with @1 riding and the honest grid', () => {
    const plan = blankClonePlan(CLONE);
    plan.beats = [makeBeat()];
    const next = cloneExtendBeat(plan, { kind: 'avatar', line: 'and here is the payoff, watch this' });
    expect(next.index).toBe(1);
    expect(next.refs).toEqual([CLONE.sheetUrl]);
    expect(next.durationSec).toBe(5); // 8 words → 5s
    expect(next.status).toBe('planned');
    // the previous beat isn't generated — no look-back yet
    expect(next.continuesFrom).toBeUndefined();
  });

  it('marks the look-back when the previous beat is generated', () => {
    const plan = blankClonePlan(CLONE);
    plan.beats = [
      makeBeat({ status: 'generated', videoUrl: 'https://cdn.example.com/beat1.mp4' }),
    ];
    const next = cloneExtendBeat(plan, { kind: 'broll', brollPrompt: 'walks out of the gym' });
    expect(next.continuesFrom).toBe('https://cdn.example.com/beat1.mp4');
    expect(next.brollPrompt).toBe('walks out of the gym');
    // and the prompts gain the continuity note only for continuing beats
    expect(cloneBrollPrompt(next, CLONE)).toContain('continues directly from the previous one');
    expect(cloneBrollPrompt(makeBeat({ kind: 'broll', brollPrompt: 'x' }), CLONE)).not.toContain(
      'continues directly from the previous one',
    );
    expect(CLONE_CONTINUITY_NOTE).toContain('unbroken motion');
  });

  it('the normalizer round-trips an appended beat (line-less avatar beats would drop — extend always carries the line)', () => {
    const plan = blankClonePlan(CLONE);
    plan.beats = [makeBeat({ status: 'generated', videoUrl: 'https://cdn.example.com/beat1.mp4' })];
    const next = cloneExtendBeat(plan, { kind: 'avatar', line: 'one more thing' });
    const back = normalizeClonePlan({ ...plan, beats: [...plan.beats, next] });
    expect(back!.beats).toHaveLength(2);
    expect(back!.beats[1].continuesFrom).toBe('https://cdn.example.com/beat1.mp4');
  });
});

describe('re-roll', () => {
  it('strips every output back to planned, keeping the plan fields', () => {
    const beat = makeBeat({
      status: 'generated',
      audioUrl: 'https://cdn.example.com/a.mp3',
      videoUrl: 'https://cdn.example.com/v.mp4',
      videoRequestId: 'req-1',
      voiceRequestId: 'req-v',
      continuesFrom: 'https://cdn.example.com/prev.mp4',
      error: 'stale',
      voice: { pace: 'fast', energy: 'high' },
    });
    const clean = cloneBeatForReroll(beat);
    expect(clean.status).toBe('planned');
    expect(clean.audioUrl).toBeUndefined();
    expect(clean.videoUrl).toBeUndefined();
    expect(clean.videoRequestId).toBeUndefined();
    expect(clean.voiceRequestId).toBeUndefined();
    expect(clean.error).toBeUndefined();
    // the plan survives: line, voice programming, refs, the look-back
    expect(clean.voice).toEqual({ pace: 'fast', energy: 'high' });
    expect(clean.continuesFrom).toBe('https://cdn.example.com/prev.mp4');
    expect(cloneGenStep(clean)).toBe('voice'); // it re-enters at voice
    expect(beat.status).toBe('generated'); // the original is untouched
  });
});

describe('the cast (Content Hub handoff)', () => {
  it('characterSheetAssets keeps only tagged image URLs', () => {
    const assets = [
      { url: 'https://cdn.example.com/sheet.png', kind: 'image', tags: ['character-sheet', 'clone'] },
      { url: 'https://cdn.example.com/other.png', kind: 'image', tags: ['cue'] },
      { url: 'not-a-url', kind: 'image', tags: ['character-sheet'] },
      { url: 'https://cdn.example.com/clip.mp4', kind: 'video', tags: ['character-sheet'] },
    ];
    const cast = characterSheetAssets(assets);
    expect(cast).toHaveLength(1);
    expect(cast[0].url).toBe('https://cdn.example.com/sheet.png');
  });
});

describe('the clone library', () => {
  it('lists other reels’ clones, skips self + plan-less reels, flags readiness', () => {
    const plan = blankClonePlan(CLONE);
    const entries = cloneLibraryEntries(
      [
        { id: 'reel-self', name: 'This reel', clonePlan: plan },
        { id: 'reel-a', name: 'Hook reel', clonePlan: plan },
        { id: 'reel-b', name: 'Empty reel' },
        {
          id: 'reel-c',
          name: 'Bare clone',
          clonePlan: { clone: { name: 'Half-built', refPhotos: [], voice: {} } },
        },
      ],
      'reel-self',
    );
    expect(entries.map((e) => e.reelId)).toEqual(['reel-a', 'reel-c']);
    expect(entries[0].clone.name).toBe('The Founder');
    expect(entries[0].ready).toBe(true); // sheet + voice id
    expect(entries[1].ready).toBe(false); // no refs at all
  });
});

describe('the twin roster (the /admin/ai-twins bridge)', () => {
  it('roster records first, with plan stats + the ready flag; prefix helpers hold', () => {
    const plan = blankClonePlan(CLONE);
    const withBeats = {
      ...plan,
      approvedAt: '2026-08-07T02:00:00.000Z',
      beats: [
        makeBeat({ status: 'generated', videoUrl: 'https://cdn.example.com/v.mp4' }),
        makeBeat({ id: 'b2', index: 1 }),
      ],
    };
    const roster = twinRoster([
      { id: 'working-reel', name: 'My hook reel', clonePlan: withBeats },
      { id: 'roster-reel', name: twinReelName('The Founder'), clonePlan: plan },
      { id: 'plain', name: 'No plan here' },
    ]);
    expect(roster.map((e) => e.reelId)).toEqual(['roster-reel', 'working-reel']);
    expect(roster[0].rosterRecord).toBe(true);
    expect(roster[1]).toMatchObject({
      rosterRecord: false,
      approved: true,
      beats: 2,
      rendered: 1,
      ready: true,
    });
    expect(isTwinReel('Twin: The Founder')).toBe(true);
    expect(isTwinReel('My hook reel')).toBe(false);
    expect(twinReelName('  The Founder  ')).toBe('Twin: The Founder');
  });
});
