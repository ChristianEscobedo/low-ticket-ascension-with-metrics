/**
 * ffmpeg-worker — the local/owned ffmpeg integration for everything fal's
 * compose endpoint can't do (see REEL_STUDIO_V2_AGENTIC_VIDEO_STRATEGY.md,
 * Risk #1): trim with an IN-POINT (true splits, the Cutdown Agent), and later
 * caption burn-in + waveforms.
 *
 * Binary resolution order: `FFMPEG_PATH` env → `@ffmpeg-installer/ffmpeg`
 * (serverless-safe: ships the binary as a static package file) → legacy
 * `ffmpeg-static` (local dev) → PATH. Works on Vercel out of the box because
 * the installer binary is a real file, never a postinstall download.

 *
 * Safety: only ever runs with execFile (no shell), args are validated numbers
 * and a working temp dir. Source URLs are fetched server-side (the URL was
 * already validated by the caller).
 */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildSplitScreenFilter,

  parseSceneCutTimes,
  sceneSelectExpr,
  spriteFpsValue,
} from '@/lib/mothermode/reel/sceneCuts';
import { buildAssCaptions, type AssCaptionStyle } from '@/lib/mothermode/reel/assCaptions';
import type { ReelWord } from '@/lib/mothermode/reel/types';

/**
 * Locate a REAL ffmpeg binary on disk. On Vercel the serverless bundle traces
 * `require('@ffmpeg-installer/ffmpeg')` but the binary file itself lives in
 * pnpm's virtual store (the .pnpm/@ffmpeg-installer+ffmpeg@VERSION subtree),
 * which the resolver's naive `join(cwd,'node_modules','@ffmpeg-installer',<plat>-<arch>)` never

 * finds — so it used to fall through to a non-existent ffmpeg-static path and
 * spawn() ENOENTs. This walks the actual install trees and returns the first
 * binary that exists.
 */
function findInstallerBinary(): string | null {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const platArch = `${process.platform}-${process.arch}`;
  const cwd = process.cwd();
  const candidates: string[] = [
    // pnpm virtual store: .pnpm/@ffmpeg-installer+ffmpeg@*/node_modules/@ffmpeg-installer/ffmpeg/<plat>-<arch>/ffmpeg
    join(cwd, 'node_modules', '.pnpm'),
    // npm/yarn flat: node_modules/@ffmpeg-installer/ffmpeg/<plat>-<arch>/ffmpeg
    join(cwd, 'node_modules', '@ffmpeg-installer', 'ffmpeg', platArch, exe),
    // the (incorrect but kept for safety) bare scoped dir
    join(cwd, 'node_modules', '@ffmpeg-installer', platArch, exe),
  ];

  // 1) exact flat layouts
  for (let i = 1; i < candidates.length; i++) {
    if (existsSync(candidates[i])) return candidates[i];
  }

  // 2) walk the pnpm virtual store for the installer package dir. The binary
  //    lives at <entry>/node_modules/@ffmpeg-installer/<plat>-<arch>/ffmpeg —
  //    the platform dir is a SIBLING of the `ffmpeg` package, directly under
  //    `@ffmpeg-installer` (NOT inside `@ffmpeg-installer/ffmpeg/`).
  const pnpmDir = candidates[0];
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (!entry.startsWith('@ffmpeg-installer+ffmpeg@')) continue;
      const binPath = join(
        pnpmDir,
        entry,
        'node_modules',
        '@ffmpeg-installer',
        platArch,
        exe,
      );
      if (existsSync(binPath)) return binPath;
    }
  }
  return null;
}


export function resolveFfmpegPath(): string {
  const env = (process.env.FFMPEG_PATH || '').trim();
  if (env) return env;

  // 1) @ffmpeg-installer/ffmpeg — the SERVERLESS-SAFE binary. Ships the
  //    platform ffmpeg as a static package file (no postinstall download).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const inst = require('@ffmpeg-installer/ffmpeg') as { path?: string };
    if (
      inst &&
      typeof inst.path === 'string' &&
      inst.path &&
      !inst.path.includes('[') &&
      existsSync(inst.path)
    ) {
      return inst.path;
    }
  } catch {
    /* installer package not resolvable in this runtime */
  }

  // 2) Walk the real install trees (pnpm virtual store + flat npm) for the
  //    installer binary — the layout the serverless bundle actually leaves on
  //    disk. THIS is what stops the ffmpeg-static ENOENT on Vercel.
  const found = findInstallerBinary();
  if (found) return found;

  // 3) Legacy ffmpeg-static — local dev only, and ONLY if the binary truly
  //    exists (never return the package's .path blindly: its postinstall is
  //    blocked on Vercel, so .path points at a file that never landed).
  try {
    const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const onDisk = join(process.cwd(), 'node_modules', 'ffmpeg-static', exe);
    if (existsSync(onDisk)) return onDisk;
  } catch {
    /* cwd unavailable */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bin = require('ffmpeg-static') as string | null;
    if (bin && !bin.includes('[') && existsSync(bin)) return bin;
  } catch {
    /* package not resolvable in this runtime */
  }
  return 'ffmpeg'; // last resort: hope it's on PATH
}



function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(resolveFfmpegPath(), args, { timeout: timeoutMs }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`ffmpeg failed: ${(stderr || err.message || '').slice(0, 400)}`));
      } else {
        resolve();
      }
    });
  });
}

/** Variant for probes (showinfo): resolves ffmpeg's STDERR, where the metadata lands. */
function runFfmpegCapture(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      resolveFfmpegPath(),
      args,
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`ffmpeg probe failed: ${(stderr || err.message || '').slice(0, 400)}`));
        } else {
          resolve(stderr || '');
        }
      },
    );
  });
}

/**
 * True trim: cut [inSec, inSec+durSec] out of a remote video, stream-copy
 * (fast, no re-encode) with a re-encode fallback when copy fails on odd
 * sources. Returns the trimmed MP4 as a Buffer.
 */
export async function trimRemoteClip(params: {
  url: string;
  inSec: number;
  durSec: number;
  timeoutMs?: number;
}): Promise<Buffer> {
  const { url, inSec, durSec } = params;
  const timeoutMs = params.timeoutMs ?? 240_000;
  if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)');
  if (!(inSec >= 0 && durSec > 0.05)) throw new Error('invalid trim window');

  const dir = await mkdtemp(join(tmpdir(), 'reel-ffmpeg-'));
  try {
    const inputPath = join(dir, 'input.mp4');
    const outputPath = join(dir, 'output.mp4');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`source fetch failed (${res.status})`);
    await writeFile(inputPath, Buffer.from(await res.arrayBuffer()));

    const copyArgs = [
      '-y',
      '-ss',
      inSec.toFixed(3),
      '-i',
      inputPath,
      '-t',
      durSec.toFixed(3),
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    try {
      await runFfmpeg(copyArgs, timeoutMs);
      return await readFile(outputPath);
    } catch {
      /* stream copy rejected this source — re-encode below */
    }

    const reencodeArgs = [
      '-y',
      '-ss',
      inSec.toFixed(3),
      '-i',
      inputPath,
      '-t',
      durSec.toFixed(3),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    await runFfmpeg(reencodeArgs, timeoutMs);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * R4 sprite sheet: `frames` evenly-spaced thumbnails of a clip as ONE tiled
 * JPEG (one ffmpeg run instead of one per frame — the filmstrip then slices
 * it client-side with CSS background-position). Samples over [0.5, dur-0.5]
 * to match the strip's frame spread.
 */
export async function extractSpriteBuffer(params: {
  url: string;
  durSec: number;
  frames?: number;
  timeoutMs?: number;
}): Promise<Buffer> {
  const { url, durSec } = params;
  const frames = Math.max(2, Math.min(8, Math.floor(params.frames ?? 4)));
  const timeoutMs = params.timeoutMs ?? 90_000;
  if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)');
  if (!(durSec > 0.2)) throw new Error('durSec too short for a sprite');
  const dir = await mkdtemp(join(tmpdir(), 'reel-sprite-'));
  try {
    const outputPath = join(dir, 'sprite.jpg');
    const fps = spriteFpsValue(durSec, frames);
    const args = (input: string) => [
      '-y',
      '-user_agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) reel-studio',
      '-ss',
      '0.50',
      '-i',
      input,
      '-vf',
      `fps=${fps},scale=160:-2,tile=${frames}x1`,
      '-frames:v',
      '1',
      '-q:v',
      '5',
      outputPath,
    ];
    try {
      await runFfmpeg(args(url), Math.min(timeoutMs, 60_000));
      return await readFile(outputPath);
    } catch {
      /* direct remote read failed — fall back to a temp download */
    }
    const inputPath = join(dir, 'input.mp4');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`source fetch failed (${res.status})`);
    await writeFile(inputPath, Buffer.from(await res.arrayBuffer()));
    await runFfmpeg(args(inputPath), timeoutMs);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * R4 Cutdown v2: visual cut points of a video via ffmpeg scene-change
 * detection (`select='gt(scene,0.4)'` + showinfo). Best effort — returns []
 * when the probe fails (the caller's transcript bounds still work).
 */
export async function detectSceneCuts(params: {
  url: string;
  threshold?: number;
  timeoutMs?: number;
}): Promise<number[]> {
  const { url } = params;
  const timeoutMs = params.timeoutMs ?? 120_000;
  if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)');
  const vf = `${sceneSelectExpr(params.threshold)},showinfo`;
  const args = (input: string) => [
    '-y',
    '-user_agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) reel-studio',
    '-i',
    input,
    '-vf',
    vf,
    '-an',
    '-f',
    'null',
    '-',
  ];
  try {
    const stderr = await runFfmpegCapture(args(url), timeoutMs);
    return parseSceneCutTimes(stderr);
  } catch {
    /* remote probe failed — download and retry once */
  }
  const dir = await mkdtemp(join(tmpdir(), 'reel-scene-'));
  try {
    const inputPath = join(dir, 'input.mp4');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`source fetch failed (${res.status})`);
    await writeFile(inputPath, Buffer.from(await res.arrayBuffer()));
    const stderr = await runFfmpegCapture(args(inputPath), timeoutMs);
    return parseSceneCutTimes(stderr);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * R4 split-screen reaction: main video on the top two-thirds, reaction cam
 * on the bottom third, 1080×1920 out. Audio is the MAIN video's (the reaction
 * is a visual layer). Remote-read fast path, temp-download fallback.
 */
export async function composeSplitScreenRemote(params: {
  mainUrl: string;
  reactionUrl: string;
  timeoutMs?: number;
}): Promise<Buffer> {
  const { mainUrl, reactionUrl } = params;
  const timeoutMs = params.timeoutMs ?? 240_000;
  if (!/^https?:\/\//i.test(mainUrl) || !/^https?:\/\//i.test(reactionUrl)) {
    throw new Error('mainUrl and reactionUrl must be http(s)');
  }
  const dir = await mkdtemp(join(tmpdir(), 'reel-split-'));
  try {
    const outputPath = join(dir, 'output.mp4');
    const filter = buildSplitScreenFilter();
    const args = (mainIn: string, reactIn: string) => [
      '-y',
      '-user_agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) reel-studio',
      '-i',
      mainIn,
      '-i',
      reactIn,
      '-filter_complex',
      filter,
      '-map',
      '[v]',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-shortest',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    try {
      await runFfmpeg(args(mainUrl, reactionUrl), Math.min(timeoutMs, 120_000));
      return await readFile(outputPath);
    } catch {
      /* remote read rejected — download both and retry */
    }
    const mainPath = join(dir, 'main.mp4');
    const reactPath = join(dir, 'reaction.mp4');
    const [mainRes, reactRes] = await Promise.all([fetch(mainUrl), fetch(reactionUrl)]);
    if (!mainRes.ok) throw new Error(`main fetch failed (${mainRes.status})`);
    if (!reactRes.ok) throw new Error(`reaction fetch failed (${reactRes.status})`);
    await writeFile(mainPath, Buffer.from(await mainRes.arrayBuffer()));
    await writeFile(reactPath, Buffer.from(await reactRes.arrayBuffer()));
    await runFfmpeg(args(mainPath, reactPath), timeoutMs);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extract one frame from a remote video as a small JPEG — the server-side
 * strip thumbnail (replaces the client's `#t=` video-element trick, which
 * fires a range request and a decoder per thumbnail per render).
 */
export async function extractFrameBuffer(params: {
  url: string;
  atSec: number;
  timeoutMs?: number;
}): Promise<Buffer> {
  const { url, atSec } = params;
  const timeoutMs = params.timeoutMs ?? 90_000;
  if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)');
  const dir = await mkdtemp(join(tmpdir(), 'reel-thumb-'));
  try {
    const outputPath = join(dir, 'frame.jpg');
    const frameArgs = (input: string) => [
      '-y',
      // CDNs reject ffmpeg's default UA (403); present a browser one.
      '-user_agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) reel-studio',
      '-ss',
      Math.max(0, atSec).toFixed(2),
      '-i',
      input,
      '-frames:v',
      '1',
      '-vf',
      'scale=160:-2',
      '-q:v',
      '5',
      outputPath,
    ];

    try {
      // Fast path: ffmpeg reads the remote URL directly with HTTP range seeks —
      // no full download, so thumbnails land in ~a second even on long clips.
      await runFfmpeg(frameArgs(url), Math.min(timeoutMs, 45_000));
      return await readFile(outputPath);
    } catch {
      /* direct remote read failed — fall back to a temp download */
    }
    const inputPath = join(dir, 'input.mp4');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`source fetch failed (${res.status})`);
    await writeFile(inputPath, Buffer.from(await res.arrayBuffer()));
    await runFfmpeg(frameArgs(inputPath), timeoutMs);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * R18 caption burn-in: overlay an ASS subtitle track (word-timed karaoke, one
 * Dialogue event per Whisper word at its EXACT start/end) onto a video and
 * re-encode. The karaoke preview and this burn read the SAME ReelWord timings,
 * so the MP4's captions land frame-accurate with what the stage showed.
 *
 * The ASS document is written to the temp dir and passed via the `ass` filter
 * (libass renders fonts + the Active highlight). A fontsdir is set so the
 * preset's Google-font family resolves when it's bundled locally; otherwise
 * libass falls back to its default sans.
 */
export async function burnCaptionsRemote(params: {
  url: string;
  /** The ASS document (from captions.ts `assFor`). */
  ass: string;
  /** Optional dir of .ttf/.otf files libass should scan (bundled Google fonts). */
  fontsDir?: string;
  timeoutMs?: number;
}): Promise<Buffer> {
  const { url, ass } = params;
  const timeoutMs = params.timeoutMs ?? 300_000;
  if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)');
  if (!ass.includes('[Events]')) throw new Error('invalid ASS document');

  const dir = await mkdtemp(join(tmpdir(), 'reel-burn-'));
  try {
    const inputPath = join(dir, 'input.mp4');
    const assPath = join(dir, 'captions.ass');
    const outputPath = join(dir, 'output.mp4');
    await writeFile(assPath, ass, 'utf8');

    // The ass filter needs the file path escaped for the filter parser
    // (drive letters on win32 + the temp dir's separator chars).
    const assFilterPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const fontsOpt = params.fontsDir
      ? `:fontsdir='${params.fontsDir.replace(/\\/g, '/').replace(/:/g, '\\:')}'`
      : '';

    const res = await fetch(url);
    if (!res.ok) throw new Error(`source fetch failed (${res.status})`);
    await writeFile(inputPath, Buffer.from(await res.arrayBuffer()));

    const args = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      `ass='${assFilterPath}'${fontsOpt}`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '21',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    await runFfmpeg(args, timeoutMs);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * THE SIMPLE RENDER — local ffmpeg compose: concat the timeline clips end to
 * end, honoring each clip's in-point (`trimStartSec`) and tail trim
 * (`trimEndSec`) NATIVELY in the concat filter — NO fal, NO in-point
 * materialization pre-step. Every clip is normalized to 1080×1920 (scale +
 * pad) so mixed-aspect sources stitch cleanly. Optional audio bed laid over
 * with amix. Returns the composed MP4 as a Buffer.
 *
 * This replaces the fal compose as the default render path — it's free, it's
 * owned, and it's the reason "In-point materialization failed" can never
 * happen again: in-points are just trim filters here.
 */
export async function composeTracksLocal(params: {
  clips: {
    url: string;
    durationSec: number;
    trimStartSec?: number;
    trimEndSec?: number;
  }[];
  audioUrl?: string;
  audioOffsetSec?: number;
  timeoutMs?: number;
}): Promise<Buffer> {
  const { clips, audioUrl, audioOffsetSec = 0, timeoutMs = 300_000 } = params;
  if (clips.length === 0) throw new Error('No clips to compose.');
  const dir = await mkdtemp(join(tmpdir(), 'reel-compose-'));
  try {
    const outputPath = join(dir, 'out.mp4');
    // Per-clip: trim to [trimStartSec, durationSec - trimEndSec], normalize to
    // 1080×1920 with pad (center, no crop), setpts/fps/aresample so the concat
    // seams are clean. Audio kept per-clip (mixed into the bed at the end).
    const videoParts: string[] = [];
    const audioParts: string[] = [];
    clips.forEach((c, i) => {
      const inSec = Math.max(0, c.trimStartSec ?? 0);
      const endSec = Math.max(inSec + 0.1, c.durationSec - Math.max(0, c.trimEndSec ?? 0));
      videoParts.push(
        `[${i}:v]trim=start=${inSec.toFixed(3)}:end=${endSec.toFixed(3)},setpts=PTS-STARTPTS,` +
          `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,` +
          `setsar=1,fps=30[v${i}]`,
      );
      audioParts.push(
        `[${i}:a]atrim=start=${inSec.toFixed(3)}:end=${endSec.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`,
      );
    });
    const videoLabels = clips.map((_, i) => `[v${i}]`).join('');
    const audioLabels = clips.map((_, i) => `[a${i}]`).join('');
    const inputs: string[] = [];
    for (const c of clips) inputs.push('-i', c.url);
    let filter =
      videoParts.join(';') +
      ';' +
      audioParts.join(';') +
      ';' +
      `${videoLabels}concat=n=${clips.length}:v=1:a=0[vcat];` +
      `${audioLabels}concat=n=${clips.length}:v=0:a=1[acat]`;
    const args: string[] = ['-y', ...inputs];
    if (audioUrl && /^https?:\/\//i.test(audioUrl)) {
      args.push('-i', audioUrl);
      const bedIdx = clips.length;
      filter +=
        `;[${bedIdx}:a]atrim=start=${Math.max(0, audioOffsetSec).toFixed(3)},asetpts=PTS-STARTPTS[bed];` +
        `[acat][bed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`;
    } else {
      filter += `;[acat]acopy[aout]`;
    }
    args.push(
      '-filter_complex',
      filter,
      '-map',
      '[vcat]',
      '-map',
      '[aout]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '21',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-shortest',
      '-movflags',
      '+faststart',
      outputPath,
    );
    await runFfmpeg(args, timeoutMs);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Capability probe: does this ffmpeg build have libass (`subtitles` / `ass`)
 * and libfreetype (`drawtext`)? Both are needed for the free caption burn-in.
 * Surfaced on the integrations page so the free path never silently degrades
 * when a deploy swaps the binary.
 */
export async function ffmpegCaptionCapabilities(): Promise<{
  subtitles: boolean;
  drawtext: boolean;
  ok: boolean;
}> {
  try {
    const out = await runFfmpegCapture(['-hide_banner', '-filters'], 10_000);
    return {
      subtitles: /\bsubtitles\b/.test(out) || /\bass\b/.test(out),
      drawtext: /\bdrawtext\b/.test(out),
      ok: true,
    };
  } catch {
    return { subtitles: false, drawtext: false, ok: false };
  }
}

/**
 * The free ASS karaoke burn: Whisper words → ASS file (karaoke \k sweep — the
 * Submagic look) → burned with the `subtitles` filter. No fal, no cost.
 * Requires libass in the ffmpeg build — check ffmpegCaptionCapabilities first.
 */
export async function burnAssCaptions(params: {
  url: string;
  words: ReelWord[];
  style?: AssCaptionStyle;
  timeoutMs?: number;
}): Promise<Buffer> {
  const { url, words, style, timeoutMs = 300_000 } = params;
  if (words.length === 0) throw new Error('No caption words to burn.');
  if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)');
  const dir = await mkdtemp(join(tmpdir(), 'ass-burn-'));
  try {
    const inputPath = join(dir, 'input.mp4');
    const assPath = join(dir, 'captions.ass');
    const outputPath = join(dir, 'output.mp4');
    await writeFile(assPath, buildAssCaptions(words, style), 'utf8');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`source fetch failed (${res.status})`);
    await writeFile(inputPath, Buffer.from(await res.arrayBuffer()));
    const assArg = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    await runFfmpeg(
      [
        '-y',
        '-i',
        inputPath,
        '-vf',
        `subtitles='${assArg}'`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '21',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      timeoutMs,
    );
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}



