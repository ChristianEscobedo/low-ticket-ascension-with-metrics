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
  CLONE_SEEDANCE_MODELS,
  cloneAssembleBeats,
  cloneAvatarPrompt,
  cloneBrollPrompt,
  cloneGenerationBlockers,
  cloneGenProgress,
  cloneGenStep,
  cloneRefImagesFor,
  cloneSceneName,
  cloneShotFraming,
} from '@/lib/mothermode/reel/cloneGenerate';

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
