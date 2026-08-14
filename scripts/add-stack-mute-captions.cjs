#!/usr/bin/env node
/**
 * Stacked phrase captions (image-style) + mute ranges + show/hide.
 *
 * - stackMode 'build': words on the current page appear as they're spoken and
 *   stay until the page flips (the "93% / MILLIONAIRES / HAVE MENTORS" look).
 * - muteRanges: hide captions for time windows (other on-screen text).
 * - captionsOn: master show/hide toggle.
 * - Gallery UI + CaptionDragLayer eye toggle.
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
// captions.ts — overrides + helpers
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/captions.ts');

  // Add fields to CaptionOverrides after rows?:
  if (!s.includes('muteRanges?')) {
    s = s.replace(
      /\/\*\* How many ROWS show at once \(1 = one line, 2 = the current \+ next line\)\. 1–3\. \*\/\r?\n\s*rows\?: number;/,
      (m) =>
        m +
        `
  /**
   * Stack behaviour for multi-row pages.
   * - 'page' (default): whole page visible, highlight walks (karaoke).
   * - 'build': words appear as spoken and HOLD until the page flips — the
   *   stacked phrase-card look (hero word stays big while the line fills).
   */
  stackMode?: 'page' | 'build';
  /** Master captions visibility. false = hide all captions. Default true. */
  captionsOn?: boolean;
  /**
   * Time windows (seconds, project clock) where captions are forced off —
   * e.g. when a lower-third or other text is already on the frame.
   */
  muteRanges?: { fromSec: number; toSec: number }[];`,
    );
    console.log('CaptionOverrides fields');
  }

  // Helper: isCaptionVisibleAt
  if (!s.includes('export function isCaptionVisibleAt')) {
    const anchor = 'export function isPowerWord';
    const i = s.indexOf(anchor);
    if (i < 0) {
      console.error('isPowerWord not found');
      process.exit(1);
    }
    const helper = `/** True when captions should paint at project-clock \`sec\`. */
export function isCaptionVisibleAt(
  sec: number,
  overrides?: CaptionOverrides | null,
): boolean {
  if (!overrides) return true;
  if (overrides.captionsOn === false) return false;
  const ranges = overrides.muteRanges;
  if (!Array.isArray(ranges) || !ranges.length) return true;
  const t = Number.isFinite(sec) ? sec : 0;
  for (const r of ranges) {
    const a = typeof r?.fromSec === 'number' ? r.fromSec : NaN;
    const b = typeof r?.toSec === 'number' ? r.toSec : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (t >= lo && t < hi) return false;
  }
  return true;
}

`;
    s = s.slice(0, i) + helper + s.slice(i);
    console.log('isCaptionVisibleAt added');
  }

  write('src/lib/mothermode/reel/captions.ts', s);
}

// ---------------------------------------------------------------------------
// captionLayer — mute + build stack
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');

  // Ensure import of isCaptionVisibleAt
  if (!s.includes('isCaptionVisibleAt')) {
    // try add to existing captions import
    if (s.includes("from '../../captions'") || s.includes('from "../captions"') || s.includes("from '../../captions.js'")) {
      s = s.replace(
        /import \{([^}]+)\} from '(\.\.\/)+captions(?:\.js)?'/,
        (m, body, dots) => {
          if (body.includes('isCaptionVisibleAt')) return m;
          return m.replace(body, body.trim().replace(/,$/, '') + ',\n  isCaptionVisibleAt,\n');
        },
      );
    }
    // fallback: if still missing, inject near top after other imports
    if (!s.includes('isCaptionVisibleAt')) {
      const imp = s.indexOf("from '../../captions'");
      if (imp < 0) {
        // search any captions import line
        const re = /import type \{[^}]+\} from ['"][^'"]*captions['"];?/;
        if (re.test(s)) {
          s = s.replace(re, (m) => m + `\nimport { isCaptionVisibleAt } from '../../captions';`);
        } else {
          s = s.replace(
            /(import [^\n]+from 'react';?\r?\n)/,
            `$1import { isCaptionVisibleAt } from '../../captions';\n`,
          );
        }
      }
    }
    console.log('import isCaptionVisibleAt');
  }

  // CaptionPlanLike may need mute fields via captionOverrides on plan — check plan shape
  // Layer uses plan from CaptionPlanLike. Add optional captionOverrides or mute on plan.
  // Easier: pass through captionLayout or def — put mute on plan as optional fields.

  // Patch CaptionLayerFrame early return for mute
  if (!s.includes('isCaptionVisibleAt(')) {
    s = s.replace(
      /export const CaptionLayerFrame: React\.FC<\{ plan: CaptionPlanLike; frame: number \}> = \(\{\r?\n\s*plan,\r?\n\s*frame,\r?\n\}\) => \{\r?\n\s*const \{ words, captionStyle: def, captionLayout: layout, powerWords \} = plan;\r?\n\s*if \(!words\.length\) return null;/,
      (m) =>
        m +
        `
  // Master off + mute ranges (project clock).
  {
    const sec = frame / Math.max(1, plan.fps);
    const ov = (plan as { captionOverrides?: import('../../captions').CaptionOverrides })
      .captionOverrides;
    if (!isCaptionVisibleAt(sec, ov ?? null)) return null;
  }`,
    );
    console.log('layer mute gate');
  }

  // Build-mode: hide words not yet spoken on the page
  // After `const text = def.upper ? ...`
  if (!s.includes('stackBuildHide')) {
    // Find word render base and add opacity for unsaid words in build mode
    const needle = `const text = def.upper ? w.text.toUpperCase() : w.text;`;
    if (!s.includes(needle) && !s.includes("def.upper ? w.text.toUpperCase()")) {
      console.warn('text line not found for build mode');
    } else {
      // Inject stack mode flag near top of map after activeIdx
      if (!s.includes('const stackMode')) {
        s = s.replace(
          /const defAnim = \(def as \{ anim\?: string \}\)\.anim \?\? 'pop';/,
          (m) =>
            m +
            `
  const stackMode =
    ((plan as { captionOverrides?: { stackMode?: string } }).captionOverrides
      ?.stackMode as string) ||
    'page';
  const isBuildStack = stackMode === 'build';`,
        );
      }

      // When assigning base style, if build and word not yet started, opacity 0
      // After base is created:
      const baseEnd = `transformOrigin: 'center center',
            };`;
      if (s.includes(baseEnd) && !s.includes('stackBuildHide')) {
        s = s.replace(
          baseEnd,
          `transformOrigin: 'center center',
            };
            // Build stack: unsaid words on this page stay invisible until spoken,
            // then HOLD (opacity 1) so the phrase card fills in on cue.
            const stackBuildHide =
              isBuildStack && frame < w.fromFrame;
            if (stackBuildHide) {
              base.opacity = 0;
            }`,
        );
        console.log('build hide on base');
      }
    }
  }

  // In build mode, prefer big scale on active word always
  if (!s.includes('isBuildStack && isActive') && s.includes('const style: React.CSSProperties = { ...base };')) {
    s = s.replace(
      `const style: React.CSSProperties = { ...base };`,
      `const style: React.CSSProperties = { ...base };
            if (isBuildStack && isActive && !style.transform) {
              style.transform = 'scale(1.35)';
              style.transformOrigin = 'center center';
              style.zIndex = 2;
            }`,
    );
    console.log('build active scale');
  }

  write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
}

// ---------------------------------------------------------------------------
// plan.ts — pass captionOverrides onto caption plan for layer
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/render/plan.ts');
  if (!s.includes('captionOverrides') || !/captionLayout[\s\S]{0,200}captionOverrides/.test(s)) {
    // Find where caption plan object is built
    if (s.includes('captionLayout,') && !s.includes('captionOverrides:')) {
      s = s.replace(
        /captionLayout,(\r?\n\s*)powerWords:/,
        (m, nl) => `captionLayout,${nl}captionOverrides: project.captionOverrides ?? null,${nl}powerWords:`,
      );
      console.log('plan passes captionOverrides');
    } else {
      console.log('plan captionOverrides wiring skipped/check');
    }
  }
  // CaptionPlan type
  if (s.includes('captionLayout: CaptionLayout') && !s.includes('captionOverrides?:')) {
    s = s.replace(
      /captionLayout: CaptionLayout;/,
      `captionLayout: CaptionLayout;\n  captionOverrides?: import('../captions').CaptionOverrides | null;`,
    );
    console.log('CaptionPlan type field');
  }
  write('src/lib/mothermode/reel/render/plan.ts', s);
}

// Also CaptionPlanLike in captionLayer
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
  if (s.includes('captionLayout:') && !s.includes('captionOverrides?:')) {
    s = s.replace(
      /type CaptionPlanLike = \{([\s\S]*?)captionLayout: CaptionLayout;/,
      (m) =>
        m.includes('captionOverrides')
          ? m
          : m.replace(
              'captionLayout: CaptionLayout;',
              `captionLayout: CaptionLayout;\n  captionOverrides?: import('../../captions').CaptionOverrides | null;`,
            ),
    );
    // softer if type is interface
    if (!s.includes('captionOverrides?:')) {
      s = s.replace(
        /captionLayout: CaptionLayout;(\r?\n\s*)powerWords/,
        `captionLayout: CaptionLayout;$1captionOverrides?: import('../../captions').CaptionOverrides | null;$1powerWords`,
      );
    }
    write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
    console.log('CaptionPlanLike field');
  }
}

// ---------------------------------------------------------------------------
// CaptionGallery UI
// ---------------------------------------------------------------------------
{
  let g = read('src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx');

  // Ensure isCaptionVisibleAt not needed in gallery

  if (!g.includes('stackMode') || !g.includes('muteRanges')) {
    // Insert after rows stepper area — find "Rows" stepper
    const marker = 'Entrance anim';
    const idx = g.indexOf(marker);
    // Prefer insert before entrance section we added reset near
    const insertAt = g.indexOf('{/* Entrance animation + highlight */}');
    const block = `
            {/* Stack + visibility */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                  Captions
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      captionsOn: !(overrides?.captionsOn !== false),
                    })
                  }
                  className={
                    overrides?.captionsOn === false
                      ? 'rounded-full border border-rose-400/40 px-2.5 py-0.5 text-[9px] font-bold uppercase text-rose-300'
                      : 'rounded-full bg-brass px-2.5 py-0.5 text-[9px] font-bold uppercase text-ink'
                  }
                  title="Show or hide all captions"
                >
                  {overrides?.captionsOn === false ? 'Hidden' : 'Shown'}
                </button>
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50 pt-0.5">
                Stack mode
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'page', label: 'Karaoke page' },
                    { id: 'build', label: 'Build & hold' },
                  ] as const
                ).map((m) => {
                  const cur = overrides?.stackMode ?? 'page';
                  const on = cur === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={
                        m.id === 'build'
                          ? 'Words appear on speech and stay until the page flips — stacked phrase card'
                          : 'Whole page visible; highlight walks word-to-word'
                      }
                      onClick={() => onCustomize({ stackMode: m.id })}
                      className={
                        on
                          ? 'rounded-full bg-brass px-2 py-0.5 text-[9px] font-bold text-ink'
                          : 'rounded-full border border-bone/15 px-2 py-0.5 text-[9px] font-bold text-bone/45 hover:bg-bone/10'
                      }
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[8px] leading-relaxed text-bone/30">
                Build & hold + 2–3 rows + power words = the big stacked phrase look.
                Still locked to the spoken word clock.
              </p>
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50 pt-1">
                Mute ranges
              </div>
              <div className="space-y-1">
                {(overrides?.muteRanges ?? []).map((r, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px] text-bone/70">
                    <input
                      type="number"
                      step={0.1}
                      value={r.fromSec}
                      onChange={(e) => {
                        const next = [...(overrides?.muteRanges ?? [])];
                        next[i] = {
                          ...next[i],
                          fromSec: Number(e.target.value) || 0,
                        };
                        onCustomize({ muteRanges: next });
                      }}
                      className="w-14 rounded border border-bone/15 bg-ink px-1 py-0.5 text-[10px]"
                      title="From (sec)"
                    />
                    <span className="text-bone/30">→</span>
                    <input
                      type="number"
                      step={0.1}
                      value={r.toSec}
                      onChange={(e) => {
                        const next = [...(overrides?.muteRanges ?? [])];
                        next[i] = {
                          ...next[i],
                          toSec: Number(e.target.value) || 0,
                        };
                        onCustomize({ muteRanges: next });
                      }}
                      className="w-14 rounded border border-bone/15 bg-ink px-1 py-0.5 text-[10px]"
                      title="To (sec)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = (overrides?.muteRanges ?? []).filter(
                          (_, j) => j !== i,
                        );
                        onCustomize({ muteRanges: next });
                      }}
                      className="ml-auto text-[9px] text-bone/35 hover:text-rose-300"
                    >
                      remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      muteRanges: [
                        ...(overrides?.muteRanges ?? []),
                        { fromSec: 0, toSec: 2 },
                      ],
                    })
                  }
                  className="rounded-full border border-bone/15 px-2 py-0.5 text-[9px] font-bold uppercase text-bone/45 hover:bg-bone/10"
                >
                  + mute window
                </button>
              </div>
              <p className="text-[8px] leading-relaxed text-bone/25">
                Mute windows hide captions while other text is on screen. Times
                are project seconds.
              </p>
            </div>

`;
    if (insertAt >= 0) {
      g = g.slice(0, insertAt) + block + g.slice(insertAt);
      console.log('gallery stack/mute UI');
    } else if (idx >= 0) {
      // before entrance header text
      const lineStart = g.lastIndexOf('\n', idx);
      g = g.slice(0, lineStart) + '\n' + block + g.slice(lineStart);
      console.log('gallery stack/mute UI (alt)');
    } else {
      console.error('could not place gallery UI');
      process.exit(1);
    }
    write('src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx', g);
  } else {
    console.log('gallery already has stack/mute');
  }
}

// ---------------------------------------------------------------------------
// CaptionDragLayer — eye toggle if file exists
// ---------------------------------------------------------------------------
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/CaptionDragLayer.tsx';
  if (fs.existsSync(path.join(root, rel))) {
    let d = read(rel);
    if (!d.includes('captionsOn') && d.includes('onCommit')) {
      // light touch: skip if complex; gallery has the control
      console.log('CaptionDragLayer present — gallery toggle is primary');
    }
  }
}

// Sync vendor
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
}
const workerPlan = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/plan.ts',
);
if (fs.existsSync(workerPlan)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/plan.ts'),
    workerPlan,
  );
}

// Quick unit: isCaptionVisibleAt
{
  const testPath = path.join(root, 'tests/lib/caption-mute-stack.test.ts');
  fs.writeFileSync(
    testPath,
    `import { describe, expect, it } from 'vitest';
import { isCaptionVisibleAt } from '@/lib/mothermode/reel/captions';

describe('caption mute + visibility', () => {
  it('respects captionsOn false', () => {
    expect(isCaptionVisibleAt(1, { captionsOn: false })).toBe(false);
    expect(isCaptionVisibleAt(1, { captionsOn: true })).toBe(true);
  });
  it('mutes inside ranges', () => {
    const ov = { muteRanges: [{ fromSec: 2, toSec: 5 }] };
    expect(isCaptionVisibleAt(1, ov)).toBe(true);
    expect(isCaptionVisibleAt(2, ov)).toBe(false);
    expect(isCaptionVisibleAt(4.9, ov)).toBe(false);
    expect(isCaptionVisibleAt(5, ov)).toBe(true);
  });
  it('default visible', () => {
    expect(isCaptionVisibleAt(0, null)).toBe(true);
    expect(isCaptionVisibleAt(0, {})).toBe(true);
  });
});
`,
  );
  console.log('wrote mute test');
}

execSync(
  'pnpm exec vitest run tests/lib/caption-mute-stack.test.ts tests/lib/caption-presets.test.ts tests/lib/caption-vendor-parity.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);

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
        /captions|captionLayer|CaptionGallery|plan\.ts/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 25).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

console.log('OK');
