import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  deleteReelProject,
  getReelProject,
  listReelProjects,
  markReelComposed,
  upsertReelProject,
} from '@/lib/mothermode/reel/store';
import {
  buildStudioComposePayload,
  effectiveClipDuration,
  timelineErrors,
} from '@/lib/mothermode/reel/timeline';
import { makeClipId } from '@/lib/mothermode/reel/types';
import { assembleTracks } from '@/utils/integrations/fal-ffmpeg';
import { burnCaptionsRemote, composeTracksLocal, trimRemoteClip } from '@/utils/integrations/ffmpeg-worker';
import {
  assFor,
  captionDefFor,
  resolveCaptionStyle,
} from '@/lib/mothermode/reel/captions';
import { uploadVideoBuffer } from '@/utils/mothermode/storage';

import {
  uploadAudioBuffer,
  uploadVideoDataUrl,
} from '@/utils/mothermode/storage';
import {
  generateSpeechWithTimestamps,
  isElevenLabsConfigured,
} from '@/utils/integrations/elevenlabs';
import {
  directReelShots,
  generateReelStory,
} from '@/utils/integrations/openai-reel';
import type { ReelProject } from '@/lib/mothermode/reel/types';

/**
 * Admin API for the Reel Studio.
 *
 * GET  → { success, projects } newest first.
 * POST { action: 'save',        project }                       — upsert (re-normalized)
 * POST { action: 'delete',      id }
 * POST { action: 'compose',     id }                            — fal compose → hosted URL, stamped on the project
 * POST { action: 'upload',      name, dataUrl, kind }           — host user footage (video) or audio
 * POST { action: 'voiceover',   text, name? }                   — ElevenLabs speech → hosted mp3 URL
 * POST { action: 'suggest-broll', topic, clipNames? }           — Shot Director b-roll concepts
 * POST { action: 'split',       id, clipId, atSec }             — TRUE split via the ffmpeg worker (in-point)
 */
export const maxDuration = 300;

export async function GET() {

  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  const projects = await listReelProjects();
  return NextResponse.json({ success: true, projects });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';

  // -- save (insert or update) ------------------------------------------------
  if (action === 'save') {
    const p = (body.project ?? {}) as Partial<ReelProject>;
    const saved = await upsertReelProject({
      id: typeof p.id === 'string' && p.id ? p.id : undefined,
      name: typeof p.name === 'string' ? p.name : 'Untitled reel',
      clips: Array.isArray(p.clips) ? p.clips : [],
      audio: p.audio ?? null,
      composedUrl: typeof p.composedUrl === 'string' ? p.composedUrl : '',
      composedAt: typeof p.composedAt === 'string' ? p.composedAt : null,
      captions: (p.captions ?? {}) as ReelProject['captions'],
      captionStyle: p.captionStyle,
      captionOverrides: p.captionOverrides,
      overlays: Array.isArray(p.overlays) ? p.overlays : undefined,
      mediaCues: Array.isArray(p.mediaCues) ? p.mediaCues : undefined,
      clonePlan: p.clonePlan as ReelProject['clonePlan'],
      updatedBy: guard.email ?? null,
    });

    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Save failed (is the reel_studio migration applied, and does the project have at least one valid clip or an empty timeline?)' },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, project: saved });
  }

  // -- delete -----------------------------------------------------------------
  if (action === 'delete') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    const ok = await deleteReelProject(id);
    return NextResponse.json({ success: ok });
  }

  // -- compose ----------------------------------------------------------------
  if (action === 'compose') {
    const id = typeof body.id === 'string' ? body.id : '';
    const project = await getReelProject(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    const errors = timelineErrors(project);
    if (errors.length) {
      return NextResponse.json({ success: false, error: errors.join(' ') }, { status: 400 });
    }
    // THE SIMPLE RENDER — local ffmpeg compose FIRST (free, owned, and honors
    // in-points natively so no materialization pre-step can ever fail). fal's
    // compose stays as the fallback for when the local binary can't run.
    try {
      const buf = await composeTracksLocal({
        clips: project.clips.map((c) => ({
          url: c.url,
          durationSec: c.durationSec,
          trimStartSec: c.trimStartSec,
          trimEndSec: c.trimEndSec,
        })),
        audioUrl: project.audio?.url,
        audioOffsetSec: project.audio?.offsetSec ?? 0,
      });
      const videoUrl = await uploadVideoBuffer(buf, 'video/mp4', 'reel-studio');
      const stamped = await markReelComposed(project.id, videoUrl);
      return NextResponse.json({ success: true, videoUrl, project: stamped, path: 'ffmpeg-local' });
    } catch (localErr) {
      // fal fallback — the old path, kept for environments without a local binary.
      const payload = buildStudioComposePayload(project);
      const result = await assembleTracks(payload);
      if (!result.ok) {
        const localMsg = localErr instanceof Error ? localErr.message : 'local compose failed';
        return NextResponse.json(
          { success: false, error: `Local compose failed (${localMsg.slice(0, 160)}) and fal fallback failed: ${result.error}` },
          { status: result.status },
        );
      }
      const stamped = await markReelComposed(project.id, result.data.videoUrl);
      return NextResponse.json({
        success: true,
        videoUrl: result.data.videoUrl,
        project: stamped,
        path: 'fal',
      });
    }
  }

  // -- upload user footage / audio ---------------------------------------------
  if (action === 'upload') {
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const kind = body.kind === 'audio' ? 'audio' : 'video';
    if (!dataUrl.startsWith('data:')) {
      return NextResponse.json({ success: false, error: 'dataUrl is required' }, { status: 400 });
    }
    try {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error('Invalid data URL');
      const mime = match[1];
      const buf = Buffer.from(match[2], 'base64');
      const url =
        kind === 'audio'
          ? await uploadAudioBuffer(buf, mime, 'reel-studio-audio')
          : await uploadVideoDataUrl(dataUrl, 'reel-studio');
      return NextResponse.json({ success: true, url });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Upload failed' },
        { status: 500 },
      );
    }
  }

  // -- voiceover (ElevenLabs → hosted mp3) ---------------------------------------
  if (action === 'voiceover') {
    if (!isElevenLabsConfigured()) {
      return NextResponse.json(
        { success: false, error: 'ELEVENLABS_API_KEY is not configured.' },
        { status: 503 },
      );
    }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return NextResponse.json({ success: false, error: 'text is required' }, { status: 400 });
    try {
      const speech = await generateSpeechWithTimestamps(text.slice(0, 4500));
      const buf = Buffer.from(speech.audioBase64, 'base64');
      const url = await uploadAudioBuffer(buf, 'audio/mpeg', 'reel-studio-vo');
      return NextResponse.json({ success: true, url });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Voiceover failed' },
        { status: 500 },
      );
    }
  }

  // -- b-roll suggestions (Story Agent + Shot Director) --------------------------
  if (action === 'suggest-broll') {
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    if (!topic) return NextResponse.json({ success: false, error: 'topic is required' }, { status: 400 });
    const clipNames = Array.isArray(body.clipNames)
      ? (body.clipNames as unknown[]).filter((s): s is string => typeof s === 'string' && !!s.trim())
      : [];

    const story = await generateReelStory({
      idea: topic,
      context: clipNames.length
        ? `The reel already contains these shots, in order: ${clipNames.join(', ')}. Suggest b-roll that complements them, never repeats them.`
        : '',
    });
    if (!story.ok) {
      return NextResponse.json({ success: false, error: story.error }, { status: story.status });
    }
    const shots = await directReelShots({ story: story.data });
    if (!shots.ok) {
      return NextResponse.json({ success: false, error: shots.error }, { status: shots.status });
    }
    return NextResponse.json({ success: true, story: story.data, shots: shots.data });
  }

  // -- split (TRUE cut at an in-point — the ffmpeg worker does what fal compose can't) --
  if (action === 'split') {
    const id = typeof body.id === 'string' ? body.id : '';
    const clipId = typeof body.clipId === 'string' ? body.clipId : '';
    const atSec = typeof body.atSec === 'number' ? body.atSec : NaN;
    const project = await getReelProject(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    const idx = project.clips.findIndex((c) => c.id === clipId);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: 'Clip not found' }, { status: 404 });
    }
    const clip = project.clips[idx];
    const eff = effectiveClipDuration(clip);
    // R25b: atSec is EFFECTIVE-LOCAL seconds (0 = the clip's in-point), so the
    // source cut = the in-point + atSec. The materialize path passes
    // sourceSeconds:true to cut at raw SOURCE seconds instead.
    const sourceSeconds = body.sourceSeconds === true;
    const inPoint = clip.trimStartSec ?? 0;
    const cut = Math.round((sourceSeconds ? atSec : inPoint + atSec) * 10) / 10;
    const valid = sourceSeconds
      ? cut > 0.05 && cut < clip.durationSec - 0.05
      : atSec > 0.05 && atSec < eff - 0.05;
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Split point must sit inside the clip (with at least a frame on each side).' },
        { status: 400 },
      );
    }
    try {
      const tailSec = Math.round((clip.durationSec - cut) * 10) / 10;
      // Part A keeps the original URL with the tail trimmed (no re-encode cost).
      const partA = { ...clip, trimEndSec: Math.round((clip.durationSec - cut) * 10) / 10 };
      // Part B is a true trim from the in-point, hosted back in storage.
      const buf = await trimRemoteClip({ url: clip.url, inSec: cut, durSec: tailSec });
      const url = await uploadVideoBuffer(buf, 'video/mp4', 'reel-studio');
      const partB = {
        id: makeClipId(),
        name: `${clip.name} (2)`.slice(0, 60),
        url,
        durationSec: tailSec,
        trimEndSec: 0,
      };
      const clips = [
        ...project.clips.slice(0, idx),
        partA,
        partB,
        ...project.clips.slice(idx + 1),
      ];
      // A split invalidates part A's captions (its timing no longer matches).
      const captions = { ...project.captions };
      delete captions[clip.id];
      const saved = await upsertReelProject({
        id: project.id,
        name: project.name,
        clips,
        audio: project.audio,
        composedUrl: project.composedUrl,
        composedAt: project.composedAt,
        captions,
        captionStyle: project.captionStyle,
        updatedBy: guard.email ?? null,
      });

      if (!saved) throw new Error('Could not save the split timeline');
      return NextResponse.json({ success: true, project: saved, partBId: partB.id });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Split failed' },
        { status: 500 },
      );
    }
  }

  // -- burn-captions (R18: compose → ASS burn-in → hosted captioned MP4) ---------
  if (action === 'burn-captions') {
    const id = typeof body.id === 'string' ? body.id : '';
    const project = await getReelProject(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    // Every scene with speech must have Whisper timings — that's the precision contract.
    const scenesMissing = project.clips.filter(
      (c) => (project.captions[c.id]?.length ?? 0) === 0,
    );
    if (scenesMissing.length === project.clips.length && project.clips.length > 0) {
      return NextResponse.json(
        { success: false, error: 'No Whisper captions yet — transcribe the scenes first (CC).' },
        { status: 400 },
      );
    }
    try {
      // 1 — the flat MP4 to caption: reuse the composed cut, or compose on demand.
      let sourceUrl = project.composedUrl;
      if (!sourceUrl) {
        const errors = timelineErrors(project);
        if (errors.length) {
          return NextResponse.json({ success: false, error: errors.join(' ') }, { status: 400 });
        }
        const result = await assembleTracks(buildStudioComposePayload(project));
        if (!result.ok) {
          return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }
        sourceUrl = result.data.videoUrl;
        await markReelComposed(project.id, sourceUrl);
      }

      // 2 — flatten every scene's words onto the composed timeline, in clip order.
      const timelineWords: { word: string; start: number; end: number }[] = [];
      let cursor = 0;
      for (const clip of project.clips) {
        const words = project.captions[clip.id] ?? [];
        for (const w of words) {
          // Clamp each word into the clip's EFFECTIVE window (a tail trim cuts speech too).
          const eff = effectiveClipDuration(clip);
          const s = Math.min(w.start, eff);
          const e = Math.min(w.end, eff);
          if (e > s) timelineWords.push({ word: w.word, start: cursor + s, end: cursor + e });
        }
        cursor += effectiveClipDuration(clip);
      }
      if (!timelineWords.length) {
        return NextResponse.json(
          { success: false, error: 'The reels captions are empty after trimming — nothing to burn.' },
          { status: 400 },
        );
      }

      // 3 — the styled ASS doc: preset + this reel's customizer overrides, exact timings.
      const def = resolveCaptionStyle(captionDefFor(project.captionStyle), project.captionOverrides);
      const ass = assFor(timelineWords, def, {
        positionPct: project.captionOverrides?.positionPct,
        sizePx: project.captionOverrides?.sizePx
          ? Math.round(project.captionOverrides.sizePx * (1080 / 360)) // stage px → PlayRes px
          : undefined,
      });

      // 4 — burn + host.
      const buf = await burnCaptionsRemote({ url: sourceUrl, ass });
      const url = await uploadVideoBuffer(buf, 'video/mp4', 'reel-studio-captioned');
      return NextResponse.json({ success: true, url, words: timelineWords.length, sourceUrl });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Burn-in failed' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
}


