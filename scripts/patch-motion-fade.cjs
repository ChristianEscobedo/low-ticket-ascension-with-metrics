#!/usr/bin/env node
/**
 * 1) Allow float + wiggle together with amplitude/speed settings
 * 2) Movie-style ghost fade: ease-in-out + slight rise on reveal / sink on dissolve
 * 3) Gallery toggles + sliders for float/wiggle
 * 4) Tests + vendor sync
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ============================================================================
// captions.ts — motion overrides + resolve
// ============================================================================
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');

  // Expand ghost type with ease (optional, default smooth)
  if (!s.includes("ease?: 'linear' | 'smooth'")) {
    s = s.replace(
      `/** Delay between staggered units in seconds (0.02–0.25). Default 0.05 word / 0.03 letter. */
    staggerSec?: number;
  };`,
      `/** Delay between staggered units in seconds (0.02–0.25). Default 0.05 word / 0.03 letter. */
    staggerSec?: number;
    /**
     * Fade curve. 'smooth' = ease-in-out (movie-caption default).
     * 'linear' = constant ramp.
     */
    ease?: 'linear' | 'smooth';
    /**
     * Extra vertical drift during fade (em). Positive = rises in / sinks out.
     * Movie-caption "float onto the frame" feel. Default 0.12 when smooth.
     */
    driftEm?: number;
  };

  /**
   * Ambient motion dials (float bob + wiggle sway). Independent toggles so both
   * can run together. Amplitude/speed override the layer defaults.
   */
  motion?: {
    floatAmpEm?: number;
    floatPeriodSec?: number;
    wiggleDeg?: number;
    wigglePeriodSec?: number;
  };`,
    );
    console.log('captions: expanded ghost + motion on def');
  }

  // Replace blockMotion exclusive with float/wiggle booleans + settings
  if (!s.includes('floatOn?:')) {
    s = s.replace(
      `/**
   * The block's ambient motion: 'still' strips float/wiggle, 'float' is the
   * gentle bob, 'wiggle' a soft rotational sway. Omit = the preset's own
   * blockFx. Page-level effects (ghostFade) are a different axis and survive.
   */
  blockMotion?: 'still' | 'float' | 'wiggle';`,
      `/**
   * Legacy single-pick motion. Prefer floatOn/wiggleOn (can both be true).
   * Kept so old saved overrides still resolve.
   */
  blockMotion?: 'still' | 'float' | 'wiggle';
  /** Toggle float bob independently (can combine with wiggle). */
  floatOn?: boolean;
  /** Toggle wiggle sway independently (can combine with float). */
  wiggleOn?: boolean;
  /** Float bob amplitude in em (0.02–0.4). Default 0.12. */
  floatAmpEm?: number;
  /** Float bob period in seconds (0.6–4). Default 1.8. */
  floatPeriodSec?: number;
  /** Wiggle rotation amplitude in degrees (0.3–6). Default 1.4. */
  wiggleDeg?: number;
  /** Wiggle period in seconds (0.4–3). Default 0.9. */
  wigglePeriodSec?: number;
  /** Ghost fade ease curve. */
  ghostEase?: 'linear' | 'smooth';
  /** Ghost vertical drift in em during fade (0–0.4). */
  ghostDriftEm?: number;`,
    );
    console.log('captions: added float/wiggle override fields');
  }

  // Replace resolve blockMotion exclusive logic
  const oldResolve = `// Block feel: the override owns float/wiggle (never both), page fx survive.
  if (overrides.blockMotion === 'still' || overrides.blockMotion === 'float' || overrides.blockMotion === 'wiggle') {
    const rest = (out.blockFx ?? []).filter((fx) => fx !== 'float' && fx !== 'wiggle');
    out.blockFx = overrides.blockMotion === 'still' ? rest : [...rest, overrides.blockMotion];
  }`;

  const newResolve = `// Block feel: float + wiggle are independent toggles (can both be on).
  // Legacy blockMotion still works for old saves.
  {
    let fx = [...(out.blockFx ?? [])];
    const hasFloatToggle = typeof overrides.floatOn === 'boolean';
    const hasWiggleToggle = typeof overrides.wiggleOn === 'boolean';
    if (hasFloatToggle || hasWiggleToggle) {
      if (hasFloatToggle) {
        fx = fx.filter((x) => x !== 'float');
        if (overrides.floatOn) fx.push('float');
      }
      if (hasWiggleToggle) {
        fx = fx.filter((x) => x !== 'wiggle');
        if (overrides.wiggleOn) fx.push('wiggle');
      }
      out.blockFx = fx;
    } else if (
      overrides.blockMotion === 'still' ||
      overrides.blockMotion === 'float' ||
      overrides.blockMotion === 'wiggle'
    ) {
      const rest = fx.filter((x) => x !== 'float' && x !== 'wiggle');
      out.blockFx =
        overrides.blockMotion === 'still' ? rest : [...rest, overrides.blockMotion];
    }
    // Motion amplitude/speed
    const m: NonNullable<CaptionStyleDef['motion']> = { ...(out.motion ?? {}) };
    let touched = false;
    if (typeof overrides.floatAmpEm === 'number' && Number.isFinite(overrides.floatAmpEm)) {
      m.floatAmpEm = Math.max(0.02, Math.min(0.4, overrides.floatAmpEm));
      touched = true;
    }
    if (typeof overrides.floatPeriodSec === 'number' && Number.isFinite(overrides.floatPeriodSec)) {
      m.floatPeriodSec = Math.max(0.6, Math.min(4, overrides.floatPeriodSec));
      touched = true;
    }
    if (typeof overrides.wiggleDeg === 'number' && Number.isFinite(overrides.wiggleDeg)) {
      m.wiggleDeg = Math.max(0.3, Math.min(6, overrides.wiggleDeg));
      touched = true;
    }
    if (typeof overrides.wigglePeriodSec === 'number' && Number.isFinite(overrides.wigglePeriodSec)) {
      m.wigglePeriodSec = Math.max(0.4, Math.min(3, overrides.wigglePeriodSec));
      touched = true;
    }
    if (touched) out.motion = m;
  }`;

  if (s.includes(oldResolve)) {
    s = s.replace(oldResolve, newResolve);
    console.log('captions: resolve motion updated');
  } else if (!s.includes('hasFloatToggle')) {
    console.warn('captions: old resolve block not found exactly');
  }

  // Ghost ease/drift in resolve (extend hasTiming block)
  if (!s.includes('ghostEase')) {
    // already added to interface; wire into resolve ghost block
    s = s.replace(
      `const gs = overrides.ghostStagger;
    const gss = overrides.ghostStaggerSec;
    const hasTiming =
      (typeof gi === 'number' && Number.isFinite(gi)) ||
      (typeof go === 'number' && Number.isFinite(go)) ||
      gs === 'block' ||
      gs === 'word' ||
      gs === 'letter' ||
      (typeof gss === 'number' && Number.isFinite(gss));
    if (hasTiming) {
      out.ghost = {
        ...(out.ghost ?? {}),
        ...(typeof gi === 'number' && Number.isFinite(gi)
          ? { fadeInSec: Math.max(0.05, Math.min(1.2, gi)) }
          : {}),
        ...(typeof go === 'number' && Number.isFinite(go)
          ? { fadeOutSec: Math.max(0.05, Math.min(1.2, go)) }
          : {}),
        ...(gs === 'block' || gs === 'word' || gs === 'letter'
          ? { stagger: gs }
          : {}),
        ...(typeof gss === 'number' && Number.isFinite(gss)
          ? { staggerSec: Math.max(0.02, Math.min(0.25, gss)) }
          : {}),
      };
    }`,
      `const gs = overrides.ghostStagger;
    const gss = overrides.ghostStaggerSec;
    const ge = overrides.ghostEase;
    const gd = overrides.ghostDriftEm;
    const hasTiming =
      (typeof gi === 'number' && Number.isFinite(gi)) ||
      (typeof go === 'number' && Number.isFinite(go)) ||
      gs === 'block' ||
      gs === 'word' ||
      gs === 'letter' ||
      (typeof gss === 'number' && Number.isFinite(gss)) ||
      ge === 'linear' ||
      ge === 'smooth' ||
      (typeof gd === 'number' && Number.isFinite(gd));
    if (hasTiming) {
      out.ghost = {
        ...(out.ghost ?? {}),
        ...(typeof gi === 'number' && Number.isFinite(gi)
          ? { fadeInSec: Math.max(0.05, Math.min(1.2, gi)) }
          : {}),
        ...(typeof go === 'number' && Number.isFinite(go)
          ? { fadeOutSec: Math.max(0.05, Math.min(1.2, go)) }
          : {}),
        ...(gs === 'block' || gs === 'word' || gs === 'letter'
          ? { stagger: gs }
          : {}),
        ...(typeof gss === 'number' && Number.isFinite(gss)
          ? { staggerSec: Math.max(0.02, Math.min(0.25, gss)) }
          : {}),
        ...(ge === 'linear' || ge === 'smooth' ? { ease: ge } : {}),
        ...(typeof gd === 'number' && Number.isFinite(gd)
          ? { driftEm: Math.max(0, Math.min(0.4, gd)) }
          : {}),
      };
    }`,
    );
    console.log('captions: ghost ease/drift resolve');
  }

  fs.writeFileSync(p, s);
}

// ============================================================================
// captionLayer.tsx — compose float+wiggle, smooth fade + drift
// ============================================================================
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');

  // Smoothstep helper + improved ghostUnitOpacity with ease + drift fraction
  const oldGhostFn = `export function ghostUnitOpacity(
  frame: number,
  pageStartFrame: number,
  pageEndFrame: number,
  unitIndex: number,
  inF: number,
  outF: number,
  staggerFrames: number,
): number {
  const delay = Math.max(0, unitIndex) * Math.max(0, staggerFrames);
  const localIn = frame - pageStartFrame - delay;
  const localOut = pageEndFrame - frame - delay;
  const inOp = Math.min(1, Math.max(0, localIn / Math.max(1, inF)));
  const outOp = Math.min(1, Math.max(0, localOut / Math.max(1, outF)));
  return Math.min(inOp, outOp);
}`;

  const newGhostFn = `/** Smoothstep 0→1 (movie-caption ease-in-out). */
export function ghostSmooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Ghost unit opacity for one staggered item (word or letter) or the whole block
 * (unitIndex 0, staggerFrames 0).
 * ease 'smooth' = ease-in-out reveal/dissolve (viral movie-caption feel).
 * Returns 0..1.
 */
export function ghostUnitOpacity(
  frame: number,
  pageStartFrame: number,
  pageEndFrame: number,
  unitIndex: number,
  inF: number,
  outF: number,
  staggerFrames: number,
  ease: 'linear' | 'smooth' = 'smooth',
): number {
  const delay = Math.max(0, unitIndex) * Math.max(0, staggerFrames);
  const localIn = frame - pageStartFrame - delay;
  const localOut = pageEndFrame - frame - delay;
  let inOp = Math.min(1, Math.max(0, localIn / Math.max(1, inF)));
  let outOp = Math.min(1, Math.max(0, localOut / Math.max(1, outF)));
  if (ease === 'smooth') {
    inOp = ghostSmooth(inOp);
    outOp = ghostSmooth(outOp);
  }
  return Math.min(inOp, outOp);
}

/**
 * Vertical drift factor for movie-style fade: +1 at start of fade-in, 0 at hold,
 * -1 at end of fade-out. Multiply by driftEm for translateY.
 */
export function ghostDriftFactor(
  frame: number,
  pageStartFrame: number,
  pageEndFrame: number,
  unitIndex: number,
  inF: number,
  outF: number,
  staggerFrames: number,
): number {
  const delay = Math.max(0, unitIndex) * Math.max(0, staggerFrames);
  const localIn = frame - pageStartFrame - delay;
  const localOut = pageEndFrame - frame - delay;
  if (localIn < inF) {
    // rising onto the frame: start below (positive Y) → 0
    const t = Math.min(1, Math.max(0, localIn / Math.max(1, inF)));
    return 1 - ghostSmooth(t);
  }
  if (localOut < outF) {
    // sinking off: 0 → positive Y
    const t = Math.min(1, Math.max(0, 1 - localOut / Math.max(1, outF)));
    return ghostSmooth(t);
  }
  return 0;
}`;

  if (s.includes(oldGhostFn)) {
    s = s.replace(oldGhostFn, newGhostFn);
    console.log('layer: ghost ease helpers');
  } else if (!s.includes('ghostSmooth')) {
    console.warn('layer: ghostUnitOpacity body mismatch');
  }

  // Replace float/wiggle exclusive transforms with composed + settings
  const oldMotion = `if (blockFx.includes('float')) {
    // A gentle bob — the period is the frame clock, so it loops identically in
    // the MP4. It composes with the centred anchor via transform chaining.
    const bob = Math.sin((frame / plan.fps) * ((2 * Math.PI) / FLOAT_PERIOD_SEC)) * 0.12;
    blockStyle.transform = \`translateX(-50%) translateY(\${bob.toFixed(3)}em)\`;
  }
  if (blockFx.includes('wiggle')) {
    // A soft rotational sway with a slight drift — same frame-clock rule. The
    // feel override never carries float AND wiggle, so this composes cleanly.
    const tSec = frame / plan.fps;
    const sway = Math.sin(tSec * ((2 * Math.PI) / 0.9)) * 1.4; // deg
    const drift = Math.sin(tSec * ((2 * Math.PI) / 1.8)) * 0.08; // em
    blockStyle.transform = \`translateX(-50%) rotate(\${sway.toFixed(2)}deg) translateY(\${drift.toFixed(3)}em)\`;
  }`;

  const newMotion = `{
    // Float + wiggle compose: both can be on. Settings from def.motion.
    const mot = (def as CaptionStyleDef).motion;
    const tSec = frame / plan.fps;
    let ty = 0;
    let rot = 0;
    if (blockFx.includes('float')) {
      const period = mot?.floatPeriodSec ?? FLOAT_PERIOD_SEC;
      const amp = mot?.floatAmpEm ?? 0.12;
      ty += Math.sin(tSec * ((2 * Math.PI) / period)) * amp;
    }
    if (blockFx.includes('wiggle')) {
      const wPer = mot?.wigglePeriodSec ?? 0.9;
      const deg = mot?.wiggleDeg ?? 1.4;
      rot += Math.sin(tSec * ((2 * Math.PI) / wPer)) * deg;
      // subtle lateral drift rides with wiggle
      ty += Math.sin(tSec * ((2 * Math.PI) / (wPer * 2))) * 0.06;
    }
    const parts = ['translateX(-50%)'];
    if (rot !== 0) parts.push(\`rotate(\${rot.toFixed(2)}deg)\`);
    if (ty !== 0) parts.push(\`translateY(\${ty.toFixed(3)}em)\`);
    if (parts.length > 1) blockStyle.transform = parts.join(' ');
  }`;

  if (s.includes(oldMotion)) {
    s = s.replace(oldMotion, newMotion);
    console.log('layer: composed float+wiggle');
  } else {
    console.warn('layer: float/wiggle block mismatch — trying looser');
  }

  // Update ghostFade block to use smooth ease + drift on block
  // Find __ghost stash and block opacity path
  if (!s.includes('ghostDriftFactor') || s.includes("ease: 'smooth'")) {
    // patch the ghostFade section's opacity + transform
    const ghostBlockRe =
      /if \(staggerMode === 'block'\) \{\s*const local = frame - pageStartFrame;\s*let opacity = 1;\s*if \(local < inF\) opacity = clamp01\(local \/ inF\);\s*else if \(local > pageDur - outF\) opacity = clamp01\(\(pageEndFrame - frame\) \/ outF\);\s*blockStyle\.opacity = opacity;\s*\}/;

    const ghostBlockNew = `const ease = (ghost?.ease ?? 'smooth') as 'linear' | 'smooth';
    const driftEm = ghost?.driftEm ?? (ease === 'smooth' ? 0.14 : 0);
    (blockStyle as Record<string, unknown>).__ghost = {
      pageStartFrame,
      pageEndFrame,
      inF,
      outF,
      staggerMode,
      staggerFrames,
      pageFrom,
      ease,
      driftEm,
    };
    if (staggerMode === 'block') {
      const opacity = ghostUnitOpacity(
        frame,
        pageStartFrame,
        pageEndFrame,
        0,
        inF,
        outF,
        0,
        ease,
      );
      blockStyle.opacity = opacity;
      if (driftEm > 0) {
        const df = ghostDriftFactor(
          frame,
          pageStartFrame,
          pageEndFrame,
          0,
          inF,
          outF,
          0,
        );
        const dy = (df * driftEm).toFixed(3);
        const prev = String(blockStyle.transform ?? 'translateX(-50%)');
        blockStyle.transform = \`\${prev} translateY(\${dy}em)\`;
      }
    }`;

    // Also need to replace the old __ghost assignment - do a broader replace
    const broadRe =
      /\(blockStyle as Record<string, unknown>\)\.__ghost = \{[\s\S]*?\/\/ word\/letter: leave block at full opacity; each unit fades itself\.\s*\}/;

    if (broadRe.test(s)) {
      s = s.replace(
        broadRe,
        ghostBlockNew + `\n    // word/letter: leave block at full opacity; each unit fades itself.\n  }`,
      );
      console.log('layer: ghost block smooth+drift');
    } else if (ghostBlockRe.test(s)) {
      s = s.replace(ghostBlockRe, ghostBlockNew);
      console.log('layer: ghost block via narrow re');
    } else {
      console.warn('layer: could not patch ghost block path');
    }
  }

  // Word stagger: pass ease + apply drift
  if (s.includes("ghostMeta.staggerMode === 'word'") && !s.includes('ghostMeta.ease')) {
    s = s.replace(
      `if (ghostMeta && ghostMeta.staggerMode === 'word') {
              const unitIdx = idx - ghostMeta.pageFrom;
              const gOp = ghostUnitOpacity(
                frame,
                ghostMeta.pageStartFrame,
                ghostMeta.pageEndFrame,
                unitIdx,
                ghostMeta.inF,
                ghostMeta.outF,
                ghostMeta.staggerFrames,
              );
              base.opacity = gOp;
            }`,
      `if (ghostMeta && ghostMeta.staggerMode === 'word') {
              const unitIdx = idx - ghostMeta.pageFrom;
              const gOp = ghostUnitOpacity(
                frame,
                ghostMeta.pageStartFrame,
                ghostMeta.pageEndFrame,
                unitIdx,
                ghostMeta.inF,
                ghostMeta.outF,
                ghostMeta.staggerFrames,
                ghostMeta.ease ?? 'smooth',
              );
              base.opacity = gOp;
              if ((ghostMeta.driftEm ?? 0) > 0) {
                const df = ghostDriftFactor(
                  frame,
                  ghostMeta.pageStartFrame,
                  ghostMeta.pageEndFrame,
                  unitIdx,
                  ghostMeta.inF,
                  ghostMeta.outF,
                  ghostMeta.staggerFrames,
                );
                const dy = df * (ghostMeta.driftEm ?? 0);
                const prev = String(base.transform ?? '');
                base.transform = prev
                  ? \`\${prev} translateY(\${dy.toFixed(3)}em)\`
                  : \`translateY(\${dy.toFixed(3)}em)\`;
              }
            }`,
    );
    // extend ghostMeta type inline
    s = s.replace(
      `staggerMode: 'block' | 'word' | 'letter';
                  staggerFrames: number;
                  pageFrom: number;
                }`,
      `staggerMode: 'block' | 'word' | 'letter';
                  staggerFrames: number;
                  pageFrom: number;
                  ease?: 'linear' | 'smooth';
                  driftEm?: number;
                }`,
    );
    console.log('layer: word stagger ease+drift');
  }

  // Letter stagger: pass ease
  if (s.includes("ghostMeta.staggerMode === 'letter'") && s.includes('ghostUnitOpacity(')) {
    // replace letter ghostUnitOpacity calls missing ease arg - look for pattern without ease
    s = s.replace(
      /ghostUnitOpacity\(\s*frame,\s*ghostMeta\.pageStartFrame,\s*ghostMeta\.pageEndFrame,\s*unitIdx,\s*ghostMeta\.inF,\s*ghostMeta\.outF,\s*ghostMeta\.staggerFrames,\s*\)/g,
      `ghostUnitOpacity(
                        frame,
                        ghostMeta.pageStartFrame,
                        ghostMeta.pageEndFrame,
                        unitIdx,
                        ghostMeta.inF,
                        ghostMeta.outF,
                        ghostMeta.staggerFrames,
                        ghostMeta.ease ?? 'smooth',
                      )`,
    );
    console.log('layer: letter ease args');
  }

  fs.writeFileSync(p, s);
}

// ============================================================================
// CaptionGallery — float/wiggle toggles + settings near ghost section
// ============================================================================
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx');
  let s = fs.readFileSync(p, 'utf8');

  if (!s.includes('floatOn')) {
    // Insert motion section before Ghost label
    const ghostLabel = s.indexOf('Ghost');
    // find the label that wraps ghost fade - look for title="Page fades
    const anchor = 'title="Page fades fully on, holds, then fades fully off"';
    const ai = s.indexOf(anchor);
    if (ai < 0) {
      console.warn('gallery: ghost title not found');
    } else {
      // walk back to the start of the ghost <label>
      const labelStart = s.lastIndexOf('<label', ai);
      if (labelStart < 0) {
        console.warn('gallery: ghost label start not found');
      } else {

      const motionUi = `
                <div className="flex flex-col gap-2 rounded-lg border border-bone/10 bg-bone/[0.03] p-2">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-bone/40">
                    Motion
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const on =
                          overrides?.floatOn ??
                          (activeDef.blockFx ?? []).includes('float');
                        onCustomize({ floatOn: !on });
                      }}
                      className={clsx(
                        'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                        (overrides?.floatOn ??
                          (activeDef.blockFx ?? []).includes('float'))
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                      )}
                    >
                      Float{' '}
                      {(overrides?.floatOn ??
                        (activeDef.blockFx ?? []).includes('float'))
                        ? 'On'
                        : 'Off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const on =
                          overrides?.wiggleOn ??
                          (activeDef.blockFx ?? []).includes('wiggle');
                        onCustomize({ wiggleOn: !on });
                      }}
                      className={clsx(
                        'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                        (overrides?.wiggleOn ??
                          (activeDef.blockFx ?? []).includes('wiggle'))
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                      )}
                    >
                      Wiggle{' '}
                      {(overrides?.wiggleOn ??
                        (activeDef.blockFx ?? []).includes('wiggle'))
                        ? 'On'
                        : 'Off'}
                    </button>
                  </div>
                  {(overrides?.floatOn ??
                    (activeDef.blockFx ?? []).includes('float')) && (
                    <>
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Float amp</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.floatAmpEm ??
                            activeDef.motion?.floatAmpEm ??
                            0.12
                          ).toFixed(2)}
                          em
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={40}
                        step={1}
                        value={Math.round(
                          (overrides?.floatAmpEm ??
                            activeDef.motion?.floatAmpEm ??
                            0.12) * 100,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            floatAmpEm: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-brass"
                      />
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Float speed</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.floatPeriodSec ??
                            activeDef.motion?.floatPeriodSec ??
                            1.8
                          ).toFixed(1)}
                          s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={40}
                        step={1}
                        value={Math.round(
                          (overrides?.floatPeriodSec ??
                            activeDef.motion?.floatPeriodSec ??
                            1.8) * 10,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            floatPeriodSec: Number(e.target.value) / 10,
                          })
                        }
                        className="w-full accent-brass"
                      />
                    </>
                  )}
                  {(overrides?.wiggleOn ??
                    (activeDef.blockFx ?? []).includes('wiggle')) && (
                    <>
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Wiggle amp</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.wiggleDeg ??
                            activeDef.motion?.wiggleDeg ??
                            1.4
                          ).toFixed(1)}
                          °
                        </span>
                      </div>
                      <input
                        type="range"
                        min={3}
                        max={60}
                        step={1}
                        value={Math.round(
                          (overrides?.wiggleDeg ??
                            activeDef.motion?.wiggleDeg ??
                            1.4) * 10,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            wiggleDeg: Number(e.target.value) / 10,
                          })
                        }
                        className="w-full accent-brass"
                      />
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Wiggle speed</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.wigglePeriodSec ??
                            activeDef.motion?.wigglePeriodSec ??
                            0.9
                          ).toFixed(1)}
                          s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={30}
                        step={1}
                        value={Math.round(
                          (overrides?.wigglePeriodSec ??
                            activeDef.motion?.wigglePeriodSec ??
                            0.9) * 10,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            wigglePeriodSec: Number(e.target.value) / 10,
                          })
                        }
                        className="w-full accent-brass"
                      />
                    </>
                  )}
                </div>
`;
      s = s.slice(0, labelStart) + motionUi + s.slice(labelStart);
      fs.writeFileSync(p, s);
      console.log('gallery: motion UI inserted');
      }
    }
  } else {
    console.log('gallery: floatOn already present');
  }


  // Add ghost ease + drift sliders after stagger if missing
  s = fs.readFileSync(p, 'utf8');
  if (!s.includes('ghostEase') && s.includes('ghostStagger')) {
    const marker = 'ghostStaggerSec: Number(e.target.value) / 100';
    const i = s.indexOf(marker);
    if (i >= 0) {
      const after = s.indexOf('/>', i) + 2;
      // find closing of stagger conditional - insert after the stagger block's parent
      // simpler: insert right after the stagger range input
      const extra = `
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Fade curve</span>
                      </div>
                      <select
                        className="rounded border border-bone/15 bg-ink px-2 py-1 text-[10px] text-bone"
                        value={
                          overrides?.ghostEase ??
                          activeDef.ghost?.ease ??
                          'smooth'
                        }
                        onChange={(e) =>
                          onCustomize({
                            ghostEase: e.target.value as 'linear' | 'smooth',
                          })
                        }
                      >
                        <option value="smooth">Smooth (movie)</option>
                        <option value="linear">Linear</option>
                      </select>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Rise / sink</span>
                        <span className="text-brass/80">
                          {(
                            overrides?.ghostDriftEm ??
                            activeDef.ghost?.driftEm ??
                            0.14
                          ).toFixed(2)}
                          em
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={Math.round(
                          (overrides?.ghostDriftEm ??
                            activeDef.ghost?.driftEm ??
                            0.14) * 100,
                        )}
                        onChange={(e) =>
                          onCustomize({
                            ghostDriftEm: Number(e.target.value) / 100,
                          })
                        }
                        className="accent-brass"
                      />
                    </div>`;
      s = s.slice(0, after) + extra + s.slice(after);
      fs.writeFileSync(p, s);
      console.log('gallery: ghost ease/drift UI');
    }
  }
}

// ============================================================================
// Tests
// ============================================================================
{
  const p = path.join(root, 'tests/lib/caption-presets.test.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('float + wiggle can both be on')) {
    const anchor = "it('ghost stagger word/letter merges + clamps delay'";
    const i = s.indexOf(anchor);
    const block = `
  it('float + wiggle can both be on with amplitude settings', () => {
    const base = captionDefFor('hormozi1');
    const both = resolveCaptionStyle(base, {
      floatOn: true,
      wiggleOn: true,
      floatAmpEm: 0.2,
      wiggleDeg: 2.5,
    });
    expect(both.blockFx).toContain('float');
    expect(both.blockFx).toContain('wiggle');
    expect(both.motion?.floatAmpEm).toBe(0.2);
    expect(both.motion?.wiggleDeg).toBe(2.5);
    const off = resolveCaptionStyle(both, { floatOn: false });
    expect(off.blockFx ?? []).not.toContain('float');
    expect(off.blockFx).toContain('wiggle');
  });

  it('ghost ease + drift merge for movie-style fade', () => {
    const base = captionDefFor('ghost');
    const m = resolveCaptionStyle(base, {
      ghostEase: 'smooth',
      ghostDriftEm: 0.2,
    });
    expect(m.ghost?.ease).toBe('smooth');
    expect(m.ghost?.driftEm).toBe(0.2);
  });

`;
    if (i >= 0) {
      s = s.slice(0, i) + block + s.slice(i);
      fs.writeFileSync(p, s);
      console.log('tests: motion + fade');
    }
  }
}

// vendor sync + tests
execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('DONE');
