import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { detectSceneCuts, trimRemoteClip } from '@/utils/integrations/ffmpeg-worker';
import { snapSegmentBounds } from '@/lib/mothermode/reel/sceneCuts';
import { uploadVideoBuffer } from '@/utils/mothermode/storage';
import { upsertReelProject } from '@/lib/mothermode/reel/store';
import { makeClipId } from '@/lib/mothermode/reel/types';

export const maxDuration = 300;

/**
 * The Cutdown Agent (Phase 3). One long video in — up to 5 self-contained
 * reels out. Transcribe (Whisper), let the model pick the strongest
 * stand-alone segments (hook + payoff, no dangling references), true-trim each
 * with the ffmpeg worker (in-points — the thing fal compose can't do), host
 * them, and create one new reel project per segment.
 *
 * POST { url, count? } → { success, segments: [{title, startSec, endSec}], projects: ReelProject[] }
 * Honest limits: Whisper's 25MB cap applies to the SOURCE file (bigger source
 * = split it first or host a smaller proxy).
 */
const PICK_SYSTEM = `You are a short-form clipping editor. You get a transcript with per-segment timestamps of a long video. Pick the 1-5 strongest SELF-CONTAINED segments for short-form reels.

Rules:
- Each segment: 8-45 seconds, starts with or contains a hook, ends at a payoff or clean sentence boundary. No dangling references ("as I said earlier", "that thing I mentioned").
- Segments must not overlap.
- Strict JSON only: { "segments": [ { "title": string (≤6 words, Title Case), "startSec": number, "endSec": number, "why": string (≤12 words) } ] }.
- If nothing stands alone well, return fewer segments — quality over count.`;

interface PickedSegment {
  title: string;
  startSec: number;
  endSec: number;
  why: string;
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
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { success: false, error: 'A public video URL is required.' },
      { status: 400 },
    );
  }
  const count = Math.max(1, Math.min(5, typeof body.count === 'number' ? Math.floor(body.count) : 5));
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  try {
    // 1) Transcribe the source with segment timestamps.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch the video (${res.status})`);
    const blob = await res.blob();
    if (blob.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: `Source is ${(blob.size / 1048576).toFixed(0)}MB — Whisper caps at 25MB. Split the source first, or host a smaller proxy.`,
        },
        { status: 413 },
      );
    }
    const form = new FormData();
    form.append('file', blob, 'source.mp4');
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const whisperJson = await whisperRes.json().catch(() => null);
    if (!whisperRes.ok) {
      throw new Error(
        (whisperJson && (whisperJson.error?.message as string)) ||
          `Whisper failed (${whisperRes.status})`,
      );
    }
    const segs = Array.isArray(whisperJson?.segments) ? (whisperJson.segments as Record<string, unknown>[]) : [];
    const transcript = segs
      .map((s) => {
        const start = typeof s.start === 'number' ? s.start : 0;
        const end = typeof s.end === 'number' ? s.end : start;
        const text = typeof s.text === 'string' ? s.text.trim() : '';
        return text ? `[${start.toFixed(1)}–${end.toFixed(1)}] ${text}` : '';
      })
      .filter(Boolean)
      .join('\n')
      .slice(0, 14000);
    if (!transcript) throw new Error('No speech found in that video.');

    // 2) The model picks self-contained segments.
    const pickRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PICK_SYSTEM },
          { role: 'user', content: `Pick up to ${count} segments.\n\nTRANSCRIPT:\n${transcript}` },
        ],
      }),
    });
    const pickJson = await pickRes.json().catch(() => null);
    if (!pickRes.ok) throw new Error('Segment picking failed.');
    let picked: PickedSegment[] = [];
    try {
      const content = pickJson?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(typeof content === 'string' ? content : '{}');
      picked = (Array.isArray(parsed.segments) ? parsed.segments : [])
        .map((s: Record<string, unknown>) => ({
          title: typeof s.title === 'string' ? s.title.slice(0, 60) : 'Reel',
          startSec: typeof s.startSec === 'number' ? Math.max(0, s.startSec) : 0,
          endSec: typeof s.endSec === 'number' ? s.endSec : 0,
          why: typeof s.why === 'string' ? s.why.slice(0, 120) : '',
        }))
        .filter((s: PickedSegment) => s.endSec - s.startSec >= 3)
        .slice(0, count);
    } catch {
      picked = [];
    }
    if (!picked.length) throw new Error('The model found no clean segments in that transcript.');

    // 2.5) Cutdown v2: snap the bounds onto VISUAL cuts (ffmpeg scene-change
    // detection). Best effort — when the probe fails the transcript's bounds
    // still work; a snap that would crush a segment is reverted by the helper.
    let sceneCuts: number[] = [];
    try {
      sceneCuts = await detectSceneCuts({ url });
    } catch {
      sceneCuts = [];
    }
    if (sceneCuts.length) {
      picked = picked.map((seg) => {
        const snapped = snapSegmentBounds(seg.startSec, seg.endSec, sceneCuts);
        return { ...seg, startSec: snapped.startSec, endSec: snapped.endSec };
      });
    }

    // 3) True-trim each segment, host it, create a reel per segment.
    const projects = [];
    const summaries: { title: string; startSec: number; endSec: number; why: string }[] = [];
    for (const seg of picked) {
      const buf = await trimRemoteClip({
        url,
        inSec: seg.startSec,
        durSec: seg.endSec - seg.startSec,
      });
      const clipUrl = await uploadVideoBuffer(buf, 'video/mp4', 'reel-cutdown');
      const durationSec = Math.round((seg.endSec - seg.startSec) * 10) / 10;
      const project = await upsertReelProject({
        name: seg.title,
        clips: [
          {
            id: makeClipId(),
            name: `${seg.title}`.slice(0, 60),
            url: clipUrl,
            durationSec,
            trimEndSec: 0,
          },
        ],
        audio: null,
        captions: {},
        updatedBy: guard.email ?? null,
      });
      if (project) {
        projects.push(project);
        summaries.push({ title: seg.title, startSec: seg.startSec, endSec: seg.endSec, why: seg.why });
      }
    }
    if (!projects.length) throw new Error('Segments were picked but could not be produced.');

    return NextResponse.json({
      success: true,
      segments: summaries,
      projects,
      sceneCuts: sceneCuts.length ? sceneCuts : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Cutdown failed' },
      { status: 500 },
    );
  }
}
