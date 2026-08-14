#!/usr/bin/env node
/**
 * Keep the reel player on screen during a long upload.
 *
 * Bugs:
 *  1. uploadJob.blobUrl unmounts RemotionPreview and swaps in a raw <video>
 *     that shows nothing until a 3-min file finishes probing.
 *  2. addUpload awaits probeDuration BEFORE insertClipAtPlayhead, so the
 *     timeline stays empty while the canvas is gone.
 *  3. insertClipAtPlayhead no-ops when there is no project yet.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const file = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/page.tsx');

function norm(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let s = norm(raw);
let n = 0;

const oldInsert = `  function insertClipAtPlayhead(clip: ReelClip) {

    if (!project) return;
    const at = currentClip
      ? project.clips.findIndex((c) => c.id === currentClip.id) + 1
      : project.clips.length;
    const next = project.clips.slice();
    next.splice(Math.max(0, at), 0, clip);
    patch({ clips: next });
  }`;

const newInsert = `  function insertClipAtPlayhead(clip: ReelClip) {
    if (!project) {
      // First clip of a brand-new session — stand up a local draft so the
      // player never waits on a server round-trip.
      setProject({
        id: \`draft-\${Date.now().toString(36)}\`,
        name: clip.name.slice(0, 48) || 'Untitled reel',
        clips: [clip],
        audio: null,
      } as ReelProject);
      return;
    }
    const at = currentClip
      ? project.clips.findIndex((c) => c.id === currentClip.id) + 1
      : project.clips.length;
    const next = project.clips.slice();
    next.splice(Math.max(0, at), 0, clip);
    patch({ clips: next });
  }`;

if (!s.includes(oldInsert)) {
  console.error('insertClipAtPlayhead block not exact');
} else {
  s = s.replace(oldInsert, newInsert);
  n += 1;
  console.log('patched insertClipAtPlayhead');
}

const oldAdd = `      const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'audio' ? 'mp3' : 'mp4');
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
      }`;

const newAdd = `      const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'audio' ? 'mp3' : 'mp4');
      // Drop the clip on the timeline NOW so the player never goes blank.
      // Probe duration in the background — a 3-min file can take a while.
      let clipId: string | null = null;
      let localDur = 0;
      if (kind === 'video' && localBlob) {
        const clip = {
          id: makeClipId(),
          name: file.name.slice(0, 60),
          url: localBlob,
          durationSec: 5,
          trimEndSec: 0,
        };
        clipId = clip.id;
        insertClipAtPlayhead(clip);
        setSelectedClip(clip.id);
        setTab('clips');
        void probeDuration(localBlob).then((dur) => {
          if (dur > 0 && clipId) {
            localDur = dur;
            patchClip(clipId, { durationSec: dur });
          }
        });
      }
      setUploadJob((j) => (j ? { ...j, pct: 8, phase: 'Requesting upload slot…' } : j));
      const mint = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ext, contentType: file.type || undefined, kind }),
      });
      const mintJson = await mint.json();
      if (!mintJson.success) throw new Error(mintJson.error || 'Could not mint an upload URL');`;

if (!s.includes(oldAdd)) {
  console.error('addUpload insert block not exact');
} else {
  s = s.replace(oldAdd, newAdd);
  n += 1;
  console.log('patched addUpload insert-first');
}

const oldSwap = `                    {uploadJob?.blobUrl ? (
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
                    )}`;

const newSwap = `                    <RemotionPreview
                        project={projectWithWordPlace ?? project}
                        aspect={aspect === '9:16' ? 'vertical' : aspect === '16:9' ? 'landscape' : 'square'}
                        playheadSec={playheadSec}
                        freePlaceEdit={stackEditMode}
                      />`;

if (!s.includes(oldSwap)) {
  console.error('preview swap block not exact');
} else {
  s = s.replace(oldSwap, newSwap);
  n += 1;
  console.log('patched keep RemotionPreview mounted');
}

if (n === 0) {
  console.error('no patches applied');
  process.exit(1);
}

fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('wrote', n, 'patches');

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out.split(/\r?\n/).filter((l) => /error TS/.test(l));
  console.log('errors', lines.length);
  lines.slice(0, 16).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('OK');
