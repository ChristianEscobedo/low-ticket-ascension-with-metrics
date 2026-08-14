#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx');
let g = fs.readFileSync(p, 'utf8');

// Ensure map vars
if (!g.includes('const muted = phraseMuted')) {
  g = g.replace(
    /\{phrases\.map\(\(p, pi\) => \{\r?\n\s*const rowActive = activeIdx >= p\.from && activeIdx < p\.to;\r?\n\s*return \(/,
    `{phrases.map((p, pi) => {
            const rowActive = activeIdx >= p.from && activeIdx < p.to;
            const muted = phraseMuted(words, p.from, p.to);
            const cardId = phraseCardId(words, p.from, p.to);
            const cardMode = cardId ? words[p.from]?.mark?.card?.mode : null;
            return (`,
  );
  console.log('map vars');
}

// Insert controls after timecode button if missing
if (!g.includes('toggleMutePhrase(p.from')) {
  const needle = `{tc(words[p.from].start)}
                </button>

                {/* the phrase — words as flowing text, active word highlighted inline */}
                <p className="min-w-0 flex-1 text-[12px] leading-5 text-bone/80">`;
  const needleCrlf = needle.replace(/\n/g, '\r\n');
  const insert = `{tc(words[p.from].start)}
                </button>

                {/* mute + stack card */}
                <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMutePhrase(p.from, p.to);
                    }}
                    title={muted ? 'Show captions for this line' : 'Mute captions for this line'}
                    className={clsx(
                      'rounded p-0.5',
                      muted
                        ? 'text-rose-300 hover:bg-rose-400/15'
                        : 'text-bone/30 hover:bg-bone/10 hover:text-bone/70',
                    )}
                  >
                    {muted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStackCard(p.from, p.to);
                    }}
                    title={
                      cardId
                        ? 'Remove stack card (back to normal karaoke)'
                        : 'Make stack card — words build & hold as a phrase block'
                    }
                    className={clsx(
                      'rounded p-0.5',
                      cardId
                        ? 'text-brass hover:bg-brass/15'
                        : 'text-bone/30 hover:bg-bone/10 hover:text-bone/70',
                    )}
                  >
                    <Layers className="h-3 w-3" />
                  </button>
                </div>

                {/* the phrase — words as flowing text, active word highlighted inline */}
                <p
                  className={clsx(
                    'min-w-0 flex-1 text-[12px] leading-5',
                    muted ? 'text-bone/25 line-through decoration-bone/20' : 'text-bone/80',
                    cardId && !muted && 'text-bone/90',
                  )}
                >`;

  if (g.includes(needle)) {
    g = g.replace(needle, insert);
    console.log('controls lf');
  } else if (g.includes(needleCrlf)) {
    g = g.replace(needleCrlf, insert.replace(/\n/g, '\r\n'));
    console.log('controls crlf');
  } else {
    // softer match
    const re =
      /\{tc\(words\[p\.from\]\.start\)\}\r?\n\s*<\/button>\r?\n\r?\n\s*\{\/\* the phrase[\s\S]*?<p className="min-w-0 flex-1 text-\[12px\] leading-5 text-bone\/80">/;
    if (!re.test(g)) {
      console.error('could not find insertion point');
      const i = g.indexOf('{tc(words[p.from].start)}');
      console.log(JSON.stringify(g.slice(i, i + 250)));
      process.exit(1);
    }
    g = g.replace(re, insert);
    console.log('controls soft');
  }
}

// Card mode chips after phrase </p>
if (!g.includes('setCardMode(p.from')) {
  // Find the phrase closing </p> inside the map — unique enough with following </div>
  const re = /(\s*)<\/p>\r?\n(\s*)<\/div>\r?\n(\s*)\);\r?\n(\s*)\}\)\}\r?\n(\s*)<\/div>/;
  if (!re.test(g)) {
    console.error('card chips anchor missing');
    process.exit(1);
  }
  g = g.replace(
    re,
    `$1</p>
                {cardId ? (
                  <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setCardMode(p.from, p.to, 'build')}
                      className={clsx(
                        'rounded px-1 py-0.5 text-[8px] font-bold uppercase',
                        cardMode === 'build'
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/40 hover:bg-bone/10',
                      )}
                      title="Build & hold — words appear on speech and stay"
                    >
                      build
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardMode(p.from, p.to, 'page')}
                      className={clsx(
                        'rounded px-1 py-0.5 text-[8px] font-bold uppercase',
                        cardMode === 'page'
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/40 hover:bg-bone/10',
                      )}
                      title="Karaoke page — whole card visible, highlight walks"
                    >
                      page
                    </button>
                  </div>
                ) : null}
$2</div>
$3);
$4})}
$5</div>`,
  );
  console.log('card chips');
}

// Footer
if (!g.includes('eye = mute line')) {
  g = g.replace(
    /: 'click a timecode to seek · click a word to edit it'\}/,
    `: 'eye = mute line · layers = stack card · click timecode to seek · click word to edit'}`,
  );
  console.log('footer');
}

// Dim muted row background
if (!g.includes('muted && !rowActive')) {
  g = g.replace(
    /rowActive \? 'bg-brass\/\[0\.10\] ring-1 ring-inset ring-brass\/25' : 'hover:bg-bone\/\[0\.04\]'/,
    `rowActive
                    ? 'bg-brass/[0.10] ring-1 ring-inset ring-brass/25'
                    : muted
                      ? 'bg-rose-500/[0.04] opacity-70'
                      : cardId
                        ? 'bg-brass/[0.04]'
                        : 'hover:bg-bone/[0.04]'`,
  );
  console.log('row style');
}

fs.writeFileSync(p, g);

// verify
const v = fs.readFileSync(p, 'utf8');
const checks = {
  muteBtn: v.includes('toggleMutePhrase(p.from'),
  stackBtn: v.includes('toggleStackCard(p.from'),
  chips: v.includes('setCardMode(p.from'),
  eye: v.includes('<Eye'),
  layers: v.includes('<Layers'),
};
console.log(checks);
if (!checks.muteBtn || !checks.stackBtn || !checks.chips) process.exit(1);
console.log('OK');
