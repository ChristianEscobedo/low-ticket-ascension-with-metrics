#!/usr/bin/env node
/**
 * Stack free-place Edit/Preview mode:
 * - Edit (default when free-place card active): show ALL card words + handles; hide CaptionDragLayer
 * - Preview: normal karaoke/build timing; no word handles
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// ---------------------------------------------------------------------------
// 1) captionLayer — freePlaceEdit shows every non-hidden word in the card
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');

  // Add prop to CaptionLayerProps if missing
  if (!s.includes('freePlaceEdit')) {
    // Find props type / destructure
    if (s.includes('export type CaptionLayerProps') || s.includes('type CaptionLayerProps')) {
      s = s.replace(
        /(type CaptionLayerProps\s*=\s*\{[\s\S]*?)(\n\};)/,
        `$1  /** Studio: show every free-place card word (ignore build timing). */\n  freePlaceEdit?: boolean;$2`,
      );
    } else if (s.includes('interface CaptionLayerProps')) {
      s = s.replace(
        /(interface CaptionLayerProps \{[\s\S]*?)(\n\})/,
        `$1  /** Studio: show every free-place card word (ignore build timing). */\n  freePlaceEdit?: boolean;$2`,
      );
    }

    // Destructure in function — find freePlaceCard area and ensure prop is available
    // Common pattern: function CaptionLayer({ ... }: Props)
    if (!/freePlaceEdit\s*[,?}]/.test(s.slice(0, 2000)) && !s.includes('freePlaceEdit =')) {
      // Try add to destructuring near captionStyle or words
      const dest = s.match(
        /export function CaptionLayer\(\{\s*([\s\S]*?)\}\s*:\s*CaptionLayerProps\)/,
      );
      if (dest) {
        const inner = dest[1];
        if (!inner.includes('freePlaceEdit')) {
          s = s.replace(
            dest[0],
            dest[0].replace(
              /\}\s*:\s*CaptionLayerProps\)/,
              `  freePlaceEdit = false,\n}: CaptionLayerProps)`,
            ),
          );
          // if that didn't work because trailing comma issues
          if (!s.includes('freePlaceEdit = false')) {
            s = s.replace(
              /(export function CaptionLayer\(\{)/,
              `$1\n  freePlaceEdit = false,`,
            );
          }
          console.log('layer: destructure freePlaceEdit');
        }
      } else {
        // props object style
        s = s.replace(
          /(function CaptionLayer\([\s\S]{0,200})/,
          (m) => {
            if (m.includes('freePlaceEdit')) return m;
            return m.replace(/\{/, '{\n  freePlaceEdit = false,');
          },
        );
        console.log('layer: freePlaceEdit inject attempt');
      }
    }

    // Fix visibility filter in free-place branch
    const oldFilter = `      .filter(({ w, idx }) => {
        if (w.mark?.hidden) return false;
        if (isBuildStack && frame < w.fromFrame) return false;
        // page mode: show whole card; build: spoken + held
        if (!isBuildStack) {
          // still only while the card's time window is live
          return true;
        }
        return frame >= w.fromFrame || idx <= activeIdx;
      });`;

    const newFilter = `      .filter(({ w, idx }) => {
        if (w.mark?.hidden) return false;
        // Edit mode: every free-placed word in the card is visible so you can
        // drag/scale the full composition without scrubbing to each word.
        if (freePlaceEdit) return true;
        if (isBuildStack && frame < w.fromFrame) return false;
        if (!isBuildStack) return true;
        return frame >= w.fromFrame || idx <= activeIdx;
      });`;

    if (s.includes(oldFilter)) {
      s = s.replace(oldFilter, newFilter);
      console.log('layer: edit visibility filter');
    } else {
      // looser
      const re =
        /\.filter\(\(\{ w, idx \}\) => \{\s*if \(w\.mark\?\.hidden\) return false;\s*if \(isBuildStack && frame < w\.fromFrame\) return false;[\s\S]*?return frame >= w\.fromFrame \|\| idx <= activeIdx;\s*\}\);/;
      if (re.test(s)) {
        s = s.replace(re, newFilter.trim().replace(/^\s+/, ''));
        console.log('layer: loose filter replace');
      } else {
        console.warn('layer: filter block not found — manual check');
      }
    }

    write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
  } else {
    console.log('layer: freePlaceEdit already');
  }
}

// Ensure freePlaceEdit is in props type even if already partially there
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
  if (!s.includes('freePlaceEdit?:')) {
    // inject after first props brace of CaptionLayerProps
    if (s.includes('CaptionLayerProps')) {
      s = s.replace(
        /(CaptionLayerProps\s*=\s*\{|interface CaptionLayerProps \{)/,
        `$1\n  freePlaceEdit?: boolean;`,
      );
      write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
      console.log('layer: freePlaceEdit?: on type');
    }
  }
  // ensure default in destructure
  if (!s.includes('freePlaceEdit') || !/freePlaceEdit\s*=/.test(s)) {
    s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
    if (!/freePlaceEdit\s*=/.test(s)) {
      s = s.replace(
        /export function CaptionLayer\(\{/,
        'export function CaptionLayer({\n  freePlaceEdit = false,',
      );
      write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
      console.log('layer: freePlaceEdit default in fn');
    }
  }
  // ensure filter uses freePlaceEdit
  s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
  if (!s.includes('if (freePlaceEdit) return true')) {
    s = s.replace(
      /(\.filter\(\(\{ w, idx \}\) => \{\s*if \(w\.mark\?\.hidden\) return false;)/,
      `$1\n        if (freePlaceEdit) return true;`,
    );
    write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
    console.log('layer: injected freePlaceEdit early return');
  }
}

// ---------------------------------------------------------------------------
// 2) RemotionPreview — pass freePlaceEdit through
// ---------------------------------------------------------------------------
{
  let s = read('src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx');
  if (!s.includes('freePlaceEdit')) {
    // add to props
    s = s.replace(
      /playheadSec,\n\}: \{/,
      `playheadSec,\n  freePlaceEdit = false,\n}: {`,
    );
    if (!s.includes('freePlaceEdit = false')) {
      s = s.replace(
        /(export default function RemotionPreview\(\{)/,
        `$1\n  freePlaceEdit = false,`,
      );
    }
    // type
    if (s.includes('playheadSec?: number')) {
      s = s.replace(
        /playheadSec\?: number;/,
        `playheadSec?: number;\n  freePlaceEdit?: boolean;`,
      );
    } else {
      s = s.replace(
        /(playheadSec\?:[\s\S]*?;)/,
        `$1\n  freePlaceEdit?: boolean;`,
      );
    }
    // pass to CaptionLayer / inputProps
    if (s.includes('<CaptionLayer')) {
      s = s.replace(
        /(<CaptionLayer[\s\S]*?)(\/>|>)/,
        (m, a, b) => {
          if (a.includes('freePlaceEdit')) return m;
          return a + '\n          freePlaceEdit={freePlaceEdit}\n        ' + b;
        },
      );
    }
    // inputProps object
    if (s.includes('inputProps') && !s.includes('freePlaceEdit')) {
      s = s.replace(
        /(inputProps\s*=\s*\{[\s\S]*?)(\n\s*\})/,
        (m, a, b) => {
          if (a.includes('freePlaceEdit')) return m;
          return a + ',\n    freePlaceEdit' + b;
        },
      );
    }
    // composition props spread
    if (s.includes('captionStyle') && s.includes('inputProps')) {
      // already tried
    }
    write('src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx', s);
    console.log('preview: freePlaceEdit prop');
  } else {
    console.log('preview: already has freePlaceEdit');
  }

  // Read how CaptionLayer is invoked
  s = read('src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx');
  const ci = s.indexOf('CaptionLayer');
  console.log('preview CaptionLayer ctx:', s.slice(Math.max(0, ci - 80), ci + 400).replace(/\s+/g, ' ').slice(0, 350));
}

// ---------------------------------------------------------------------------
// 3) page.tsx — stackEditMode state, toggle UI, hide CaptionDrag when free-place
// ---------------------------------------------------------------------------
{
  let p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');

  if (!p.includes('stackEditMode')) {
    const anchor =
      'const [wordScaleLocal, setWordScaleLocal] = useState<Record<number, number>>({});';
    if (!p.includes(anchor)) throw new Error('wordScaleLocal missing');
    p = p.replace(
      anchor,
      anchor +
        `\n  /** Free-place stack: Edit shows all card words + handles; Preview = karaoke timing. */\n  const [stackEditMode, setStackEditMode] = useState(true);`,
    );
    console.log('page: stackEditMode state');
  }

  // Helper expression used in JSX — inject near mounts if needed via inline

  // Hide CaptionDragLayer when free-place words exist on current clip
  // Pattern: {ccOn && Object.values... && ( <> <CaptionDragLayer
  // Change to also require !hasFreePlace

  if (!p.includes('hasFreePlaceStack')) {
    // Add a small derived flag before first CaptionDragLayer usage is hard;
    // instead wrap CaptionDragLayer condition.

    // Replace both CaptionDragLayer openings with conditional
    // Find: <CaptionDragLayer  after ccOn block
    // We'll change the fragment condition.

    // Simpler: wrap each <CaptionDragLayer ... /> with {!stackHasFreePlace && ( ... )}
    // And compute stackHasFreePlace inline.

    const freeCheck = `(() => {
                        if (!currentClip) return false;
                        const ws = project.captions[currentClip.id] ?? [];
                        return ws.some(
                          (w) =>
                            typeof w.mark?.xPct === 'number' &&
                            typeof w.mark?.yPct === 'number',
                        );
                      })()`;

    // For each CaptionDragLayer, wrap it
    if (!p.includes('/* stack-edit: hide box when free-place */')) {
      p = p.replace(
        /<CaptionDragLayer\s+/g,
        `{/* stack-edit: hide box when free-place */}\n                        {!${freeCheck} && (\n                        <CaptionDragLayer\n                          `,
      );
      // Close after CaptionDragLayer self-close — find /> that ends CaptionDragLayer
      // This is fragile. Better: after each CaptionDragLayer's />, add )}
      // Count CaptionDragLayer
      const parts = p.split('<CaptionDragLayer');
      // already replaced opening. Need to close.
      // Find pattern: CaptionDragLayer ... />  then WordDragLayer
      p = p.replace(
        /(<\/CaptionDragLayer>|<CaptionDragLayer[\s\S]*?\/>)/g,
        (m) => {
          if (m.includes('stack-edit-closed')) return m;
          if (m.startsWith('</')) return m;
          return m + '\n                        )}';
        },
      );
      console.log('page: CaptionDragLayer gated');
    }
  }

  // Pass freePlaceEdit to RemotionPreview
  if (!p.includes('freePlaceEdit={stackEditMode}')) {
    p = p.replace(
      /(<RemotionPreview\s+[\s\S]*?playheadSec=\{playheadSec\})/,
      `$1\n                      freePlaceEdit={stackEditMode}`,
    );
    console.log('page: RemotionPreview freePlaceEdit');
  }

  // WordDragLayer only when stackEditMode
  // words={...} already; wrap entire WordDragLayer
  if (!p.includes('stackEditMode && (')) {
    p = p.replace(
      /<WordDragLayer\s+/g,
      `{stackEditMode && (\n                        <WordDragLayer\n                          `,
    );
    p = p.replace(
      /(onStyle=\{\(index, partial\) => \{[\s\S]*?void applyWordMark\(index, patch\);\s*\}\s*\}\s*\/>)/g,
      `$1\n                        )}`,
    );
    console.log('page: WordDragLayer gated by stackEditMode');
  }

  // Toggle chip near preview — find a good spot: after ccOn caption layers or near preview header
  if (!p.includes('data-stack-edit-toggle')) {
    // Insert toggle just before first WordDragLayer block's parent, or after RemotionPreview
    const toggle = `
                    {/* Free-place stack Edit/Preview — only when card has placed words */}
                    {currentClip &&
                      (project.captions[currentClip.id] ?? []).some(
                        (w) =>
                          typeof w.mark?.xPct === 'number' &&
                          typeof w.mark?.yPct === 'number',
                      ) && (
                        <div
                          data-stack-edit-toggle
                          className="pointer-events-auto absolute right-2 top-2 z-40 flex items-center gap-1 rounded-full border border-white/15 bg-black/70 p-0.5 text-[10px] shadow-lg backdrop-blur"
                        >
                          <button
                            type="button"
                            className={
                              stackEditMode
                                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
                            }
                            onClick={() => setStackEditMode(true)}
                            title="Show every word in the stack card for drag/scale"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={
                              !stackEditMode
                                ? 'rounded-full bg-white/15 px-2.5 py-1 font-semibold text-white'
                                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
                            }
                            onClick={() => setStackEditMode(false)}
                            title="Preview karaoke/build timing"
                          >
                            Preview
                          </button>
                        </div>
                      )}
`;
    // Insert after RemotionPreview closing />
    p = p.replace(
      /(<RemotionPreview[\s\S]*?\/>)/,
      `$1\n${toggle}`,
    );
    console.log('page: Edit/Preview toggle');
  }

  write('src/app/(fullscreen)/admin/reel-studio/page.tsx', p);
}

// ---------------------------------------------------------------------------
// 4) RemotionPreview — ensure freePlaceEdit reaches CaptionLayer via inputProps
// ---------------------------------------------------------------------------
{
  let s = read('src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx');
  // Dump structure around inputProps / Caption
  const idx = s.search(/inputProps|CaptionLayer|defaultProps/);
  console.log('--- preview structure ---');
  console.log(s.slice(Math.max(0, idx - 100), idx + 800));

  // Common pattern: inputProps={{ ... plan fields }}
  if (s.includes('inputProps') && s.includes('freePlaceEdit') && !s.match(/freePlaceEdit[,}]/)) {
    // prop declared but not passed
  }
  if (s.includes('freePlaceEdit') && !s.match(/freePlaceEdit=\{freePlaceEdit\}|freePlaceEdit,/)) {
    // try add to inputProps object
    if (/inputProps=\{\{/.test(s)) {
      s = s.replace(/inputProps=\{\{/, 'inputProps={{\n          freePlaceEdit,');
      write('src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx', s);
      console.log('preview: freePlaceEdit in inputProps');
    }
  }
}

// Vendor caption layer
execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
const wl = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(wl)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
    wl,
  );
}

// Verify
const p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');
console.log('stackEditMode', p.includes('stackEditMode'));
console.log('toggle', p.includes('data-stack-edit-toggle'));
console.log('freePlaceEdit prop', p.includes('freePlaceEdit={stackEditMode}'));
const layer = read('src/lib/mothermode/reel/render/captionLayer.tsx');
console.log('layer freePlaceEdit filter', layer.includes('if (freePlaceEdit) return true'));

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
        /page\.tsx|WordDrag|RemotionPreview|captionLayer|stackEdit|freePlace/.test(
          l,
        ),
    );
  console.log('relevant errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

execSync(
  'pnpm exec vitest run tests/lib/caption-free-place.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');
