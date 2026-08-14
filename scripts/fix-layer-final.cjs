#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

// 1) Remove stray } after glow case that closed the switch early
const bad = `      style.textShadow = shadows.join(', ');
      break;
    }

    }
    case 'gradient': {`;
const good = `      style.textShadow = shadows.join(', ');
      break;
    }
    case 'gradient': {`;
if (s.includes(bad)) {
  s = s.replace(bad, good);
  console.log('removed stray brace after glow');
} else {
  // looser
  s = s.replace(
    /style\.textShadow = shadows\.join\(', '\);\s*break;\s*\}\s*\}\s*case 'gradient':/,
    `style.textShadow = shadows.join(', ');
      break;
    }
    case 'gradient':`,
  );
  console.log('removed stray brace via regex');
}

// 2) Fix gradient mark fx to use CSS var for dual-layer (not filter on same node)
const oldGradFx = `      if (style.textShadow) {
        style.filter = \`drop-shadow(\${String(style.textShadow).split(',')[0].trim()})\`;
        delete style.textShadow;
      }
      // Stroke outside a clipped fill reads as a hard black halo — drop it.
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }
    case 'shine': {`;
const newGradFx = `      // Dual-layer: stash shadow for under-paint; never filter the clipped fill.
      if (style.textShadow) {
        (style as Record<string, unknown>)['--caption-grad-shadow'] = style.textShadow;
        delete style.textShadow;
      } else {
        (style as Record<string, unknown>)['--caption-grad-shadow'] =
          '0 2px 8px rgba(0,0,0,0.55)';
      }
      delete style.filter;
      // Stroke outside a clipped fill reads as a hard black halo — drop it.
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }
    case 'shine': {`;
if (s.includes(oldGradFx)) {
  s = s.replace(oldGradFx, newGradFx);
  console.log('gradient mark fx dual-layer');
} else {
  console.log('WARN gradient mark fx pattern miss');
}

// Shine: also set a soft shadow var so dual-layer can depth it
const oldShineEnd = `      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }
    case 'pulse': {`;
const newShineEnd = `      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      if (!(style as Record<string, unknown>)['--caption-grad-shadow']) {
        (style as Record<string, unknown>)['--caption-grad-shadow'] =
          '0 2px 8px rgba(0,0,0,0.5)';
      }
      delete style.filter;
      delete style.textShadow;
      break;
    }
    case 'pulse': {`;
if (s.includes(oldShineEnd)) {
  s = s.replace(oldShineEnd, newShineEnd);
  console.log('shine dual-layer shadow');
}

// 3) Wire dual-layer render into main word return
if (!s.includes('renderGradientWord(text, style')) {
  // Find the main return with marker
  const marker = `return (
              <span key={\`\${idx}-\${w.text}\`} style={style}>
                {mark?.fx === 'marker' ? (`;
  if (s.includes(marker)) {
    const pre = `
            // Dual-layer gradient/shine: solid shadow under + clipped fill on top.
            {
              const gradShadow = String(
                (style as Record<string, unknown>)['--caption-grad-shadow'] ?? '',
              );
              const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];
              if (
                isGradFill &&
                gradShadow &&
                !(ghostMeta && ghostMeta.staggerMode === 'letter')
              ) {
                return (
                  <span key={\`\${idx}-\${w.text}\`}>
                    {renderGradientWord(text, style, emoji, tail)}
                  </span>
                );
              }
            }

            `;
    s = s.replace(marker, pre + marker);
    console.log('wired dual-layer early return');
  } else {
    console.log('WARN: main return marker not found for dual-layer');
  }
}

// 4) Ensure renderGradientWord exists
if (!s.includes('function renderGradientWord')) {
  const at = s.indexOf('export function CaptionLayer');
  const alt = s.indexOf('export const CaptionLayer');
  const pos = at >= 0 ? at : alt;
  const helper = `
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
  const shell: React.CSSProperties = {
    display: 'inline-block',
    position: 'relative',
    transform: style.transform,
    opacity: style.opacity,
  };
  const under: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    color: '#050505',
    textShadow: shadow,
    WebkitTextFillColor: '#050505',
    pointerEvents: 'none',
    userSelect: 'none',
    font: 'inherit',
    letterSpacing: 'inherit',
    whiteSpace: 'pre-wrap',
  };
  const fill: React.CSSProperties = {
    ...style,
    position: 'relative',
    transform: undefined,
    opacity: undefined,
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
  s = s.slice(0, pos) + helper + s.slice(pos);
  console.log('added renderGradientWord');
}

// 5) Gate block float/wiggle when motion.syncToWords
if (!s.includes('// skip block motion when word-synced')) {
  s = s.replace(
    `if (blockFx.includes('float')) {
      const period = mot?.floatPeriodSec ?? FLOAT_PERIOD_SEC;`,
    `// skip block motion when word-synced
    if (!(def as CaptionStyleDef).motion?.syncToWords && blockFx.includes('float')) {
      const period = mot?.floatPeriodSec ?? FLOAT_PERIOD_SEC;`,
  );
  s = s.replace(
    `if (blockFx.includes('wiggle')) {
      const period = mot?.wigglePeriodSec`,
    `if (!(def as CaptionStyleDef).motion?.syncToWords && blockFx.includes('wiggle')) {
      const period = mot?.wigglePeriodSec`,
  );
  console.log('gated block float/wiggle');
}

// 6) Word-synced float/wiggle per word if missing usage of wordMotionPhase beyond def
if ((s.match(/wordMotionPhase\(/g) || []).length < 2) {
  const baseMark = `const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
            };`;
  if (s.includes(baseMark) && !s.includes('// Word-synced float/wiggle')) {
    s = s.replace(
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
                if (parts.length) base.transform = parts.join(' ');
              }
            }
`,
    );
    console.log('added per-word motion');
  }
}

// 7) When ghost.syncToWords, don't also fade the whole block
if (s.includes("if (staggerMode === 'block')") && !s.includes('!syncToWords && staggerMode')) {
  // Find __ghost assign and block opacity
  s = s.replace(
    /if \(staggerMode === 'block'\) \{\s*\n\s*const opacity = ghostUnitOpacity/,
    `if (staggerMode === 'block' && !syncToWords) {
      const opacity = ghostUnitOpacity`,
  );
  // ensure syncToWords is in scope where __ghost is built
  if (!s.includes('const syncToWords =')) {
    s = s.replace(
      /const staggerMode = /,
      `const syncToWords = !!(def as CaptionStyleDef).ghost?.syncToWords;\n    const staggerMode = `,
    );
  }
  console.log('block ghost skips when word-synced');
}

fs.writeFileSync(p, s);

// brace balance
let d = 0;
for (const c of s) {
  if (c === '{') d++;
  if (c === '}') d--;
}
console.log('layer balance', d);
console.log('has slam in entrance', s.includes("case 'slam':"));
console.log('renderGradientWord calls', (s.match(/renderGradientWord\(/g) || []).length);

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('ALL OK');
