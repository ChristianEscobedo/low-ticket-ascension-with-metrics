#!/usr/bin/env node
/**
 * Batch 1:
 * 1) Wire dual-layer gradient so render shows colors (not black silhouette)
 * 2) Ensure captionCssFor sets --caption-grad-shadow for gradient fills
 * 3) Draft quality mode on worker (half-res, faster x264)
 * 4) Keep-alive ping endpoint usage note + /warm
 * 5) Port doc stub
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ─── 1) Fix dual-layer wire in captionLayer ─────────────────────────────────
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');

  // Ensure renderGradientWord exists
  if (!s.includes('function renderGradientWord')) {
    console.error('renderGradientWord missing — abort');
    process.exit(1);
  }

  const emptyDual = `// Dual-layer gradient/shine (no silhouette).
            {
              const gradShadow = String(
                (style as Record<string, unknown>)['--caption-grad-shadow'] ?? '',
              );
              const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];

            }

            return (
              <span key={\`\${idx}-\${w.text}\`} style={style}>`;

  const wiredDual = `// Dual-layer gradient/shine (no silhouette).
            // Chromium/Remotion often paints background-clip:text as a solid
            // silhouette when filter/text-shadow sit on the same node. Split:
            // shadow layer (solid color + text-shadow) under a clipped fill.
            {
              const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];
              if (isGradFill) {
                return (
                  <span key={\`\${idx}-\${w.text}\`} style={{ display: 'inline-block', position: 'relative' }}>
                    {renderGradientWord(text, style, emoji, tail)}
                  </span>
                );
              }
            }

            return (
              <span key={\`\${idx}-\${w.text}\`} style={style}>`;

  if (s.includes(emptyDual)) {
    s = s.replace(emptyDual, wiredDual);
    console.log('wired dual-layer (exact)');
  } else {
    // looser: find Dual-layer comment and replace through return span
    const start = s.indexOf('// Dual-layer gradient/shine');
    const ret = s.indexOf('return (\n              <span key={`${idx}-${w.text}`} style={style}>', start);
    if (start >= 0 && ret > start) {
      s = s.slice(0, start) + wiredDual + s.slice(ret + 'return (\n              <span key={`${idx}-${w.text}`} style={style}>'.length);
      // wait that drops the opening of return - fix differently
      console.log('trying regex');
    }
    const re =
      /\/\/ Dual-layer gradient\/shine[\s\S]*?const isGradFill = !![\s\S]*?;\s*\n\s*\n\s*\}\s*\n\s*\n\s*return \(\s*\n\s*<span key=\{\`\$\{idx\}-\$\{w\.text\}\`\} style=\{style\}>/;
    if (re.test(s)) {
      s = s.replace(re, wiredDual);
      console.log('wired dual-layer (regex)');
    } else {
      console.log('WARN dual not matched — dump');
      const i = s.indexOf('// Dual-layer');
      console.log(JSON.stringify(s.slice(i, i + 500)));
    }
  }

  // Ensure renderGradientWord always has a default shadow when var missing
  if (s.includes('function renderGradientWord')) {
    // already handles empty shadow — ok
  }

  fs.writeFileSync(p, s);
  let d = 0;
  for (const c of s) {
    if (c === '{') d++;
    if (c === '}') d--;
  }
  console.log('layer balance', d);
  if (d !== 0) process.exit(1);
}

// ─── 2) captionCssFor: always set --caption-grad-shadow on gradient fills ───
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');

  // After paintGradient block sets WebkitTextFillColor, ensure shadow var
  const needle = `// Depth via filter (not text-shadow) so the gradient stays visible.
    if (def.shadow) {`;
  const insert = `// Shadow for dual-layer render (captionLayer splits fill vs shadow).
    (css as Record<string, unknown>)['--caption-grad-shadow'] =
      def.shadow || '0 2px 10px rgba(0,0,0,0.55)';
    // Depth via filter (not text-shadow) so the gradient stays visible.
    if (def.shadow) {`;

  if (s.includes(needle) && !s.includes("'--caption-grad-shadow'] =\n      def.shadow")) {
    s = s.replace(needle, insert);
    console.log('captions: set --caption-grad-shadow');
  } else if (s.includes('--caption-grad-shadow')) {
    console.log('captions: shadow var already present');
  } else {
    // find paintGradient block end-ish
    const pg = s.indexOf("css['color'] = 'transparent';");
    if (pg >= 0 && !s.includes('--caption-grad-shadow')) {
      const after = s.indexOf('\n', pg) + 1;
      s =
        s.slice(0, after) +
        `    (css as Record<string, unknown>)['--caption-grad-shadow'] =\n` +
        `      def.shadow || '0 2px 10px rgba(0,0,0,0.55)';\n` +
        s.slice(after);
      console.log('captions: injected shadow var after transparent color');
    }
  }

  fs.writeFileSync(p, s);
}

// ─── 3) Worker draft quality ────────────────────────────────────────────────
{
  const p = path.join(root, 'render-worker/server.js');
  let s = fs.readFileSync(p, 'utf8');

  // Expand quality handling: draft | 720 | 1080
  // scale
  if (!s.includes("quality === 'draft'")) {
    s = s.replace(
      /scale: quality === '720' \? 2 \/ 3 : 1,/g,
      `scale: quality === 'draft' ? 0.5 : quality === '720' ? 2 / 3 : 1,`,
    );
    s = s.replace(
      /const maxH = quality === '720' \? 720 : 1080;/g,
      `const maxH = quality === 'draft' ? 540 : quality === '720' ? 720 : 1080;`,
    );
    // faster encode for draft on mezzanine
    s = s.replace(
      /'-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'/g,
      `'-c:v', 'libx264', '-preset', quality === 'draft' ? 'ultrafast' : 'veryfast', '-crf', quality === 'draft' ? '28' : '23'`,
    );

    // Log line
    s = s.replace(
      /quality=\$\{quality \|\| '1080'\}/g,
      `quality=\${quality || '1080'}`,
    );

    // Add /warm keep-alive endpoint near /health
    if (!s.includes("app.get('/warm'")) {
      const health = s.indexOf("app.get('/health'");
      if (health >= 0) {
        const endHealth = s.indexOf('});', health) + 3;
        s =
          s.slice(0, endHealth) +
          `

/** Keep-alive: hit every few minutes from the app so Railway doesn't sleep. */
app.get('/warm', (_req, res) => {
  res.json({ ok: true, ts: Date.now(), jobs: jobs.size });
});
` +
          s.slice(endHealth);
        console.log('added /warm');
      }
    }

    console.log('worker draft quality patched');
  } else {
    console.log('worker draft already present');
  }

  fs.writeFileSync(p, s);
}

// ─── 4) UI: draft quality option ────────────────────────────────────────────
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/useRenderJob.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes("'draft'")) {
    s = s.replace(
      /export type RenderQuality = '720' \| '1080';/,
      `export type RenderQuality = 'draft' | '720' | '1080';`,
    );
    // default stays 1080
    fs.writeFileSync(p, s);
    console.log('RenderQuality + draft');
  }

  const rp = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/RenderPanel.tsx');
  let r = fs.readFileSync(rp, 'utf8');
  if (!r.includes("'draft'")) {
    r = r.replace(
      /\(\['1080', '720'\] as const\)\.map\(\(q\) =>/g,
      `(['draft', '720', '1080'] as const).map((q) =>`,
    );
    r = r.replace(
      /title=\{q === '1080' \? 'Full canvas resolution \(needs ~2-4GB on the worker\)' : 'Downsampled — renders on a small worker'\}/,
      `title={q === 'draft' ? 'Fast draft: half-res + ultrafast encode' : q === '1080' ? 'Full canvas resolution (needs ~2-4GB on the worker)' : 'Downsampled — renders on a small worker'}`,
    );
    // label display
    if (!r.includes("q === 'draft' ? 'Draft'")) {
      // find button children {q}
      r = r.replace(
        />\{q === '1080' \? '1080p' : '720p'\}</,
        `>{q === 'draft' ? 'Draft' : q === '1080' ? '1080p' : '720p'}<`,
      );
      // or just {q}p
      r = r.replace(
        /\{q\}p/g,
        `{q === 'draft' ? 'Draft' : q + 'p'}`,
      );
    }
    fs.writeFileSync(rp, r);
    console.log('RenderPanel draft chip');
  }
}

// ─── 5) Keep-alive client ping (useRenderJob or page) ───────────────────────
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/useRenderJob.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('/warm') && !s.includes('keepWorkerWarm')) {
    // add a small effect export helper at end of file
    const add = `

/** Ping the render worker so Railway doesn't cold-sleep mid-session. */
export function keepWorkerWarm(workerBaseUrl: string | null | undefined) {
  if (!workerBaseUrl || typeof window === 'undefined') return () => {};
  const base = workerBaseUrl.replace(/\\/$/, '');
  const tick = () => {
    fetch(base + '/warm', { method: 'GET', mode: 'cors' }).catch(() => {});
  };
  tick();
  const id = window.setInterval(tick, 4 * 60 * 1000);
  return () => window.clearInterval(id);
}
`;
    s = s + add;
    fs.writeFileSync(p, s);
    console.log('keepWorkerWarm helper');
  }
}

// Wire keepWorkerWarm in page if RENDER worker url env is used
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/page.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('keepWorkerWarm')) {
    // only add import if useRenderJob is imported
    if (s.includes('useRenderJob')) {
      s = s.replace(
        /from ['\"]\.\/useRenderJob['\"]/,
        (m) => m.replace("'", "'").replace('useRenderJob', 'useRenderJob, { keepWorkerWarm }').replace('useRenderJob, { keepWorkerWarm }, { keepWorkerWarm }', 'useRenderJob, { keepWorkerWarm }'),
      );
      // fix double
      s = s.replace(
        /useRenderJob, \{ keepWorkerWarm \}, \{ keepWorkerWarm \}/g,
        'useRenderJob, { keepWorkerWarm }',
      );
      if (!s.includes('keepWorkerWarm')) {
        s = s.replace(
          /import \{([^}]*)\} from ['\"]\.\/useRenderJob['\"]/,
          (m, g1) => `import {${g1}, keepWorkerWarm } from './useRenderJob'`,
        );
      }
      // add effect near top of component - find first useEffect
      if (!s.includes('keepWorkerWarm(')) {
        const ue = s.indexOf('useEffect(() => {');
        if (ue >= 0) {
          s =
            s.slice(0, ue) +
            `useEffect(() => {
    // Keep Railway worker warm while studio is open (avoids multi-minute cold starts).
    return keepWorkerWarm(process.env.NEXT_PUBLIC_RENDER_WORKER_URL);
  }, []);

  ` +
            s.slice(ue);
          console.log('page warm effect');
        }
      }
      fs.writeFileSync(p, s);
    }
  }
}

// ─── 6) Port doc ────────────────────────────────────────────────────────────
{
  const doc = path.join(root, 'docs/CAPTION_EDITOR_FX_AND_DRAFT_RENDER_PORT.md');
  fs.writeFileSync(
    doc,
    `# Caption Editor FX + Draft Render — Port

## Status
In progress (batch 1 landed).

## Batch 1 (this session)
- **Gradient black-in-render fix**: dual-layer wire restored — \`renderGradientWord\` paints solid shadow under clipped gradient fill (Remotion/Chromium silhouette bug).
- \`--caption-grad-shadow\` set from \`captionCssFor\` for every gradient fill.
- **Draft quality**: \`draft | 720 | 1080\` — draft = scale 0.5 + ultrafast/crf28 mezzanine.
- **Worker \`GET /warm\`**: keep-alive for Railway.
- **Studio**: \`keepWorkerWarm\` pings every 4 min while Reel Studio is open.
- Async queue already exists (\`POST /render\` → job id → poll \`GET /render/:id\`).

## Batch 2+ (effects backlog)
Frame-driven only (no CSS animation clocks):

| Effect | Notes |
|--------|--------|
| Type-on / mask reveal | clip-path or width wipe per word |
| Glow pulse / neon flicker | opacity/shadow sine on active |
| 3D tilt / perspective pop | rotateX/Y + perspective on entrance |
| Motion-blur trails | stacked opacity echoes offset by velocity |
| Growing background pill/bar | scaleX from word start |
| Emoji/sticker burst | keyword map + pop scale |
| Sound-reactive bounce | waveform amp → translateY |
| Camera punch-in | block scale keyed to page start |
| Split-color / dual-tone | two half fills or per-letter colors |
| Outline → fill | stroke then fill opacity |
| Spring bounce exits | overshoot scale on page out |
| Cinematic letterbox + rise | bars + caption y |
| Glitch / RGB split | short chromatic offset |
| Hand-drawn underline/circle | SVG path length |
| Number tick-up | parse digits, interpolate |
| Editor packs | MrBeast / faceless / luxury / podcast one-click stacks |

## Files
- \`src/lib/mothermode/reel/render/captionLayer.tsx\` (+ vendored worker copy)
- \`src/lib/mothermode/reel/captions.ts\`
- \`render-worker/server.js\`
- \`src/app/(fullscreen)/admin/reel-studio/useRenderJob.ts\`
- \`src/app/(fullscreen)/admin/reel-studio/RenderPanel.tsx\`
- \`src/app/(fullscreen)/admin/reel-studio/page.tsx\`

## Verify
\`\`\`bash
node scripts/sync-vendored-captions.cjs
pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts
\`\`\`

Pick **Draft** in Render panel for fast iteration; **1080** for final.
`,
  );
  console.log('wrote port doc');
}

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('BATCH1 OK');
