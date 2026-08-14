#!/usr/bin/env node
/**
 * Fix remaining Vercel/Railway tsc breakers from batch FX patches:
 * 1) renderGradientWord polluted with out-of-scope isActive/frame/w/plan/def/css
 * 2) CaptionBlockFx missing waveBounce
 * 3) resolveCaptionStyle anim '' comparison + waveBounce cast
 * 4) durationFrames cast noise
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, s) {
  fs.writeFileSync(path.join(root, rel), s);
}

// ---------- captions.ts ----------
{
  let s = read('src/lib/mothermode/reel/captions.ts');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';

  // Add waveBounce to CaptionBlockFx
  if (!s.includes("'waveBounce'")) {
    s = s.replace(
      /export type CaptionBlockFx = 'ghostFade' \| 'float' \| 'wiggle' \| 'punchIn' \| 'letterbox' \| 'springExit';/,
      "export type CaptionBlockFx = 'ghostFade' | 'float' | 'wiggle' | 'punchIn' | 'letterbox' | 'springExit' | 'waveBounce';",
    );
    console.log('CaptionBlockFx += waveBounce');
  } else {
    console.log('CaptionBlockFx already has waveBounce');
  }

  // Fix motionTrail anim assignment: avoid !== '' on CaptionAnim without empty
  // out.anim on CaptionStyleDef is CaptionAnim which may or may not include ''
  // Use Boolean(out.anim) instead
  s = s.replace(
    /out\.anim = out\.anim && out\.anim !== '' \? out\.anim : 'motionTrail';/,
    "out.anim = out.anim ? out.anim : 'motionTrail';",
  );

  // Fix waveBounce push cast - now it's a real member
  s = s.replace(
    /if \(overrides\.waveBounce\) fx\.push\('waveBounce' as CaptionBlockFx\);/,
    "if (overrides.waveBounce) fx.push('waveBounce');",
  );

  // Ensure CaptionStyleDef.anim allows empty string if needed - check
  // CaptionAnim already has | ''

  write('src/lib/mothermode/reel/captions.ts', s);
  console.log('captions.ts patched');
}

// ---------- captionLayer.tsx: clean renderGradientWord ----------
{
  const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
  let s = read(rel);

  // Replace the entire broken renderGradientWord function with a clean dual-layer version.
  // Match from function renderGradientWord through its closing brace before CaptionLayerFrame.
  const start = s.indexOf('function renderGradientWord(');
  const endMarker = 'export const CaptionLayerFrame';
  const end = s.indexOf(endMarker);
  if (start < 0 || end < 0) {
    console.error('could not locate renderGradientWord / CaptionLayerFrame');
    process.exit(1);
  }

  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const cleanFn = [
    'function renderGradientWord(',
    '  text: string,',
    '  style: React.CSSProperties,',
    '  emoji: string,',
    '  tail: string,',
    '): React.ReactNode {',
    "  const shadow = String(",
    "    (style as Record<string, unknown>)['--caption-grad-shadow'] ?? '',",
    '  );',
    "  const hasGrad = !!(style as Record<string, unknown>)['backgroundImage'];",
    '  if (!hasGrad || !shadow) {',
    '    return (',
    '      <>',
    '        {text}',
    '        {emoji ? <span className="emoji-burst">{emoji}</span> : null}',
    '        {tail}',
    '      </>',
    '    );',
    '  }',
    '  // Dual layer: solid shadow under clipped gradient fill (Chromium-safe).',
    '  const shell: React.CSSProperties = {',
    "    display: 'inline-block',",
    "    position: 'relative',",
    '    transform: style.transform,',
    '    opacity: style.opacity,',
    '  };',
    '  const under: React.CSSProperties = {',
    "    position: 'absolute',",
    '    left: 0,',
    '    top: 0,',
    "    color: '#000',",
    '    textShadow: shadow,',
    "    WebkitTextFillColor: '#000',",
    "    pointerEvents: 'none',",
    "    userSelect: 'none',",
    "    font: 'inherit',",
    "    letterSpacing: 'inherit',",
    "    whiteSpace: 'pre-wrap',",
    '  };',
    '  const fill: React.CSSProperties = {',
    '    ...style,',
    "    position: 'relative',",
    '    transform: undefined,',
    '    opacity: undefined,',
    '    filter: undefined,',
    '    textShadow: undefined,',
    '  };',
    "  delete (fill as Record<string, unknown>)['--caption-grad-shadow'];",
    '  return (',
    '    <span style={shell}>',
    '      <span aria-hidden style={under}>',
    '        {text}',
    '      </span>',
    '      <span style={fill}>{text}</span>',
    '      {emoji ? <span className="emoji-burst">{emoji}</span> : null}',
    '      {tail}',
    '    </span>',
    '  );',
    '}',
    '',
    '',
  ].join(nl);

  s = s.slice(0, start) + cleanFn + s.slice(end);

  // Fix durationFrames cast - use unknown intermediate
  s = s.replace(
    /const totalSec = Math\.max\(1, \(plan as \{ durationFrames\?: number \}\)\.durationFrames\s*\r?\n\s*\? \(\(plan as \{ durationFrames: number \}\)\.durationFrames \/ plan\.fps\)\s*\r?\n\s*: peaks\.length \/ 30\);/,
    `const durFrames = (plan as unknown as { durationFrames?: number }).durationFrames;
        const totalSec = Math.max(1, typeof durFrames === 'number' && durFrames > 0
          ? durFrames / plan.fps
          : peaks.length / 30);`,
  );

  write(rel, s);
  console.log('captionLayer.tsx renderGradientWord cleaned');
}

// Sync vendored copies of captions + captionLayer if worker tracks them
execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});

// Also copy captionLayer if worker has a copy
const workerLayer = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
const srcLayer = path.join(
  root,
  'src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(workerLayer)) {
  fs.copyFileSync(srcLayer, workerLayer);
  console.log('synced captionLayer to worker');
}

// tsc check focused
try {
  const out = execSync(
    'pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1',
    { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  console.log('tsc exit 0');
  const bad = out
    .split(/\r?\n/)
    .filter((l) => /captions\.ts|captionLayer\.tsx|CaptionGallery/.test(l));
  bad.slice(0, 20).forEach((l) => console.log(l));
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out
    .split(/\r?\n/)
    .filter(
      (l) =>
        /error TS/.test(l) &&
        (/captions\.ts|captionLayer\.tsx|CaptionGallery/.test(l) ||
          /Cannot find name|CaptionOverrides|CaptionBlockFx|waveBounce|motionTrail/.test(
            l,
          )),
    );
  console.log('remaining caption/layer errors:', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
  console.log('(other project tsc errors ignored)');
}

console.log('OK');
