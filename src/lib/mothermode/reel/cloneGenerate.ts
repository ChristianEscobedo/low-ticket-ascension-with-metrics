/**
 * AI Clone — the per-beat GENERATION step (wizard step 5). Pure planning +
 * prompt logic; the network lives in the route
 * (src/app/api/admin/reel-clone-generate/route.ts) and the muapi/elevenlabs
 * integrations.
 *
 * THE FLOW PER BEAT
 * -----------------
 *   voice  — any beat with a spoken line (every avatar beat; a b-roll beat
 *            with a line gets it as a voiceover) → ElevenLabs with THAT
 *            beat's voice programming (one call per beat = per-beat emotion).
 *   video  — avatar beats: muapi OmniHuman-class talking head fed @1 (the
 *            locked sheet) + the beat's audio. B-roll beats: Seedance with
 *            the @reference images riding so the same character shows up
 *            INSIDE the footage.
 *
 * THE GATE
 * --------
 * Nothing generates without the storyboard stamp: `approvedAt` set and the
 * plan still clean (edits un-approve upstream, so a stamp means the manifest
 * IS the approved one). `cloneGenerationBlockers` is the route + UI's
 * single check.
 *
 * CHARACTER CONSISTENCY
 * ---------------------
 * Same ref images + the look bible quoted verbatim + the same voice id,
 * every beat. The prompts below are the ONLY place generation copy is
 * built — deterministic for the same manifest.
 */
import {
  beatGridForWords,
  beatWordCount,
  cloneBeatRefSlots,
  cloneMasterRef,
  lookBibleString,
  makeBeatId,
  storyboardIssues,
  type CloneBeat,
  type CloneBeatKind,
  type ClonePlan,
  type CloneShotAngle,
  type ReelClone,
  type SeedanceTier,
} from './clone';

// ---------------------------------------------------------------------------
// Models + output constants
// ---------------------------------------------------------------------------

/** Clone reels are vertical. */
export const CLONE_ASPECT_RATIO = '9:16';

/**
 * The talking-head avatar model slug on muapi (OmniHuman-1 class). The route
 * reads MUAPI_AVATAR_MODEL first; this is the fallback. Verify against the
 * live muapi catalog when wiring a real key.
 */
export const CLONE_AVATAR_MODEL = 'omnihuman-1';

/**
 * Seedance model slug per tier. 2.0 rides the existing pipeline default
 * (MUAPI_SEEDANCE_MODEL → seedance-2-vip-omni-reference-1080p); 2.5 is the
 * hero tier — the route reads MUAPI_SEEDANCE_25_MODEL first. Verify slugs
 * against the live catalog at build time.
 */
export const CLONE_SEEDANCE_MODELS: Record<SeedanceTier, string> = {
  'seedance-2.0': 'seedance-2-vip-omni-reference-1080p',
  'seedance-2.5': 'seedance-2.5-pro-omni-reference-1080p',
};

// ---------------------------------------------------------------------------
// Per-beat generation state
// ---------------------------------------------------------------------------

/** The next thing a beat needs, or 'done'. */
export type CloneGenStep = 'voice' | 'video' | 'done';

/**
 * Where a beat stands. A beat with a spoken line voices first (avatar beats
 * always speak; a b-roll beat MAY carry a voiceover line). 'failed' beats
 * re-enter at the step that failed — voice when the audio never landed,
 * video otherwise.
 */
export function cloneGenStep(beat: CloneBeat): CloneGenStep {
  if (beat.status === 'generated' && beat.videoUrl) return 'done';
  const speaks = beat.kind === 'avatar' || beatWordCount(beat.line) > 0;
  if (speaks && !beat.audioUrl) return 'voice';
  return 'video';
}

/** Rollup counts for the panel's progress line. */
export interface CloneGenProgress {
  total: number;
  generated: number;
  /** Audio done, video not yet. */
  voiced: number;
  failed: number;
  /** Fully generated beats / total, 0..1 (0 beats → 0). */
  ratio: number;
}

export function cloneGenProgress(plan: ClonePlan): CloneGenProgress {
  const total = plan.beats.length;
  const generated = plan.beats.filter((b) => b.status === 'generated' && !!b.videoUrl).length;
  const failed = plan.beats.filter((b) => b.status === 'failed').length;
  const voiced = plan.beats.filter(
    (b) => !!b.audioUrl && b.status !== 'generated' && b.status !== 'failed',
  ).length;
  return { total, generated, voiced, failed, ratio: total ? generated / total : 0 };
}

/**
 * The spend gate: empty when generation may proceed. Unapproved plans get
 * the gate message; approved plans re-run the storyboard honesty rules (a
 * manifest edited around the UI should still fail closed).
 */
export function cloneGenerationBlockers(plan: ClonePlan): string[] {
  if (!plan.approvedAt) {
    return ['Approve the storyboard first — nothing spends before the gate is stamped.'];
  }
  return storyboardIssues(plan);
}

// ---------------------------------------------------------------------------
// Prompts (deterministic — same manifest in, same strings out)
// ---------------------------------------------------------------------------

/** The talking-head framing words for a shot angle. */
export function cloneShotFraming(shot: CloneShotAngle): string {
  if (shot === 'close') return 'a tight close-up, head and shoulders';
  if (shot === 'wide') return 'a wide shot, full upper body with space around';
  return 'a medium shot, chest up';
}

/** The look-back line: a continuing beat's prompt gains this verbatim. */
export const CLONE_CONTINUITY_NOTE =
  'This shot continues directly from the previous one — same person, same wardrobe, same setting, unbroken motion.';

/**
 * The avatar direction: framing + the performance note (the beat's energy
 * and pace, so the delivery matches the voice programming) + the look bible
 * verbatim. The model gets @1 (the sheet) + the beat's audio alongside.
 */
export function cloneAvatarPrompt(beat: CloneBeat, clone: ReelClone): string {
  const bible = lookBibleString(clone.lookBible);
  const energy = beat.voice?.energy ?? 'medium';
  const pace = beat.voice?.pace ?? 'natural';
  return [
    `The person in the reference image, ${cloneShotFraming(beat.shot)}, speaking directly to camera.`,
    beat.startSec != null && beat.endSec != null
      ? `TIMELINE: this shot covers ${Math.round(beat.startSec)}–${Math.round(beat.endSec)}s of the video (beat ${beat.index + 1} of the script) — the read fills exactly that window.`
      : '',
    `Delivery: ${energy} energy, ${pace} pace.`,
    beat.continuesFrom ? CLONE_CONTINUITY_NOTE : '',
    bible ? `${bible}.` : '',
    'Photorealistic, natural lip sync to the audio, steady camera, real skin texture, no text, no watermark, no logos.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The b-roll prompt: the beat's visual + the @image addressing so Seedance
 * puts THE SAME character inside the footage (@image1 = the sheet, @image2
 * = the optional variant) + the look bible verbatim.
 */
export function cloneBrollPrompt(beat: CloneBeat, clone: ReelClone, product?: string): string {
  const bible = lookBibleString(clone.lookBible);
  const slots = cloneBeatRefSlots(beat, clone);
  return [
    (beat.brollPrompt ?? '').trim(),
    // The spoken line rides the visual prompt so the footage agrees with
    // what's being SAID over it (the voice layers at assembly).
    beat.line.trim() ? `The voiceover over this shot says: "${beat.line.trim()}" — the visual proves or illustrates it.` : '',
    beat.startSec != null && beat.endSec != null
      ? `TIMELINE: this shot covers ${Math.round(beat.startSec)}–${Math.round(beat.endSec)}s of the video (beat ${beat.index + 1} of the script).`
      : '',
    '@image1 is the character — the same person appears in the footage with the same face, hair, and wardrobe.',
    product?.trim()
      ? 'The product from the reference images (the app screen / the box) appears in the shot exactly as it looks there — hands holding it, screen readable.'
      : '',
    slots.variant
      ? '@image2 is the variant reference (wardrobe change, location, or product-in-hand) — match it for this shot.'
      : '',
    beat.continuesFrom ? CLONE_CONTINUITY_NOTE : '',
    bible ? `${bible}.` : '',
    'Cinematic, photorealistic, natural motion, no text, no watermark, no logos.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The reference-images array for a video call, dense and in slot order:
 * [@1 primary, @2 variant?]. Empty when the beat has no resolvable @1 (the
 * gate blocks those beats, so this is belt-and-braces).
 */
export function cloneRefImagesFor(beat: CloneBeat, clone: ReelClone): string[] {
  const slots = cloneBeatRefSlots(beat, clone);
  return [slots.primary, slots.variant].filter((u): u is string => !!u);
}

// ---------------------------------------------------------------------------
// Assemble (beats → timeline scenes)
// ---------------------------------------------------------------------------

/** The timeline clip name for a beat ("Clone 2 · close"). */
export function cloneSceneName(beat: CloneBeat, position: number): string {
  const what = beat.kind === 'broll' ? 'b-roll' : beat.shot;
  return `Clone ${position + 1} · ${what}`.slice(0, 60);
}

/** Beats ready to land on the timeline: generated, in manifest order. */
export function cloneAssembleBeats(plan: ClonePlan): CloneBeat[] {
  return [...plan.beats]
    .sort((a, b) => a.index - b.index)
    .filter((b) => b.status === 'generated' && !!b.videoUrl);
}

// ---------------------------------------------------------------------------
// Extend + re-roll (manifest operations — extend/re-roll is step 5's sibling)
// ---------------------------------------------------------------------------

/**
 * Extend: append a beat after the last one. @1 rides automatically; when the
 * previous beat is generated the new beat marks the look-back
 * (`continuesFrom` = the previous beat's clip — the generate route grabs its
 * last frame for the image-to-video start). Appending changes the
 * storyboard, so the caller un-approves the gate. VSLs are just longer
 * chains appended this way.
 */
export function cloneExtendBeat(
  plan: ClonePlan,
  input: { kind: CloneBeatKind; line?: string; brollPrompt?: string },
): CloneBeat {
  const sorted = [...plan.beats].sort((a, b) => a.index - b.index);
  const prev = sorted[sorted.length - 1];
  const line = (input.line ?? '').trim().slice(0, 300);
  const master = cloneMasterRef(plan.clone);
  const beat: CloneBeat = {
    id: makeBeatId(),
    index: prev ? prev.index + 1 : 0,
    kind: input.kind,
    line,
    shot: 'medium',
    // The honest grid: the seconds the words need (5s for a visual beat).
    durationSec: beatGridForWords(beatWordCount(line)),
    refs: master ? [master] : [],
    status: 'planned',
  };
  if (input.kind === 'broll' && input.brollPrompt?.trim()) {
    beat.brollPrompt = input.brollPrompt.trim().slice(0, 500);
  }
  if (prev?.status === 'generated' && prev.videoUrl) beat.continuesFrom = prev.videoUrl;
  return beat;
}

/**
 * Re-roll: strip a beat's generation outputs back to 'planned'. The plan is
 * unchanged, so the gate stays stamped — re-rolling re-buys THIS beat's
 * outputs only. Pure: a new beat with the output keys dropped (id, refs,
 * line, voice, and any continuesFrom survive).
 */
export function cloneBeatForReroll(beat: CloneBeat): CloneBeat {
  const out: CloneBeat = { ...beat, status: 'planned' };
  delete out.audioUrl;
  delete out.videoUrl;
  delete out.voiceRequestId;
  delete out.videoRequestId;
  delete out.error;
  return out;
}
