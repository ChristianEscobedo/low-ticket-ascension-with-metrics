/**
 * The Remotion render worker. One job: accept a RenderPlan, render the MP4,
 * upload to Supabase storage, return the public URL.
 *
 * Runs on Railway/Fly as a persistent Docker container. The Next.js app POSTs
 * here instead of calling Remotion Lambda — no IAM, no S3, no function names.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT (default 8080).
 */
const express = require('express');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition, getCompositions } = require('@remotion/renderer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;
const BUCKET = 'reel-renders';

// Lazy Supabase client — created on first use, NOT at module load. The worker
// starts and serves /health even without env vars; it only fails on /render if
// they're missing (which is the right behavior — the client tells you why).
let _supabase = null;
function supabase() {
  if (_supabase) return _supabase;
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (Railway Variables).');
  _supabase = createClient(url, key);
  return _supabase;
}


// Bundle the composition ONCE at startup — renders reuse it.
let bundled = null;
async function getBundle() {
  if (bundled) return bundled;
  const entry = path.join(__dirname, 'remotion-project', 'index.ts');
  console.log('[worker] bundling', entry);
  bundled = await bundle(entry);
  console.log('[worker] bundled OK');
  return bundled;
}

app.get('/health', (_req, res) => res.json({ ok: true, bundled: !!bundled }));

app.post('/render', async (req, res) => {
  const { plan, reelId } = req.body || {};
  if (!plan || !plan.clips || !plan.clips.length) {
    return res.status(400).json({ success: false, error: 'Invalid plan — no clips.' });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-render-'));
  const outPath = path.join(tmpDir, 'out.mp4');

  try {
    const serveUrl = await getBundle();
    // This id must match the <Composition id="..."> in remotion-project/Root.tsx
    // exactly. It is "Reel" — the COMPONENT is named ReelComposition, which is
    // the name this used to ask for, and that mismatch failed every render.
    //
    // Resolve the composition defensively. `selectComposition` THROWS on an
    // unknown id, which turns a one-word naming drift into a total render
    // outage ("Could not find composition with ID X. Available: Reel"). If the
    // expected id is missing we fall back to whatever the bundle actually
    // registers, and log it loudly so the drift is visible instead of fatal.
    let compositionId = 'Reel';
    try {
      const available = await getCompositions(serveUrl, { inputProps: { plan } });
      const ids = available.map((c) => c.id);
      if (!ids.includes(compositionId)) {
        console.warn(
          `[render] composition "${compositionId}" not in bundle; available: ${ids.join(', ') || '(none)'}`,
        );
        if (!ids.length) throw new Error('Remotion bundle registered no compositions');
        compositionId = ids[0];
        console.warn(`[render] falling back to composition "${compositionId}"`);
      }
    } catch (e) {
      // Non-fatal: let selectComposition below produce the authoritative error.
      console.warn(`[render] composition probe failed: ${e && e.message ? e.message : e}`);
    }

    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps: { plan },
    });

    console.log(`[worker] rendering ${plan.clips.length} clips, ${plan.durationInFrames} frames @ ${plan.fps}fps`);
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outPath,
      inputProps: { plan },
      onProgress: ({ progress }) => {
        if (progress % 0.1 < 0.01) console.log(`[worker] ${Math.round(progress * 100)}%`);
      },
    });

    // Upload to Supabase storage
    const fileName = `${reelId || 'reel'}-${Date.now()}.mp4`;
    const fileBuffer = fs.readFileSync(outPath);
    const { error: upErr } = await supabase().storage
      .from(BUCKET)
      .upload(fileName, fileBuffer, { contentType: 'video/mp4', upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: urlData } = supabase().storage.from(BUCKET).getPublicUrl(fileName);

    console.log(`[worker] done → ${urlData.publicUrl}`);
    res.json({ success: true, url: urlData.publicUrl, renderId: fileName });
  } catch (err) {
    console.error('[worker] render failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Pre-bundle on startup so the first render isn't slow
getBundle().catch((e) => console.error('[worker] pre-bundle failed:', e.message));

app.listen(PORT, () => console.log(`[worker] listening on :${PORT}`));
