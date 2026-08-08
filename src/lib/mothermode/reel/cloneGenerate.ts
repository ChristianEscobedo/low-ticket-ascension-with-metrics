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
 * The avatar beat, as the same production brief: @image1 is the character
 * sheet (the source of truth for identity + wardrobe), the attached audio is
 * the voice track (lip-sync to it exactly), and the beat block carries the
 * window, the framing, the delivery, and the continuity note — lean, never
 * re-describing what the sheet already owns.
 */
export function cloneAvatarPrompt(beat: CloneBeat, clone: ReelClone): string {
  const bible = lookBibleString(clone.lookBible);
  const win =
    beat.startSec != null && beat.endSec != null
      ? `${T(beat.startSec)}–${T(beat.endSec)}`
      : `${T(beat.index * beat.durationSec)}–${T((beat.index + 1) * beat.durationSec)}`;
  return [
    '[REFERENCE SYSTEM]',
    'IMPORTANT: the supplied Character Sheet and the attached audio carry different responsibilities — do not treat the reference image as an independent creative instruction. The SHEET is the source of truth for continuity.',
    '',
    '[CHARACTER SHEETS]',
    '@image1 — THE CHARACTER. Source of truth for identity, face, hair, body, approximate age, wardrobe, accessories, distinguishing features. The character stays recognizable as the same person across every scene, beat, and cut. If the sheet shows multiple views, poses, or expressions, they are all the SAME person — never different people.',
    '',
    '[AUDIO REFERENCES]',
    "The attached audio — THE VOICE TRACK. The exact read of this beat's line: lip-sync to it precisely (mouth shapes, timing, the pauses in it). Do not re-write the words; the audio is final.",
    '',
    '[SOURCE OF TRUTH PRIORITY]',
    'CHARACTER SHEET → identity + wardrobe. AUDIO REFERENCE → the voice + the exact words + their timing. BEAT → action + performance + framing. CUT → camera behavior. If two references conflict, the one responsible for that category wins.',
    '',
    `SCENE — ${win}`,
    '━━━━━━━━━━━━━━━━━━━━',
    `BEAT ${beat.index + 1} — ${win}`,
    `ACTION: the character, ${cloneShotFraming(beat.shot)}, speaking directly to camera.`,
    beat.line.trim() ? `SCRIPT (this is what the voice track says): "${beat.line.trim()}"` : '',
    beat.voice
      ? `DELIVERY: ${beat.voice.energy} energy, ${beat.voice.pace} pace${beat.voice.emphasis?.length ? `, stress "${beat.voice.emphasis[0]}"` : ''}${beat.voice.pauseAfterWord ? `, breathe after word ${beat.voice.pauseAfterWord}` : ''} — the face and body sell the same read.`
      : 'DELIVERY: medium energy, natural pace — the face and body sell the read.',
    `CUT: ${beat.shot} shot · 9:16 · ${beat.durationSec}s. Steady cinematic camera.`,
    beat.continuesFrom ? `CONTINUITY IN: ${CLONE_CONTINUITY_NOTE}` : 'CONTINUITY OUT: the character ends the beat in the same wardrobe and environment, ready to continue.',
    bible ? `LOOK: ${bible}.` : '',
    'Photorealistic, natural lip sync to the audio, real skin texture, no text, no watermark, no logos.',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/** What rides a b-roll render, so the prompt can tag the refs BY ROLE. */
export interface CloneBrollRefs {
  /** The product image url (assigned the next @image slot). */
  product?: string;
  /** True when the beat's world scene sheet trails the refs. */
  worldSheet?: boolean;
}

const T = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * THE PRODUCTION BRIEF — the b-roll render prompt as a production document:
 * the sheets carry the responsibilities (identity / environment / object),
 * the priority table resolves conflicts, and the SCENE/BEAT/CUT block stays
 * lean (action, script, delivery, framing) — wardrobe and room never repeat,
 * which is exactly how contradictions and prompt bloat stay out.
 *
 * The @image tags match the route's ref ORDER: @image1 the character sheet,
 * @image2 the variant, then the product, then the world sheet.
 */
export function cloneBrollPrompt(beat: CloneBeat, clone: ReelClone, refs?: CloneBrollRefs | string): string {
  // Back-compat: the third arg used to be the product url directly.
  const r: CloneBrollRefs = typeof refs === 'string' ? { product: refs } : (refs ?? {});
  const bible = lookBibleString(clone.lookBible);
  const slots = cloneBeatRefSlots(beat, clone);
  // Assign the @image numbers exactly as the route packs the array.
  let n = slots.variant ? 2 : 1;
  const productAt = r.product?.trim() ? ++n : 0;
  const worldAt = r.worldSheet ? ++n : 0;
  const win =
    beat.startSec != null && beat.endSec != null
      ? `${T(beat.startSec)}–${T(beat.endSec)}`
      : `${T(beat.index * beat.durationSec)}–${T((beat.index + 1) * beat.durationSec)}`;
  return [
    '[REFERENCE SYSTEM]',
    'IMPORTANT: the supplied Character Sheet, World Sheet, and Product image carry different responsibilities — do not treat reference images as independent creative instructions. The SHEETS are the source of truth for continuity.',
    '',
    '[CHARACTER SHEETS]',
    '@image1 — THE CHARACTER. Source of truth for identity, face, hair, body, approximate age, wardrobe, accessories, distinguishing features. The character stays recognizable as the same person across every scene, beat, and cut. If the sheet shows multiple views, poses, or expressions, they are all the SAME person — never different people.',
    slots.variant
      ? '@image2 — THE VARIANT. A wardrobe / location / prop variant for THIS beat only — match it here, then revert.'
      : '',
    r.product?.trim()
      ? `[PRODUCT / PROP SHEETS]\n@image${productAt} — THE PRODUCT. Source of truth for shape, proportions, materials, colors, packaging, labels. The product appears exactly as it looks there — held, used, or screen-readable when the beat calls for it — and never drifts.`
      : '',
    r.worldSheet
      ? `[SCENE SHEETS]\n@image${worldAt} — THE WORLD. Source of truth for location, layout, furniture and background objects, lighting, time of day, atmosphere, spatial relationships. Multiple views on the sheet are the SAME environment; the character moves through it, the location never resets.`
      : '',
    '',
    '[SOURCE OF TRUTH PRIORITY]',
    'CHARACTER SHEET → identity + wardrobe. SCENE SHEET → environment + lighting + layout. PRODUCT SHEET → object appearance. SCRIPT → the exact words spoken. BEAT → action + performance + timing. CUT → framing + camera movement. If two references conflict, the one responsible for that category wins.',
    '',
    `SCENE — ${win}`,
    '━━━━━━━━━━━━━━━━━━━━',
    `BEAT ${beat.index + 1} — ${win}`,
    `ACTION: ${(beat.brollPrompt ?? 'visual beat').trim()}`,
    beat.line.trim() ? `SCRIPT (the voiceover over this shot): "${beat.line.trim()}" — the visual proves or illustrates it.` : '',
    beat.voice
      ? `DELIVERY: ${beat.voice.energy} energy, ${beat.voice.pace} pace${beat.voice.emphasis?.length ? `, stress "${beat.voice.emphasis[0]}"` : ''}${beat.voice.pauseAfterWord ? `, breathe after word ${beat.voice.pauseAfterWord}` : ''}.`
      : '',
    `CUT: ${beat.shot} shot · 9:16 · ${beat.durationSec}s. Cinematic camera, natural motion.`,
    beat.continuesFrom ? `CONTINUITY IN: ${CLONE_CONTINUITY_NOTE}` : 'CONTINUITY OUT: the character ends the beat in the same wardrobe and environment, ready to continue.',
    bible ? `LOOK: ${bible}.` : '',
    'Photorealistic, sharp focus, no text, no watermark, no logos.',
  ]
    .filter((l) => l !== '')
    .join('\n');
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
