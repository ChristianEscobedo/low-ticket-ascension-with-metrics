#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ============================================================================
// captions.ts
// ============================================================================
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');

  // 1) Add motion + ghost ease fields on CaptionStyleDef.ghost
  if (!s.includes('floatAmpEm?:')) {
    // Find ghost staggerSec closing
    const marker = 'staggerSec?: number;';
    // last occurrence in ghost type (before overrides)
    let idx = -1;
    let searchFrom = 0;
    while (true) {
      const n = s.indexOf(marker, searchFrom);
      if (n < 0) break;
      idx = n;
      searchFrom = n + 1;
    }
    if (idx < 0) throw new Error('staggerSec not found');
    const insertAt = idx + marker.length;
    const extra = `
    /** Fade curve. smooth = movie ease-in-out. */
    ease?: 'linear' | 'smooth';
    /** Vertical drift during fade (em). */
    driftEm?: number;
  };

  /** Ambient motion amplitude/speed (float + wiggle compose). */
  motion?: {
    floatAmpEm?: number;
    floatPeriodSec?: number;
    wiggleDeg?: number;
    wigglePeriodSec?: number;
  };`;
    // Only insert ease/drift if not already - check next chars
    if (!s.slice(insertAt, insertAt + 80).includes("ease?:")) {
      // Replace the closing `};` after staggerSec carefully
      // Find the `};` that closes ghost after this staggerSec
      const closeGhost = s.indexOf('};', insertAt);
      const between = s.slice(insertAt, closeGhost);
      if (!between.includes('ease?:')) {
        s = s.slice(0, closeGhost) + `
    ease?: 'linear' | 'smooth';
    driftEm?: number;` + s.slice(closeGhost);
      }
    }
    // Add motion after ghost block if missing
    if (!s.includes('motion?: {')) {
      // Find "ghost?:" block end - look for first `};` after "ghost?:"
      const gStart = s.indexOf('ghost?: {');
      // find matching close - simple: after driftEm we added
      const afterGhost = s.indexOf('};', s.indexOf('driftEm?: number;'));
      if (afterGhost > 0 && !s.slice(afterGhost, afterGhost + 40).includes('motion?:')) {
        s =
          s.slice(0, afterGhost + 2) +
          `

  /** Ambient motion amplitude/speed (float + wiggle compose). */
  motion?: {
    floatAmpEm?: number;
    floatPeriodSec?: number;
    wiggleDeg?: number;
    wigglePeriodSec?: number;
  };` +
          s.slice(afterGhost + 2);
      }
    }
    console.log('def fields patched');
  }

  // 2) CaptionOverrides floatOn etc
  if (!s.includes('floatOn?:')) {
    const bm = s.indexOf("blockMotion?: 'still' | 'float' | 'wiggle';");
    if (bm < 0) throw new Error('blockMotion override not found');
    const endLine = s.indexOf('\n', bm);
    const inject = `
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
  ghostDriftEm?: number;`;
    s = s.slice(0, endLine) + inject + s.slice(endLine);
    console.log('overrides fields patched');
  }

  // 3) Replace resolve blockMotion exclusive
  if (!s.includes('hasFloatToggle')) {
    const start = s.indexOf('// Block feel: the override owns float/wiggle');
    if (start < 0) throw new Error('resolve comment not found');
    const end = s.indexOf('// Ghost fade dial', start);
    if (end < 0) throw new Error('ghost fade dial not found');
    const replacement = `// Block feel: float + wiggle are independent toggles (can both be on).
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
  }
  `;
    s = s.slice(0, start) + replacement + s.slice(end);
    console.log('resolve motion patched');
  }

  // 4) Ghost ease/drift in resolve
  if (!s.includes('overrides.ghostEase')) {
    const old = `const gs = overrides.ghostStagger;
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
    }`;
    const neu = `const gs = overrides.ghostStagger;
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
    }`;
    if (!s.includes(old)) {
      // try looser: find gs = overrides.ghostStagger in resolve
      const a = s.indexOf('const gs = overrides.ghostStagger;');
      const b = s.indexOf('// Drop shadow', a);
      if (a < 0 || b < 0) {
        // try end of ghost block differently
        const b2 = s.indexOf("if (typeof overrides.dropShadow", a);
        console.log('ghost resolve anchors', a, b, b2);
        if (a >= 0 && b2 >= 0) {
          s = s.slice(0, a) + neu + '\n  ' + s.slice(b2);
          console.log('ghost ease resolve via dropShadow anchor');
        } else {
          console.warn('ghost resolve not patched');
        }
      } else {
        s = s.slice(0, a) + neu + '\n  ' + s.slice(b);
        console.log('ghost ease resolve patched');
      }
    } else {
      s = s.replace(old, neu);
      console.log('ghost ease resolve exact');
    }
  }

  fs.writeFileSync(p, s);
}

// ============================================================================
// captionLayer float+wiggle compose
// ============================================================================
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');

  if (!s.includes('mot?.floatAmpEm')) {
    const start = s.indexOf("if (blockFx.includes('float'))");
    const end = s.indexOf("if (blockFx.includes('ghostFade'))", start);
    if (start < 0 || end < 0) throw new Error('float/ghost anchors missing');
    const neu = `{
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
      ty += Math.sin(tSec * ((2 * Math.PI) / (wPer * 2))) * 0.06;
    }
    const parts = ['translateX(-50%)'];
    if (rot !== 0) parts.push(\`rotate(\${rot.toFixed(2)}deg)\`);
    if (ty !== 0) parts.push(\`translateY(\${ty.toFixed(3)}em)\`);
    if (parts.length > 1) blockStyle.transform = parts.join(' ');
  }
  `;
    s = s.slice(0, start) + neu + s.slice(end);
    console.log('layer float+wiggle composed');
  }

  // Ghost block path: ensure ease+drift applied
  if (!s.includes("ghost?.ease ?? 'smooth'") && !s.includes('ghost?.ease')) {
    // find staggerMode === 'block' opacity path
    const sm = s.indexOf("if (staggerMode === 'block')");
    if (sm >= 0) {
      // replace from __ghost assignment through block path
      const gh = s.lastIndexOf('(blockStyle as Record<string, unknown>).__ghost', sm);
      const afterBlock = s.indexOf('// word/letter:', sm);
      if (gh >= 0 && afterBlock >= 0) {
        const neu = `const ease = (ghost?.ease ?? 'smooth') as 'linear' | 'smooth';
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
    }
    `;
        s = s.slice(0, gh) + neu + s.slice(afterBlock);
        console.log('layer ghost block ease+drift');
      }
    }
  }

  fs.writeFileSync(p, s);
}

// vendor + tests
execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');
