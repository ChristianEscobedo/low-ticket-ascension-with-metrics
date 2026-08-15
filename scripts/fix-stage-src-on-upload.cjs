/**
 * Reel Studio: the stage <video> is driven 100% by the playback clock
 * (syncVideoToClock), which ONLY runs while the clock is ticking. So a clip that
 * arrives while the clock is parked - i.e. every upload - never gets a `src`,
 * and the player stays black: "the video does not show after upload".
 *
 * This patch:
 *  1. Falls the stage source back to the first clip when the playhead is past
 *     the end (a stale playhead used to blank the whole stage).
 *  2. Adds a mount/source effect that paints the current frame imperatively the
 *     moment the stage URL changes (insert, blob -> storage swap, project load).
 *  3. Puts the upload progress ON the stage so there is visible feedback.
 *  4. preload="auto" so the first frame decodes without a play().
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(
  process.cwd(),
  'src',
  'app',
  '(fullscreen)',
  'admin',
  'reel-studio',
  'page.tsx',
);
let src = fs.readFileSync(FILE, 'utf8');
const before = src;
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const L = (...lines) => lines.join(nl);

/* ---------------------------------------------------------------- 1 + 2 --- */
const OLD_PREVIEW = `const previewSrc = stageClip?.url || project?.composedUrl || '';`;
if (!src.includes(OLD_PREVIEW)) throw new Error('previewSrc anchor not found');

const NEW_PREVIEW = L(
  `const previewSrc =`,
  `    stageClip?.url || project?.clips?.[0]?.url || project?.composedUrl || '';`,
  ``,
  `  /**`,
  `   * PAINT THE STAGE WHEN THE SOURCE CHANGES.`,
  `   *`,
  `   * The <video> has no src prop on purpose - the clock owns it. But the clock`,
  `   * only runs while PLAYING, so a clip that lands while playback is parked`,
  `   * (every upload, every project load) never got a source and the player sat`,
  `   * black. This effect does the one thing the clock cannot: swap + seek the`,
  `   * element the instant the stage URL changes, so an uploaded clip shows up`,
  `   * immediately - and swaps cleanly again when the blob becomes a storage URL.`,
  `   */`,
  `  useEffect(() => {`,
  `    const v = previewRef.current;`,
  `    if (!v || !previewSrc) return;`,
  `    if (v.dataset.clipUrl === previewSrc) return;`,
  `    swappingRef.current = true;`,
  `    v.dataset.clipUrl = previewSrc;`,
  `    pendingSeekRef.current =`,
  `      (stageClip?.trimStartSec ?? 0) + (clockHit?.local ?? 0);`,
  `    v.src = previewSrc;`,
  `    try {`,
  `      v.load();`,
  `    } catch {`,
  `      /* Safari can throw on a same-tick load - the swap still lands */`,
  `    }`,
  `    // eslint-disable-next-line react-hooks/exhaustive-deps`,
  `  }, [previewSrc, stageClip?.id]);`,
);
src = src.replace(OLD_PREVIEW, NEW_PREVIEW);

/* -------------------------------------------------------------------- 3 --- */
const STAGE_ANCHOR = `{/* R25: ONE element, driven 100% by the playback clock`;
if (!src.includes(STAGE_ANCHOR)) throw new Error('stage video anchor not found');

const OVERLAY = L(
  `{/* Upload feedback lives ON the stage - the sidebar is not where`,
  `                        the eye is while a file is climbing. */}`,
  `                    {uploadJob && (`,
  `                      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/85 via-black/50 to-transparent px-3 pb-6 pt-2.5">`,
  `                        <p className="text-[11px] font-semibold text-bone">`,
  `                          {uploadJob.phase}`,
  `                        </p>`,
  `                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bone/20">`,
  `                          <div`,
  `                            className="h-full rounded-full bg-emerald-400 transition-[width] duration-200"`,
  `                            style={{ width: \`\${Math.max(4, uploadJob.pct)}%\` }}`,
  `                          />`,
  `                        </div>`,
  `                        <p className="mt-1 truncate text-[10px] text-bone/60">`,
  `                          {uploadJob.name} {uploadJob.pct}%`,
  `                        </p>`,
  `                      </div>`,
  `                    )}`,
  ``,
  `                    ` + STAGE_ANCHOR,
);
src = src.replace(STAGE_ANCHOR, OVERLAY);

/* -------------------------------------------------------------------- 4 --- */
const PRELOAD_ANCHOR = `                      data-clip-url=""`;
if (src.includes(PRELOAD_ANCHOR)) {
  src = src.replace(PRELOAD_ANCHOR, PRELOAD_ANCHOR + nl + `                      preload="auto"`);
}

if (src === before) throw new Error('nothing changed');
fs.writeFileSync(FILE, src);
console.log('patched: stage src effect + stage upload overlay + preload');
