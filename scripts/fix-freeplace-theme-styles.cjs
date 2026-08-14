#!/usr/bin/env node
/**
 * 1) Free-place words use full caption theme + mark FX (not bare spans)
 * 2) applyWordMark properly clears undefined keys
 * 3) Wider / cleaner right-click menu
 * 4) Vendor sync + tsc
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// ─── 1) captionLayer free-place branch ───────────────────────────────────────
{
  const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
  let s = read(rel);

  // Normalize newlines so CRLF files match LF needles.
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const startNeedle =
    `          const base: React.CSSProperties = {${nl}            ...(isActive || power ? css.active : css.word),${nl}            position: 'absolute',`;
  const start = s.indexOf(startNeedle);
  if (start < 0) throw new Error('free-place base style not found');
  // replace from base through the map callback body end (before `})}`)
  const mapEnd = s.indexOf(`${nl}        })}`, start);
  if (mapEnd < 0) throw new Error('map end not found');


  const replacement = `          const base: React.CSSProperties = {
            ...(isActive || power ? css.active : css.word),
            position: 'absolute',
            left: \`\${x}%\`,
            bottom: \`\${y}%\`,
            transform: 'translate(-50%, 50%)',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          };
          // Theme gradient shift (same as normal path) when no mark color.
          if (mark?.color) {
            base.color = mark.color;
            delete (base as Record<string, unknown>)['backgroundImage'];
            delete (base as Record<string, unknown>)['WebkitBackgroundClip'];
            delete (base as Record<string, unknown>)['backgroundClip'];
            delete (base as Record<string, unknown>)['WebkitTextFillColor'];
          } else if (
            def.gradientShift &&
            (base as Record<string, unknown>)['backgroundImage']
          ) {
            const tSec = frame / plan.fps;
            const gx = ((tSec * 22) % 100).toFixed(1);
            const gy = ((tSec * 13) % 100).toFixed(1);
            (base as Record<string, unknown>)['backgroundPosition'] = \`\${gx}% \${gy}%\`;
            if (!(base as Record<string, unknown>)['backgroundSize']) {
              (base as Record<string, unknown>)['backgroundSize'] = '200% 200%';
            }
          }

          const text = def.upper ? w.text.toUpperCase() : w.text;
          const wordAnim = mark?.anim ?? defAnim;
          // In Edit mode every word is shown; still run entrance for the active
          // spoken word so Preview and Edit share the same look when scrubbing.
          const wordEnterT =
            isActive && !freePlaceEdit
              ? entranceProgress(frame, w.fromFrame, plan.fps)
              : isActive
                ? entranceProgress(frame, w.fromFrame, plan.fps)
                : 1;

          const style: React.CSSProperties = { ...base };
          if (isActive && wordAnim && wordEnterT < 1) {
            const entrance = entranceStyle(wordAnim as CaptionAnim | string, wordEnterT);
            // Keep free-place anchor; compose entrance on top of translate.
            const entT = (entrance.transform as string) || '';
            const entRest = { ...entrance };
            delete entRest.transform;
            Object.assign(style, entRest);
            style.transform = \`translate(-50%, 50%)\${entT ? \` \${entT}\` : ''}\`.trim();
          }
          if (mark?.scale && mark.scale !== 1) {
            style.transform = \`\${(style.transform as string) || 'translate(-50%, 50%)'} scale(\${mark.scale})\`.trim();
            style.transformOrigin = 'center center';
          }
          // Full mark FX (glow / gradient / shine / pulse / font / ambient…)
          applyWordMarkExtras(
            style,
            mark,
            frame,
            w.fromFrame,
            plan.fps,
            css.active.color as string,
          );

          const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];
          if (isGradFill) {
            return (
              <span key={idx} style={{ position: 'absolute', left: \`\${x}%\`, bottom: \`\${y}%\`, transform: 'translate(-50%, 50%)', display: 'inline-block', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                {renderGradientWord(text, style, '', '')}
              </span>
            );
          }

          return (
            <span key={idx} style={style}>
              {mark?.fx === 'marker' ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: '-0.04em -0.14em',
                    background: mark.fxColor ?? (css.active.color as string),
                    opacity: Math.min(
                      0.85,
                      0.34 * Math.max(0.2, Math.min(3, mark.fxAmount ?? 1)),
                    ),
                    zIndex: -1,
                    borderRadius: '0.14em',
                    transformOrigin: 'left center',
                    transform: \`scaleX(\${wordSpanGrow(frame, w.fromFrame, plan.fps).toFixed(3)})\`,
                  }}
                />
              ) : null}
              {text}
              {mark?.fx === 'underline' ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '-0.04em',
                    right: '-0.04em',
                    bottom: '-0.10em',
                    height: \`\${(0.09 * Math.max(0.2, Math.min(3, mark.fxAmount ?? 1))).toFixed(2)}em\`,
                    borderRadius: '0.06em',
                    background: mark.fxColor ?? (css.active.color as string),
                    boxShadow: \`0 0 0.12em \${mark.fxColor ?? (css.active.color as string)}\`,
                    transformOrigin: 'left center',
                    transform: \`scaleX(\${wordSpanGrow(frame, w.fromFrame, plan.fps).toFixed(3)})\`,
                  }}
                />
              ) : null}
              {mark?.fx === 'strike' ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '-0.04em',
                    right: '-0.04em',
                    top: '52%',
                    height: \`\${(0.09 * Math.max(0.2, Math.min(3, mark.fxAmount ?? 1))).toFixed(2)}em\`,
                    borderRadius: '0.06em',
                    background: mark.fxColor ?? (css.active.color as string),
                    transformOrigin: 'left center',
                    transform: \`scaleX(\${wordSpanGrow(frame, w.fromFrame, plan.fps).toFixed(3)})\`,
                  }}
                />
              ) : null}
            </span>
          );`;

  s = s.slice(0, start) + replacement + s.slice(mapEnd);
  write(rel, s);
  console.log('captionLayer: free-place full theme+fx');
}

// ─── 2) page.tsx applyWordMark clears undefined ──────────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  let s = read(rel);
  const old = `async function applyWordMark(
    index: number,
    partial: Partial<import('@/lib/mothermode/reel/types').ReelWordMark>,
  ) {
    if (!project || !currentClip) return;
    const words = (project.captions[currentClip.id] ?? []).map((w, i) =>
      i === index ? { ...w, mark: { ...(w.mark ?? {}), ...partial } } : w,
    );`;
  const neu = `async function applyWordMark(
    index: number,
    partial: Partial<import('@/lib/mothermode/reel/types').ReelWordMark>,
  ) {
    if (!project || !currentClip) return;
    const words = (project.captions[currentClip.id] ?? []).map((w, i) => {
      if (i !== index) return w;
      // undefined in partial means "clear this field" (spread alone keeps old).
      const next: Record<string, unknown> = { ...(w.mark ?? {}) };
      for (const [k, v] of Object.entries(partial)) {
        if (v === undefined) delete next[k];
        else next[k] = v;
      }
      const empty = Object.keys(next).length === 0;
      return empty
        ? { word: w.word, start: w.start, end: w.end }
        : { ...w, mark: next as import('@/lib/mothermode/reel/types').ReelWordMark };
    });`;
  if (!s.includes(old)) {
    // already patched or drifted
    if (s.includes('undefined in partial means')) {
      console.log('page: applyWordMark already clears');
    } else {
      console.warn('page: applyWordMark pattern not found — manual check');
      const i = s.indexOf('async function applyWordMark');
      console.log(s.slice(i, i + 350));
    }
  } else {
    s = s.replace(old, neu);
    write(rel, s);
    console.log('page: applyWordMark clears undefined');
  }
}

// ─── 3) WordDragLayer menu polish ────────────────────────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx';
  let s = read(rel);
  s = s.replace(
    'className="pointer-events-auto fixed z-50 max-h-[min(420px,70vh)] w-[200px] overflow-y-auto rounded-lg border border-white/15 bg-ink/95 p-1.5 shadow-xl backdrop-blur"',
'className="pointer-events-auto fixed z-50 max-h-[min(480px,78vh)] w-[260px] overflow-y-auto rounded-xl border border-white/12 bg-ink/95 p-2 shadow-2xl shadow-black/50 ring-1 ring-white/5 backdrop-blur-md"',
  );
  s = s.replace(
    'className="mb-1 truncate px-1.5 text-[9px] font-semibold uppercase tracking-wide text-brass/90"',
    'className="mb-1.5 truncate border-b border-white/8 px-2 pb-1.5 text-[10px] font-semibold tracking-wide text-brass"',
  );
  // Section label a bit clearer
  s = s.replace(
    'className="mb-0.5 px-1.5 text-[8px] uppercase tracking-wide text-white/35"',
    'className="mb-1 px-1.5 text-[9px] font-medium uppercase tracking-wider text-white/40"',
  );
  write(rel, s);
  console.log('WordDragLayer: wider modern menu');
}

// ─── vendor + tsc ────────────────────────────────────────────────────────────
try {
  execSync('node scripts/sync-vendored-captions.cjs', {
    cwd: root,
    stdio: 'inherit',
  });
} catch (e) {
  console.warn('vendor sync warn', e.message);
}
const wl = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(wl)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
    wl,
  );
  console.log('copied captionLayer to worker');
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
        /captionLayer|WordDrag|page\.tsx|freePlace|applyWordMark/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (!lines.length) {
    // show any errors
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 20)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}

console.log('OK');
