#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ---- Gallery: insert stagger controls after fade-out range ----
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('ghostStagger')) {
    console.log('gallery already has stagger');
  } else {
    // Find the fade-out slider's closing after ghostFadeOutSec onChange
    const marker = 'ghostFadeOutSec: Number(e.target.value) / 100';
    const i = s.indexOf(marker);
    if (i < 0) {
      // try alternate
      const i2 = s.indexOf('ghostFadeOutSec:');
      console.log('looking near', i2, s.slice(i2, i2 + 400));
      process.exit(1);
    }
    // Find the end of this <input ... /> after marker
    const afterInput = s.indexOf('/>', i);
    if (afterInput < 0) process.exit(1);
    const insertAt = afterInput + 2;
    const ui = `
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                        <span>Reveal</span>
                      </div>
                      <select
                        className="rounded border border-bone/15 bg-ink px-2 py-1 text-[10px] text-bone"
                        value={
                          overrides?.ghostStagger ??
                          activeDef.ghost?.stagger ??
                          'block'
                        }
                        onChange={(e) =>
                          onCustomize({
                            ghostStagger: e.target.value as
                              | 'block'
                              | 'word'
                              | 'letter',
                          })
                        }
                      >
                        <option value="block">Whole page</option>
                        <option value="word">Word by word</option>
                        <option value="letter">Letter by letter</option>
                      </select>
                    </div>
                    {(overrides?.ghostStagger ??
                      activeDef.ghost?.stagger ??
                      'block') !== 'block' && (
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[9px] font-semibold text-bone/40">
                          <span>Stagger</span>
                          <span className="text-brass/80">
                            {(
                              overrides?.ghostStaggerSec ??
                              activeDef.ghost?.staggerSec ??
                              ((overrides?.ghostStagger ??
                                activeDef.ghost?.stagger) === 'letter'
                                ? 0.03
                                : 0.05)
                            ).toFixed(2)}
                            s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={25}
                          step={1}
                          value={Math.round(
                            (overrides?.ghostStaggerSec ??
                              activeDef.ghost?.staggerSec ??
                              ((overrides?.ghostStagger ??
                                activeDef.ghost?.stagger) === 'letter'
                                ? 0.03
                                : 0.05)) * 100,
                          )}
                          onChange={(e) =>
                            onCustomize({
                              ghostStaggerSec: Number(e.target.value) / 100,
                            })
                          }
                          className="accent-brass"
                        />
                      </div>
                    )}`;
    s = s.slice(0, insertAt) + ui + s.slice(insertAt);
    fs.writeFileSync(p, s);
    console.log('gallery stagger UI inserted');
  }
}

// ---- Tests ----
{
  const p = path.join(root, 'tests/lib/caption-presets.test.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('ghost stagger word/letter')) {
    console.log('tests already extended');
  } else {
    const anchor = "it('gradient-flow / iridescent ship whole-text living gradients'";
    const i = s.indexOf(anchor);
    if (i < 0) {
      console.error('test anchor not found');
      process.exit(1);
    }
    const block = `
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
    expect(letter.ghost?.staggerSec).toBe(0.25);
  });

  it('gradient CSS uses filter drop-shadow not textShadow (no silhouette)', () => {
    const flow = captionCssFor(captionDefFor('gradient-flow'));
    expect(String(flow.word.backgroundImage ?? '')).toContain('linear-gradient');
    expect(flow.word.color).toBe('transparent');
    expect(flow.word.textShadow).toBeUndefined();
    expect(String((flow.word as Record<string, unknown>).filter ?? '')).toContain(
      'drop-shadow',
    );
  });

`;
    s = s.slice(0, i) + block + s.slice(i);
    fs.writeFileSync(p, s);
    console.log('tests inserted');
  }
}

execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');
