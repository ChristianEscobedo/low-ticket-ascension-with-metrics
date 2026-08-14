#!/usr/bin/env node
/**
 * 1) Dual-layer gradient fill (shadow under + clipped gradient on top) — kills silhouette
 * 2) Word-synced ghost / float / wiggle (keyed to each word's from/to frames)
 * 3) Extra word FX: bounce, slam, typewriter, blur-pop, neon-pulse
 * 4) Sync worker + tests
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

const captionsPath = path.join(root, 'src/lib/mothermode/reel/captions.ts');
const layerPath = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
const galleryPath = path.join(
  root,
  'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx',
);
const testPath = path.join(root, 'tests/lib/caption-presets.test.ts');

let captions = fs.readFileSync(captionsPath, 'utf8');
let layer = fs.readFileSync(layerPath, 'utf8');
let gallery = fs.readFileSync(galleryPath, 'utf8');
let tests = fs.readFileSync(testPath, 'utf8');

// ---------------------------------------------------------------------------
// A) captions.ts — dual-layer gradient CSS + new anims + motion sync flags
// ---------------------------------------------------------------------------

// 1. Expand CaptionAnim with new word FX
if (!captions.includes("| 'slam'")) {
  captions = captions.replace(
    `| 'cascade';`,
    `| 'cascade'
  | 'slam'
  | 'typewriter'
  | 'blurPop'
  | 'neonPulse'
  | 'zoomSnap'
  | 'dropIn';`,
  );
  console.log('added CaptionAnim variants');
}

// 2. Add motion.syncToWords on CaptionStyleDef motion type if present
if (!captions.includes('syncToWords?:')) {
  // Find motion?: { ... } on CaptionStyleDef
  const motionField = captions.indexOf('motion?: {');
  if (motionField >= 0) {
    const endBrace = captions.indexOf('};', motionField);
    if (endBrace > motionField && endBrace - motionField < 800) {
      captions =
        captions.slice(0, endBrace) +
        `\n    /** When true, float/wiggle phase is keyed to each word's start (not global clock). */\n    syncToWords?: boolean;\n  ` +
        captions.slice(endBrace);
      console.log('added motion.syncToWords');
    }
  }
  // ghost.syncToWords
  if (captions.includes('ghost?: {') && !captions.includes('syncToWords?: boolean; // ghost')) {
    captions = captions.replace(
      /ghost\?: \{([^}]+)\}/,
      (full, body) => {
        if (body.includes('syncToWords')) return full;
        return `ghost?: {${body}  /** Fade each word on its own spoken window (from→to), not the page. */\n    syncToWords?: boolean;\n  }`;
      },
    );
    console.log('added ghost.syncToWords');
  }
}

// 3. Overrides for sync
if (!captions.includes('ghostSyncToWords?:')) {
  captions = captions.replace(
    'ghostDriftEm?: number;',
    `ghostDriftEm?: number;
  /** Ghost each word on its spoken window (karaoke-synced reveal). */
  ghostSyncToWords?: boolean;
  /** Float/wiggle phase keyed to each word start. */
  motionSyncToWords?: boolean;`,
  );
  console.log('added sync overrides');
}

// 4. Resolve merges for sync flags
if (!captions.includes('overrides.ghostSyncToWords')) {
  const anchor = 'if (hasTiming) {';
  const i = captions.indexOf(anchor);
  if (i < 0) throw new Error('hasTiming anchor missing');
  // Insert after ghost timing block closes — find "  // Drop shadow"
  const drop = captions.indexOf('// Drop shadow + outer glow');
  if (drop < 0) throw new Error('drop shadow anchor missing');
  const inject = `
  // Karaoke-sync toggles for ghost + motion.
  if (typeof overrides.ghostSyncToWords === 'boolean') {
    out.ghost = { ...(out.ghost ?? {}), syncToWords: overrides.ghostSyncToWords };
  }
  if (typeof overrides.motionSyncToWords === 'boolean') {
    out.motion = { ...(out.motion ?? {}), syncToWords: overrides.motionSyncToWords };
  }
  `;
  captions = captions.slice(0, drop) + inject + captions.slice(drop);
  console.log('resolve sync flags');
}

// 5. Dual-layer gradient: store shadow separately, don't put filter on clipped glyph
// Replace the paintGradient shadow handling in wordCss
const oldGradShadow = `    // Depth via filter (not text-shadow) so the gradient stays visible.
    if (def.shadow) {
      css['filter'] = cssTextShadowToDropFilter(def.shadow);
    }`;
const newGradShadow = `    // Depth is painted by a dual-layer stack in the caption layer
    // (solid shadow under + clipped gradient on top). Putting filter or
    // text-shadow on the clipped glyph itself still silhouettes in Chromium.
    if (def.shadow) {
      (css as Record<string, unknown>)['--caption-grad-shadow'] = def.shadow;
    }`;
if (captions.includes(oldGradShadow)) {
  captions = captions.replace(oldGradShadow, newGradShadow);
  console.log('wordCss: dual-layer shadow marker');
} else if (captions.includes("css['filter'] = cssTextShadowToDropFilter")) {
  captions = captions.replace(
    /if \(def\.shadow\) \{\s*css\['filter'\] = cssTextShadowToDropFilter\(def\.shadow\);\s*\}/,
    `if (def.shadow) {
      (css as Record<string, unknown>)['--caption-grad-shadow'] = def.shadow;
    }`,
  );
  console.log('wordCss: dual-layer via regex');
} else {
  console.log('WARN: gradient shadow block not found');
}

// 6. Glow on gradient should also use CSS var, not filter on same node
const oldGlow = `      if (paintGradient) {
        const glow = \`drop-shadow(0 0 0.35em \${def.activeColor}) drop-shadow(0 0 0.9em \${def.activeColor}66)\`;
        css['filter'] = css['filter'] ? \`\${glow} \${css['filter']}\` : glow;
      } else {`;
const newGlow = `      if (paintGradient) {
        const existing = String((css as Record<string, unknown>)['--caption-grad-shadow'] ?? '');
        const glow = \`0 0 0.35em \${def.activeColor}, 0 0 0.9em \${def.activeColor}66\`;
        (css as Record<string, unknown>)['--caption-grad-shadow'] = existing
          ? \`\${glow}, \${existing}\`
          : glow;
      } else {`;
if (captions.includes("drop-shadow(0 0 0.35em ${def.activeColor})")) {
  captions = captions.replace(oldGlow, newGlow);
  console.log('glow dual-layer');
}

// 7. entranceStyle / keyframes for new anims — find captionAnimKeyframes or entrance
// Add keyframe helpers if there's a switch on anim
if (!captions.includes("case 'slam':") && captions.includes("case 'cascade':")) {
  // Find anim keyframes switch
  const cas = captions.indexOf("case 'cascade':");
  // We'll handle transforms in the layer entranceStyle instead
  console.log('anims will be handled in layer entranceStyle');
}

fs.writeFileSync(captionsPath, captions);

// ---------------------------------------------------------------------------
// B) captionLayer.tsx — dual-layer render, word-sync ghost/float/wiggle, new FX
// ---------------------------------------------------------------------------

// B1. Helper: word-local ghost opacity (spoken window)
if (!layer.includes('function wordSyncedGhostOpacity')) {
  const insertAfter = layer.indexOf('function ghostDriftFactor');
  // find end of ghostDriftFactor function
  let d = 0;
  let i = layer.indexOf('{', insertAfter);
  for (; i < layer.length; i++) {
    if (layer[i] === '{') d++;
    if (layer[i] === '}') {
      d--;
      if (d === 0) {
        i++;
        break;
      }
    }
  }
  const helper = `

/**
 * Ghost opacity keyed to ONE word's spoken window (fromFrame → toFrame).
 * Fade fully ON as the word starts, hold while spoken, fade fully OFF at end.
 * Matches karaoke timing so reveal tracks the speaker.
 */
export function wordSyncedGhostOpacity(
  frame: number,
  fromFrame: number,
  toFrame: number,
  inF: number,
  outF: number,
  ease: 'linear' | 'smooth' = 'smooth',
): number {
  const dur = Math.max(1, toFrame - fromFrame);
  let inFrames = Math.max(1, inF);
  let outFrames = Math.max(1, outF);
  const minHold = 1;
  if (inFrames + outFrames + minHold > dur) {
    const budget = Math.max(2, dur - minHold);
    const total = inFrames + outFrames;
    inFrames = Math.max(1, Math.round((budget * inFrames) / total));
    outFrames = Math.max(1, budget - inFrames);
  }
  const localIn = frame - fromFrame;
  const localOut = toFrame - frame;
  let inOp = Math.min(1, Math.max(0, localIn / inFrames));
  let outOp = Math.min(1, Math.max(0, localOut / outFrames));
  if (ease === 'smooth') {
    // smoothstep
    const s = (t: number) => t * t * (3 - 2 * t);
    inOp = s(inOp);
    outOp = s(outOp);
  }
  if (frame < fromFrame) return 0;
  if (frame > toFrame) return 0;
  return Math.min(inOp, outOp);
}

/** Word-local float/wiggle phase: starts at the word's fromFrame. */
export function wordMotionPhase(
  frame: number,
  fromFrame: number,
  fps: number,
  periodSec: number,
): number {
  const t = Math.max(0, frame - fromFrame) / Math.max(1, fps);
  const p = Math.max(0.25, periodSec);
  return (t / p) * Math.PI * 2;
}
`;
  layer = layer.slice(0, i) + helper + layer.slice(i);
  console.log('added wordSyncedGhostOpacity helpers');
}

// B2. Expand entranceStyle for new anims
if (!layer.includes("case 'slam':") && layer.includes('function entranceStyle')) {
  const es = layer.indexOf('function entranceStyle');
  // Find a simple case to extend — look for case 'riseUp' or default return
  if (layer.includes("case 'riseUp':") && !layer.includes("case 'slam':")) {
    layer = layer.replace(
      /case 'riseUp':([\s\S]*?)break;/,
      (m) =>
        m +
        `
    case 'slam': {
      const s = 1.55 - 0.55 * t;
      const y = (1 - t) * -0.55;
      return { opacity: t, transform: \`translateY(\${y.toFixed(3)}em) scale(\${s.toFixed(3)})\` };
    }
    case 'typewriter': {
      return { opacity: t > 0.05 ? 1 : 0, transform: 'none' };
    }
    case 'blurPop': {
      const blur = ((1 - t) * 8).toFixed(1);
      const s = 0.85 + 0.15 * t;
      return { opacity: t, filter: \`blur(\${blur}px)\`, transform: \`scale(\${s.toFixed(3)})\` };
    }
    case 'neonPulse': {
      const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI);
      return { opacity: Math.max(t, pulse), transform: \`scale(\${(0.96 + 0.08 * t).toFixed(3)})\` };
    }
    case 'zoomSnap': {
      const s = 0.4 + 0.6 * t;
      return { opacity: t, transform: \`scale(\${s.toFixed(3)})\` };
    }
    case 'dropIn': {
      const y = (1 - t) * -1.1;
      return { opacity: t, transform: \`translateY(\${y.toFixed(3)}em)\` };
    }
`,
    );
    console.log('entranceStyle new anims');
  } else {
    // Try alternate structure - object map
    console.log('entranceStyle structure different, scanning...');
    const chunk = layer.slice(es, es + 2500);
    console.log(chunk.slice(0, 400));
  }
}

// B3. Dual-layer gradient word render
// Replace the simple return <span style={style}>{text}...
// with a helper renderWordContent that dual-layers when gradient shadow var is set.

if (!layer.includes('function renderGradientWord')) {
  // Insert helper before CaptionLayer export or near top after helpers
  const anchor = layer.indexOf('export function CaptionLayer');
  const alt = layer.indexOf('export const CaptionLayer');
  const at = anchor >= 0 ? anchor : alt;
  if (at < 0) throw new Error('CaptionLayer export not found');
  const helper = `
/**
 * Gradient glyphs: paint a solid shadow layer UNDER a clipped gradient fill.
 * Single-node background-clip:text + filter/text-shadow still silhouettes in
 * Chromium/Remotion — dual layer is the only reliable fix.
 */
function renderGradientWord(
  text: string,
  style: React.CSSProperties,
  emoji: string,
  tail: string,
): React.ReactNode {
  const shadow = String(
    (style as Record<string, unknown>)['--caption-grad-shadow'] ?? '',
  );
  const hasGrad = !!(style as Record<string, unknown>)['backgroundImage'];
  if (!hasGrad || !shadow) {
    return (
      <>
        {text}
        {emoji}
        {tail}
      </>
    );
  }
  // Strip clip props from the outer (shadow) shell; keep transform/opacity.
  const shell: React.CSSProperties = {
    display: 'inline-block',
    position: 'relative',
    transform: style.transform,
    opacity: style.opacity,
    // no filter on shell — shadow is real text-shadow on solid under-layer
  };
  const under: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    color: '#000',
    textShadow: shadow,
    WebkitTextFillColor: '#000',
    pointerEvents: 'none',
    userSelect: 'none',
    // Match weight/size via inherit
    font: 'inherit',
    letterSpacing: 'inherit',
    whiteSpace: 'pre-wrap',
  };
  const fill: React.CSSProperties = {
    ...style,
    position: 'relative',
    transform: undefined,
    opacity: undefined,
    // ensure no filter/textShadow on fill
    filter: undefined,
    textShadow: undefined,
  };
  delete (fill as Record<string, unknown>)['--caption-grad-shadow'];
  return (
    <span style={shell}>
      <span aria-hidden style={under}>
        {text}
      </span>
      <span style={fill}>{text}</span>
      {emoji}
      {tail}
    </span>
  );
}

`;
  layer = layer.slice(0, at) + helper + layer.slice(at);
  console.log('added renderGradientWord');
}

// B4. Wire dual-layer into the main word return
// Find: return (\n              <span key={`${idx}-${w.text}`} style={style}>
// and the non-marker simple text path
const simpleReturn = `return (
              <span key={\`\${idx}-\${w.text}\`} style={style}>
                {mark?.fx === 'marker' ? (`;
if (layer.includes(simpleReturn) && !layer.includes('renderGradientWord(text, style')) {
  // After marker block ends, text is rendered — find the letter ghost branch and normal text
  // Replace the final content rendering for non-cascade non-fill
  // Look for the pattern that renders {text} in the main return after marker
  const markerBlockEnd = layer.indexOf("mark?.fx === 'marker'");
  // Find closing of letter stagger ternary that ends with {text}
  // Safer: replace both letter and non-letter text emission

  // Non-letter path often: `{text}{emoji}{tail}` inside the span
  // Letter path is more complex

  // For the main style span children after marker, wrap text via renderGradientWord when not letter-stagger
  // Find ghost letter branch end and the else text
  const letterBranch = layer.indexOf("ghostMeta && ghostMeta.staggerMode === 'letter'");
  if (letterBranch > 0) {
    // After letter map, there's typically : ( <> {text} ...
    const afterLetter = layer.indexOf('})', letterBranch);
    // search for ternary else with text
    const elseText = layer.indexOf('? Array.from(text)', letterBranch);
    console.log('letter branch at', letterBranch, 'elseText', elseText);
  }

  // Simpler approach: after building `style`, if gradient shadow var set, force content through helper
  // by replacing the return's children for the default path.

  // Inject just before `return (` of the main word:
  const injectPoint = layer.indexOf(simpleReturn);
  const pre = `
            // Dual-layer gradient when shadow var is present (no silhouette).
            const gradShadow = String(
              (style as Record<string, unknown>)['--caption-grad-shadow'] ?? '',
            );
            const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];
            if (isGradFill && gradShadow && !(ghostMeta && ghostMeta.staggerMode === 'letter')) {
              return (
                <span key={\`\${idx}-\${w.text}\`}>
                  {renderGradientWord(text, style, emoji, tail)}
                </span>
              );
            }

            `;
  layer = layer.slice(0, injectPoint) + pre + layer.slice(injectPoint);
  console.log('wired dual-layer early return');
}

// B5. Word-synced ghost: when ghost.syncToWords, apply per-word opacity from word window
// Replace/extend the word-level ghost block
const wordGhostBlock = `if (ghostMeta && ghostMeta.staggerMode === 'word') {`;
if (layer.includes(wordGhostBlock) && !layer.includes('ghostMeta.syncToWords')) {
  // Extend ghostMeta type and application
  layer = layer.replace(
    `staggerMode: 'block' | 'word' | 'letter';
                  staggerFrames: number;
                  pageFrom: number;
                  ease?: 'linear' | 'smooth';
                  driftEm?: number;
                }`,
    `staggerMode: 'block' | 'word' | 'letter';
                  staggerFrames: number;
                  pageFrom: number;
                  ease?: 'linear' | 'smooth';
                  driftEm?: number;
                  syncToWords?: boolean;
                  inF: number;
                  outF: number;
                }`,
  );
  // Fix duplicate inF if any - check
  // Apply word-synced path BEFORE stagger word path
  layer = layer.replace(
    wordGhostBlock,
    `if (ghostMeta && ghostMeta.syncToWords) {
              const gOp = wordSyncedGhostOpacity(
                frame,
                w.fromFrame,
                w.toFrame,
                ghostMeta.inF,
                ghostMeta.outF,
                ghostMeta.ease ?? 'smooth',
              );
              base.opacity = gOp;
              if ((ghostMeta.driftEm ?? 0) > 0) {
                // rise onto spoken start, sink at end
                const dur = Math.max(1, w.toFrame - w.fromFrame);
                const localIn = frame - w.fromFrame;
                const localOut = w.toFrame - frame;
                let df = 0;
                if (localIn < ghostMeta.inF) {
                  const t = Math.min(1, Math.max(0, localIn / Math.max(1, ghostMeta.inF)));
                  df = 1 - t * t * (3 - 2 * t);
                } else if (localOut < ghostMeta.outF) {
                  const t = Math.min(1, Math.max(0, localOut / Math.max(1, ghostMeta.outF)));
                  df = 1 - t * t * (3 - 2 * t);
                }
                const dy = df * (ghostMeta.driftEm ?? 0);
                const prev = String(base.transform ?? '');
                base.transform = prev
                  ? \`\${prev} translateY(\${dy.toFixed(3)}em)\`
                  : \`translateY(\${dy.toFixed(3)}em)\`;
              }
            } else if (ghostMeta && ghostMeta.staggerMode === 'word') {`,
  );
  console.log('word-synced ghost path');
}

// B6. When building ghostMeta on block, include syncToWords + always inF/outF
if (layer.includes('__ghost') && !layer.includes('syncToWords:')) {
  // Find where __ghost is assigned
  const gAssign = layer.indexOf('__ghost');
  console.log('__ghost context:\n', layer.slice(gAssign, gAssign + 600));
  // Try replace common pattern
  if (layer.includes("staggerMode: ghost?.stagger ?? 'block'")) {
    layer = layer.replace(
      /staggerMode: ghost\?\.stagger \?\? 'block',/,
      `staggerMode: ghost?.stagger ?? 'block',
      syncToWords: !!ghost?.syncToWords,`,
    );
    console.log('ghostMeta syncToWords field');
  } else {
    // broader search
    const m = layer.match(/__ghost\s*=\s*\{[\s\S]{0,800}\}/);
    if (m) {
      console.log('found __ghost assign len', m[0].length);
      if (!m[0].includes('syncToWords')) {
        layer = layer.replace(
          m[0],
          m[0].replace(
            /staggerFrames:\s*[^,]+,/,
            (x) => x + '\n        syncToWords: !!(def as CaptionStyleDef).ghost?.syncToWords,',
          ),
        );
        console.log('injected syncToWords into __ghost');
      }
    }
  }
}

// B7. Word-synced float/wiggle — apply per word when motion.syncToWords
if (!layer.includes('wordMotionPhase(')) {
  // After base style built, before ghost, add motion per word
  const baseMark = `const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
            };`;
  if (layer.includes(baseMark)) {
    layer = layer.replace(
      baseMark,
      baseMark +
        `
            // Word-synced float/wiggle: phase starts when THIS word is spoken.
            {
              const motion = (def as CaptionStyleDef).motion;
              const syncM = !!motion?.syncToWords;
              const blockFxList = (def as CaptionStyleDef).blockFx ?? [];
              if (syncM && (blockFxList.includes('float') || blockFxList.includes('wiggle'))) {
                const parts: string[] = [];
                if (blockFxList.includes('float')) {
                  const amp = motion?.floatAmpEm ?? 0.08;
                  const period = motion?.floatPeriodSec ?? 1.8;
                  const ph = wordMotionPhase(frame, w.fromFrame, plan.fps, period);
                  parts.push(\`translateY(\${(Math.sin(ph) * amp).toFixed(3)}em)\`);
                }
                if (blockFxList.includes('wiggle')) {
                  const deg = motion?.wiggleDeg ?? 2.5;
                  const period = motion?.wigglePeriodSec ?? 0.45;
                  const ph = wordMotionPhase(frame, w.fromFrame, plan.fps, period);
                  parts.push(\`rotate(\${(Math.sin(ph) * deg).toFixed(2)}deg)\`);
                }
                if (parts.length) {
                  base.transform = parts.join(' ');
                }
              }
            }
`,
    );
    console.log('word-synced float/wiggle');
  }
}

// B8. When motion.syncToWords, skip block-level float/wiggle (avoid double)
if (layer.includes("blockFx.includes('float')") && !layer.includes('motion?.syncToWords')) {
  // Find block float/wiggle section
  const bf = layer.indexOf("if (blockFx.includes('float')");
  // might be combined - search floatAmp
  const fa = layer.indexOf('floatAmpEm');
  if (fa > 0) {
    // wrap the block motion section
    const blockStart = layer.lastIndexOf('if (blockFx', fa);
    // get a reasonable chunk
    console.log('block motion at', blockStart, layer.slice(blockStart, blockStart + 200));
    // Prepend guard
    if (blockStart > 0 && !layer.slice(blockStart - 80, blockStart).includes('syncToWords')) {
      layer = layer.replace(
        /if \(blockFx\.includes\('float'\)[\s\S]{0,40}blockFx\.includes\('wiggle'\)/,
        (m) =>
          `if (!(def as CaptionStyleDef).motion?.syncToWords && (${m.replace(/^if \(/, '')}`,
      );
      // That might break parens - do cleaner:
    }
  }
}

// Cleaner block-motion guard:
if (!layer.includes('// skip block motion when word-synced')) {
  // Find: const parts for float bob near blockStyle
  const idx = layer.indexOf("blockFx.includes('float')");
  if (idx > 0) {
    // look backward for if (
    const ifStart = layer.lastIndexOf('\n', idx);
    // insert condition by replacing first occurrence of block float application
    const snippet = layer.slice(idx - 30, idx + 80);
    console.log('float snippet', JSON.stringify(snippet));
  }
  // Replace blockStyle float/wiggle computation header
  if (layer.includes('// Float + wiggle') || layer.includes('float bob')) {
    // try
  }
  // Most reliable: when building block transforms, gate on !syncToWords
  layer = layer.replace(
    /const parts: string\[\] = \[\];\s*\n\s*if \(blockFx\.includes\('float'\)\)/,
    `const parts: string[] = [];
    // skip block motion when word-synced
    if (!(def as CaptionStyleDef).motion?.syncToWords && blockFx.includes('float'))`,
  );
  // if that didn't catch wiggle-only path
  if (layer.includes("if (blockFx.includes('wiggle'))") && layer.includes('skip block motion')) {
    // ensure wiggle also gated - if float was gated with &&, wiggle may still run
    layer = layer.replace(
      /if \(blockFx\.includes\('wiggle'\)\) \{\s*\n\s*const deg/,
      `if (!(def as CaptionStyleDef).motion?.syncToWords && blockFx.includes('wiggle')) {
      const deg`,
    );
  }
  console.log('gated block float/wiggle');
}

fs.writeFileSync(layerPath, layer);

// ---------------------------------------------------------------------------
// C) Gallery — Sync to words toggles + new anim options if listed
// ---------------------------------------------------------------------------
if (!gallery.includes('ghostSyncToWords') && gallery.includes('ghostStagger')) {
  // Add a compact "Sync to speech" toggle near ghost controls
  const ghostLabel = gallery.indexOf('Reveal');
  const ghostSection = gallery.indexOf('ghostFade');
  console.log('gallery ghostFade', ghostSection, 'Reveal', ghostLabel);
  // Find Fade curve or Stagger UI end
  const easeUi = gallery.indexOf('ghostEase');
  if (easeUi > 0) {
    // Find a good insertion after ghost drift slider
    const drift = gallery.indexOf('ghostDriftEm');
    const insertAt = drift > 0 ? gallery.indexOf('\n', gallery.indexOf('ghostDriftEm', drift)) : -1;
    // Simpler: add near floatOn controls
  }
  // Add after ghostFade toggle row if present
  if (gallery.includes("label: 'Ghost'") || gallery.includes('Ghost fade')) {
    // inject buttons in customize panel
  }
  // Look for setOverrides ghost
  const setG = gallery.indexOf('ghostFade:');
  console.log('set ghostFade at', setG);
}

// Add sync toggles after ghost stagger controls if we can find a unique string
if (!gallery.includes('ghostSyncToWords')) {
  const marker = "ghostStaggerSec";
  const mi = gallery.lastIndexOf(marker);
  if (mi > 0) {
    // Find end of that control block - next section header
    const nextSection = gallery.indexOf('{/* ', mi + 10);
    const nextSection2 = gallery.indexOf('Float', mi);
    const at = nextSection2 > 0 && nextSection2 < mi + 2000 ? nextSection2 : nextSection;
    if (at > mi) {
      // go back to line start
      const line = gallery.lastIndexOf('\n', at);
      const block = `
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Sync to speech</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() =>
                    setOverrides((o) => ({
                      ...o,
                      ghostSyncToWords: !(o.ghostSyncToWords ?? false),
                    }))
                  }
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: overrides.ghostSyncToWords ? 'rgba(167,139,250,0.35)' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Ghost ↔ words
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setOverrides((o) => ({
                      ...o,
                      motionSyncToWords: !(o.motionSyncToWords ?? false),
                    }))
                  }
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: overrides.motionSyncToWords ? 'rgba(167,139,250,0.35)' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Float/Wiggle ↔ words
                </button>
              </div>
              <div style={{ fontSize: 10, opacity: 0.55, lineHeight: 1.3 }}>
                When on, each word fades/moves on its own spoken timing — matches the speaker.
              </div>
            </div>
`;
      gallery = gallery.slice(0, line) + block + gallery.slice(line);
      fs.writeFileSync(galleryPath, gallery);
      console.log('gallery sync toggles');
    } else {
      console.log('WARN: could not place gallery sync UI');
    }
  } else {
    console.log('WARN: ghostStaggerSec not in gallery');
  }
}

// Anim picker: add new anims if there's a list
for (const anim of ['slam', 'typewriter', 'blurPop', 'neonPulse', 'zoomSnap', 'dropIn']) {
  if (gallery.includes("'cascade'") && !gallery.includes(`'${anim}'`)) {
    gallery = gallery.replace(`'cascade'`, `'cascade', '${anim}'`);
    console.log('gallery anim', anim);
  }
}
fs.writeFileSync(galleryPath, gallery);

// ---------------------------------------------------------------------------
// D) Tests
// ---------------------------------------------------------------------------
if (!tests.includes('wordSyncedGhostOpacity')) {
  // add import + tests at end of describe
  if (!tests.includes('wordSyncedGhostOpacity')) {
    tests = tests.replace(
      /from ['"]@?\/?.*captions['"]/,
      (m) => m, // keep
    );
  }
  // Import from captionLayer
  if (!tests.includes("from '../../src/lib/mothermode/reel/render/captionLayer'")) {
    // add after first import block
    const firstImportEnd = tests.indexOf(';', tests.indexOf('import')) + 1;
    tests =
      tests.slice(0, firstImportEnd) +
      `\nimport {\n  wordSyncedGhostOpacity,\n  wordMotionPhase,\n} from '../../src/lib/mothermode/reel/render/captionLayer';\n` +
      tests.slice(firstImportEnd);
  }

  const extra = `
  it('word-synced ghost fades on spoken window (0 → 1 → 0)', () => {
    // word 10..40, in=5 out=5
    expect(wordSyncedGhostOpacity(10, 10, 40, 5, 5, 'linear')).toBeCloseTo(0, 1);
    expect(wordSyncedGhostOpacity(15, 10, 40, 5, 5, 'linear')).toBeCloseTo(1, 1);
    expect(wordSyncedGhostOpacity(25, 10, 40, 5, 5, 'linear')).toBeCloseTo(1, 1);
    expect(wordSyncedGhostOpacity(40, 10, 40, 5, 5, 'linear')).toBeCloseTo(0, 1);
    expect(wordSyncedGhostOpacity(5, 10, 40, 5, 5, 'linear')).toBe(0);
  });

  it('word motion phase is 0 at word start', () => {
    expect(wordMotionPhase(30, 30, 30, 1)).toBeCloseTo(0, 5);
    expect(wordMotionPhase(45, 30, 30, 1)).toBeGreaterThan(0);
  });

  it('ghostSyncToWords + motionSyncToWords merge on resolve', () => {
    const base = captionDefFor('iridescent');
    const merged = resolveCaptionStyle(base, {
      ghostSyncToWords: true,
      motionSyncToWords: true,
      floatOn: true,
    });
    expect(merged.ghost?.syncToWords).toBe(true);
    expect(merged.motion?.syncToWords).toBe(true);
    expect(merged.blockFx).toContain('float');
  });

  it('gradient dual-layer marks shadow via CSS var (not filter on glyph)', () => {
    const flow = captionCssFor(captionDefFor('gradient-flow'));
    expect(String(flow.word.backgroundImage ?? '')).toContain('linear-gradient');
    expect(flow.word.color).toBe('transparent');
    expect(flow.word.textShadow).toBeUndefined();
    // filter on the clipped glyph is the silhouette bug — must be absent
    expect(flow.word.filter).toBeUndefined();
    expect(
      String((flow.word as Record<string, unknown>)['--caption-grad-shadow'] ?? ''),
    ).toBeTruthy();
  });
`;
  // Update old drop-shadow test if present
  if (tests.includes("toContain(\n      'drop-shadow'")) {
    tests = tests.replace(
      /it\('gradient CSS uses filter drop-shadow not textShadow \(no silhouette\)'[\s\S]*?\n  \}\);/,
      `it('gradient CSS uses dual-layer shadow var not textShadow/filter (no silhouette)', () => {
    const flow = captionCssFor(captionDefFor('gradient-flow'));
    expect(String(flow.word.backgroundImage ?? '')).toContain('linear-gradient');
    expect(flow.word.color).toBe('transparent');
    expect(flow.word.textShadow).toBeUndefined();
    expect(flow.word.filter).toBeUndefined();
    expect(
      String((flow.word as Record<string, unknown>)['--caption-grad-shadow'] ?? ''),
    ).toMatch(/px/);
  });`,
    );
    console.log('updated silhouette test');
  }

  // Append extra tests before last closing of describe
  const last = tests.lastIndexOf('});');
  tests = tests.slice(0, last) + extra + '\n' + tests.slice(last);
  fs.writeFileSync(testPath, tests);
  console.log('tests extended');
} else {
  fs.writeFileSync(testPath, tests);
}

// Fix block motion gating more carefully by reading current layer state
layer = fs.readFileSync(layerPath, 'utf8');
// Ensure __ghost includes syncToWords
if (!layer.includes('syncToWords:') && layer.includes('__ghost')) {
  const m = layer.match(/\(blockStyle as Record<string, unknown>\)\.__ghost\s*=\s*\{[\s\S]{0,900}?\};/);
  if (m) {
    console.log('__ghost assign:\n', m[0].slice(0, 500));
    let rep = m[0];
    if (!rep.includes('syncToWords')) {
      rep = rep.replace(
        /ease:\s*[^,]+,/,
        (x) => x + '\n      syncToWords: !!(def as CaptionStyleDef).ghost?.syncToWords,',
      );
      if (!rep.includes('syncToWords')) {
        rep = rep.replace(
          /\{/,
          '{\n      syncToWords: !!(def as CaptionStyleDef).ghost?.syncToWords,',
        );
      }
      layer = layer.replace(m[0], rep);
      console.log('patched __ghost syncToWords');
    }
  } else {
    // try alternate storage
    const m2 = layer.match(/__ghost\s*as[\s\S]{0,200}/);
    console.log('alt', m2 && m2[0]);
    // Find where ghost meta object is created
    const create = layer.indexOf('pageStartFrame');
    console.log(layer.slice(create - 100, create + 500));
  }
}

// Fix duplicate inF in type if we doubled
layer = layer.replace(
  /inF: number;\s*outF: number;\s*staggerMode[\s\S]{0,200}?inF: number;\s*outF: number;/,
  (m) => {
    // remove second inF/outF
    return m.replace(/inF: number;\s*outF: number;\s*$/, '');
  },
);

fs.writeFileSync(layerPath, layer);

// Verify brace balance on edited files
function balance(src, label) {
  let d = 0;
  for (const ch of src) {
    if (ch === '{') d++;
    if (ch === '}') d--;
  }
  console.log('balance', label, d);
  return d;
}
balance(fs.readFileSync(captionsPath, 'utf8'), 'captions');
balance(fs.readFileSync(layerPath, 'utf8'), 'layer');
balance(fs.readFileSync(galleryPath, 'utf8'), 'gallery');

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
try {
  execSync(
    'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
    { cwd: root, stdio: 'inherit' },
  );
  console.log('ALL OK');
} catch (e) {
  console.error('TESTS FAILED');
  process.exit(1);
}
