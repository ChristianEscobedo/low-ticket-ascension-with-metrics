#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// Fix CAPTION_ANIMS type annotation
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    'export const CAPTION_ANIMS: CaptionAnim[\n  \'pop\',',
    "export const CAPTION_ANIMS: CaptionAnim[] = [\n  'pop',",
  );
  // also broken form without newline
  s = s.replace(
    'export const CAPTION_ANIMS: CaptionAnim[\n',
    'export const CAPTION_ANIMS: CaptionAnim[] = [\n',
  );
  fs.writeFileSync(p, s);
  console.log('captions anims fixed', s.includes('CaptionAnim[] = ['));
}

// Fix boxGrow double brace + marker ternary
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');

  // Fix {{def -> {def
  s = s.replace('{{def.highlightMode === \'boxGrow\'', "{def.highlightMode === 'boxGrow'");

  // Fix bare mark?.fx without {
  s = s.replace(
    ') : null}\n                mark?.fx === \'marker\' ? (',
    ") : null}\n                {mark?.fx === 'marker' ? (",
  );

  fs.writeFileSync(p, s);
  console.log('layer jsx fixed');

  // show context
  const i = s.indexOf('boxGrowBg');
  console.log(s.slice(i - 80, i + 200));
}

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('PARSE FIX OK');
