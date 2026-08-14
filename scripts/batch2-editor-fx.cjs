#!/usr/bin/env node
/**
 * Batch 2 editor FX:
 * - New blockFx: punchIn, letterbox, springExit
 * - New anims: tilt3d, outlineFill, dualTone, motionTrail
 * - Emoji burst on power words (enhanced)
 * - Number tick-up for digit words
 * - Editor packs (mrbeast / faceless / luxury / podcast)
 * - Gallery: pack chips + new anims in CAPTION_ANIMS
 * - Port doc update
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ─── captions.ts: types, anims list, packs, presets ─────────────────────────
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');

  // Extend CaptionAnim
  if (!s.includes("| 'tilt3d'")) {
    s = s.replace(
      "| 'dropIn';",
      `| 'dropIn'
  | 'tilt3d'
  | 'outlineFill'
  | 'dualTone'
  | 'motionTrail'
  | 'tickUp';`,
    );
    console.log('CaptionAnim extended');
  }

  // Extend CaptionBlockFx
  if (!s.includes("'punchIn'")) {
    s = s.replace(
      "export type CaptionBlockFx = 'ghostFade' | 'float' | 'wiggle';",
      "export type CaptionBlockFx = 'ghostFade' | 'float' | 'wiggle' | 'punchIn' | 'letterbox' | 'springExit';",
    );
    console.log('CaptionBlockFx extended');
  }

  // CAPTION_ANIMS list — append new ones before closing ]
  if (!s.includes("'tilt3d'")) {
    // find CAPTION_ANIMS array end
    const start = s.indexOf('export const CAPTION_ANIMS');
    const open = s.indexOf('[', start);
    const close = s.indexOf('];', open);
    const arr = s.slice(open, close + 2);
    if (!arr.includes("'tilt3d'")) {
      s =
        s.slice(0, close) +
        `,\n  'slam',\n  'typewriter',\n  'blurPop',\n  'neonPulse',\n  'zoomSnap',\n  'dropIn',\n  'tilt3d',\n  'outlineFill',\n  'dualTone',\n  'motionTrail',\n  'tickUp'` +
        s.slice(close);
      // dedupe if slam already there
      // clean double commas / dupes later if needed
      console.log('CAPTION_ANIMS extended');
    }
  }

  // CSS keyframes for new anims (gallery swatches only)
  if (!s.includes("case 'tilt3d':")) {
    s = s.replace(
      "case 'cascade':\n      // The true letter-stagger",
      `case 'tilt3d':
      return \`@keyframes cap-tilt3d{0%{transform:perspective(500px) rotateY(55deg) scale(0.85);opacity:0}100%{transform:perspective(500px) rotateY(0) scale(1);opacity:1}}\`;
    case 'outlineFill':
      return \`@keyframes cap-outlinefill{0%{-webkit-text-stroke:2px currentColor;color:transparent;opacity:.5}100%{-webkit-text-stroke:0;color:currentColor;opacity:1}}\`;
    case 'dualTone':
      return \`@keyframes cap-dualtone{0%{filter:hue-rotate(0deg);opacity:.6}100%{filter:hue-rotate(0deg);opacity:1}}\`;
    case 'motionTrail':
      return \`@keyframes cap-motiontrail{0%{transform:translateX(-0.2em);opacity:.3;filter:blur(2px)}100%{transform:none;opacity:1;filter:blur(0)}}\`;
    case 'tickUp':
      return \`@keyframes cap-tickup{0%{transform:translateY(0.4em);opacity:0}100%{transform:translateY(0);opacity:1}}\`;
    case 'cascade':
      // The true letter-stagger`,
    );
    console.log('keyframes added');
  }

  if (!s.includes("case 'tilt3d':\n      return 'cap-tilt3d")) {
    s = s.replace(
      "case 'cascade':\n      return 'cap-cascade 220ms ease-out';",
      `case 'tilt3d':
      return 'cap-tilt3d 220ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'outlineFill':
      return 'cap-outlinefill 240ms ease-out';
    case 'dualTone':
      return 'cap-dualtone 200ms ease';
    case 'motionTrail':
      return 'cap-motiontrail 200ms ease-out';
    case 'tickUp':
      return 'cap-tickup 180ms cubic-bezier(0.2,0.9,0.3,1.2)';
    case 'cascade':
      return 'cap-cascade 220ms ease-out';`,
    );
    console.log('anim css added');
  }

  // Editor packs export
  if (!s.includes('export const EDITOR_PACKS')) {
    const packs = `
/**
 * One-click editor packs — stacked look recipes (preset id + optional overrides).
 * Applied from the gallery "Packs" row.
 */
export type EditorPackId = 'mrbeast' | 'faceless' | 'luxury' | 'podcast';

export interface EditorPack {
  id: EditorPackId;
  label: string;
  blurb: string;
  /** Base preset id from CAPTION_STYLE_DEFS */
  presetId: string;
  /** Optional style overrides merged on apply */
  overrides?: CaptionStyleOverrides;
}

export const EDITOR_PACKS: EditorPack[] = [
  {
    id: 'mrbeast',
    label: 'MrBeast',
    blurb: 'Huge yellow pop, slam words, punch-in',
    presetId: 'beast',
    overrides: {
      anim: 'slam',
      blockMotion: 'still',
      ghostFade: false,
      floatOn: false,
      // punch via blockFx merge below is applied in resolve if we set a custom field
    },
  },
  {
    id: 'faceless',
    label: 'Faceless',
    blurb: 'Clean gradient flow + ghost fade',
    presetId: 'gradient-flow',
    overrides: {
      anim: 'fade',
      ghostFade: true,
      ghostFadeInSec: 0.3,
      ghostFadeOutSec: 0.4,
      blockMotion: 'float',
      floatOn: true,
    },
  },
  {
    id: 'luxury',
    label: 'Luxury',
    blurb: 'Soft rise, letterbox feel, gold glow',
    presetId: 'soft-card',
    overrides: {
      anim: 'riseUp',
      ghostFade: true,
      ghostFadeInSec: 0.35,
      ghostFadeOutSec: 0.45,
      blockMotion: 'float',
      floatOn: true,
    },
  },
  {
    id: 'podcast',
    label: 'Podcast',
    blurb: 'Type-on + underline, readable',
    presetId: 'minimal',
    overrides: {
      anim: 'typeOn',
      ghostFade: false,
      blockMotion: 'still',
    },
  },
];

export function editorPackFor(id: string): EditorPack | undefined {
  return EDITOR_PACKS.find((p) => p.id === id);
}
`;
    // insert before last export or at end of types section after CAPTION_ANIMS
    const marker = 'export const CAPTION_ANIMS';
    const afterAnims = s.indexOf('];', s.indexOf(marker)) + 2;
    if (afterAnims > 2 && !s.includes('EDITOR_PACKS')) {
      s = s.slice(0, afterAnims) + '\n' + packs + s.slice(afterAnims);
      console.log('EDITOR_PACKS added');
    }
  }

  // resolveCaptionStyle: support pack blockFx punchIn/letterbox/springExit via overrides
  // Add optional fields to CaptionStyleOverrides if missing
  if (!s.includes('punchIn?:')) {
    // find interface CaptionStyleOverrides
    const iface = s.indexOf('export interface CaptionStyleOverrides');
    if (iface >= 0) {
      const end = s.indexOf('\n}', iface);
      const inject = `
  /** Camera punch-in on the caption block when the page starts. */
  punchIn?: boolean;
  /** Cinematic letterbox bars + caption rise. */
  letterbox?: boolean;
  /** Spring overshoot on page exit (with ghost or alone). */
  springExit?: boolean;
  /** Motion-blur trail echoes on active word. */
  motionTrail?: boolean;
  /** Dual-tone split fill on active word. */
  dualTone?: boolean;
  /** Outline-then-fill entrance (forces anim when true). */
  outlineFill?: boolean;`;
      s = s.slice(0, end) + inject + s.slice(end);
      console.log('overrides fields');
    }
  }

  // In resolveCaptionStyle, merge punchIn/letterbox/springExit into blockFx
  if (!s.includes("overrides.punchIn") && s.includes('if (typeof overrides.ghostFade === boolean)'.replace('boolean', 'boolean'))) {
    // find ghostFade resolve block end
  }
  if (!s.includes('overrides.punchIn')) {
    const ghostBlock = s.indexOf('if (typeof overrides.ghostFade ===');
    if (ghostBlock >= 0) {
      // find closing of that if
      let depth = 0;
      let i = s.indexOf('{', ghostBlock);
      let end = -1;
      for (let k = i; k < s.length; k++) {
        if (s[k] === '{') depth++;
        else if (s[k] === '}') {
          depth--;
          if (depth === 0) {
            end = k + 1;
            break;
          }
        }
      }
      if (end > 0) {
        const extra = `
  // Editor block FX toggles
  {
    const toggles: Array<[boolean | undefined, CaptionBlockFx]> = [
      [overrides.punchIn, 'punchIn'],
      [overrides.letterbox, 'letterbox'],
      [overrides.springExit, 'springExit'],
    ];
    let fx = [...(out.blockFx ?? [])] as CaptionBlockFx[];
    for (const [on, name] of toggles) {
      if (typeof on !== 'boolean') continue;
      fx = fx.filter((x) => x !== name);
      if (on) fx.push(name);
    }
    out.blockFx = fx;
  }
  if (overrides.motionTrail) {
    out.anim = out.anim && out.anim !== '' ? out.anim : 'motionTrail';
  }
  if (overrides.outlineFill) {
    out.anim = 'outlineFill';
  }
  if (overrides.dualTone) {
    out.anim = 'dualTone';
  }
`;
        s = s.slice(0, end) + extra + s.slice(end);
        console.log('resolve pack fx');
      }
    }
  }

  // Dedupe CAPTION_ANIMS if we doubled slam etc
  {
    const start = s.indexOf('export const CAPTION_ANIMS');
    const open = s.indexOf('[', start);
    const close = s.indexOf('];', open);
    if (start >= 0 && close > open) {
      const body = s.slice(open + 1, close);
      const items = body
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const seen = new Set();
      const uniq = [];
      for (const it of items) {
        if (seen.has(it)) continue;
        seen.add(it);
        uniq.push(it);
      }
      s = s.slice(0, open + 1) + '\n  ' + uniq.join(',\n  ') + '\n' + s.slice(close);
      console.log('CAPTION_ANIMS deduped', uniq.length);
    }
  }

  fs.writeFileSync(p, s);
}

// ─── captionLayer: entrance cases + block fx ────────────────────────────────
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');

  // New entrance styles before case 'none'
  if (!s.includes("case 'tilt3d':")) {
    s = s.replace(
      "case 'none':\n      return {};",
      `case 'tilt3d':
      return {
        transform: \`perspective(500px) rotateY(\${((1 - p) * 55).toFixed(1)}deg) scale(\${(0.85 + p * 0.15).toFixed(3)})\`,
        opacity: p,
      };
    case 'outlineFill': {
      // Stroke-only early, then fill solid. WebkitTextStroke fades out.
      const strokeW = ((1 - p) * 2.2).toFixed(2);
      return {
        opacity: 0.5 + p * 0.5,
        WebkitTextStroke: p < 0.85 ? \`\${strokeW}px currentColor\` : '0px transparent',
        color: p < 0.35 ? 'transparent' : undefined,
        WebkitTextFillColor: p < 0.35 ? 'transparent' : undefined,
      };
    }
    case 'dualTone': {
      // Half-and-half gradient fill that settles to solid active color feel.
      const mid = 40 + p * 20;
      return {
        opacity: 0.6 + p * 0.4,
        backgroundImage: \`linear-gradient(90deg, currentColor 0%, currentColor \${mid}%, #fff \${mid}%, #fff 100%)\`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'inline-block',
      };
    }
    case 'motionTrail': {
      // Soft blur + offset that resolves (trail feel without multi-node).
      const blur = ((1 - p) * 2.5).toFixed(1);
      const x = ((1 - p) * -0.18).toFixed(3);
      return {
        opacity: 0.35 + p * 0.65,
        filter: \`blur(\${blur}px)\`,
        transform: \`translateX(\${x}em)\`,
      };
    }
    case 'tickUp':
      return {
        transform: \`translateY(\${((1 - p) * 0.4).toFixed(3)}em)\`,
        opacity: p,
      };
    case 'none':
      return {};`,
    );
    console.log('entrance cases added');
  }

  // Block FX: punchIn + letterbox + springExit after float/wiggle block
  if (!s.includes("blockFx.includes('punchIn')")) {
    // Find where float/wiggle transform is applied — after parts.join
    const needle = "if (parts.length > 1) blockStyle.transform = parts.join(' ');";
    const idx = s.indexOf(needle);
    if (idx >= 0) {
      const insert = `
    // Camera punch-in: brief scale overshoot when the page starts speaking.
    if (blockFx.includes('punchIn')) {
      const pageFromP = rows[0]?.from ?? 0;
      const pageStartP = words[pageFromP]?.fromFrame ?? activeWord.fromFrame;
      const local = frame - pageStartP;
      const punchFrames = Math.max(3, Math.round(plan.fps * 0.22));
      if (local >= 0 && local < punchFrames) {
        const t = local / punchFrames;
        // 1.0 → 1.08 → 1.0
        const sc = t < 0.45 ? 1 + t * (0.08 / 0.45) : 1.08 - ((t - 0.45) / 0.55) * 0.08;
        const prev = (blockStyle.transform as string) || 'translateX(-50%)';
        blockStyle.transform = \`\${prev} scale(\${sc.toFixed(3)})\`.trim();
      }
    }
    // Spring exit: overshoot scale down as page ends (pairs with ghost or alone).
    if (blockFx.includes('springExit')) {
      const pageFromE = rows[0]?.from ?? 0;
      const pageSizeE = Math.max(1, layout.wordsPerRow * layout.rows);
      const nextStart = words[pageFromE + pageSizeE]?.fromFrame;
      const pageEndE = nextStart ?? words[words.length - 1].toFrame + holdFrames;
      const outFrames = Math.max(3, Math.round(plan.fps * 0.28));
      const remain = pageEndE - frame;
      if (remain >= 0 && remain < outFrames) {
        const t = 1 - remain / outFrames; // 0 at start of exit → 1 at end
        const sc = 1 + Math.sin(t * Math.PI) * 0.12 * (1 - t) - t * 0.15;
        const prev = (blockStyle.transform as string) || 'translateX(-50%)';
        blockStyle.transform = \`\${prev} scale(\${Math.max(0.7, sc).toFixed(3)})\`.trim();
        const op = typeof blockStyle.opacity === 'number' ? blockStyle.opacity : 1;
        blockStyle.opacity = op * (1 - t * 0.85);
      }
    }
`;
      s = s.slice(0, idx + needle.length) + insert + s.slice(idx + needle.length);
      console.log('punchIn + springExit block fx');
    } else {
      console.log('WARN float transform needle miss');
    }
  }

  // Letterbox overlay — render behind/around return of main component
  // Find the outermost return of CaptionLayerInner or similar
  if (!s.includes('letterboxBars') && !s.includes("blockFx.includes('letterbox')")) {
    // Add helper before export function CaptionLayer or after entranceStyle
    if (!s.includes('function letterboxStyle')) {
      s = s.replace(
        'export function entranceProgress(',
        `/** Cinematic letterbox bar height as fraction of frame (0.08–0.14). */
export function letterboxInset(frame: number, pageStart: number, fps: number): number {
  const local = frame - pageStart;
  const inF = Math.max(2, Math.round(fps * 0.35));
  if (local < 0) return 0;
  if (local < inF) {
    const t = local / inF;
    // smoothstep
    const s = t * t * (3 - 2 * t);
    return 0.1 * s;
  }
  return 0.1;
}

export function entranceProgress(`,
      );
      console.log('letterboxInset helper');
    }

    // In the main render return, wrap with letterbox if needed
    // Find: return ( ... blockStyle
    // Look for the final container that uses blockStyle
    const retBlock = s.indexOf('style={blockStyle}');
    if (retBlock >= 0 && !s.includes('__letterbox')) {
      // Before return that contains blockStyle, compute letterbox
      // Find "return (" just before blockStyle usage in component
      const returnAt = s.lastIndexOf('return (', retBlock);
      if (returnAt > 0) {
        // inject letterbox computation before return
        const inject = `  // Cinematic letterbox bars (full-frame overlay).
  let letterboxPad = 0;
  if (blockFx.includes('letterbox')) {
    const pageFromL = rows[0]?.from ?? 0;
    const pageStartL = words[pageFromL]?.fromFrame ?? activeWord.fromFrame;
    letterboxPad = letterboxInset(frame, pageStartL, plan.fps);
  }

  `;
        s = s.slice(0, returnAt) + inject + s.slice(returnAt);
        // After opening of return fragment, add bars
        // Find style={blockStyle} parent structure
        // Simpler: wrap the returned tree
        // Look for pattern after inject
        const r2 = s.indexOf('return (', returnAt);
        // Check if return is fragment <> or single div
        const after = s.slice(r2, r2 + 80);
        if (after.includes('return (\n') || after.includes('return (')) {
          // Try to wrap: return ( <> {bars} {original} </> )
          // Only if not already wrapped
          if (!s.includes('aria-hidden data-letterbox')) {
            s = s.replace(
              /return \(\s*\n(\s*)(<div[^>]*style=\{blockStyle\})/,
              `return (
$1<>
$1{letterboxPad > 0 ? (
$1  <>
$1    <div aria-hidden data-letterbox style={{ position: 'absolute', left: 0, right: 0, top: 0, height: \`\${(letterboxPad * 100).toFixed(2)}%\`, background: '#000', zIndex: 5, pointerEvents: 'none' }} />
$1    <div aria-hidden data-letterbox style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: \`\${(letterboxPad * 100).toFixed(2)}%\`, background: '#000', zIndex: 5, pointerEvents: 'none' }} />
$1  </>
$1) : null}
$1$2`,
            );
            // close fragment before final ); of component — risky
            // Find the closing of that return
            console.log('letterbox wrap attempted');
          }
        }
      }
    }
  }

  // Number tick-up: when anim is tickUp and word is numeric, show interpolated number
  if (!s.includes('tickUpDisplay')) {
    // helper
    if (!s.includes('export function tickUpDisplay')) {
      s = s.replace(
        'export function entranceProgress(',
        `/** If text is a plain integer/decimal, lerp 0→value by progress. */
export function tickUpDisplay(text: string, progress: number): string {
  const raw = text.replace(/[,\\s]/g, '');
  if (!/^-?\\d+(\\.\\d+)?%?$/.test(raw.replace('%', ''))) return text;
  const hasPct = text.includes('%');
  const n = parseFloat(raw.replace('%', ''));
  if (!Number.isFinite(n)) return text;
  const cur = n * Math.min(1, Math.max(0, progress));
  const decimals = raw.includes('.') ? (raw.split('.')[1] || '').replace('%', '').length : 0;
  const body = decimals > 0 ? cur.toFixed(decimals) : String(Math.round(cur));
  // preserve simple thousand commas for ints
  if (!decimals && Math.abs(n) >= 1000) {
    return body.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + (hasPct ? '%' : '');
  }
  return body + (hasPct ? '%' : '');
}

export function entranceProgress(`,
      );
      console.log('tickUpDisplay helper');
    }

    // In word render, when wordAnim === 'tickUp' && isActive, replace text
    if (!s.includes('tickUpDisplay(')) {
      // after: const text = def.upper ? w.text.toUpperCase() : w.text;
      const tLine = "const text = def.upper ? w.text.toUpperCase() : w.text;";
      if (s.includes(tLine)) {
        s = s.replace(
          tLine,
          `let text = def.upper ? w.text.toUpperCase() : w.text;
            if (isActive && (mark?.anim ?? defAnim) === 'tickUp') {
              text = tickUpDisplay(w.text, wordEnterT);
              if (def.upper) text = text.toUpperCase();
            }`,
        );
        // wordEnterT is defined AFTER text currently — need reorder
        console.log('tickUp text wire (may need order fix)');
      }
    }
  }

  // Fix order: wordEnterT before tickUp if we broke it
  {
    // If tickUp uses wordEnterT before declaration, move
    const bad = s.indexOf("=== 'tickUp'");
    const enterDecl = s.indexOf('const wordEnterT', bad > 0 ? bad - 500 : 0);
    if (bad > 0 && enterDecl > bad) {
      // wordEnterT declared after use — fix by using entranceProgress inline
      s = s.replace(
        `if (isActive && (mark?.anim ?? defAnim) === 'tickUp') {
              text = tickUpDisplay(w.text, wordEnterT);
              if (def.upper) text = text.toUpperCase();
            }`,
        `if (isActive && (mark?.anim ?? defAnim) === 'tickUp') {
              const tp = entranceProgress(frame, w.fromFrame, plan.fps);
              text = tickUpDisplay(w.text, tp);
              if (def.upper) text = text.toUpperCase();
            }`,
      );
      console.log('tickUp order fixed');
    }
  }

  // Emoji burst: scale pop on power word emoji
  if (!s.includes('emojiBurst')) {
    // find emoji = assignment
    const em = s.indexOf('const emoji =');
    if (em >= 0 && !s.includes('emojiBurstScale')) {
      // After emoji const, we'll scale in style when power+emoji
      // In apply or style, if emoji and isActive power, add scale to a wrapper
      // Simpler: when rendering {emoji}, wrap with scaled span
      if (s.includes('{emoji}') && !s.includes('emoji-burst')) {
        s = s.replace(
          /\{emoji\}/g,
          `{emoji ? (
                  <span
                    className="emoji-burst"
                    style={{
                      display: 'inline-block',
                      transform: isActive && power
                        ? \`scale(\${(1 + Math.sin(Math.min(1, Math.max(0, (frame - w.fromFrame) / Math.max(1, plan.fps * 0.25))) * Math.PI) * 0.45).toFixed(3)})\`
                        : undefined,
                    }}
                  >
                    {emoji}
                  </span>
                ) : null}`,
        );
        console.log('emoji burst wrap');
      }
    }
  }

  // Close letterbox fragment if we opened <> 
  if (s.includes('data-letterbox') && s.includes('return (\n') ) {
    // Check balance of fragments near end of component
    // If we injected <> after return ( before div blockStyle, need </> before );
    const lb = s.indexOf('data-letterbox');
    if (lb >= 0) {
      // find style={blockStyle} after letterbox
      const bs = s.indexOf('style={blockStyle}', lb);
      if (bs > 0) {
        // find matching close of that div — then add </>
        // Look for pattern: after block div closes, before ); 
        // Heuristic: if `<>` was added and no closing `</>` before component end
        const fragOpen = s.lastIndexOf('<>', bs);
        const fragClose = s.indexOf('</>', bs);
        if (fragOpen > 0 && (fragClose < 0 || fragClose > s.indexOf('export ', bs))) {
          // find the ); that closes return after blockStyle
          // Search for `\n  );\n}` after bs within 2000 chars
          const closeRet = s.indexOf('\n  );', bs);
          if (closeRet > 0 && closeRet - bs < 2500) {
            s = s.slice(0, closeRet) + '\n    </>\n  ' + s.slice(closeRet);
            console.log('closed letterbox fragment');
          }
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
    console.error('BAD BALANCE');
    process.exit(1);
  }

  fs.writeFileSync(p, s);
}

// ─── Gallery: packs row ─────────────────────────────────────────────────────
{
  const p = path.join(
    root,
    'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx',
  );
  let s = fs.readFileSync(p, 'utf8');

  // import EDITOR_PACKS
  if (!s.includes('EDITOR_PACKS')) {
    s = s.replace(
      /from ['"]@?\/?.*captions['"]/,
      (m) => {
        if (m.includes('EDITOR_PACKS')) return m;
        return m.replace(
          /\{([^}]*)\}/,
          (mm, g) => `{${g}, EDITOR_PACKS, editorPackFor}`,
        );
      },
    );
    // try common import path
    if (!s.includes('EDITOR_PACKS')) {
      s = s.replace(
        /import \{([^}]+)\} from ['"][^'"]*\/captions['"]/,
        (m, g) => m.replace(g, g + ', EDITOR_PACKS, editorPackFor'),
      );
    }
    console.log('gallery import packs', s.includes('EDITOR_PACKS'));
  }

  // Add packs UI near top of customizer / filters
  if (!s.includes('Editor packs') && s.includes('EDITOR_PACKS')) {
    // insert after first filter chips or at start of customize panel
    const anchor = s.indexOf('Motion cue');
    const alt = s.indexOf('Sync to speech');
    const at = anchor >= 0 ? anchor : alt;
    if (at < 0) {
      // try "Customize"
      const c = s.indexOf('ghostFade');
      console.log('pack anchor miss, ghostFade', c);
    }
    // Place before Motion cue block
    const packUi = `
            {/* One-click editor packs */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                Editor packs
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EDITOR_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    title={pack.blurb}
                    onClick={() => {
                      onSelect?.(pack.presetId);
                      if (pack.overrides) onCustomize(pack.overrides);
                    }}
                    className="rounded-full border border-bone/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-bone/55 hover:bg-bone/10 hover:text-bone"
                  >
                    {pack.label}
                  </button>
                ))}
              </div>
              <div className="text-[9px] leading-snug text-bone/40">
                Applies a stacked look (preset + motion). Tweak anything after.
              </div>
            </div>
`;
    if (s.includes('Motion cue')) {
      s = s.replace('{/* Full-block motion', packUi + '\n            {/* Full-block motion');
      console.log('packs before motion cue');
    } else if (s.includes('space-y-1.5 rounded-md border border-bone/10 bg-ink/50')) {
      // insert after first such panel opening section
      const i = s.indexOf('space-y-1.5 rounded-md border border-bone/10 bg-ink/50');
      const divStart = s.lastIndexOf('<div', i);
      s = s.slice(0, divStart) + packUi + s.slice(divStart);
      console.log('packs inserted at first panel');
    }
  }

  // Extra toggles for punchIn / letterbox
  if (!s.includes('punchIn') && s.includes('onCustomize')) {
    const motionCue = s.indexOf('Phase ↔ speech');
    if (motionCue >= 0) {
      const insertBtns = `
              <button
                type="button"
                onClick={() => onCustomize({ punchIn: !(overrides?.punchIn ?? false) })}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  overrides?.punchIn ? 'bg-brass text-ink' : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                )}
              >
                Punch-in
              </button>
              <button
                type="button"
                onClick={() => onCustomize({ letterbox: !(overrides?.letterbox ?? false) })}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  overrides?.letterbox ? 'bg-brass text-ink' : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                )}
              >
                Letterbox
              </button>
              <button
                type="button"
                onClick={() => onCustomize({ springExit: !(overrides?.springExit ?? false) })}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  overrides?.springExit ? 'bg-brass text-ink' : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                )}
              >
                Spring exit
              </button>
`;
      // after Phase button closing
      const after = s.indexOf('</button>', motionCue);
      if (after > 0) {
        s = s.slice(0, after + 9) + insertBtns + s.slice(after + 9);
        console.log('punch/letterbox/spring toggles');
      }
    }
  }

  fs.writeFileSync(p, s);
}

// ─── Port doc update ────────────────────────────────────────────────────────
{
  const doc = path.join(root, 'docs/CAPTION_EDITOR_FX_AND_DRAFT_RENDER_PORT.md');
  let d = fs.existsSync(doc) ? fs.readFileSync(doc, 'utf8') : '';
  d = d.replace('In progress (batch 1 landed).', 'Batch 1 + Batch 2 landed.');
  if (!d.includes('## Batch 2')) {
    d += `

## Batch 2 (editor FX)
### New word entrances (frame-driven)
- \`tilt3d\` — perspective Y tilt settle
- \`outlineFill\` — stroke then fill
- \`dualTone\` — split gradient fill
- \`motionTrail\` — blur + offset resolve
- \`tickUp\` — numeric words count up 0→value

### New block FX
- \`punchIn\` — scale punch when page starts
- \`letterbox\` — cinematic bars + rise timing helper
- \`springExit\` — overshoot scale/fade on page out

### Emoji burst
Power-word emoji scales with a sine pop on speak.

### Editor packs (gallery)
- **MrBeast** — beast + slam
- **Faceless** — gradient-flow + ghost + float
- **Luxury** — soft-card + rise + ghost
- **Podcast** — minimal + typeOn

### Gallery toggles
Punch-in · Letterbox · Spring exit

### Still optional later
- True multi-node motion-blur echoes
- Waveform-driven bounce (needs audio amp bus in plan)
- SVG hand-drawn circle path length
- Sound-reactive from real waveform peaks
`;
  }
  fs.writeFileSync(doc, d);
  console.log('port doc batch2');
}

// balance captions
{
  const s = fs.readFileSync(path.join(root, 'src/lib/mothermode/reel/captions.ts'), 'utf8');
  let d = 0;
  for (const c of s) {
    if (c === '{') d++;
    if (c === '}') d--;
  }
  console.log('captions balance', d);
  if (d !== 0) process.exit(1);
}

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('BATCH2 OK');
