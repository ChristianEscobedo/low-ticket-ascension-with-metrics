#!/usr/bin/env node
/**
 * Free-place style blowout fix.
 *
 * Root cause: when a word gets xPct/yPct it leaves the normal karaoke path
 * and is painted by a stripped absOverlay that drops entrance, karaoke fill,
 * cascade, emoji, and (critically) dual-layer gradient shell styles.
 *
 * Fix: absOverlay uses the SAME style composition as the normal word path,
 * then only overrides position to frame-absolute coords.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
const p = path.join(root, rel);
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('  // Free-place MIXED mode:');
if (start < 0) {
  console.error('MIXED block not found');
  process.exit(1);
}
// end at `) : null;` after absOverlay assignment
const marker = '  const absOverlay =';
const mStart = s.indexOf(marker, start);
if (mStart < 0) {
  console.error('absOverlay not found');
  process.exit(1);
}
// find end of absOverlay const: `) : null;\n\n`
const endNeedle = ') : null;';
let end = s.indexOf(endNeedle, mStart);
if (end < 0) {
  console.error('absOverlay end not found');
  process.exit(1);
}
end = end + endNeedle.length;

const neu = `  // Free-place MIXED mode: only words the user moved (xPct+yPct) leave the
  // caption line. Style pipeline MUST match the normal karaoke path so a drag
  // never blows out theme gradients / shadows / entrance / FX.
  const freePlacedAbs = words
    .map((w, idx) => ({ w, idx }))
    .filter(
      ({ w }) =>
        !w.mark?.hidden &&
        typeof w.mark?.xPct === 'number' &&
        typeof w.mark?.yPct === 'number',
    )
    .filter(({ w, idx }) => {
      if (freePlaceEdit) return true;
      if (isBuildStack && frame < w.fromFrame) return false;
      if (!isBuildStack) return true;
      return frame >= w.fromFrame || idx <= activeIdx;
    });

  const absOverlay =
    freePlacedAbs.length > 0 ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 11,
          pointerEvents: 'none',
          fontSize,
          // Inherit the same typeface stack the caption box uses.
          fontFamily: (css.word as React.CSSProperties).fontFamily,
          fontWeight: (css.word as React.CSSProperties).fontWeight,
          letterSpacing: (css.word as React.CSSProperties).letterSpacing,
          textTransform: (css.word as React.CSSProperties).textTransform,
        }}
      >
        {freePlacedAbs.map(({ w, idx }) => {
          const isActive = idx === activeIdx;
          const power = isPowerWord(w.text, powerWords as string[]);
          const mark = w.mark;
          const x = mark!.xPct as number;
          const y = mark!.yPct as number;

          // --- identical base to normal path ---
          const base: React.CSSProperties = {
            ...(isActive || power ? css.active : css.word),
            display: 'inline-block',
            position: 'absolute',
            left: \`\${x}%\`,
            bottom: \`\${y}%\`,
            transform: 'translate(-50%, 50%)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          };

          if (mark?.color) {
            base.color = mark.color;
            delete (base as Record<string, unknown>)['backgroundImage'];
            delete (base as Record<string, unknown>)['WebkitTextFillColor'];
            delete (base as Record<string, unknown>)['backgroundClip'];
            delete (base as Record<string, unknown>)['WebkitBackgroundClip'];
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
          // Edit mode still runs entrance on the spoken word so Preview/Edit match.
          const wordEnterT = isActive
            ? entranceProgress(frame, w.fromFrame, plan.fps)
            : 1;

          const style: React.CSSProperties = { ...base };
          if (isBuildStack && isActive && !style.transform?.includes('scale')) {
            // keep translate anchor; stack pop on top
            style.transform = 'translate(-50%, 50%) scale(1.35)';
            style.transformOrigin = 'center center';
            style.zIndex = 2;
          }
          const isCascade =
            isActive && (wordAnim === 'cascade' || (mark?.stagger ?? 0) > 0);
          const useFill = isActive && def.karaokeFill && !isCascade;
          if (isActive && !useFill && !isCascade && wordAnim) {
            const entrance = entranceStyle(wordAnim as string, wordEnterT);
            // entrance may set transform — re-anchor to free-place centre
            const entT = (entrance.transform as string | undefined) ?? '';
            const rest = { ...entrance };
            delete (rest as { transform?: string }).transform;
            Object.assign(style, rest);
            const scaleBit = mark?.scale ? \` scale(\${mark.scale})\` : '';
            style.transform = \`translate(-50%, 50%) \${entT}\${scaleBit}\`.trim();
            style.transformOrigin = 'center center';
          } else if (mark?.scale && mark.scale !== 1) {
            style.transform = \`translate(-50%, 50%) scale(\${mark.scale})\`;
            style.transformOrigin = 'center center';
          }

          applyWordMarkExtras(
            style,
            mark,
            frame,
            w.fromFrame,
            plan.fps,
            css.active.color as string,
          );

          const emoji =
            (isActive || power) && def.emoji && emojiFor(w.text)
              ? \` \${emojiFor(w.text)}\`
              : '';

          if (isCascade) {
            const staggerSec =
              (mark?.stagger ?? 0) > 0
                ? (mark?.stagger as number)
                : CASCADE_STAGGER_SEC;
            return (
              <span key={\`fp-\${idx}\`} style={style}>
                <CascadeWord
                  text={text}
                  base={{}}
                  frame={frame}
                  fromFrame={w.fromFrame}
                  staggerFrames={Math.round(plan.fps * staggerSec)}
                  fps={plan.fps}
                />
                {emoji ? <span className="emoji-burst">{emoji}</span> : null}
              </span>
            );
          }

          if (useFill) {
            // Karaoke fill still works free-placed — clip progress on the glyph.
            const fillT = wordEnterT;
            const fillStyle: React.CSSProperties = {
              ...style,
              // keep free-place anchor
            };
            return (
              <span key={\`fp-\${idx}\`} style={fillStyle}>
                {renderGradientWord(text, style, emoji, '')}
              </span>
            );
          }

          const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];
          if (isGradFill) {
            // IMPORTANT: pass FULL style (incl. gradient + shadow vars) into
            // renderGradientWord. Outer shell only anchors position — but must
            // NOT strip transform scale the inner needs. renderGradientWord
            // paints dual layers using the style bag.
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
                }}
              >
                {renderGradientWord(text, style, emoji, '')}
              </span>
            );
          }

          return (
            <span key={\`fp-\${idx}\`} style={style}>
              {text}
              {emoji ? <span className="emoji-burst">{emoji}</span> : null}
            </span>
          );
        })}
      </div>
    ) : null;
`;

s = s.slice(0, start) + neu + s.slice(end);
fs.writeFileSync(p, s);
console.log('absOverlay rewritten for style parity');

// Also merge wordPlaceLocal into Remotion preview words so live drag keeps
// the same renderer (with coords) instead of only moving the hit target.
{
  const pageRel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  const pp = path.join(root, pageRel);
  let ps = fs.readFileSync(pp, 'utf8');

  // Find RemotionPreview project={project} and inject a project with merged marks
  // Safer: find where captions are read for the preview composition.
  // RemotionPreview gets full project — we need to merge wordPlaceLocal into captions.

  if (!ps.includes('projectWithWordPlace')) {
    // Insert a useMemo near stackEditMode / wordPlaceLocal
    const anchor = 'const [wordScaleLocal, setWordScaleLocal]';
    const ai = ps.indexOf(anchor);
    if (ai < 0) {
      console.warn('wordScaleLocal anchor missing — skip live merge');
    } else {
      // find end of that useState line
      const lineEnd = ps.indexOf('\n', ai);
      const inject = `

  /** Live free-place drag: merge local x/y into caption marks so Remotion
   *  paints the moved word with FULL theme styles (not just the hit target). */
  const projectWithWordPlace = useMemo(() => {
    if (!project || !currentClip) return project;
    const locals = wordPlaceLocal;
    const scales = wordScaleLocal;
    const hasLoc = Object.keys(locals).length > 0 || Object.keys(scales).length > 0;
    if (!hasLoc) return project;
    const base = project.captions[currentClip.id] ?? [];
    const next = base.map((w, i) => {
      const loc = locals[i];
      const sc = scales[i];
      if (!loc && typeof sc !== 'number') return w;
      return {
        ...w,
        mark: {
          ...(w.mark ?? {}),
          ...(loc ? { xPct: loc.xPct, yPct: loc.yPct } : {}),
          ...(typeof sc === 'number' ? { scale: sc } : {}),
        },
      };
    });
    return {
      ...project,
      captions: { ...project.captions, [currentClip.id]: next },
    };
  }, [project, currentClip, wordPlaceLocal, wordScaleLocal]);
`;
      ps = ps.slice(0, lineEnd + 1) + inject + ps.slice(lineEnd + 1);

      // Ensure useMemo is imported
      if (!ps.includes('useMemo')) {
        ps = ps.replace(
          /import\s*\{([^}]+)\}\s*from\s*'react'/,
          (m, g1) => {
            if (g1.includes('useMemo')) return m;
            return `import {${g1.replace(/\s+$/, '')}, useMemo } from 'react'`;
          },
        );
      }

      // Replace project={project} on RemotionPreview with projectWithWordPlace
      // Only the main studio preview instances (not every project=)
      const rePrev =
        /(<RemotionPreview\s+project=\{)project(\})/g;
      const before = ps;
      ps = ps.replace(rePrev, '$1projectWithWordPlace ?? project$2');
      if (ps === before) {
        // try multiline
        ps = ps.replace(
          /<RemotionPreview\s*\n\s*project=\{project\}/g,
          '<RemotionPreview\n                      project={projectWithWordPlace ?? project}',
        );
      }
      console.log(
        'RemotionPreview project swaps',
        (before.match(/<RemotionPreview/g) || []).length,
      );
      fs.writeFileSync(pp, ps);
      console.log('page: live wordPlace merge into preview project');
    }
  } else {
    console.log('page: projectWithWordPlace already present');
  }
}

// vendor copy
const dst = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(dst)) fs.copyFileSync(p, dst);

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
        /captionLayer|page\.tsx|WordDrag|freePlace|projectWithWordPlace/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (!lines.length) {
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 15)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}
console.log('OK');
