#!/usr/bin/env node
/**
 * Batch 3 — systematic remaining work:
 * 1) Fix CAPTION_ANIMS full list
 * 2) Gallery anim picker + highlight mode (boxGrow pill)
 * 3) boxGrow polish in captionCssFor / layer
 * 4) Hand-drawn circle + underline draw (SVG path)
 * 5) Waveform bounce blockFx (frame amp from optional plan peaks)
 * 6) Deploy/smoke checklist in port doc
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

const FULL_ANIMS = [
  "''",
  "'pop'",
  "'fade'",
  "'slide'",
  "'flip'",
  "'spin'",
  "'bounce'",
  "'blurIn'",
  "'riseUp'",
  "'elastic'",
  "'glitch'",
  "'typeOn'",
  "'shake'",
  "'riseMask'",
  "'springPop'",
  "'neonFlicker'",
  "'glowPulse'",
  "'cascade'",
  "'slam'",
  "'typewriter'",
  "'blurPop'",
  "'neonPulse'",
  "'zoomSnap'",
  "'dropIn'",
  "'tilt3d'",
  "'outlineFill'",
  "'dualTone'",
  "'motionTrail'",
  "'tickUp'",
];

// ─── 1) captions.ts ─────────────────────────────────────────────────────────
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');

  // Fix CAPTION_ANIMS
  {
    const start = s.indexOf('export const CAPTION_ANIMS');
    const open = s.indexOf('[', start);
    const close = s.indexOf('];', open);
    if (start < 0 || close < 0) {
      console.error('CAPTION_ANIMS not found');
      process.exit(1);
    }
    // Don't include empty string '' in the gallery list — use pop as default
    const list = FULL_ANIMS.filter((a) => a !== "''");
    s =
      s.slice(0, open) +
      '[\n  ' +
      list.join(',\n  ') +
      '\n' +
      s.slice(close);
    console.log('CAPTION_ANIMS fixed', list.length);
  }

  // Ensure CaptionStyleOverrides has anim + highlightMode + waveBounce + handDrawn
  if (!s.includes('handDrawn?:')) {
    const iface = s.indexOf('export interface CaptionStyleOverrides');
    if (iface >= 0) {
      const end = s.indexOf('\n}', iface);
      s =
        s.slice(0, end) +
        `
  /** Word-enter animation override. */
  anim?: CaptionAnim | '';
  /** Highlight mode override (color/box/boxGrow/glow/...). */
  highlightMode?: HighlightMode;
  /** Sound-reactive bounce (uses plan.audioPeaks when present). */
  waveBounce?: boolean;
  /** Hand-drawn circle/underline draw-on for active word. */
  handDrawn?: 'underline' | 'circle' | false;
` +
        s.slice(end);
      console.log('overrides: anim/highlight/wave/handDrawn');
    }
  }

  // resolveCaptionStyle: anim + highlightMode + waveBounce + handDrawn
  if (!s.includes('overrides.waveBounce') && s.includes('if (typeof overrides.ghostFade')) {
    // append after punchIn block if present, else after ghostFade
    const marker = s.includes('overrides.punchIn')
      ? s.lastIndexOf('if (overrides.dualTone)')
      : s.indexOf('if (typeof overrides.ghostFade');
    // find a good insertion: after dualTone block
    let insertAt = -1;
    if (s.includes('if (overrides.dualTone)')) {
      const i = s.indexOf('if (overrides.dualTone)');
      const brace = s.indexOf('{', i);
      let d = 0;
      for (let k = brace; k < s.length; k++) {
        if (s[k] === '{') d++;
        else if (s[k] === '}') {
          d--;
          if (d === 0) {
            insertAt = k + 1;
            break;
          }
        }
      }
    }
    if (insertAt < 0) {
      // after ghostFade if
      const i = s.indexOf('if (typeof overrides.ghostFade');
      const brace = s.indexOf('{', i);
      let d = 0;
      for (let k = brace; k < s.length; k++) {
        if (s[k] === '{') d++;
        else if (s[k] === '}') {
          d--;
          if (d === 0) {
            insertAt = k + 1;
            break;
          }
        }
      }
    }
    if (insertAt > 0) {
      const extra = `
  if (typeof overrides.anim === 'string') {
    out.anim = overrides.anim as CaptionAnim;
  }
  if (typeof overrides.highlightMode === 'string' && overrides.highlightMode) {
    out.highlightMode = overrides.highlightMode as HighlightMode;
  }
  if (typeof overrides.waveBounce === 'boolean') {
    let fx = [...(out.blockFx ?? [])] as CaptionBlockFx[];
    fx = fx.filter((x) => x !== 'waveBounce');
    if (overrides.waveBounce) fx.push('waveBounce' as CaptionBlockFx);
    out.blockFx = fx;
  }
  if (overrides.handDrawn === 'underline' || overrides.handDrawn === 'circle') {
    (out as CaptionStyleDef & { handDrawn?: string }).handDrawn = overrides.handDrawn;
  } else if (overrides.handDrawn === false) {
    delete (out as { handDrawn?: string }).handDrawn;
  }
`;
      s = s.slice(0, insertAt) + extra + s.slice(insertAt);
      console.log('resolve anim/highlight/wave/handDrawn');
    }
  }

  // Extend CaptionBlockFx with waveBounce
  if (!s.includes("'waveBounce'")) {
    s = s.replace(
      "export type CaptionBlockFx = 'ghostFade' | 'float' | 'wiggle' | 'punchIn' | 'letterbox' | 'springExit';",
      "export type CaptionBlockFx = 'ghostFade' | 'float' | 'wiggle' | 'punchIn' | 'letterbox' | 'springExit' | 'waveBounce';",
    );
    console.log('waveBounce blockFx');
  }

  // Optional handDrawn on CaptionStyleDef
  if (!s.includes('handDrawn?:') || !s.includes("handDrawn?: 'underline'")) {
    // on CaptionStyleDef
    const def = s.indexOf('export interface CaptionStyleDef');
    if (def >= 0 && !s.slice(def, def + 2000).includes('handDrawn?:')) {
      const end = s.indexOf('\n}', def);
      s =
        s.slice(0, end) +
        `
  /** Hand-drawn accent on the active word. */
  handDrawn?: 'underline' | 'circle';
` +
        s.slice(end);
      console.log('CaptionStyleDef.handDrawn');
    }
  }

  // boxGrow polish comment already exists — ensure active path uses scaleX grow via layer
  // Add highlightModes export for gallery
  if (!s.includes('export const HIGHLIGHT_MODES')) {
    const afterAnims = s.indexOf('export const CAPTION_ANIMS');
    const close = s.indexOf('];', afterAnims) + 2;
    s =
      s.slice(0, close) +
      `

/** Highlight modes the customizer can pick. */
export const HIGHLIGHT_MODES: HighlightMode[] = [
  'color',
  'box',
  'boxGrow',
  'scale',
  'glow',
  'underline',
  'sweep',
  'gradient',
];
` +
      s.slice(close);
    console.log('HIGHLIGHT_MODES');
  }

  // EDITOR_PACKS may reference CaptionStyleOverrides before definition — move packs after overrides if needed
  // Check if CaptionStyleOverrides is after EDITOR_PACKS
  const packsAt = s.indexOf('export const EDITOR_PACKS');
  const ovAt = s.indexOf('export interface CaptionStyleOverrides');
  if (packsAt >= 0 && ovAt > packsAt) {
    console.log('NOTE: EDITOR_PACKS before CaptionStyleOverrides (TS type-only OK)');
  }

  // Fix mrbeast pack to include punchIn
  s = s.replace(
    `overrides: {
      anim: 'slam',
      blockMotion: 'still',
      ghostFade: false,
      floatOn: false,
      // punch via blockFx merge below is applied in resolve if we set a custom field
    },`,
    `overrides: {
      anim: 'slam',
      blockMotion: 'still',
      ghostFade: false,
      floatOn: false,
      punchIn: true,
    },`,
  );

  fs.writeFileSync(p, s);
  let d = 0;
  for (const c of s) {
    if (c === '{') d++;
    if (c === '}') d--;
  }
  console.log('captions balance', d);
  if (d !== 0) process.exit(1);
}

// ─── 2) captionLayer: boxGrow, handDrawn, waveBounce ────────────────────────
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');

  // waveBounce on block
  if (!s.includes("blockFx.includes('waveBounce')")) {
    const needle = "if (blockFx.includes('punchIn'))";
    const idx = s.indexOf(needle);
    if (idx >= 0) {
      const insert = `
    // Waveform bounce: bob amplitude from optional plan.audioPeaks, else gentle sine.
    if (blockFx.includes('waveBounce')) {
      const peaks = (plan as { audioPeaks?: number[] }).audioPeaks;
      let amp = 0.06;
      if (peaks && peaks.length > 0) {
        const tSec = frame / Math.max(1, plan.fps);
        // peaks cover full composition duration roughly
        const totalSec = Math.max(1, (plan as { durationFrames?: number }).durationFrames
          ? ((plan as { durationFrames: number }).durationFrames / plan.fps)
          : peaks.length / 30);
        const u = Math.min(0.999, Math.max(0, tSec / totalSec));
        const pi = Math.floor(u * peaks.length);
        amp = 0.04 + (peaks[pi] ?? 0) * 0.14;
      } else {
        amp = 0.05 + 0.03 * Math.abs(Math.sin(frame * 0.21));
      }
      const y = Math.sin(frame * 0.35) * amp;
      const prev = (blockStyle.transform as string) || 'translateX(-50%)';
      blockStyle.transform = \`\${prev} translateY(\${y.toFixed(3)}em)\`.trim();
    }
`;
      s = s.slice(0, idx) + insert + s.slice(idx);
      console.log('waveBounce block');
    }
  }

  // boxGrow: ensure active word gets scaleX grow on background
  // Already in captionCssFor for boxGrow — enhance layer for active boxGrow with wordSpanGrow
  if (!s.includes('boxGrowBg')) {
    // After style is built for active word, if highlightMode boxGrow, set background scale via pseudo-like nested span
    // Simpler: when def.highlightMode === 'boxGrow' && isActive, add a growing bg span like marker
    const markerFx = s.indexOf("mark?.fx === 'marker'");
    if (markerFx >= 0) {
      const inject = `{def.highlightMode === 'boxGrow' && isActive ? (
                  <span
                    aria-hidden
                    className="boxGrowBg"
                    style={{
                      position: 'absolute',
                      inset: '-0.08em -0.18em',
                      background: def.activeBg ?? 'rgba(255,255,255,0.2)',
                      borderRadius: '0.2em',
                      zIndex: -1,
                      transformOrigin: 'left center',
                      transform: \`scaleX(\${wordSpanGrow(frame, w.fromFrame, plan.fps).toFixed(3)})\`,
                    }}
                  />
                ) : null}
                `;
      s = s.slice(0, markerFx) + inject + s.slice(markerFx);
      console.log('boxGrow growing pill');
    }
  }

  // Hand-drawn underline / circle SVG
  if (!s.includes('hand-drawn-accent')) {
    const under = s.indexOf("mark?.fx === 'underline'");
    if (under >= 0) {
      // insert after underline block ends — find next mark?.fx after underline
      // Add before closing of word span content: handDrawn from def
      const inject = `
                {(def as { handDrawn?: string }).handDrawn === 'underline' && isActive ? (
                  <svg
                    className="hand-drawn-accent"
                    aria-hidden
                    viewBox="0 0 100 12"
                    preserveAspectRatio="none"
                    style={{
                      position: 'absolute',
                      left: '-4%',
                      right: '-4%',
                      bottom: '-0.18em',
                      width: '108%',
                      height: '0.28em',
                      overflow: 'visible',
                      pointerEvents: 'none',
                    }}
                  >
                    <path
                      d="M2,8 Q25,2 50,7 T98,6"
                      fill="none"
                      stroke={(css.active.color as string) || '#F8E16C'}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - wordSpanGrow(frame, w.fromFrame, plan.fps)}
                    />
                  </svg>
                ) : null}
                {(def as { handDrawn?: string }).handDrawn === 'circle' && isActive ? (
                  <svg
                    className="hand-drawn-accent"
                    aria-hidden
                    viewBox="0 0 100 60"
                    preserveAspectRatio="none"
                    style={{
                      position: 'absolute',
                      left: '-12%',
                      top: '-35%',
                      width: '124%',
                      height: '170%',
                      overflow: 'visible',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    <ellipse
                      cx="50"
                      cy="30"
                      rx="46"
                      ry="24"
                      fill="none"
                      stroke={(css.active.color as string) || '#F8E16C'}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - wordSpanGrow(frame, w.fromFrame, plan.fps)}
                      transform="rotate(-6 50 30)"
                    />
                  </svg>
                ) : null}
`;
      // place before mark underline or after emoji
      const em = s.indexOf('{emoji ? (');
      if (em >= 0) {
        // after emoji block — find ); null} after emoji
        const endEm = s.indexOf(') : null}', em);
        if (endEm > 0) {
          s = s.slice(0, endEm + 9) + inject + s.slice(endEm + 9);
          console.log('hand-drawn svg');
        }
      } else {
        const t = s.indexOf('{text}');
        if (t >= 0) {
          s = s.slice(0, t + 6) + inject + s.slice(t + 6);
          console.log('hand-drawn after text');
        }
      }
    }
  }

  let d = 0;
  for (const c of s) {
    if (c === '{') d++;
    if (c === '}') d--;
  }
  console.log('layer balance', d);
  if (d !== 0) {
    console.error('BAD LAYER');
    process.exit(1);
  }
  fs.writeFileSync(p, s);
}

// ─── 3) plan.ts: optional audioPeaks on plan type if exists ─────────────────
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/plan.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('audioPeaks') && s.includes('export interface RenderPlan')) {
    const i = s.indexOf('export interface RenderPlan');
    const end = s.indexOf('\n}', i);
    if (end > 0) {
      s =
        s.slice(0, end) +
        `
  /** Optional 0..1 peak buckets for caption waveBounce (from client waveform). */
  audioPeaks?: number[];
` +
        s.slice(end);
      fs.writeFileSync(p, s);
      console.log('RenderPlan.audioPeaks');
    }
  } else {
    console.log('plan audioPeaks skip/exists');
  }
}

// ─── 4) Gallery: anim picker + highlight + handDrawn + waveBounce ───────────
{
  const p = path.join(
    root,
    'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx',
  );
  let s = fs.readFileSync(p, 'utf8');

  // imports
  if (!s.includes('CAPTION_ANIMS')) {
    s = s.replace(
      /import \{([^}]+)\} from ['"][^'"]*\/captions['"]/,
      (m, g) => {
        let ng = g;
        if (!ng.includes('CAPTION_ANIMS')) ng += ', CAPTION_ANIMS';
        if (!ng.includes('HIGHLIGHT_MODES')) ng += ', HIGHLIGHT_MODES';
        return m.replace(g, ng);
      },
    );
    console.log('import CAPTION_ANIMS', s.includes('CAPTION_ANIMS'));
  }

  // UI block after Editor packs or before Motion
  if (!s.includes('Entrance anim') && s.includes('onCustomize')) {
    const ui = `
            {/* Entrance animation + highlight */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                Entrance anim
              </div>
              <div className="flex flex-wrap gap-1">
                {CAPTION_ANIMS.map((a) => {
                  const cur = overrides?.anim ?? activeDef.anim ?? 'pop';
                  const on = cur === a;
                  return (
                    <button
                      key={a || 'none'}
                      type="button"
                      onClick={() => onCustomize({ anim: a })}
                      className={
                        on
                          ? 'rounded-full bg-brass px-2 py-0.5 text-[9px] font-bold text-ink'
                          : 'rounded-full border border-bone/15 px-2 py-0.5 text-[9px] font-bold text-bone/45 hover:bg-bone/10'
                      }
                    >
                      {a || 'none'}
                    </button>
                  );
                })}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50 pt-1">
                Highlight
              </div>
              <div className="flex flex-wrap gap-1">
                {HIGHLIGHT_MODES.map((h) => {
                  const cur = overrides?.highlightMode ?? activeDef.highlightMode;
                  const on = cur === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onCustomize({ highlightMode: h })}
                      className={
                        on
                          ? 'rounded-full bg-brass px-2 py-0.5 text-[9px] font-bold text-ink'
                          : 'rounded-full border border-bone/15 px-2 py-0.5 text-[9px] font-bold text-bone/45 hover:bg-bone/10'
                      }
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onCustomize({ waveBounce: !(overrides?.waveBounce ?? false) })}
                  className={
                    overrides?.waveBounce
                      ? 'rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink'
                      : 'rounded-full border border-bone/15 px-2.5 py-0.5 text-[9px] font-bold uppercase text-bone/45 hover:bg-bone/10'
                  }
                >
                  Wave bounce
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      handDrawn:
                        overrides?.handDrawn === 'underline' ? false : 'underline',
                    })
                  }
                  className={
                    overrides?.handDrawn === 'underline'
                      ? 'rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink'
                      : 'rounded-full border border-bone/15 px-2.5 py-0.5 text-[9px] font-bold uppercase text-bone/45 hover:bg-bone/10'
                  }
                >
                  Draw underline
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      handDrawn: overrides?.handDrawn === 'circle' ? false : 'circle',
                    })
                  }
                  className={
                    overrides?.handDrawn === 'circle'
                      ? 'rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink'
                      : 'rounded-full border border-bone/15 px-2.5 py-0.5 text-[9px] font-bold uppercase text-bone/45 hover:bg-bone/10'
                  }
                >
                  Draw circle
                </button>
              </div>
            </div>
`;
    if (s.includes('Editor packs')) {
      // after editor packs section — find next motion or Full-block
      if (s.includes('{/* Full-block motion')) {
        s = s.replace('{/* Full-block motion', ui + '\n            {/* Full-block motion');
        console.log('anim UI before motion');
      } else {
        s = s.replace('Editor packs', 'Editor packs');
        // after packs div — hard
        const packs = s.indexOf('Editor packs');
        const closePacks = s.indexOf('</div>\n            </div>', packs);
        if (closePacks > 0) {
          const end = closePacks + '</div>\n            </div>'.length;
          s = s.slice(0, end) + '\n' + ui + s.slice(end);
          console.log('anim UI after packs');
        }
      }
    } else if (s.includes('punchIn')) {
      const i = s.indexOf('punchIn');
      const before = s.lastIndexOf('<div', i);
      s = s.slice(0, before) + ui + s.slice(before);
      console.log('anim UI before punch');
    }
  }

  // clsx may not exist — punch buttons used clsx; check
  if (s.includes('clsx(') && !s.includes("from 'clsx'") && !s.includes('function clsx')) {
    // replace clsx with template
    s = s.replace(
      /className=\{clsx\(\s*'([^']+)',\s*([^)]+)\)\}/g,
      (m, base, cond) => {
        // fragile — leave if import missing add simple
        return m;
      },
    );
    if (!s.includes("import clsx") && s.includes('clsx(')) {
      s = `import clsx from 'clsx';\n` + s;
      // or without dep:
      s = s.replace("import clsx from 'clsx';\n", '');
      // inline helper
      if (!s.includes('function cx(')) {
        s = s.replace(
          /^('use client';\n)/m,
          `$1function cx(...parts: Array<string | false | null | undefined>) {\n  return parts.filter(Boolean).join(' ');\n}\n`,
        );
        s = s.replace(/clsx\(/g, 'cx(');
        console.log('cx helper for clsx');
      }
    }
  }

  fs.writeFileSync(p, s);
}

// ─── 5) Pass audioPeaks into plan if client has waveform ────────────────────
{
  // Search reel-render route for plan build
  const route = path.join(root, 'src/app/api/admin/reel-render/route.ts');
  if (fs.existsSync(route)) {
    let s = fs.readFileSync(route, 'utf8');
    if (!s.includes('audioPeaks') && s.includes('buildRenderPlan')) {
      console.log('reel-render: buildRenderPlan present — peaks optional later');
    }
  }
}

// ─── 6) Port doc ────────────────────────────────────────────────────────────
{
  const doc = path.join(root, 'docs/CAPTION_EDITOR_FX_AND_DRAFT_RENDER_PORT.md');
  let d = fs.readFileSync(doc, 'utf8');
  if (!d.includes('## Batch 3')) {
    d += `

## Batch 3 (systematic)
- Full \`CAPTION_ANIMS\` list restored (incl. slam, tilt3d, outlineFill, dualTone, motionTrail, tickUp, …)
- Gallery **Entrance anim** chip row + **Highlight** mode chips (boxGrow = growing pill)
- **Wave bounce** blockFx (uses \`plan.audioPeaks\` when present, else sine)
- **Hand-drawn** underline / circle (SVG pathLength draw-on)
- \`RenderPlan.audioPeaks?: number[]\`
- Editor pack MrBeast sets \`punchIn: true\`

## Deploy + smoke checklist
1. Redeploy **Railway render worker** (captions + captionLayer vendored).
2. Confirm \`NEXT_PUBLIC_RENDER_WORKER_URL\` points at worker (studio /warm).
3. Reel Studio smoke:
   - [ ] Gradient preset → **Draft** render → colors match canvas (not black)
   - [ ] Ghost fade On → full ON hold OFF
   - [ ] Editor pack Faceless / MrBeast
   - [ ] Entrance anim: typeOn, tilt3d, slam
   - [ ] Highlight: boxGrow (pill grows)
   - [ ] Draw underline / Draw circle on active word
   - [ ] Punch-in + Letterbox + Spring exit + Wave bounce
   - [ ] Final **1080** render of one short clip
4. If worker OOM: stay on Draft/720 or upgrade Railway RAM.
`;
    fs.writeFileSync(doc, d);
    console.log('port doc batch3');
  }
}

// balance layer again
{
  const s = fs.readFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
    'utf8',
  );
  let d = 0;
  for (const c of s) {
    if (c === '{') d++;
    if (c === '}') d--;
  }
  console.log('final layer balance', d);
  if (d !== 0) process.exit(1);
}

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('BATCH3 OK');
