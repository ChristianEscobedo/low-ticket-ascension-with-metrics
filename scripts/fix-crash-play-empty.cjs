#!/usr/bin/env node
/**
 * 1) Crash: freePlaceWordsFrom assumes mark.card on every placed word.
 * 2) Play broken: stackEditMode defaults ON + auto-pause + shield.
 * 3) Empty canvas: start screen (upload / library) + auto-transcribe.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

function norm(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
function write(file, content, crlf) {
  fs.writeFileSync(file, crlf ? content.replace(/\n/g, '\r\n') : content);
}

// ── 1) WordDragLayer: don't crash without a card ──────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  const old = `  if (!cardId) {
    for (let i = 0; i < all.length; i++) {
      const w = all[i];
      if (w.mark?.card?.freePlace || (typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number')) {
        cardId = w.mark!.card!.id;
        cardMeta = w.mark!.card!;
        break;
      }
    }
  }
  if (!cardId) return [];`;

  const neu = `  if (!cardId) {
    for (let i = 0; i < all.length; i++) {
      const w = all[i];
      if (w.mark?.card?.id && w.mark.card.freePlace) {
        cardId = w.mark.card.id;
        cardMeta = w.mark.card;
        break;
      }
    }
  }
  // Mixed free-place: words with x/y but NO card. Build a synthetic list.
  if (!cardId) {
    const placed = all
      .map((w, i) => ({ w, i }))
      .filter(
        ({ w }) =>
          typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number',
      );
    if (!placed.length) return [];
    return placed.map(({ w, i }) => ({
      index: i,
      xPct: w.mark!.xPct as number,
      yPct: w.mark!.yPct as number,
      label: w.word,
      scale: w.mark?.scale,
      anim: w.mark?.anim,
      color: w.mark?.color,
      fx: w.mark?.fx,
      fxColor: w.mark?.fxColor,
      fxColor2: w.mark?.fxColor2,
      font: w.mark?.font,
      hidden: w.mark?.hidden,
    }));
  }`;

  if (!s.includes(old)) {
    if (s.includes('Mixed free-place: words with x/y but NO card')) {
      console.log('freePlaceWordsFrom already patched');
    } else {
      console.error('freePlaceWordsFrom fallback not found');
      const i = s.indexOf('if (!cardId)');
      console.log(JSON.stringify(s.slice(i, i + 450)));
      process.exit(1);
    }
  } else {
    s = s.replace(old, neu);
    console.log('freePlaceWordsFrom no longer assumes card');
  }

  write(p, s, crlf);
}

// ── 2) page.tsx: Edit off by default, pause only on enter, empty start ───
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  // Default Edit OFF so play/timeline work until the user opts in.
  if (s.includes("const [stackEditMode, setStackEditMode] = useState(true);")) {
    s = s.replace(
      "const [stackEditMode, setStackEditMode] = useState(true);",
      "const [stackEditMode, setStackEditMode] = useState(false);",
    );
    console.log('stackEditMode defaults OFF');
  }

  // Auto-pause only when transitioning INTO edit (not on every mount).
  const oldPause = `  /* edit-mode auto-pause */
  useEffect(() => {
    if (!stackEditMode) return;
    // Freeze the clock so free-place editing isn't fighting a moving playhead.
    const c = clockRef.current;
    if (c?.playing) {
      c.playing = false;
      cancelAnimationFrame(c.raf);
      setPlaying(false);
      const v = previewRef.current;
      if (v && !v.paused) v.pause();
      const ov = overlayRef.current;
      if (ov && !ov.paused) ov.pause();
    }
  }, [stackEditMode]);`;

  const neuPause = `  /* edit-mode auto-pause — only when ENTERING edit, never on first mount. */
  const prevEditRef = useRef(false);
  useEffect(() => {
    const entered = stackEditMode && !prevEditRef.current;
    prevEditRef.current = stackEditMode;
    if (!entered) return;
    const c = clockRef.current;
    if (!c?.playing) return;
    c.playing = false;
    cancelAnimationFrame(c.raf);
    setPlaying(false);
    const v = previewRef.current;
    if (v && !v.paused) v.pause();
    const ov = overlayRef.current;
    if (ov && !ov.paused) ov.pause();
  }, [stackEditMode]);`;

  if (s.includes(oldPause)) {
    s = s.replace(oldPause, neuPause);
    console.log('auto-pause only on enter-edit');
  } else if (s.includes('prevEditRef')) {
    console.log('auto-pause already gated');
  } else {
    console.warn('auto-pause block not exact');
  }

  // Auto-transcribe preference
  if (!s.includes('autoTranscribeOnImport')) {
    s = s.replace(
      "const [stackEditMode, setStackEditMode] = useState(false);",
      `const [stackEditMode, setStackEditMode] = useState(false);
  const [autoTranscribeOnImport, setAutoTranscribeOnImport] = useState(true);`,
    );
    console.log('autoTranscribeOnImport state');
  }

  // After a clip is added from file/url/hub, optionally transcribe.
  // Hook the common "next.splice(...clip)" / patch clips sites is too broad.
  // Instead wrap transcribeCurrentClip call after importHubPiece and file add.
  // Find importHubPiece end-ish: patch({ clips
  // Safer: after selected clip is set on add, if autoTranscribe, fire.
  // Look for fileInput onChange
  const fi = s.indexOf('fileInput');
  const onChange = s.indexOf('onChange', s.indexOf('<input', fi > 0 ? 0 : 0));
  // find the actual file input element
  const inputTag = s.indexOf('ref={fileInput}');
  if (inputTag > 0) {
    console.log('fileInput tag', s.slice(inputTag - 80, inputTag + 250).replace(/\s+/g, ' ').slice(0, 200));
  }

  // Empty-canvas start screen: find RemotionPreview / stage when no clips
  // Insert overlay when !project?.clips.length
  if (!s.includes('data-empty-start')) {
    // Place just inside the stage box — look for RemotionPreview usage
    const rp = s.indexOf('<RemotionPreview');
    if (rp > 0) {
      // wrap a sibling overlay before RemotionPreview's parent content
      // Find a nearby `{previewMode === 'remotion'`
      const branch = s.lastIndexOf('{previewMode', rp);
      const insertAt = s.lastIndexOf('{', rp);
      // Simpler: after the stage container opens that holds RemotionPreview,
      // inject empty state when no clips.
      s = s.replace(
        /<RemotionPreview/,
        `{(!project || project.clips.length === 0) && (
                      <div
                        data-empty-start
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center"
                      >
                        <p className="text-sm font-semibold text-bone">Start a reel</p>
                        <p className="max-w-[240px] text-[11px] text-bone/50">
                          Upload a video or pull one from the media library. Captions can transcribe automatically.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            className="rounded-md bg-brass px-3 py-1.5 text-[11px] font-semibold text-ink"
                          >
                            Upload video
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const tabBtn = document.querySelector('[data-tab=\"clips\"]') as HTMLButtonElement | null;
                              tabBtn?.click();
                            }}
                            className="rounded-md border border-bone/20 px-3 py-1.5 text-[11px] font-semibold text-bone/80 hover:bg-white/5"
                          >
                            From library
                          </button>
                        </div>
                        <label className="flex items-center gap-2 text-[10px] text-bone/55">
                          <input
                            type="checkbox"
                            checked={autoTranscribeOnImport}
                            onChange={(e) => setAutoTranscribeOnImport(e.target.checked)}
                          />
                          Auto-transcribe on import
                        </label>
                      </div>
                    )}
                    <RemotionPreview`,
      );
      console.log('empty start screen', s.includes('data-empty-start'));
    }
  }

  // Fire transcribe after hub import if setting on
  if (s.includes('function importHubPiece') && !s.includes('autoTranscribeOnImport &&')) {
    // after patch clips in importHubPiece — look for setSelectedClip in that fn
    const ih = s.indexOf('function importHubPiece');
    const ihEnd = s.indexOf('\n  function ', ih + 10);
    let chunk = s.slice(ih, ihEnd > 0 ? ihEnd : ih + 2000);
    if (chunk.includes('setSelectedClip') && !chunk.includes('autoTranscribeOnImport')) {
      chunk = chunk.replace(
        /setSelectedClip\(([^)]+)\);/,
        `setSelectedClip($1);
    if (autoTranscribeOnImport) {
      window.setTimeout(() => { void transcribeCurrentClip(); }, 400);
    }`,
      );
      s = s.slice(0, ih) + chunk + s.slice(ihEnd > 0 ? ihEnd : ih + chunk.length);
      console.log('hub import auto-transcribe');
    }
  }

  write(p, s, crlf);
}

// ── 3) captionLayer: don't crash if css.word/active missing ───────────────
{
  const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);
  if (s.includes('const themePaint = isActive || power ? css.active : css.word;')) {
    s = s.replace(
      'const themePaint = isActive || power ? css.active : css.word;',
      'const themePaint = (isActive || power ? css.active : css.word) ?? css.word ?? {};',
    );
    write(p, s, crlf);
    const dst = path.join(
      root,
      'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
    );
    if (fs.existsSync(dst)) fs.copyFileSync(p, dst);
    console.log('themePaint guarded');
  }
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
        /page\.tsx|WordDrag|captionLayer|freePlace|autoTranscribe|empty-start/.test(
          l,
        ),
    );
  console.log('errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (!lines.length) {
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 12)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}
console.log('OK');
