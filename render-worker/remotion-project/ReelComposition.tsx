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
 */
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { CaptionLayer } from './CaptionLayer';
import { FontLoader } from './FontLoader';
import type { RenderClip, RenderPlan } from './constants';


/** Tolerant read of a motion keyframe — field names differ by preset vintage. */
type MotionLike = {
  atSec?: number;
  t?: number;
  timeSec?: number;
  scale?: number;
  x?: number;
  y?: number;
  rotate?: number;
};

const keyTime = (k: MotionLike): number => Number(k.atSec ?? k.t ?? k.timeSec ?? 0);

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
  const x = pick((k) => (typeof k.x === 'number' ? k.x : 0));
  const y = pick((k) => (typeof k.y === 'number' ? k.y : 0));
  const rotate = pick((k) => (typeof k.rotate === 'number' ? k.rotate : 0));
  return `translate(${x}%, ${y}%) scale(${scale}) rotate(${rotate}deg)`;
}

const ClipLayer: React.FC<{ clip: RenderClip; fps: number; muted?: boolean }> = ({
  clip,
  fps,
  muted,
}) => {
  const transform = useMotionTransform(clip, fps);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
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

export const ReelComposition: React.FC<{ plan: RenderPlan }> = ({ plan }) => {
  const { fps } = plan;
  // A replacement music bed means the original clip audio must duck out.
  const muteClips = plan.audio !== null;

  return (
    // FontLoader wraps everything and holds the render open (delayRender) until
    // the caption webfonts are usable. Without it Chromium paints a fallback
    // face into the first frames and burns it into the MP4 permanently — the
    // fonts are not in the container image, they are fetched at render time.
    <FontLoader plan={plan}>
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {plan.clips.map((clip) => (
        <Sequence
          key={clip.id}
          from={clip.fromFrame}
          durationInFrames={clip.durationInFrames}
          layout="none"
        >
          <ClipLayer clip={clip} fps={fps} muted={muteClips} />
        </Sequence>
      ))}

      {plan.overlays.map((ov) => (
        <Sequence
          key={ov.id}
          from={ov.fromFrame}
          durationInFrames={ov.durationInFrames}
          layout="none"
        >
          <ClipLayer clip={ov} fps={fps} muted />
        </Sequence>
      ))}

      {plan.audio ? (
        <Sequence from={plan.audio.fromFrame} durationInFrames={plan.audio.durationInFrames}>
          <Audio src={plan.audio.src} />
        </Sequence>
      ) : null}

      {/* Captions live at the top of the stack, timed in absolute frames. */}
      <CaptionLayer plan={plan} />
    </AbsoluteFill>
    </FontLoader>
  );
};
