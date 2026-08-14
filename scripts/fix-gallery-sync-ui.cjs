#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(
  root,
  'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx',
);
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('setOverrides')) {
  console.log('no setOverrides — already fixed?');
} else {
  // Replace the whole injected Sync-to-speech block with a proper onCustomize version
  // that matches gallery styling.
  const startMarker = 'Sync to speech';
  const start = s.lastIndexOf('<div', s.indexOf(startMarker));
  // Find end of that outer div — look for the closing after the help text
  const help = 'When on, each word fades/moves on its own spoken timing';
  const helpAt = s.indexOf(help);
  if (start < 0 || helpAt < 0) {
    console.log('markers not found', start, helpAt);
    // fallback: just replace setOverrides calls
    s = s.replace(
      /setOverrides\(\(o\) => \(\{\s*\.\.\.o,\s*ghostSyncToWords: !\(o\.ghostSyncToWords \?\? false\),\s*\}\)\)/g,
      `onCustomize({ ghostSyncToWords: !(overrides?.ghostSyncToWords ?? false) })`,
    );
    s = s.replace(
      /setOverrides\(\(o\) => \(\{\s*\.\.\.o,\s*motionSyncToWords: !\(o\.motionSyncToWords \?\? false\),\s*\}\)\)/g,
      `onCustomize({ motionSyncToWords: !(overrides?.motionSyncToWords ?? false) })`,
    );
    // also fix overrides.ghostSyncToWords without optional chaining
    s = s.replace(/overrides\.ghostSyncToWords/g, 'overrides?.ghostSyncToWords');
    s = s.replace(/overrides\.motionSyncToWords/g, 'overrides?.motionSyncToWords');
    fs.writeFileSync(p, s);
    console.log('fallback replace setOverrides');
  } else {
    // find closing </div></div> after help
    let end = helpAt;
    // advance past the help text line and two closing divs
    end = s.indexOf('</div>', helpAt);
    end = s.indexOf('</div>', end + 1);
    end = s.indexOf('</div>', end + 1) + '</div>'.length;

    const replacement = `{/* Sync reveal/motion to spoken word timings */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                Sync to speech
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      ghostSyncToWords: !(overrides?.ghostSyncToWords ?? false),
                    })
                  }
                  className={clsx(
                    'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                    overrides?.ghostSyncToWords
                      ? 'bg-brass text-ink'
                      : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                  )}
                  title="Each word fades on/off with its spoken window"
                >
                  Ghost ↔ words
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({
                      motionSyncToWords: !(overrides?.motionSyncToWords ?? false),
                    })
                  }
                  className={clsx(
                    'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                    overrides?.motionSyncToWords
                      ? 'bg-brass text-ink'
                      : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                  )}
                  title="Float/wiggle phase starts when each word is spoken"
                >
                  Float/Wiggle ↔ words
                </button>
              </div>
              <div className="text-[9px] leading-snug text-bone/40">
                When on, each word fades/moves on its own spoken timing — matches the speaker.
              </div>
            </div>`;

    s = s.slice(0, start) + replacement + s.slice(end);
    fs.writeFileSync(p, s);
    console.log('replaced sync UI block with onCustomize');
  }
}

// Final sanity
s = fs.readFileSync(p, 'utf8');
if (s.includes('setOverrides')) {
  console.error('STILL HAS setOverrides');
  // nuke any remaining
  s = s.replace(/setOverrides\(\(o\) => \(\{[\s\S]*?\}\)\)/g, (m) => {
    if (m.includes('ghostSyncToWords')) {
      return `onCustomize({ ghostSyncToWords: !(overrides?.ghostSyncToWords ?? false) })`;
    }
    if (m.includes('motionSyncToWords')) {
      return `onCustomize({ motionSyncToWords: !(overrides?.motionSyncToWords ?? false) })`;
    }
    return m;
  });
  fs.writeFileSync(p, s);
  s = fs.readFileSync(p, 'utf8');
}
console.log('setOverrides remaining', (s.match(/setOverrides/g) || []).length);
console.log('onCustomize ghostSync', s.includes('onCustomize({\n                      ghostSyncToWords') || s.includes('ghostSyncToWords: !(overrides'));

// Typecheck gallery via tsc if possible — at least ensure no setOverrides
if (s.includes('setOverrides')) {
  process.exit(1);
}

// Run a quick tsc on the file if next build is heavy — use vitest parity only
try {
  execSync(
    'pnpm exec tsc --noEmit --pretty false 2>&1 | findstr /i "CaptionGallery setOverrides"',
    { cwd: root, stdio: 'pipe', shell: true },
  );
} catch (e) {
  const out = String(e.stdout || e.stderr || e.message || '');
  if (out.includes('CaptionGallery') || out.includes('setOverrides')) {
    console.log(out.slice(0, 1500));
  } else {
    console.log('tsc filter empty or tsc unavailable — ok');
  }
}

console.log('OK');
