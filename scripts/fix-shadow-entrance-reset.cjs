#!/usr/bin/env node
/**
 * 1) Keep drop shadow / outer glow on the ACTIVE word (don't drop when
 *    highlight/gradient/entrance rewrites textShadow/filter).
 * 2) Real "none" entrance anim in CAPTION_ANIMS + layer skip + entranceStyle.
 * 3) Reset-all-overrides control in CaptionGallery + page wiring.
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

// ---------------------------------------------------------------------------
// captions.ts — CAPTION_ANIMS includes '' ; wordCss keeps shadow on active
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/captions.ts');

  // Prepend '' to CAPTION_ANIMS if missing
  if (!/export const CAPTION_ANIMS: CaptionAnim\[\] = \[\s*''/.test(s)) {
    s = s.replace(
      /export const CAPTION_ANIMS: CaptionAnim\[\] = \[\r?\n\s*'pop'/,
      (m) => m.replace("'pop'", "'',\n  'pop'"),
    );
    console.log('CAPTION_ANIMS += none');
  } else {
    console.log('CAPTION_ANIMS already has none');
  }

  // Rewrite the active-highlight tail of wordCss so glow COMPOSES with base shadow
  // and gradient active keeps --caption-grad-shadow (incl. glow).
  const activeStart = s.indexOf('  if (active) {\n    // Big-word emphasis');
  const activeStartAlt = s.indexOf("  if (active) {\r\n    // Big-word emphasis");
  const a0 = activeStart >= 0 ? activeStart : activeStartAlt;
  if (a0 < 0) {
    console.error('active block not found in wordCss');
    process.exit(1);
  }
  // find matching close of if (active)
  let depth = 0;
  let a1 = -1;
  const openAt = s.indexOf('{', a0);
  for (let i = openAt; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        a1 = i + 1;
        break;
      }
    }
  }
  if (a1 < 0) {
    console.error('could not close active block');
    process.exit(1);
  }

  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const newActive = [
    '  if (active) {',
    '    // Big-word emphasis. transform does not affect layout; pin origin center',
    "    // so the pop doesn't read as a sideways shove.",
    '    const bigScale = def.big ? 1.55 : 1.18;',
    "    if (def.highlightMode === 'scale' || def.big) {",
    '      css[\'transform\'] = `scale(${bigScale})`;',
    "      css['transformOrigin'] = 'center center';",
    "    } else if (def.highlightMode === 'glow') {",
    '      // Compose bloom WITH the base shadow — never replace it (that made the',
    '      // active word look flat / "shadow disappeared").',
    "      const baseSh = def.shadow || '0 2px 6px rgba(0,0,0,0.9)';",
    '      const bloom =',
    '        `0 0 0.35em ${def.activeColor}, 0 0 0.9em ${def.activeColor}66`;',
    '      if (paintGradient) {',
    '        // Gradient glyphs use dual-layer shadow var, not filter/text-shadow.',
    "        const prev = String((css as Record<string, unknown>)['--caption-grad-shadow'] ?? '');",
    "        (css as Record<string, unknown>)['--caption-grad-shadow'] = prev",
    '          ? `${bloom}, ${prev}`',
    '          : `${bloom}, ${baseSh}`;',
    '      } else {',
    "        const prev = typeof css['textShadow'] === 'string' ? css['textShadow'] : '';",
    "        css['textShadow'] = prev",
    '          ? `${bloom}, ${prev}`',
    '          : `${bloom}, ${baseSh}`;',
    '      }',
    "    } else if (def.highlightMode === 'underline') {",
    "      css['textDecoration'] = 'underline';",
    "      css['textDecorationThickness'] = '0.12em';",
    "      css['textUnderlineOffset'] = '0.18em';",
    '    }',
    "    // 'color'/'sweep'/'gradient'/'box' — color/chrome only; shadow already set above.",
    '  }',
    '',
    '  // Final guard: if we still have a base shadow and somehow lost it on the',
    '  // active glyph path, put it back. Idle already set it in the branches above.',
    '  if (def.shadow) {',
    '    if (paintGradient) {',
    "      if (!(css as Record<string, unknown>)['--caption-grad-shadow']) {",
    "        (css as Record<string, unknown>)['--caption-grad-shadow'] = def.shadow;",
    '      }',
    "    } else if (!css['textShadow']) {",
    "      css['textShadow'] = def.shadow;",
    '    }',
    '  }',
  ].join(nl);

  s = s.slice(0, a0) + newActive + s.slice(a1);
  write('src/lib/mothermode/reel/captions.ts', s);
  console.log('wordCss active shadow compose fixed');
}

// ---------------------------------------------------------------------------
// captionLayer — skip entrance when anim is '' / none; entranceStyle no-op
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');

  // entranceStyle: handle '' and 'none' at top
  if (!s.includes("case '':") && !s.includes("case 'none':")) {
    s = s.replace(
      /function entranceStyle\(anim: string, e: number\): React\.CSSProperties \{\r?\n  const p = clamp01\(e\);\r?\n  switch \(anim\) \{/,
      (m) =>
        m +
        `\n    case '':\n    case 'none':\n      return {};`,
    );
    console.log('entranceStyle none cases');
  }

  // Only apply entrance when wordAnim is truthy
  const oldIf =
    "if (isActive && !useFill && !isCascade) {\n              const entrance = entranceStyle(wordAnim, wordEnterT);\n              Object.assign(style, entrance);";
  const newIf =
    "if (isActive && !useFill && !isCascade && wordAnim) {\n              const entrance = entranceStyle(wordAnim, wordEnterT);\n              Object.assign(style, entrance);";
  if (s.includes(oldIf)) {
    s = s.replace(oldIf, newIf);
    console.log('layer skip empty entrance');
  } else {
    const oldIfCrlf = oldIf.replace(/\n/g, '\r\n');
    const newIfCrlf = newIf.replace(/\n/g, '\r\n');
    if (s.includes(oldIfCrlf)) {
      s = s.replace(oldIfCrlf, newIfCrlf);
      console.log('layer skip empty entrance (crlf)');
    } else if (s.includes('&& wordAnim)')) {
      console.log('layer already skips empty anim');
    } else {
      // softer
      s = s.replace(
        /if \(isActive && !useFill && !isCascade\) \{(\r?\n\s*)const entrance = entranceStyle/,
        'if (isActive && !useFill && !isCascade && wordAnim) {$1const entrance = entranceStyle',
      );
      console.log('layer skip empty entrance (soft)');
    }
  }

  // When entrance sets filter (blurIn), don't wipe an existing filter — compose.
  // Safer: after Object.assign entrance, if both had filter... skip for now;
  // blurIn is rare. Shadow is on textShadow / grad var.

  // renderGradientWord: also accept style.textShadow as fallback shadow source
  s = s.replace(
    /const shadow = String\(\r?\n\s*\(style as Record<string, unknown>\)\['--caption-grad-shadow'\] \?\? '',\r?\n\s*\);/,
    `const shadow = String(
    (style as Record<string, unknown>)['--caption-grad-shadow'] ??
      style.textShadow ??
      '',
  );`,
  );

  write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
  console.log('captionLayer patched');
}

// ---------------------------------------------------------------------------
// CaptionGallery — Reset all button + ensure none anim works
// ---------------------------------------------------------------------------
{
  let g = read('src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx');

  // Add onResetOverrides prop
  if (!g.includes('onResetOverrides')) {
    g = g.replace(
      /onCustomize,\r?\n  words = \[\],\r?\n  clipName = '',\r?\n\}: \{/,
      (m) =>
        m.replace(
          'onCustomize,',
          'onCustomize,\n  onResetOverrides,\n',
        ),
    );
    g = g.replace(
      /onCustomize: \(patch: Partial<CaptionOverrides>\) => void;\r?\n  \/\*\* R20:/,
      (m) =>
        m.replace(
          'void;',
          'void;\n  /** Clear every caption override back to the preset defaults. */\n  onResetOverrides?: () => void;',
        ),
    );
    console.log('gallery prop onResetOverrides');
  }

  // Insert Reset all control near Entrance anim header
  if (!g.includes('Reset all overrides') && !g.includes('Reset to preset defaults')) {
    const marker = `{/* Entrance animation + highlight */}`;
    const idx = g.indexOf(marker);
    if (idx < 0) {
      console.error('entrance marker missing');
      process.exit(1);
    }
    // Find the opening of that section's first div after marker and inject a reset row before entrance
    const insert = `
            {/* Reset every dial back to the active preset */}
            {onResetOverrides && (
              <div className="flex items-center justify-between rounded-md border border-bone/10 bg-ink/40 px-2 py-1.5">
                <span className="text-[9px] text-bone/45">
                  Custom look applied
                </span>
                <button
                  type="button"
                  onClick={() => onResetOverrides()}
                  className="rounded-full border border-bone/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-bone/60 hover:bg-bone/10 hover:text-bone"
                  title="Clear all caption overrides and restore the preset defaults"
                >
                  Reset to defaults
                </button>
              </div>
            )}

`;
    g = g.slice(0, idx) + insert + g.slice(idx);
    console.log('reset button inserted');
  }

  // Label empty anim as None more clearly (already {a || 'none'})
  write('src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx', g);
}

// ---------------------------------------------------------------------------
// page.tsx — wire onResetOverrides to clear captionOverrides
// ---------------------------------------------------------------------------
{
  let p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');
  if (!p.includes('onResetOverrides')) {
    // Find CaptionGallery usage with onCustomize
    if (!p.includes('<CaptionGallery')) {
      console.error('CaptionGallery not in page');
      process.exit(1);
    }
    p = p.replace(
      /onCustomize=\{?\(?(?:patchOv)?\)?\s*=>\s*void setCaptionOverrides\((?:patchOv)?\)\}?/,
      (m) => {
        // keep onCustomize and add onReset next to it
        return `${m}
                    onResetOverrides={() => {
                      void (async () => {
                        if (!project) return;
                        const updated = { ...project, captionOverrides: {} };
                        setProject(updated);
                        await post({ action: 'save', project: updated });
                      })();
                    }}`;
      },
    );
    // Broader fallback
    if (!p.includes('onResetOverrides')) {
      p = p.replace(
        /onCustomize=\{\(patchOv\) => void setCaptionOverrides\(patchOv\)\}/,
        `onCustomize={(patchOv) => void setCaptionOverrides(patchOv)}
                    onResetOverrides={() => {
                      void (async () => {
                        if (!project) return;
                        const updated = { ...project, captionOverrides: {} };
                        setProject(updated);
                        await post({ action: 'save', project: updated });
                      })();
                    }}`,
      );
    }
    if (!p.includes('onResetOverrides')) {
      // dump context
      const i = p.indexOf('CaptionGallery');
      console.log(p.slice(i, i + 500));
      process.exit(1);
    }
    write('src/app/(fullscreen)/admin/reel-studio/page.tsx', p);
    console.log('page onResetOverrides wired');
  } else {
    console.log('page already has onResetOverrides');
  }
}

// Also improve mergeCaptionOv so null values delete keys (optional future)
{
  let p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');
  const old = `function mergeCaptionOv(patchOv: Partial<CaptionOverrides>): CaptionOverrides {
const merged: CaptionOverrides = { ...(project?.captionOverrides ?? {}), ...patchOv };
    if (merged.colors && merged.colors.every((c) => !c)) delete merged.colors;
    return merged;
  }`;
  const neu = `function mergeCaptionOv(patchOv: Partial<CaptionOverrides>): CaptionOverrides {
    const merged: CaptionOverrides = { ...(project?.captionOverrides ?? {}), ...patchOv };
    // Explicit null deletes a key (reset one dial without wiping the rest).
    for (const [k, v] of Object.entries(patchOv)) {
      if (v === null) delete (merged as Record<string, unknown>)[k];
    }
    if (merged.colors && merged.colors.every((c) => !c)) delete merged.colors;
    return merged;
  }`;
  if (p.includes('v === null')) {
    console.log('merge already null-deletes');
  } else if (p.includes('function mergeCaptionOv')) {
    p = p.replace(
      /function mergeCaptionOv\(patchOv: Partial<CaptionOverrides>\): CaptionOverrides \{[\s\S]*?return merged;\r?\n  \}/,
      neu,
    );
    write('src/app/(fullscreen)/admin/reel-studio/page.tsx', p);
    console.log('mergeCaptionOv null-delete');
  }
}

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
const workerLayer = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(workerLayer)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
    workerLayer,
  );
  console.log('synced layer');
}

// tests
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-vendor-parity.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);

// tsc caption paths
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
        /captions\.ts|captionLayer|CaptionGallery|reel-studio\/page/.test(l),
    );
  console.log('errors:', lines.length);
  lines.slice(0, 20).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

console.log('OK');
