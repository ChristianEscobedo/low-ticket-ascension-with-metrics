#!/usr/bin/env node
/**
 * Finish ghost letter stagger + gallery stagger UI + tests + vendor sync.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

// ---------- captionLayer: ensure letter stagger on default text node ----------
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');

  const hasRealLetter =
    s.includes("ghostMeta && ghostMeta.staggerMode === 'letter'") ||
    s.includes('ghostMeta.staggerMode === "letter"');

  if (!hasRealLetter) {
    // Find bare {text} that is the main word content (after marker, before underline)
    const idx = s.indexOf("{mark?.fx === 'marker'");
    if (idx < 0) {
      console.error('marker fx not found');
      process.exit(1);
    }
    // Find `{text}` after that marker block
    const after = s.indexOf('{text}', idx);
    if (after < 0) {
      console.error('no {text} after marker');
      process.exit(1);
    }
    // Make sure this isn't inside cascade (Array.from already nearby)
    const window = s.slice(Math.max(0, after - 80), after + 40);
    if (window.includes('Array.from')) {
      console.log('first {text} is cascade — searching next');
    }
    // Replace only this occurrence
    const letterBranch = `{ghostMeta && ghostMeta.staggerMode === 'letter'
                  ? Array.from(text).map((ch, li) => {
                      const unitIdx =
                        words
                          .slice(ghostMeta.pageFrom, idx)
                          .reduce((n, ww) => n + Array.from(ww.text).length, 0) + li;
                      const gOp = ghostUnitOpacity(
                        frame,
                        ghostMeta.pageStartFrame,
                        ghostMeta.pageEndFrame,
                        unitIdx,
                        ghostMeta.inF,
                        ghostMeta.outF,
                        ghostMeta.staggerFrames,
                      );
                      return (
                        <span key={li} style={{ display: 'inline-block', opacity: gOp }}>
                          {ch}
                        </span>
                      );
                    })
                  : text}`;
    s = s.slice(0, after) + letterBranch + s.slice(after + '{text}'.length);
    fs.writeFileSync(p, s);
    console.log('injected letter stagger at', after);
  } else {
    console.log('letter stagger already real');
  }

  // Fix gradient mark if still missing filter
  s = fs.readFileSync(p, 'utf8');
  if (
    s.includes("case 'gradient':") &&
    !s.includes('text-shadow on transparent fill = silhouette')
  ) {
    s = s.replace(
      /(case 'gradient': \{[\s\S]*?style\.color = 'transparent';\s*)(\/\/ Stroke outside[\s\S]*?break;\s*\})/,
      `$1style.display = 'inline-block';
      if (style.textShadow) {
        style.filter = \`drop-shadow(\${String(style.textShadow).split(',')[0].trim()})\`;
        delete style.textShadow;
      }
      // Stroke outside a clipped fill reads as a hard black halo — drop it.
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }`,
    );
    fs.writeFileSync(p, s);
    console.log('patched gradient mark filter');
  }
}

// ---------- CaptionGallery: ghost stagger controls ----------
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('ghostStagger')) {
    // Insert after ghost fade out slider block — look for ghostFadeOutSec
    const anchor = 'ghostFadeOutSec';
    const i = s.lastIndexOf(anchor);
    if (i < 0) {
      console.warn('gallery: ghostFadeOutSec not found — skip UI');
    } else {
      // Find end of that control block (next closing of a section)
      // Insert a stagger row after the fade-out control's parent fragment.
      // Search for a unique nearby string.
      const needle = /ghostFadeOutSec[\s\S]{0,800}?<\/label>/;
      const m = s.match(needle);
      if (m) {
        const insert = `${m[0]}
            <label className="flex flex-col gap-1 text-[10px] text-zinc-400">
              Reveal
              <select
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                value={overrides.ghostStagger ?? def.ghost?.stagger ?? 'block'}
                onChange={(e) =>
                  patch({
                    ghostStagger: e.target.value as 'block' | 'word' | 'letter',
                  })
                }
              >
                <option value="block">Whole page</option>
                <option value="word">Word by word</option>
                <option value="letter">Letter by letter</option>
              </select>
            </label>
            {(overrides.ghostStagger ?? def.ghost?.stagger ?? 'block') !== 'block' && (
              <label className="flex flex-col gap-1 text-[10px] text-zinc-400">
                Stagger {(overrides.ghostStaggerSec ?? def.ghost?.staggerSec ?? (overrides.ghostStagger === 'letter' || def.ghost?.stagger === 'letter' ? 0.03 : 0.05)).toFixed(2)}s
                <input
                  type="range"
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  value={overrides.ghostStaggerSec ?? def.ghost?.staggerSec ?? (overrides.ghostStagger === 'letter' || def.ghost?.stagger === 'letter' ? 0.03 : 0.05)}
                  onChange={(e) => patch({ ghostStaggerSec: Number(e.target.value) })}
                />
              </label>
            )}`;
        s = s.replace(m[0], insert);
        fs.writeFileSync(p, s);
        console.log('gallery stagger UI added');
      } else {
        console.warn('gallery: could not locate fade-out label');
      }
    }
  } else {
    console.log('gallery already has ghostStagger');
  }
}

// ---------- tests ----------
{
  const p = path.join(root, 'tests/lib/caption-presets.test.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('ghost stagger')) {
    s = s.replace(
      /it\('ghost fade overrides force blockFx[\s\S]*?\n  \}\);\n/,
      (block) =>
        block +
        `
  it('ghost stagger word/letter merges + clamps delay', () => {
    const base = captionDefFor('hormozi1');
    const word = resolveCaptionStyle(base, {
      ghostFade: true,
      ghostStagger: 'word',
      ghostStaggerSec: 0.08,
    });
    expect(word.blockFx).toContain('ghostFade');
    expect(word.ghost?.stagger).toBe('word');
    expect(word.ghost?.staggerSec).toBe(0.08);
    const letter = resolveCaptionStyle(base, {
      ghostFade: true,
      ghostStagger: 'letter',
      ghostStaggerSec: 9,
    });
    expect(letter.ghost?.stagger).toBe('letter');
    expect(letter.ghost?.staggerSec).toBe(0.25); // clamp
  });

  it('gradient CSS uses filter drop-shadow not textShadow (no silhouette)', () => {
    const flow = captionCssFor(captionDefFor('gradient-flow'));
    expect(String(flow.word.backgroundImage ?? '')).toContain('linear-gradient');
    expect(flow.word.color).toBe('transparent');
    expect(flow.word.textShadow).toBeUndefined();
    expect(String((flow.word as Record<string, unknown>).filter ?? '')).toContain('drop-shadow');
  });
`,
    );
    fs.writeFileSync(p, s);
    console.log('tests extended');
  } else {
    console.log('tests already have stagger');
  }
}

// ---------- vendor sync ----------
try {
  execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('sync failed', e.message);
  process.exit(1);
}

// ---------- run tests ----------
try {
  execSync(
    'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
    { cwd: root, stdio: 'inherit' },
  );
} catch (e) {
  console.error('tests failed');
  process.exit(1);
}

console.log('ALL DONE');
