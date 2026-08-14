#!/usr/bin/env node
/**
 * Finish free-place double-paint fix (CRLF-safe).
 * - StageCaptions: pass marks + freePlaceEdit + merged captions
 * - WordDragLayer: bigger hit targets
 * - vendor captionLayer already has gradient fix
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

function normNl(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
function writePreserveNl(file, content, wasCrlf) {
  const out = wasCrlf ? content.replace(/\n/g, '\r\n') : content;
  fs.writeFileSync(file, out);
}

// ── page.tsx StageCaptions ────────────────────────────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = normNl(raw);

  // 1) Expand StageCaptions signature
  if (!s.includes('freePlaceEdit = false')) {
    s = s.replace(
      /function StageCaptions\(\{\n  words,\n  timeSec,\n  stageW,\n  fps = DEFAULT_FPS,\n  preset = 'karaoke',\n  overrides,\n\}: \{\n  \/\*\* The clip's words, in CLIP-LOCAL source seconds \(what project\.captions holds\)\. \*\/\n  words: ReelWord\[\];\n  \/\*\* Playhead in the same clip-local seconds\. \*\/\n  timeSec: number;\n  stageW: number;\n  fps\?: number;\n  preset\?: CaptionPreset;\n  overrides\?: CaptionOverrides;\n\}\) \{/,
      `function StageCaptions({
  words,
  timeSec,
  stageW,
  fps = DEFAULT_FPS,
  preset = 'karaoke',
  overrides,
  freePlaceEdit = false,
}: {
  /** The clip's words, in CLIP-LOCAL source seconds (what project.captions holds). */
  words: ReelWord[];
  /** Playhead in the same clip-local seconds. */
  timeSec: number;
  stageW: number;
  fps?: number;
  preset?: CaptionPreset;
  overrides?: CaptionOverrides;
  /** Edit mode: show every free-placed word (not just the spoken one). */
  freePlaceEdit?: boolean;
}) {`,
    );
    if (!s.includes('freePlaceEdit = false')) {
      // simpler insert after overrides,
      s = s.replace(
        /(function StageCaptions\(\{[\s\S]*?overrides,)(\n\}: \{)/,
        '$1\n  freePlaceEdit = false,$2',
      );
      s = s.replace(
        /(overrides\?: CaptionOverrides;)(\n\}\) \{)/,
        '$1\n  /** Edit mode: show every free-placed word. */\n  freePlaceEdit?: boolean;$2',
      );
    }
    console.log('sig', s.includes('freePlaceEdit = false'));
  }

  // 2) Pass marks in word map
  if (!s.includes('...(w.mark ? { mark: w.mark }')) {
    const before = s;
    s = s.replace(
      /fromFrame: Math\.round\(w\.start \* fps\),\n        toFrame: Math\.round\(w\.end \* fps\),\n      \}\)/,
      `fromFrame: Math.round(w.start * fps),
        toFrame: Math.round(w.end * fps),
        ...(w.mark ? { mark: w.mark } : {}),
      })`,
    );
    console.log('marks', s !== before);
    if (s === before) {
      // only inside StageCaptions
      const sc = s.indexOf('function StageCaptions');
      const scEnd = s.indexOf('\nfunction ', sc + 10);
      const chunk = s.slice(sc, scEnd);
      const fixed = chunk.replace(
        /toFrame: Math\.round\(w\.end \* fps\),/,
        `toFrame: Math.round(w.end * fps),
        ...(w.mark ? { mark: w.mark } : {}),`,
      );
      if (fixed === chunk) {
        console.error('could not inject marks');
        process.exit(1);
      }
      s = s.slice(0, sc) + fixed + s.slice(scEnd);
      console.log('marks via chunk');
    }
  }

  // 3) freePlaceEdit on plan object
  {
    const sc = s.indexOf('function StageCaptions');
    const scEnd = s.indexOf('\nfunction ', sc + 10);
    let chunk = s.slice(sc, scEnd);
    if (!chunk.includes('freePlaceEdit,')) {
      chunk = chunk.replace(
        /(powerWords: overrides\?\.powerWords \?\? \[\],)/,
        '$1\n      freePlaceEdit,',
      );
    }
    if (!chunk.includes('freePlaceEdit]')) {
      chunk = chunk.replace(
        /\[words, fps, stageW, def, layout, overrides\?\.powerWords\]/,
        '[words, fps, stageW, def, layout, overrides?.powerWords, freePlaceEdit]',
      );
    }
    // type annotation optional
    chunk = chunk.replace(
      /const plan: CaptionPlanLike = useMemo/,
      'const plan: CaptionPlanLike & { freePlaceEdit?: boolean } = useMemo',
    );
    s = s.slice(0, sc) + chunk + s.slice(scEnd);
    console.log('plan freePlaceEdit', chunk.includes('freePlaceEdit,'));
  }

  // 4) JSX: merged captions + freePlaceEdit
  {
    const before = s;
    s = s.replace(
      /words=\{project\.captions\[stageClip\.id\]\}/,
      'words={(projectWithWordPlace ?? project).captions[stageClip.id] ?? []}',
    );
    if (!s.includes('freePlaceEdit={stackEditMode}')) {
      // only on StageCaptions (not Remotion which already has it)
      s = s.replace(
        /(<StageCaptions\n(?:[^\n]*\n){1,12}?\s*overrides=\{project\.captionOverrides\})\n(\s*)\/>/,
        '$1\n$2freePlaceEdit={stackEditMode}\n$2/>',
      );
    }
    console.log('jsx', s !== before, 'fp prop', s.includes('freePlaceEdit={stackEditMode}'));
  }

  writePreserveNl(p, s, crlf);
}

// ── WordDragLayer hit targets ─────────────────────────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = normNl(raw);

  const oldBox = `const baseW = Math.max(48, Math.min(160, 14 + w.label.length * 11));
        const baseH = 36;`;
  const neuBox = `// Generous hit target — theme glyphs are large; a tight box is ungrabbable.
        const baseW = Math.max(72, Math.min(220, 28 + w.label.length * 14));
        const baseH = 52;`;
  if (s.includes(oldBox)) {
    s = s.replace(oldBox, neuBox);
    console.log('hit targets enlarged');
  } else if (s.includes('Math.max(72')) {
    console.log('hit targets already large');
  } else {
    console.warn('hit box not found');
  }

  // Always-visible light ring so grab zone is obvious
  s = s.replace(
    /isSel\n\s*\? 'ring-2 ring-brass\/80 ring-offset-0 bg-brass\/\[0\.06\]'\n\s*: 'hover:ring-1 hover:ring-white\/35 hover:bg-white\/\[0\.03\]'/,
    `isSel
                  ? 'ring-2 ring-brass ring-offset-0 bg-brass/10'
                  : 'ring-1 ring-white/25 hover:ring-brass/50 hover:bg-white/[0.06]'`,
  );

  writePreserveNl(p, s, crlf);
}

// vendor captionLayer
{
  const src = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  const dst = path.join(
    root,
    'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
  );
  if (fs.existsSync(dst)) fs.copyFileSync(src, dst);
}

// verify key bits
{
  const p = fs.readFileSync(
    path.join(root, 'src/app/(fullscreen)/admin/reel-studio/page.tsx'),
    'utf8',
  );
  console.log('verify marks', p.includes('...(w.mark ? { mark: w.mark }'));
  console.log('verify merge', p.includes('projectWithWordPlace ?? project).captions'));
  console.log('verify fp', p.includes('freePlaceEdit={stackEditMode}'));
  console.log(
    'verify StageCaptions fp param',
    /function StageCaptions[\s\S]{0,400}freePlaceEdit = false/.test(p),
  );
  const cl = fs.readFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
    'utf8',
  );
  console.log('verify grad', cl.includes('never let free-place layout'));
  const w = fs.readFileSync(
    path.join(root, 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx'),
    'utf8',
  );
  console.log('verify hit', w.includes('Math.max(72'));
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
        /page\.tsx|captionLayer|WordDrag|StageCaptions|freePlace|renderGradient/.test(
          l,
        ),
    );
  console.log('errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (!lines.length) {
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 12)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}
console.log('OK');
