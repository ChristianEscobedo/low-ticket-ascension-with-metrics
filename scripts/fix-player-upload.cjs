#!/usr/bin/env node
/**
 * Fix Reel Studio playback + empty-start + long-video upload.
 *
 * 1. Empty-start overlay lives in the "has clips" branch — never shows.
 *    Move it to the no-clips else.
 * 2. onPause stops the clock during src swaps → player sticks after a few plays.
 * 3. Duration is probed from the public URL after upload. Fresh files often
 *    return 0, so a 3-min clip becomes 5s and the playhead looks "way off".
 *    Probe the local File first.
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

const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
const p = path.join(root, rel);
const raw = fs.readFileSync(p, 'utf8');
const crlf = raw.includes('\r\n');
let s = norm(raw);
let n = 0;

// ── 1) Probe local File duration (not just a URL) ─────────────────────────
{
  const old = `/** Probe a video's runtime client-side via a detached element. */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () =>
      resolve(Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : 0);
    v.onerror = () => resolve(0);
    v.src = url;
  });
}`;
  const neu = `/** Probe a video's runtime client-side via a detached element. */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (n: number) => {
      v.removeAttribute('src');
      v.load();
      resolve(n);
    };
    v.onloadedmetadata = () =>
      done(Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration * 10) / 10 : 0);
    v.onerror = () => done(0);
    v.src = url;
  });
}

/** Probe a local File before upload so we never fall back to 5s on a 3-min clip. */
function probeFileDuration(file: File): Promise<number> {
  const blobUrl = URL.createObjectURL(file);
  return probeDuration(blobUrl).finally(() => URL.revokeObjectURL(blobUrl));
}`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    n++;
    console.log('probe File duration');
  } else if (s.includes('function probeFileDuration')) {
    console.log('probe File already');
  } else {
    console.warn('probeDuration not exact');
  }
}

// ── 2) addUpload: don't require project; probe local file first ───────────
{
  const old = `  async function addUpload(file: File, kind: 'video' | 'audio') {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'audio' ? 'mp3' : 'mp4');
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');
      const put = await fetch(mintJson.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) {
        const text = await put.text().catch(() => '');
        throw new Error(
          \`Upload rejected (\${put.status})\${text ? \`: \${text.slice(0, 160)}\` : ''} — if this mentions size, apply the bucket-limit migration.\`,
        );
      }
      const url = String(mintJson.publicUrl || '');
      if (!url) throw new Error('Upload returned no public URL');
      if (kind === 'video') {
        const dur = await probeDuration(url);
        const clip = {
          id: makeClipId(),
          name: file.name.slice(0, 60),
          url,
          durationSec: dur || 5,
          trimEndSec: 0,
        };
        insertClipAtPlayhead(clip);
        setSelectedClip(clip.id);
        setTab('clips');

      } else {
        patch({ audio: { url, name: file.name.slice(0, 60), offsetSec: 0, durationSec: null } });
        setTab('clips');
      }
      setNote('Uploaded and attached.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }`;
  const neu = `  async function addUpload(file: File, kind: 'video' | 'audio') {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'audio' ? 'mp3' : 'mp4');
      const localDur = kind === 'video' ? await probeFileDuration(file) : 0;
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');
      const putHeaders: Record<string, string> = {
        'content-type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      };
      if (mintJson.token) putHeaders.authorization = \`Bearer \${mintJson.token}\`;
      const put = await fetch(mintJson.signedUrl, {
        method: 'PUT',
        headers: putHeaders,
        body: file,
      });
      if (!put.ok) {
        const text = await put.text().catch(() => '');
        throw new Error(
          \`Upload rejected (\${put.status})\${text ? \`: \${text.slice(0, 160)}\` : ''} — if this mentions size, apply the bucket-limit migration.\`,
        );
      }
      const url = String(mintJson.publicUrl || '');
      if (!url) throw new Error('Upload returned no public URL');
      if (kind === 'video') {
        const remoteDur = await probeDuration(url);
        const dur = localDur || remoteDur || 5;
        const clip = {
          id: makeClipId(),
          name: file.name.slice(0, 60),
          url,
          durationSec: dur,
          trimEndSec: 0,
        };
        insertClipAtPlayhead(clip);
        setSelectedClip(clip.id);
        setTab('clips');
      } else {
        patch({ audio: { url, name: file.name.slice(0, 60), offsetSec: 0, durationSec: null } });
        setTab('clips');
      }
      setNote(\`Uploaded \${file.name} (\${kind === 'video' ? (localDur || 0).toFixed(1) + 's' : 'audio'}).\`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    n++;
    console.log('addUpload local probe + no project gate');
  } else if (s.includes('probeFileDuration(file)')) {
    console.log('addUpload already patched');
  } else {
    console.warn('addUpload not exact');
  }
}

// ── 3) Don't stop the clock on pause during a src swap ────────────────────
{
  const old = `if (clockRef.current.playing) stopClock();`;
  // only the onPause one — look for the comment nearby
  const pauseOld = `// a src swap, not a user pause
                        if (clockRef.current.playing) stopClock();`;
  const pauseNeu = `// a src swap, not a user pause
                        if (clockRef.current.playing && !swappingRef.current) stopClock();`;
  if (s.includes(pauseOld)) {
    s = s.replace(pauseOld, pauseNeu);
    n++;
    console.log('onPause ignores swap');
  } else if (s.includes('!swappingRef.current) stopClock()')) {
    console.log('onPause already gated');
  } else {
    // fallback: first playing-stopClock after onPause-ish
    const i = s.indexOf('if (clockRef.current.playing) stopClock();');
    if (i >= 0) {
      s = s.replace(
        'if (clockRef.current.playing) stopClock();',
        'if (clockRef.current.playing && !swappingRef.current) stopClock();',
      );
      n++;
      console.log('onPause gated (fallback)');
    } else {
      console.warn('onPause stopClock not found');
    }
  }
}

// ── 4) After metadata, resume play if clock is running ────────────────────
{
  const old = `                      onLoadedMetadata={(e) => {
                        swappingRef.current = false;
                        const pending = pendingSeekRef.current;`;
  const neu = `                      onLoadedMetadata={(e) => {
                        swappingRef.current = false;
                        const el = e.currentTarget;
                        const pending = pendingSeekRef.current;`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    n++;
    console.log('onLoadedMetadata el');
  }
  // After the pending seek block, resume play. Find the typical tail.
  const seekTail = `                          try {
                            e.currentTarget.currentTime = pending;
                          } catch {
                            /* ignore */
                          }
                        }`;
  const seekTail2 = `                          try {
                            (e.currentTarget as HTMLVideoElement).currentTime = pending;
                          } catch {
                            /* ignore */
                          }
                        }`;
  const resume = `
                        if (clockRef.current.playing && el.paused) {
                          void el.play().catch(() => {});
                        }`;
  if (s.includes(seekTail) && !s.includes('if (clockRef.current.playing && el.paused)')) {
    s = s.replace(seekTail, seekTail + resume);
    n++;
    console.log('resume play after metadata');
  } else if (s.includes(seekTail2) && !s.includes('if (clockRef.current.playing && el.paused)')) {
    s = s.replace(seekTail2, seekTail2 + resume);
    n++;
    console.log('resume play after metadata (alt)');
  } else if (s.includes('if (clockRef.current.playing && el.paused)')) {
    console.log('resume already');
  } else {
    console.warn('metadata seek tail not exact — dumping nearby');
    const i = s.indexOf('onLoadedMetadata');
    if (i >= 0) console.log(JSON.stringify(s.slice(i, i + 700)));
  }
}

// ── 5) startClock: unstick a leftover swap flag ───────────────────────────
{
  const old = `    if (!proj || proj.clips.length === 0 || c.playing) return;
    if (c.t >= tot - 0.01) c.t = 0; // replay from the top when at the end
    c.playing = true;`;
  const neu = `    if (!proj || proj.clips.length === 0 || c.playing) return;
    if (c.t >= tot - 0.01) c.t = 0; // replay from the top when at the end
    swappingRef.current = false; // leftover swap must not block play()
    c.playing = true;`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    n++;
    console.log('startClock clears swap');
  } else if (s.includes('leftover swap must not block')) {
    console.log('startClock already clears swap');
  } else {
    console.warn('startClock body not exact');
  }
}

// ── 6) Empty-start: replace the no-clips else with the real overlay ───────
{
  const oldElse = `              ) : (

                <div className="rounded-xl border border-dashed border-bone/10 px-10 py-16 text-sm text-bone/30">
                  Add a scene to see it here.
                </div>
              )}`;
  const neuElse = `              ) : (
                <div
                  data-empty-start
                  className="relative flex shrink-0 flex-col items-center justify-center gap-4 rounded-xl bg-black px-6 py-16 text-center shadow-2xl ring-1 ring-bone/10"
                  style={{ width: stageBox.w || 360, minHeight: stageBox.h || 480 }}
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
                        const tabBtn = document.querySelector('[data-tab="clips"]') as HTMLButtonElement | null;
                        tabBtn?.click();
                      }}
                      className="rounded-md border border-bone/20 px-3 py-1.5 text-[11px] font-semibold text-bone/80 hover:bg-white/5"
                    >
                      Media library
                    </button>
                  </div>
                </div>
              )}`;
  if (s.includes(oldElse)) {
    s = s.replace(oldElse, neuElse);
    n++;
    console.log('empty-start else restored');
  } else if (s.includes('data-empty-start') && s.includes('Start a reel') && s.split('data-empty-start').length > 2) {
    console.log('empty-start already in else?');
  } else {
    console.warn('empty else not exact');
    const i = s.indexOf('Add a scene to see it here');
    console.log('add-scene idx', i);
    if (i >= 0) console.log(JSON.stringify(s.slice(i - 180, i + 120)));
  }
}

// ── 7) Return token from upload route ─────────────────────────────────────
{
  const routeP = path.join(root, 'src/app/api/admin/reel-upload-url/route.ts');
  const routeRaw = fs.readFileSync(routeP, 'utf8');
  const routeCrlf = routeRaw.includes('\r\n');
  let r = norm(routeRaw);
  if (!r.includes('token: data.token')) {
    const oldRet = `  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ success:`;
    if (r.includes(oldRet)) {
      // read the rest of the return
      const i = r.indexOf(oldRet);
      const rest = r.slice(i, i + 400);
      console.log('return snippet', JSON.stringify(rest.slice(0, 280)));
    }
    r = r.replace(
      /return NextResponse\.json\(\{\s*success:\s*true,\s*signedUrl:\s*data\.signedUrl,\s*publicUrl,?\s*\}\);/,
      `return NextResponse.json({
    success: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl,
  });`,
    );
    if (r.includes('token: data.token')) {
      write(routeP, r, routeCrlf);
      n++;
      console.log('upload route returns token');
    } else {
      console.warn('upload route return not patched');
    }
  } else {
    console.log('upload route already has token');
  }
}

write(p, s, crlf);

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out.split(/\r?\n/).filter((l) => /error TS/.test(l) && /(page\.tsx|reel-upload)/.test(l));
  console.log('errors', lines.length);
  lines.slice(0, 20).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('patches', n);
console.log('OK');
