// @ts-nocheck — this folder is compiled by Remotion's own bundler (`npx remotion
// studio` / `remotion lambda sites create`), which supplies `remotion` and
// `@remotion/*`. The Next app never imports it, so it stays out of the web build.
/**
 * The composition: a RenderPlan in, frames out.
 *
 * Everything is a <Sequence> placed at plan-computed frame offsets, so the
 * output is frame-exact by construction — no drift between the clip cuts, the
 * music and the captions, which is the failure mode the ffmpeg concat/burn
 * chain kept producing.
 *
 * NOTE: this file exists twice (here and render-worker/remotion-project/), once
 * per build context. Edit it in one place and copy it over — they must agree.
 */
import React from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { CaptionLayer } from './CaptionLayer';
import type { RenderClip, RenderMediaCue, RenderPlan } from '../src/lib/mothermode/reel/render/plan';

/** Tolerant read of a motion keyframe — field names differ by preset vintage. */
type MotionLike = {
  atSec?: number;
  t?: number;
  timeSec?: number;
  scale?: number;
  x?: number;
  y?: number;
  rotate?: number;
  panX?: number;
  panY?: number;
  rotateDeg?: number;
};

const keyTime = (k: MotionLike): number => Number(k.atSec ?? k.t ?? k.timeSec ?? 0);
/** The plan's MotionKey uses panX/panY/rotateDeg; older vintages used x/y/rotate. */
const keyPanX = (k: MotionLike): number =>
  Number(typeof k.panX === 'number' ? k.panX : typeof k.x === 'number' ? k.x : 0);
const keyPanY = (k: MotionLike): number =>
  Number(typeof k.panY === 'number' ? k.panY : typeof k.y === 'number' ? k.y : 0);
const keyRotate = (k: MotionLike): number =>
  Number(typeof k.rotateDeg === 'number' ? k.rotateDeg : typeof k.rotate === 'number' ? k.rotate : 0);

/**
 * Ken-Burns / pan / zoom, interpolated per frame.
 *
 * ffmpeg's zoompan could only ever do one linear ramp per clip; here motion is
 * a real keyframe track, and the same numbers the editor previews are the
 * numbers we render.
 */
function useMotionTransform(clip: RenderClip, fps: number): string {
  const frame = useCurrentFrame(); // clip-local, because we're inside its Sequence
  const keys = ((clip.motion ?? []) as unknown as MotionLike[])
    .slice()
    .sort((a, b) => keyTime(a) - keyTime(b));
  if (keys.length < 2) return 'scale(1)';

  const frames = keys.map((k) => Math.max(0, Math.round(keyTime(k) * fps)));
  const pick = (get: (k: MotionLike) => number) =>
    interpolate(frame, frames, keys.map(get), {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  const scale = pick((k) => (typeof k.scale === 'number' ? k.scale : 1));
  const x = pick(keyPanX);
  const y = pick(keyPanY);
  const rotate = pick(keyRotate);
  return `translate(${x}%, ${y}%) scale(${scale}) rotate(${rotate}deg)`;
}

/**
 * Per-boundary scene transitions, frame-driven like everything else in this
 * file (a CSS transition/animation clock does not advance between renderMedia
 * screenshots — it would render frozen at the seam).
 *
 * `t` is 0→1 through the OVERLAP window: the incoming clip's first
 * `transition.frames` frames, which are also the outgoing clip's last
 * `transition.frames` frames (the plan overlapped them — both sequences are
 * mounted for the window). 'in' styles the incoming scene, 'out' the leaving
 * one. At t=0 and t=1 every style is identity, so the seam never pops.
 */
function transitionStyleFor(
  type: string,
  phase: 'in' | 'out',
  t: number,
): React.CSSProperties {
  const p = Math.min(1, Math.max(0, t));
  switch (type) {
    case 'crossfade':
      // The incoming scene fades up over the outgoing one (which holds still
      // beneath — DOM order already stacks the later clip on top).
      return phase === 'in' ? { opacity: p } : {};
    case 'whip': {
      // Whip-pan: the outgoing scene whips off left with a motion blur while
      // the incoming one whips in from the right. Fast + blurred = the whip.
      const x = phase === 'out' ? -105 * p : 105 * (1 - p);
      const blur = 10 * (phase === 'out' ? p : 1 - p);
      return {
        transform: `translateX(${x.toFixed(2)}%)`,
        filter: `blur(${blur.toFixed(1)}px)`,
        opacity: phase === 'out' ? 1 - p * 0.35 : 1,
      };
    }
    case 'zoom':
      // Zoom-through: the outgoing scene pushes INTO the camera (scale up +
      // fade, riding ON TOP via the zIndex the loop passes) while the
      // incoming scene settles from slightly oversized underneath.
      return phase === 'out'
        ? { transform: `scale(${(1 + p * 0.5).toFixed(4)})`, opacity: 1 - p * p }
        : { transform: `scale(${(1.14 - 0.14 * p).toFixed(4)})` };
    default:
      return {};
  }
}

const ClipLayer: React.FC<{
  clip: RenderClip;
  fps: number;
  muted?: boolean;
  zIndex?: number;
  /** The transition INTO this clip (its first `frames` frames blend). */
  enter?: { type: string; frames: number };
  /** The transition OUT of this clip (its last `frames` frames blend) — the
   *  NEXT clip's transitionIn, passed down by the loop. */
  exit?: { type: string; frames: number };
}> = ({ clip, fps, muted, zIndex, enter, exit }) => {
  const frame = useCurrentFrame(); // clip-local, because we're inside its Sequence
  const transform = useMotionTransform(clip, fps);

  // The transition style rides the OUTER AbsoluteFill so it composes with the
  // motion track on the video inside instead of fighting over `transform`.
  let tf: React.CSSProperties = {};
  if (enter && enter.frames > 0 && frame < enter.frames) {
    tf = transitionStyleFor(enter.type, 'in', frame / Math.max(1, enter.frames - 1));
  } else if (exit && exit.frames > 0 && frame >= clip.durationInFrames - exit.frames) {
    const local = frame - (clip.durationInFrames - exit.frames);
    tf = transitionStyleFor(exit.type, 'out', local / Math.max(1, exit.frames - 1));
  }

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        ...(typeof zIndex === 'number' ? { zIndex } : {}),
        ...tf,
      }}
    >
      {/* OffthreadVideo (not <Video>) is what makes Lambda renders reliable:
          frames are extracted with ffmpeg instead of waiting on a <video> tag
          to seek, which is where headless renders used to hang or drop frames. */}
      <OffthreadVideo
        src={clip.src}
        startFrom={Math.round(clip.trimStartSec * fps)}
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform }}
      />
    </AbsoluteFill>
  );
};

/**
 * A word-triggered media cue: the image flies in when its word is spoken.
 *
 * Frame math again, never a CSS clock. Two motion cases:
 *   - NO keyframes (the default): the ease-out rise+scale entrance over
 *     ~0.25s and a fade over the last ~0.2s of the cue's window.
 *   - cue.motion set: the SAME MotionKey[] track clips use, sampled per frame
 *     with the same interpolate() call as useMotionTransform. The track owns
 *     translate/scale/rotate; only the exit fade still applies (so the cue
 *     never hard-cuts). Key times are CUE-RELATIVE seconds, and the window
 *     is word-derived — a trim that shortens it plays less of the track.
 *   - style.ambient set: an ambient bob/sway (float/wiggle) that rides ON TOP
 *     of either case, eased in and out with the cue so it never pops.
 * The cue's timing comes from the plan, which resolved it from the word's own
 * start/end — so the fly-in is glued to the audio, not to a guess.
 */
const MediaCueLayer: React.FC<{ cue: RenderMediaCue; fps: number }> = ({ cue, fps }) => {
  const frame = useCurrentFrame(); // cue-local, inside its Sequence
  const enterFrames = Math.max(2, Math.round(fps * 0.25));
  const exitFrames = Math.max(2, Math.round(fps * 0.2));
  const e = 1 - Math.pow(1 - Math.min(1, frame / enterFrames), 3);
  const out = Math.min(1, Math.max(0, (cue.durationInFrames - frame) / exitFrames));

  const style = cue.style ?? {};
  const keys = ((cue.motion ?? []) as unknown as MotionLike[])
    .slice()
    .sort((a, b) => keyTime(a) - keyTime(b));
  const hasMotion = keys.length >= 2;

  let motionTransform = '';
  if (hasMotion) {
    const keyFrames = keys.map((k) => Math.max(0, Math.round(keyTime(k) * fps)));
    const pick = (get: (k: MotionLike) => number) =>
      interpolate(frame, keyFrames, keys.map(get), {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    const scale = pick((k) => (typeof k.scale === 'number' ? k.scale : 1));
    const x = pick(keyPanX);
    const y = pick(keyPanY);
    const rotate = pick(keyRotate);
    motionTransform = `translate(${x}%, ${y}%) scale(${scale}) rotate(${rotate}deg)`;
  }

  // Ambient motion (style.ambient): a frame-driven bob/sway that rides on top
  // of the entrance and any motion track, eased in and out WITH the cue
  // (× min(e, out)) so it never pops at the edges. Same rule as the caption
  // `float` blockFx: a sine of the frame, never a CSS clock.
  const ambK = Math.min(e, out);
  const tSec = frame / fps;
  const ambY = style.ambient === 'float' ? Math.sin(tSec * Math.PI * 1.2) * 10 * ambK : 0;
  const ambX = style.ambient === 'wiggle' ? Math.sin(tSec * Math.PI * 1.1) * 4 * ambK : 0;
  const ambDeg = style.ambient === 'wiggle' ? Math.sin(tSec * Math.PI * 2.2) * 2.2 * ambK : 0;
  const ambientTf = style.ambient
    ? ` translate(${ambX.toFixed(1)}px, ${ambY.toFixed(1)}px) rotate(${ambDeg.toFixed(2)}deg)`
    : '';

  const borderPx = style.borderPx ?? 0;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          // The house card is right:6%/top:16%/width:34% — as left/top that is
          // x=60, y=16. A style override moves the SAME box.
          left: `${style.xPct ?? 60}%`,
          top: `${style.yPct ?? 16}%`,
          width: `${style.widthPct ?? 34}%`,
          // Z-order against the caption layer (z 10): 'above' paints OVER the
          // text, the house default (no z) stays UNDER it. Intermediates carry
          // no z, so the comparison is global. A layer, not a position.
          zIndex: style.z === 'above' ? 20 : undefined,
          opacity: hasMotion ? out : Math.min(e, out),
          transform: hasMotion
            ? motionTransform + ambientTf
            : `translateY(${((1 - e) * 40).toFixed(1)}px) scale(${(0.82 + e * 0.18).toFixed(3)})${ambientTf}`,
        }}
      >
        <Img
          src={cue.src}
          style={{
            width: '100%',
            display: 'block',
            borderRadius: style.radiusPx ?? 16,
            boxShadow: style.shadow === false ? 'none' : '0 12px 40px rgba(0,0,0,0.55)',
            ...(borderPx > 0 && style.borderColor
              ? { border: `${borderPx}px solid ${style.borderColor}` }
              : {}),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const ReelComposition: React.FC<{ plan: RenderPlan }> = ({ plan }) => {
  const { fps } = plan;
  // A replacement music bed means the original clip audio must duck out.
  const muteClips = plan.audio !== null;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {plan.clips.map((clip, i) => {
        // A transition lives on the INCOMING clip (plan.ts overlapped its
        // start with the previous clip's tail); the outgoing clip's exit is
        // the NEXT clip's entrance. During the overlap both Sequences are
        // mounted, so the two scenes blend frame-exactly.
        const exit = plan.clips[i + 1]?.transition;
        return (
          <Sequence
            key={clip.id}
            from={clip.fromFrame}
            durationInFrames={clip.durationInFrames}
            layout="none"
          >
            <ClipLayer
              clip={clip}
              fps={fps}
              muted={muteClips}
              enter={clip.transition}
              exit={exit}
              // Zoom-through rides the OUTGOING scene on top while it pushes
              // into the camera; crossfade/whip let DOM order stack the
              // incoming scene on top.
              zIndex={exit?.type === 'zoom' ? 3 : undefined}
            />
          </Sequence>
        );
      })}

      {plan.overlays.map((ov) => (
        <Sequence
          key={ov.id}
          from={ov.fromFrame}
          durationInFrames={ov.durationInFrames}
          layout="none"
        >
          {/* A subject CUTOUT rides at z 6: UNDER the caption block (z 10) and
              the front free-placed words (z 11), but OVER a behind-marked word
              (z 5) — the "caption behind the speaker" stack. A plain b-roll
              overlay keeps z auto (under the captions, as always). */}
          <ClipLayer clip={ov} fps={fps} muted zIndex={ov.isCutout ? 6 : undefined} />
        </Sequence>
      ))}

      {plan.audio ? (
        <Sequence from={plan.audio.fromFrame} durationInFrames={plan.audio.durationInFrames}>
          <Audio src={plan.audio.src} />
        </Sequence>
      ) : null}

      {/* Word-triggered media cues (image fly-ins), timed in absolute frames. */}
      {(plan.mediaCues ?? []).map((cue) => (
        <Sequence
          key={cue.id}
          from={cue.fromFrame}
          durationInFrames={cue.durationInFrames}
          layout="none"
        >
          <MediaCueLayer cue={cue} fps={fps} />
        </Sequence>
      ))}

      {/* One-shot SFX, frame-exact: a cue's whoosh at its first frame (its own
          window bounds it), and a marked word's hit at the word's start. The
          Player plays these in preview too, so what you hear IS what burns. */}
      {(plan.mediaCues ?? [])
        .filter((cue) => cue.sfx && cue.sfx.url)
        .map((cue) => (
          <Sequence
            key={`sfx-${cue.id}`}
            from={cue.fromFrame}
            durationInFrames={cue.durationInFrames}
            layout="none"
          >
            <Audio src={String(cue.sfx?.url)} volume={cue.sfx?.volume ?? 1} />
          </Sequence>
        ))}
      {plan.words
        .map((w, i) => ({ w, i }))
        .filter(({ w }) => w.mark && w.mark.sfx && w.mark.sfx.url)
        .map(({ w, i }) => (
          <Sequence
            key={`wsfx-${i}`}
            from={w.fromFrame}
            durationInFrames={Math.max(1, w.toFrame - w.fromFrame) + plan.fps}
            layout="none"
          >
            <Audio src={String(w.mark?.sfx?.url)} volume={w.mark?.sfx?.volume ?? 1} />
          </Sequence>
        ))}

      {/* Captions live at the top of the stack, timed in absolute frames. */}
      <CaptionLayer plan={plan} />

      {/* Background-removed subject cutouts — the "caption behind the speaker"
          foreground layer. Rendered ABOVE the captions (after CaptionLayer in
          the stack) for [fromFrame, toFrame): the speaker occludes the words.
          The cutout is a transparent VP9 webm (the fal pixelcut output); the
          OffthreadVideo composites its alpha over the caption layer. */}
      {(plan.cutouts ?? []).map((c) => (
        <Sequence
          key={c.id}
          from={c.fromFrame}
          durationInFrames={Math.max(1, c.toFrame - c.fromFrame)}
          layout="none"
        >
          {/* z 6 — UNDER the caption block (z 10) but OVER a behind-marked
              word (z 5). Without the explicit z the cutout painted UNDER every
              caption (z-auto loses to z 10/11), so the "behind" look never
              actually appeared. */}
          <AbsoluteFill style={{ zIndex: 6 }}>
            <OffthreadVideo
              src={c.src}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
