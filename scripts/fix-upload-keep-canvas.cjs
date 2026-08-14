#!/usr/bin/env node
/**
 * Keep the Reel Studio canvas up during / after a long upload.
 *
 * Root cause: addUpload waits on a remote probe, then Remotion mounts the
 * public URL before storage is readable. The Player paints black / unmounts.
 *
 * Fix:
 *  - Insert the clip immediately from a local blob URL so the stage stays.
 *  - PUT with XHR so we get real percent.
 *  - Overlay progress on the stage.
 *  - Only swap to the public URL once a <video> can actually load it.
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

// ── 1) State next to busy ────────────────────────────────────────────────
{
  const old = `  const [busy, setBusy] = useState(false);`;
  const neu = `  const [busy, setBusy] = useState(false);
  const [uploadJob, setUploadJob] = useState<{
    name: string;
    pct: number;
    phase: string;
    blobUrl: string | null;
  } | null>(null);`;
  if (s.includes(old) && !s.includes('const [uploadJob, setUploadJob]')) {
    s = s.replace(old, neu);
    n++;
    console.log('uploadJob state');
  } else if (s.includes('const [uploadJob, setUploadJob]')) {
    console.log('uploadJob already');
  } else {
    console.warn('busy state not exact');
  }
}

// ── 2) Helpers after probeFileDuration ───────────────────────────────────
{
  const old = `function probeFileDuration(file: File): Promise<number> {
  const blobUrl = URL.createObjectURL(file);
  return probeDuration(blobUrl).finally(() => URL.revokeObjectURL(blobUrl));
}`;
  const neu = `function probeFileDuration(file: File): Promise<number> {
  const blobUrl = URL.createObjectURL(file);
  return probeDuration(blobUrl).finally(() => URL.revokeObjectURL(blobUrl));
}

function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onPct: (n: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onPct(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(\`Upload rejected (\${xhr.status}): \${String(xhr.responseText || '').slice(0, 160)}\`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    xhr.send(file);
  });
}

function waitUntilPlayable(url: string, timeoutMs = 20000): Promise<boolean> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (ok: boolean) => {
      window.clearTimeout(timer);
      v.onloadedmetadata = null;
      v.onerror = null;
      v.removeAttribute('src');
      v.load();
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(false), timeoutMs);
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0);
    v.onerror = () => done(false);
    v.src = url;
  });
}`;
  if (s.includes(old) && !s.includes('function putWithProgress')) {
    s = s.replace(old, neu);
    n++;
    console.log('putWithProgress + waitUntilPlayable');
  } else if (s.includes('function putWithProgress')) {
    console.log('helpers already');
  } else {
    console.warn('probeFileDuration not exact');
  }
}

// ── 3) Rewrite addUpload ─────────────────────────────────────────────────
{
  const start = s.indexOf("  async function addUpload(file: File, kind: 'video' | 'audio') {");
  const end = s.indexOf('  async function generateVoiceover()', start);
  if (start < 0 || end < 0) {
    console.warn('addUpload bounds not found', start, end);
  } else {
    const neu = `  async function addUpload(file: File, kind: 'video' | 'audio') {
    setBusy(true);
    setError(null);
    const localBlob = kind === 'video' ? URL.createObjectURL(file) : null;
    setUploadJob({
      name: file.name,
      pct: 2,
      phase: 'Reading file…',
      blobUrl: localBlob,
    });
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'audio' ? 'mp3' : 'mp4');
      const localDur = kind === 'video' ? await probeDuration(localBlob!) : 0;
      setUploadJob((j) => (j ? { ...j, pct: 8, phase: 'Requesting upload slot…' } : j));
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');

      // Keep the canvas alive: drop the clip in NOW from the local file.
      let clipId: string | null = null;
      if (kind === 'video') {
        const clip = {
          id: makeClipId(),
          name: file.name.slice(0, 60),
          url: localBlob!,
          durationSec: localDur || 5,
          trimEndSec: 0,
        };
        clipId = clip.id;
        insertClipAtPlayhead(clip);
        setSelectedClip(clip.id);
        setTab('clips');
      }

      const putHeaders: Record<string, string> = {
        'content-type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      };
      if (mintJson.token) putHeaders.authorization = \`Bearer \${mintJson.token}\`;
      setUploadJob((j) => (j ? { ...j, pct: 10, phase: \`Uploading \${file.name}…\` } : j));
      await putWithProgress(mintJson.signedUrl, file, putHeaders, (pct) => {
        setUploadJob((j) => (j ? { ...j, pct: 10 + Math.round(pct * 0.8), phase: \`Uploading \${pct}%\` } : j));
      });

      const url = String(mintJson.publicUrl || '');
      if (!url) throw new Error('Upload returned no public URL');
      setUploadJob((j) => (j ? { ...j, pct: 92, phase: 'Confirming the file is playable…' } : j));

      if (kind === 'video' && clipId) {
        const ready = await waitUntilPlayable(url);
        patchClip(clipId, { url: ready ? url : localBlob!, durationSec: localDur || 5 });
        if (!ready) {
          setNote(\`Uploaded \${file.name} (\${(localDur || 0).toFixed(1)}s). Storage is still catching up — preview is using the local file.\`);
        } else {
          setNote(\`Uploaded \${file.name} (\${(localDur || 0).toFixed(1)}s).\`);
          if (localBlob) URL.revokeObjectURL(localBlob);
        }
      } else {
        patch({ audio: { url, name: file.name.slice(0, 60), offsetSec: 0, durationSec: null } });
        setTab('clips');
        setNote(\`Uploaded \${file.name} (audio).\`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      if (localBlob) URL.revokeObjectURL(localBlob);
    } finally {
      setUploadJob(null);
      setBusy(false);
    }
  }

`;
    s = s.slice(0, start) + neu + s.slice(end);
    n++;
    console.log('rewrote addUpload');
  }
}

// ── 4) Stage overlay: progress + keep canvas sized ───────────────────────
{
  const old = `                    <RemotionPreview
                      project={projectWithWordPlace ?? project}
                      aspect={aspect === '9:16' ? 'vertical' : aspect === '16:9' ? 'landscape' : 'square'}
                      // The timeline drives the frame. Without this the Player ran
                      // its own clock and the ruler moved nothing: captions (React
                      // state) tracked the playhead while the video sat still.
                      playheadSec={playheadSec}
                      freePlaceEdit={stackEditMode}
                    />`;
  const neu = `                    {uploadJob?.blobUrl ? (
                      <video
                        src={uploadJob.blobUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-contain bg-black"
                      />
                    ) : (
                      <RemotionPreview
                        project={projectWithWordPlace ?? project}
                        aspect={aspect === '9:16' ? 'vertical' : aspect === '16:9' ? 'landscape' : 'square'}
                        playheadSec={playheadSec}
                        freePlaceEdit={stackEditMode}
                      />
                    )}
                    {uploadJob && (
                      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10">
                        <p className="mb-1.5 text-[11px] font-semibold text-bone">
                          {uploadJob.phase}
                        </p>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                          <div
                            className="h-full rounded-full bg-brass transition-[width] duration-150"
                            style={{ width: \`\${Math.max(4, uploadJob.pct)}%\` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-bone/50">
                          {uploadJob.name} · {uploadJob.pct}%
                        </p>
                      </div>
                    )}`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    n++;
    console.log('stage overlay + local video');
  } else if (s.includes('uploadJob?.blobUrl')) {
    console.log('stage overlay already');
  } else {
    console.warn('RemotionPreview block not exact');
  }
}

// ── 5) Also show progress on the empty-start else (no clips yet) ─────────
{
  const old = `              ) : (
                <div
                  data-empty-start
                  className="relative flex shrink-0 flex-col items-center justify-center gap-4 rounded-xl bg-black px-6 py-16 text-center shadow-2xl ring-1 ring-bone/10"
                  style={{ width: stageBox.w || 360, minHeight: stageBox.h || 480 }}
                >`;
  const neu = `              ) : (
                <div
                  data-empty-start
                  className="relative flex shrink-0 flex-col items-center justify-center gap-4 rounded-xl bg-black px-6 py-16 text-center shadow-2xl ring-1 ring-bone/10"
                  style={{ width: stageBox.w || 360, minHeight: stageBox.h || 480 }}
                >
                  {uploadJob?.blobUrl && (
                    <video
                      src={uploadJob.blobUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-contain opacity-40"
                    />
                  )}
                  {uploadJob && (
                    <div className="absolute inset-x-6 bottom-6 z-10">
                      <p className="mb-1.5 text-[11px] font-semibold text-bone">{uploadJob.phase}</p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-brass"
                          style={{ width: \`\${Math.max(4, uploadJob.pct)}%\` }}
                        />
                      </div>
                    </div>
                  )}`;
  if (s.includes(old) && !s.includes('{uploadJob?.blobUrl && (')) {
    s = s.replace(old, neu);
    n++;
    console.log('empty-start progress');
  } else {
    console.log('empty-start progress skip');
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
  const lines = out.split(/\r?\n/).filter((l) => /error TS/.test(l) && /page\.tsx/.test(l));
  console.log('errors', lines.length);
  lines.slice(0, 20).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('patches', n);
console.log('OK');
