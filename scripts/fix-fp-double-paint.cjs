#!/usr/bin/env node
/**
 * Free-place double-paint + jacked shadow fix.
 *
 * Bugs:
 * 1) StageCaptions drops word.mark when building the plan → free-place never
 *    activates on the edit stage (original stays on the line forever).
 * 2) Free-place gradient path passes a style bag that still has
 *    position/left/bottom into renderGradientWord. The dual-layer FILL spreads
 *    those layout props and jumps off the shell; the black underlayer stays —
 *    looks like a black ghost + a gradient original.
 * 3) Hit targets are tiny (label-width estimate) → hard to grab.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ── 1) captionLayer: sanitize layout out of gradient dual-layer ───────────
{
  const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');

  const old = `function renderGradientWord(
  text: string,
  style: React.CSSProperties,
  emoji: string,
  tail: string,
): React.ReactNode {
  const shadow = String(
    (style as Record<string, unknown>)['--caption-grad-shadow'] ??
      style.textShadow ??
      '',
  );
  const hasGrad = !!(style as Record<string, unknown>)['backgroundImage'];
  if (!hasGrad || !shadow) {
    return (
      <>
        {text}
        {emoji ? <span className="emoji-burst">{emoji}</span> : null}
        {tail}
      </>
    );
  }
  // Dual layer: solid shadow under clipped gradient fill (Chromium-safe).
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
    color: '#000',
    textShadow: shadow,
    WebkitTextFillColor: '#000',
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
    filter: undefined,`;

  if (!s.includes('function renderGradientWord')) {
    console.error('renderGradientWord missing');
    process.exit(1);
  }

  // Replace the whole function more carefully by finding start and the return
  const start = s.indexOf('function renderGradientWord');
  // find matching end: next \nfunction or \nexport
  let end = s.indexOf('\nfunction ', start + 10);
  const end2 = s.indexOf('\nexport ', start + 10);
  if (end2 > start && (end < 0 || end2 < end)) end = end2;
  if (end < 0) {
    console.error('could not find end of renderGradientWord');
    process.exit(1);
  }

  const neu = `function renderGradientWord(
  text: string,
  style: React.CSSProperties,
  emoji: string,
  tail: string,
): React.ReactNode {
  const shadow = String(
    (style as Record<string, unknown>)['--caption-grad-shadow'] ??
      style.textShadow ??
      '',
  );
  const hasGrad = !!(style as Record<string, unknown>)['backgroundImage'];
  if (!hasGrad) {
    // Solid fill path — still strip layout so free-place shells stay clean.
    const solid: React.CSSProperties = { ...style };
    delete solid.position;
    delete solid.left;
    delete solid.right;
    delete solid.top;
    delete solid.bottom;
    delete solid.inset;
    return (
      <span style={solid}>
        {text}
        {emoji ? <span className="emoji-burst">{emoji}</span> : null}
        {tail}
      </span>
    );
  }
  // Dual layer: solid shadow under clipped gradient fill (Chromium-safe).
  // CRITICAL: never let free-place layout (position/left/bottom/transform
  // anchor) leak into the fill — that paints a black underlayer at the
  // free-place spot and a gradient glyph somewhere else (double PROCESS).
  const shell: React.CSSProperties = {
    display: 'inline-block',
    position: 'relative',
    // transform/opacity ride the OUTER free-place shell, not here
    opacity: 1,
  };
  const under: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    color: '#000',
    textShadow: shadow || (style.textShadow as string) || '0 2px 8px rgba(0,0,0,0.85)',
    WebkitTextFillColor: '#000',
    backgroundImage: 'none',
    backgroundClip: 'border-box',
    WebkitBackgroundClip: 'border-box',
    pointerEvents: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    textTransform: style.textTransform,
  };
  const fill: React.CSSProperties = {
    backgroundImage: style.backgroundImage,
    backgroundSize: style.backgroundSize,
    backgroundPosition: style.backgroundPosition,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    // Keep any non-layout paint bits
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    textTransform: style.textTransform,
    // Shadow lives on the under layer only — never on the clipped fill
    textShadow: 'none',
    position: 'relative',
    display: 'inline-block',
    whiteSpace: 'nowrap',
  };
  // Preserve CSS var for consumers that read it
  if ((style as Record<string, unknown>)['--caption-grad-shadow']) {
    (fill as Record<string, unknown>)['--caption-grad-shadow'] = (
      style as Record<string, unknown>
    )['--caption-grad-shadow'];
  }
  return (
    <span style={shell}>
      <span style={under} aria-hidden>
        {text}
      </span>
      <span style={fill}>
        {text}
      </span>
      {emoji ? <span className="emoji-burst">{emoji}</span> : null}
      {tail}
    </span>
  );
}
`;

  s = s.slice(0, start) + neu + s.slice(end);
  fs.writeFileSync(p, s);
  console.log('renderGradientWord rewritten (no layout leak)');

  // Free-place gradient outer shell: do NOT pass transform that includes
  // entrance on the outer AND inner. Outer anchors only.
  const badShell = `return (
              <span
                key={\`fp-\${idx}\`}
                style={{
                  position: 'absolute',
                  left: \`\${x}%\`,
                  bottom: \`\${y}%\`,
                  transform: style.transform ?? 'translate(-50%, 50%)',
                  transformOrigin: 'center center',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: style.zIndex,
                  opacity: style.opacity,
                }}
              >
                {renderGradientWord(text, style, emoji, '')}
              </span>
            );`;

  // Use a looser replace
  const shellStart = s.indexOf('// IMPORTANT: pass FULL style');
  if (shellStart > 0) {
    const retStart = s.indexOf('return (', shellStart);
    const retEnd = s.indexOf(');', retStart) + 2;
    // find the closing of the if block's return - match braces from return
    let depth = 0;
    let i = retStart;
    let found = -1;
    // simpler: find `);` after renderGradientWord call
    const gCall = s.indexOf('renderGradientWord(text, style, emoji, \'\')', shellStart);
    if (gCall < 0) {
      // try double quotes
    }
    const neuShell = `// Outer shell ONLY anchors free-place. Paint styles go into
            // renderGradientWord WITHOUT position/left/bottom (stripped there).
            // Transform (entrance/scale) stays on the outer shell so the dual
            // layer moves as one unit.
            return (
              <span
                key={\`fp-\${idx}\`}
                style={{
                  position: 'absolute',
                  left: \`\${x}%\`,
                  bottom: \`\${y}%\`,
                  transform: style.transform ?? 'translate(-50%, 50%)',
                  transformOrigin: 'center center',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: style.zIndex,
                  opacity: style.opacity,
                  filter: style.filter,
                }}
              >
                {renderGradientWord(text, style, emoji, '')}
              </span>
            );`;
    // replace from comment through the return's closing );
    const blockEnd = s.indexOf('renderGradientWord(text, style, emoji, \'\')', shellStart);
    if (blockEnd < 0) {
      console.warn('fp grad shell block not found for rewrite');
    } else {
      const close = s.indexOf(');', blockEnd) + 2;
      s = s.slice(0, shellStart) + neuShell + s.slice(close);
      fs.writeFileSync(p, s);
      console.log('fp grad outer shell cleaned');
    }
  }

  // vendor
  const dst = path.join(
    root,
    'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
  );
  if (fs.existsSync(dst)) fs.copyFileSync(p, dst);
}

// ── 2) StageCaptions: pass marks + freePlaceEdit ──────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');

  const oldMap = `words: words.map((w) => ({
        text: w.word,
        fromFrame: Math.round(w.start * fps),
        toFrame: Math.round(w.end * fps),
      })),`;

  const neuMap = `words: words.map((w) => ({
        text: w.word,
        fromFrame: Math.round(w.start * fps),
        toFrame: Math.round(w.end * fps),
        // Marks MUST ride through — free-place x/y, scale, fx, hide.
        // Dropping them is why a dragged word left a ghost on the line.
        ...(w.mark ? { mark: w.mark } : {}),
      })),`;

  if (!s.includes(oldMap)) {
    // try already patched
    if (s.includes('...(w.mark ? { mark: w.mark }')) {
      console.log('StageCaptions marks already present');
    } else {
      console.error('StageCaptions word map not found');
      const i = s.indexOf('function StageCaptions');
      console.log(s.slice(i, i + 900));
      process.exit(1);
    }
  } else {
    s = s.replace(oldMap, neuMap);
    console.log('StageCaptions passes marks');
  }

  // Add freePlaceEdit prop to StageCaptions
  if (!s.includes('function StageCaptions') ) {
    console.error('StageCaptions missing');
    process.exit(1);
  }

  // Expand StageCaptions signature
  const sigOld = `function StageCaptions({
  words,
  timeSec,
  stageW,
  fps = DEFAULT_FPS,
  preset = 'karaoke',
  overrides,
}: {
  /** The clip's words, in CLIP-LOCAL source seconds (what project.captions holds). */
  words: ReelWord[];
  /** Playhead in the same clip-local seconds. */
  timeSec: number;
  stageW: number;
  fps?: number;
  preset?: CaptionPreset;
  overrides?: CaptionOverrides;
}) {`;

  const sigNeu = `function StageCaptions({
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
}) {`;

  if (s.includes(sigOld)) {
    s = s.replace(sigOld, sigNeu);
    console.log('StageCaptions freePlaceEdit prop added');
  } else if (s.includes('freePlaceEdit = false')) {
    console.log('StageCaptions freePlaceEdit already in sig');
  } else {
    console.warn('StageCaptions sig not exact — trying loose');
  }

  // plan useMemo must include freePlaceEdit + marks in deps
  const planRet = `const plan: CaptionPlanLike = useMemo(
    () => ({
      fps,
      width: Math.max(1, stageW),
      words: words.map((w) => ({
        text: w.word,
        fromFrame: Math.round(w.start * fps),
        toFrame: Math.round(w.end * fps),
        // Marks MUST ride through — free-place x/y, scale, fx, hide.
        // Dropping them is why a dragged word left a ghost on the line.
        ...(w.mark ? { mark: w.mark } : {}),
      })),
      captionStyle: def,
      captionLayout: layout,
      powerWords: overrides?.powerWords ?? [],
    }),
    [words, fps, stageW, def, layout, overrides?.powerWords],
  );

  return <CaptionLayerFrame plan={plan} frame={Math.round(timeSec * fps)} />;
}`;

  const planNeu = `const plan: CaptionPlanLike & { freePlaceEdit?: boolean } = useMemo(
    () => ({
      fps,
      width: Math.max(1, stageW),
      words: words.map((w) => ({
        text: w.word,
        fromFrame: Math.round(w.start * fps),
        toFrame: Math.round(w.end * fps),
        ...(w.mark ? { mark: w.mark } : {}),
      })),
      captionStyle: def,
      captionLayout: layout,
      powerWords: overrides?.powerWords ?? [],
      freePlaceEdit,
    }),
    [words, fps, stageW, def, layout, overrides?.powerWords, freePlaceEdit],
  );

  return <CaptionLayerFrame plan={plan} frame={Math.round(timeSec * fps)} />;
}`;

  if (s.includes(planRet)) {
    s = s.replace(planRet, planNeu);
    console.log('StageCaptions plan includes freePlaceEdit');
  } else {
    // try without mark comments
    const loose = s.match(
      /const plan: CaptionPlanLike = useMemo\(\s*\(\) => \(\{[\s\S]*?\}\),\s*\[[^\]]*\],\s*\);\s*return <CaptionLayerFrame plan=\{plan\} frame=\{Math\.round\(timeSec \* fps\)\} \/>;/,
    );
    if (loose) {
      s = s.replace(loose[0], planNeu.replace(/^const plan[^=]+= /, 'const plan = ').replace('CaptionPlanLike & { freePlaceEdit?: boolean }', 'any'));
      // do proper
      s = s.replace(
        /return <CaptionLayerFrame plan=\{plan\} frame=\{Math\.round\(timeSec \* fps\)\} \/>;/,
        'return <CaptionLayerFrame plan={plan} frame={Math.round(timeSec * fps)} />;',
      );
      // inject freePlaceEdit into plan object if missing
      if (!s.includes('freePlaceEdit,')) {
        s = s.replace(
          /powerWords: overrides\?\.powerWords \?\? \[\],\n    \}\)/,
          'powerWords: overrides?.powerWords ?? [],\n      freePlaceEdit,\n    })',
        );
      }
      console.log('StageCaptions plan loose patch');
    } else {
      console.warn('plan block not matched — manual inject');
      // inject mark into map if still missing
      if (!s.includes('...(w.mark ? { mark: w.mark }')) {
        s = s.replace(
          /fromFrame: Math\.round\(w\.start \* fps\),\s*toFrame: Math\.round\(w\.end \* fps\),\s*\}\)/,
          `fromFrame: Math.round(w.start * fps),
        toFrame: Math.round(w.end * fps),
        ...(w.mark ? { mark: w.mark } : {}),
      })`,
        );
      }
      if (!s.includes('freePlaceEdit,')) {
        s = s.replace(
          /(powerWords: overrides\?\.powerWords \?\? \[\],)/,
          '$1\n      freePlaceEdit,',
        );
        s = s.replace(
          /\[words, fps, stageW, def, layout, overrides\?\.powerWords\]/,
          '[words, fps, stageW, def, layout, overrides?.powerWords, freePlaceEdit]',
        );
      }
    }
  }

  // Wire StageCaptions JSX to use merged captions + freePlaceEdit
  const scJsxOld = `<StageCaptions
                              words={project.captions[stageClip.id]}
                              timeSec={previewTime + (stageClip.trimStartSec ?? 0)}
                              stageW={stageBox.w}
                              preset={project.captionStyle}
                              overrides={project.captionOverrides}
                            />`;

  const scJsxNeu = `<StageCaptions
                              words={
                                (projectWithWordPlace ?? project).captions[
                                  stageClip.id
                                ] ?? []
                              }
                              timeSec={previewTime + (stageClip.trimStartSec ?? 0)}
                              stageW={stageBox.w}
                              preset={project.captionStyle}
                              overrides={project.captionOverrides}
                              freePlaceEdit={stackEditMode}
                            />`;

  if (s.includes(scJsxOld)) {
    s = s.replace(scJsxOld, scJsxNeu);
    console.log('StageCaptions JSX wired to projectWithWordPlace');
  } else if (s.includes('projectWithWordPlace ?? project).captions')) {
    console.log('StageCaptions JSX already merged');
  } else {
    // loose
    s = s.replace(
      /words=\{project\.captions\[stageClip\.id\]\}/,
      'words={(projectWithWordPlace ?? project).captions[stageClip.id] ?? []}',
    );
    if (!s.includes('freePlaceEdit={stackEditMode}')) {
      s = s.replace(
        /(overrides=\{project\.captionOverrides\}\s*)\/>/,
        '$1freePlaceEdit={stackEditMode}\n                            />',
      );
    }
    console.log('StageCaptions JSX loose wire');
  }

  fs.writeFileSync(p, s);
}

// ── 3) WordDragLayer: bigger hit targets ──────────────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx';
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');

  const oldBox = `const baseW = Math.max(48, Math.min(160, 14 + w.label.length * 11));
        const baseH = 36;`;
  const neuBox = `// Generous hit target — theme glyphs are large; a tight box is ungrabbable.
        const baseW = Math.max(72, Math.min(220, 28 + w.label.length * 14));
        const baseH = 52;`;

  if (s.includes(oldBox)) {
    s = s.replace(oldBox, neuBox);
    console.log('hit targets enlarged');
  } else {
    console.warn('hit box constants not found');
  }

  // Make the ring more visible and the whole box easier to see as a grab zone
  s = s.replace(
    /isSel\s*\n\s*\? 'ring-2 ring-brass\/80 ring-offset-0 bg-brass\/\[0\.06\]'\s*\n\s*: 'hover:ring-1 hover:ring-white\/35 hover:bg-white\/\[0\.03\]'/,
    `isSel
                  ? 'ring-2 ring-brass ring-offset-0 bg-brass/10'
                  : 'ring-1 ring-white/25 hover:ring-brass/50 hover:bg-white/[0.06]'`,
  );

  fs.writeFileSync(p, s);
}

// tsc
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
        /page\.tsx|captionLayer|WordDrag|renderGradient|StageCaptions|freePlace/.test(
          l,
        ),
    );
  console.log('errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
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
