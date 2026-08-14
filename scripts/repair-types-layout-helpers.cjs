#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ─── Fix corrupted defaultStackLayout / captionLineLayout in types.ts ────────
{
  const p = path.join(root, 'src/lib/mothermode/reel/types.ts');
  let s = fs.readFileSync(p, 'utf8');

  const start = s.indexOf('/**\n * Seed free-place positions for a stack-card phrase.');
  const startCrlf = s.indexOf('/**\r\n * Seed free-place positions for a stack-card phrase.');
  const startIdx = start >= 0 ? start : startCrlf;
  const end = s.indexOf('/** Validate one word mark.');
  if (startIdx < 0 || end < 0) {
    console.error('markers', startIdx, end);
    process.exit(1);
  }

  const fixed = `/**
 * Seed free-place positions for a stack-card phrase.
 * Spreads words into \`rows\` x words-per-row around the frame centre,
 * matching the caption box's bottom-origin y axis.
 */
export function defaultStackLayout(
  count: number,
  opts?: { rows?: number; wordsPerRow?: number; baseYPct?: number; baseXPct?: number },
): { xPct: number; yPct: number }[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const rows = Math.max(1, Math.min(4, Math.round(opts?.rows ?? Math.min(3, n))));
  const perRow = Math.max(
    1,
    Math.min(8, Math.round(opts?.wordsPerRow ?? Math.ceil(n / rows))),
  );
  const baseX = opts?.baseXPct ?? 50;
  const baseY = opts?.baseYPct ?? 42;
  const rowGap = 9; // % of frame between rows (bottom -> top)
  const colGap = 14; // % between word centres
  const out: { xPct: number; yPct: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const rowLen = Math.min(perRow, n - r * perRow);
    const rowWidth = (rowLen - 1) * colGap;
    const x0 = baseX - rowWidth / 2;
    // First row is lowest (closest to baseY); later rows stack upward.
    const y = Math.max(6, Math.min(88, baseY + r * rowGap));
    const x = Math.max(8, Math.min(92, x0 + c * colGap));
    out.push({ xPct: Math.round(x * 10) / 10, yPct: Math.round(y * 10) / 10 });
  }
  return out;
}

/**
 * Approximate on-frame positions for words as they sit in the normal caption
 * block (centred row(s) at layout.xPct / layout.positionPct). Used so free-place
 * edit can put hit targets ON the existing glyphs without scattering them.
 */
export function captionLineLayout(
  count: number,
  opts?: {
    wordsPerRow?: number;
    baseXPct?: number;
    baseYPct?: number;
    /** Rough centre-to-centre gap as % of frame width. */
    colGapPct?: number;
    rowGapPct?: number;
  },
): { xPct: number; yPct: number }[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const perRow = Math.max(1, Math.min(8, Math.round(opts?.wordsPerRow ?? Math.min(4, n))));
  const baseX = opts?.baseXPct ?? 50;
  const baseY = opts?.baseYPct ?? 12;
  const colGap = opts?.colGapPct ?? 11;
  const rowGap = opts?.rowGapPct ?? 7;
  const out: { xPct: number; yPct: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    // Last row may be shorter — centre that row too.
    const rowStart = row * perRow;
    const rowCount = Math.min(perRow, n - rowStart);
    const rowWidth = (rowCount - 1) * colGap;
    const x0 = baseX - rowWidth / 2;
    out.push({
      xPct: Math.max(4, Math.min(96, x0 + col * colGap)),
      // Rows stack upward from the caption baseline (y is from bottom).
      yPct: Math.max(4, Math.min(96, baseY + row * rowGap)),
    });
  }
  return out;
}

`;

  s = s.slice(0, startIdx) + fixed + s.slice(end);
  fs.writeFileSync(p, s);
  console.log('types.ts layout helpers fixed');

  const dst = path.join(root, 'render-worker/src/lib/mothermode/reel/types.ts');
  if (fs.existsSync(dst)) fs.copyFileSync(p, dst);
}

// ─── page Edit/Preview gate includes freePlace flag ──────────────────────────
{
  const page = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/page.tsx');
  let ps = fs.readFileSync(page, 'utf8');
  const re =
    /\(project\.captions\[currentClip\.id\] \?\? \[\]\)\.some\(\s*\(w\) =>\s*typeof w\.mark\?\.xPct === 'number' &&\s*typeof w\.mark\?\.yPct === 'number',\s*\)/g;
  if (re.test(ps)) {
    ps = ps.replace(
      re,
      `(project.captions[currentClip.id] ?? []).some(
                        (w) =>
                          w.mark?.card?.freePlace === true ||
                          (typeof w.mark?.xPct === 'number' &&
                            typeof w.mark?.yPct === 'number'),
                      )`,
    );
    fs.writeFileSync(page, ps);
    console.log('page: gate fixed via regex');
  } else if (ps.includes('w.mark?.card?.freePlace === true')) {
    console.log('page: gate already has freePlace');
  } else {
    console.warn('page gate not found');
  }
}

// ─── ensure freePlace survives mark normalize ────────────────────────────────
{
  const p = path.join(root, 'src/lib/mothermode/reel/types.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('freePlace') || !s.includes('card.freePlace')) {
    // find card normalize block
    const needle = 'if (o.card && typeof o.card ===';
    // try alternate
  }
  // Look for card assignment in normalizeWordMark
  const i = s.indexOf('out.card');
  if (i >= 0) {
    console.log('card normalize snippet:', s.slice(i, i + 400));
  }
  // If freePlace not copied into card, add it
  if (s.includes('mode: m.mode') && !s.includes('freePlace:')) {
    s = s.replace(
      /mode:\s*m\.mode as ['"]build['"] \| ['"]page['"]/,
      `mode: m.mode as 'build' | 'page',\n      ...(m.freePlace === true ? { freePlace: true as const } : {})`,
    );
    // also try object spread style
  }
  // More robust: find card object construction
  const cardBlock = s.match(/out\.card\s*=\s*\{[\s\S]{0,400}?\}/);
  if (cardBlock) {
    console.log('card block:', cardBlock[0].slice(0, 300));
    if (!cardBlock[0].includes('freePlace') && s.includes('freePlace?: boolean')) {
      // inject after mode line inside card
      const old = cardBlock[0];
      let neu = old;
      if (old.includes('mode:') && !old.includes('freePlace')) {
        neu = old.replace(
          /(mode:\s*[^,\n]+,?)/,
          `$1\n      ...(typeof (o.card as { freePlace?: unknown }).freePlace === 'boolean' && (o.card as { freePlace?: boolean }).freePlace\n        ? { freePlace: true as const }\n        : {}),`,
        );
        if (neu !== old) {
          s = s.replace(old, neu);
          fs.writeFileSync(p, s);
          console.log('normalizeWordMark preserves freePlace');
        }
      }
    }
  }
}

// copy layer again
{
  const src = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  const dst = path.join(
    root,
    'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
  );
  if (fs.existsSync(dst)) fs.copyFileSync(src, dst);
  const ts = path.join(root, 'src/lib/mothermode/reel/types.ts');
  const td = path.join(root, 'render-worker/src/lib/mothermode/reel/types.ts');
  if (fs.existsSync(td)) fs.copyFileSync(ts, td);
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
        /types|Subtitle|WordDrag|captionLayer|page\.tsx|freePlace|captionLine/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (!lines.length) {
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 20)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}
console.log('OK');
