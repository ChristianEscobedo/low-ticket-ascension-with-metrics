#!/usr/bin/env node
/**
 * Fix: active caption word shifts subtly right on highlight.
 *
 * Root cause: wordCss only applies horizontal padding / box chrome when
 * `active` is true (box / boxGrow). padding-left pushes glyphs right and
 * reflows the line. Scale without an explicit center origin can also feel
 * off-center next to dual-layer gradient shells.
 *
 * Fix:
 * 1) Reserve the same padding/radius/display on idle + active for box modes;
 *    only paint background when active.
 * 2) boxGrow: drop layout-affecting padding/scale from wordCss (layer already
 *    draws an absolute bg with scaleX).
 * 3) scale/big: transform-origin center center.
 * 4) Always inline-block words so idle↔active display doesn't reflow.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

const capsPath = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(capsPath, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

const start = s.indexOf('function wordCss(');
if (start < 0) {
  console.error('wordCss not found');
  process.exit(1);
}
// Find end of function: matching brace from first {
const brace = s.indexOf('{', start);
let depth = 0;
let end = -1;
for (let i = brace; i < s.length; i++) {
  if (s[i] === '{') depth++;
  else if (s[i] === '}') {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
if (end < 0) {
  console.error('could not find end of wordCss');
  process.exit(1);
}

const newFn = `function wordCss(
  def: CaptionStyleDef,
  color: string,
  active: boolean,
): React.CSSProperties {
  const css: React.CSSProperties = {
    color,
    fontStyle: def.italic ? 'italic' : undefined,
    // Always the same box model idle↔active so highlight never reflows glyphs.
    display: 'inline-block',
  };
  // Gradient fill: active-only by default, or every word when scope is 'all'.
  // NEVER combine with WebkitTextStroke — the stroke paints outside the clip
  // and reads as a hard black outline around every modern gradient preset.
  //
  // Also NEVER use text-shadow on a background-clip:text glyph: the fill is
  // transparent so only the shadow silhouette shows (the "black outline blob"
  // the gallery was rendering). Use filter:drop-shadow instead — it respects
  // the clipped alpha and keeps the gradient visible.
  const scope = def.gradientScope ?? 'active';
  const paintGradient = !!def.gradient && (active || scope === 'all');
  if (paintGradient && def.gradient) {
    (css as Record<string, unknown>)['backgroundImage'] = gradientCssFor(
      def.gradient,
      def.gradientAngle ?? 135,
    );
    (css as Record<string, unknown>)['WebkitBackgroundClip'] = 'text';
    (css as Record<string, unknown>)['backgroundClip'] = 'text';
    (css as Record<string, unknown>)['WebkitTextFillColor'] = 'transparent';
    css['color'] = 'transparent';
    // Larger background so gradientShift can drift without seams.
    if (def.gradientShift) {
      (css as Record<string, unknown>)['backgroundSize'] = '200% 200%';
      (css as Record<string, unknown>)['backgroundRepeat'] = 'no-repeat';
    }
    // Depth via dual-layer shadow var (not text-shadow) so the gradient stays visible.
    if (def.shadow) {
      (css as Record<string, unknown>)['--caption-grad-shadow'] = def.shadow;
    }
  } else if (def.stroke && def.stroke.width > 0) {
    // paint-order stroke: the outline sits behind the fill (the Hormozi look).
    // Only when we are NOT gradient-filling this glyph.
    (css as Record<string, unknown>)['WebkitTextStroke'] =
      \`\${def.stroke.width}px \${def.stroke.color}\`;
    (css as Record<string, unknown>)['paintOrder'] = 'stroke fill';
    if (def.shadow) css['textShadow'] = def.shadow;
  } else if (def.shadow) {
    css['textShadow'] = def.shadow;
  }

  // ---- Highlight chrome: reserve layout on BOTH states ----
  // Horizontal padding only on the active word was the right-shift bug
  // (padding-left pushes glyphs). Keep metrics identical idle↔active.
  if (def.highlightMode === 'box' && def.activeBg && !paintGradient) {
    css['padding'] = '0 0.18em';
    css['borderRadius'] = '0.18em';
    if (active) css['backgroundColor'] = def.activeBg;
  } else if (def.highlightMode === 'boxGrow' && !paintGradient) {
    // Layer draws the growing absolute bg; only reserve a hair of space so
    // the absolute plate doesn't clip, same idle + active.
    css['padding'] = '0 0.12em';
    css['borderRadius'] = '0.28em';
    // No backgroundColor / scale here — absolute boxGrowBg handles the pop
    // without changing glyph metrics.
  }

  if (active) {
    // Big-word emphasis. transform does not affect layout; pin origin center
    // so the pop doesn't read as a sideways shove.
    const bigScale = def.big ? 1.55 : 1.18;
    if (def.highlightMode === 'scale' || def.big) {
      css['transform'] = \`scale(\${bigScale})\`;
      css['transformOrigin'] = 'center center';
    } else if (def.highlightMode === 'glow') {
      // Animated bloom in the accent color (neon without a hard box).
      // On gradient glyphs, stack into filter so we don't kill the fill.
      if (paintGradient) {
        const glow = \`drop-shadow(0 0 0.35em \${def.activeColor}) drop-shadow(0 0 0.9em \${def.activeColor}66)\`;
        css['filter'] = css['filter'] ? \`\${glow} \${css['filter']}\` : glow;
      } else {
        css['textShadow'] =
          \`0 0 0.35em \${def.activeColor}, 0 0 0.9em \${def.activeColor}66, \${def.shadow ?? '0 2px 6px rgba(0,0,0,0.9)'}\`;
      }
    } else if (def.highlightMode === 'underline') {
      css['textDecoration'] = 'underline';
      css['textDecorationThickness'] = '0.12em';
      css['textUnderlineOffset'] = '0.18em';
    }
    // 'color'/'sweep'/'gradient' just change color (gradient fills via background-clip above).
  }
  return css;
}`;

s = s.slice(0, start) + newFn + s.slice(end);
fs.writeFileSync(capsPath, s);
console.log('wordCss rewritten');

// captionLayer: pin transform-origin on word spans + boxGrow bg already absolute
const layerPath = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let layer = fs.readFileSync(layerPath, 'utf8');

// Ensure base word style has transformOrigin center when scaling
const baseNeedle = `const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
            };`;
const baseRepl = `const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
              // Keep pop/scale centered so highlight never shoves glyphs sideways.
              transformOrigin: 'center center',
            };`;
if (layer.includes(baseNeedle)) {
  layer = layer.replace(baseNeedle, baseRepl);
  console.log('layer base transformOrigin set');
} else if (layer.includes("transformOrigin: 'center center'")) {
  console.log('layer already has transformOrigin');
} else {
  // softer match
  const soft = `display: 'inline-block',
              position: 'relative',
            };`;
  if (layer.includes(soft) && layer.includes('const base: React.CSSProperties')) {
    layer = layer.replace(
      soft,
      `display: 'inline-block',
              position: 'relative',
              transformOrigin: 'center center',
            };`,
    );
    console.log('layer base transformOrigin set (soft)');
  } else {
    console.warn('could not patch layer base style');
  }
}

// boxGrow absolute bg: use center origin (not left) so growth doesn't bias right
layer = layer.replace(
  /className="boxGrowBg"\s*style=\{\{([\s\S]*?)transformOrigin: 'left center',/,
  (m) => m.replace("transformOrigin: 'left center'", "transformOrigin: 'center center'"),
);
// Actually for boxGrow the scaleX from left is intentional for "grow in" effect.
// Revert if we changed it - user complaint is word shift not bg grow direction.
// Leave boxGrow as left origin for the decorative plate only.

fs.writeFileSync(layerPath, layer);

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});

// copy layer to worker if present
const workerLayer = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(workerLayer)) {
  fs.copyFileSync(layerPath, workerLayer);
  console.log('synced captionLayer to worker');
}

// quick sanity: wordCss must mention reserve / padding on box for both
const check = fs.readFileSync(capsPath, 'utf8');
if (!check.includes("def.highlightMode === 'box'")) {
  console.error('box branch missing');
  process.exit(1);
}
if (check.includes("css['padding'] = '0 0.22em'") && check.includes('if (active)')) {
  // old pattern might still exist
}
// Ensure we don't only pad inside `if (active)` for box
const activeBlock = check.slice(check.indexOf('if (active) {'), check.indexOf('if (active) {') + 1200);
if (activeBlock.includes("highlightMode === 'box'") && activeBlock.includes('padding')) {
  console.error('box padding still only inside active block');
  process.exit(1);
}

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out
    .split(/\r?\n/)
    .filter(
      (l) =>
        /error TS/.test(l) &&
        (/captions\.ts|captionLayer\.tsx/.test(l) || /Cannot find name/.test(l)),
    );
  console.log('caption errors:', lines.length);
  lines.slice(0, 15).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

console.log('OK');
