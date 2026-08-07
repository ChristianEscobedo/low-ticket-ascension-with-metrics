import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  generateContentImage,
  editContentImage,
  rewriteContentText,
  generateTextVariations,
  amplifyContent,

  amplifyParts,
  amplifyImagePrompts,
  generateVideoScript,
  generateCloneAutofill,
  generateCloneScript,
  generateStoryboardPlan,
  generateFramePackPlan,
  generateVariationBrief,
  generateVariationPlan,
  imageSizeForFormat,
  type RewriteInput,
  type AmplifyTextInput,
  type AmplifyPart,
} from '@/utils/integrations/openai-content';

import { runSmartResize } from '@/utils/integrations/fal-smart-resize';
import {
  scoreComplianceWithAgent,
  fixComplianceWithAgent,
  type ComplianceAgentPiece,
} from '@/utils/integrations/openai-compliance';
import { generateYouTubeKit } from '@/utils/integrations/openai-youtube';
import { scoreLocalCompliance } from '@/lib/mothermode/content/platformCompliance';




import { IMAGE_STYLE } from '@/lib/mothermode/content/constants';
import { hostGeneratedImage, uploadVideoDataUrl } from '@/utils/mothermode/storage';
import {
  isPerspective,
  isSophistication,
} from '@/lib/mothermode/content/amplify';
import type { ContentPiece } from '@/lib/mothermode/content/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Non-empty model id, or undefined for Auto (server picks a key-aware default). */
function modelId(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * A recipe-inputs map from a picker (keyed by field id), or undefined when
 * nothing usable was filled. Blank values drop out here so the generators only
 * ever see real material.
 */
function strMap(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string' && val.trim()) out[k] = val.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Content hub AI backend. Admin-only. The actions the sheet tabs call:

 *   action 'image'   -> generate a post visual with the GPT Image API, then host
 *                       it in Supabase Storage and return its public URL.
 *   action 'imageEdit' -> edit a seed image (optional reference images) with the
 *                       image API, then host the result and return its public URL.
 *   action 'rewrite' -> rewrite or A/B-variant a hook, caption, or body, held
 *                       to the MotherMode voice rules, written by Claude Opus or
 *                       GPT-5.5 depending on configuration.
 *   action 'amplify' -> multiply one piece into a list of hooks, angles, CTAs,
 *                       or body versions for the Amplify tab.
 *   action 'imagePrompts' -> stage one of the image pipeline: turn a version's
 *                       hook into N distinct photographic scene prompts.
 *   action 'videoScript' -> second-by-second production script for reel/video
 *                       pieces (exact VO, shot direction, b-roll prompts).
 *   action 'storyboardPlan' -> 1–4 connected cinematic contact-sheet boards
 *                       with lookback continuity for a content piece.
 *   action 'framePackPlan' -> ordered carousel/story/idea slide pack with
 *                       roles, copy, prompts, and lookback continuity.
 *   action 'variationBrief' -> brief → master/alt image prompts + optional
 *                       carousel/story frame pack.

 *   action 'variationPlan' -> dimension matrix of image-edit instructions.
 *   action 'smartResize' -> fal-ai/smart-resize to exact platform sizes.
 *   action 'complianceScore' -> brand + platform policy scorecard (AI agent).
 *   action 'complianceFix' -> rewrite non-compliant fields into an edits patch.
 * The provider calls live in src/utils/integrations/openai-content.ts
 * and openai-compliance.ts.
 */




import {
  generateReelStory,
  directReelShots,
} from '@/utils/integrations/openai-reel';
import type { ReelStory } from '@/lib/mothermode/content/review';

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;


  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }

  const action = body.action;

  // Host a client-side video data URL (funnel VSL / hero upload) to Storage.
  if (action === 'hostVideo') {
    const dataUrl =
      typeof body.dataUrl === 'string'
        ? body.dataUrl
        : typeof body.video === 'string'
          ? body.video
          : '';
    if (!dataUrl.startsWith('data:')) {
      if (/^https?:\/\//i.test(dataUrl)) {
        return NextResponse.json({ ok: true, video: dataUrl });
      }
      return NextResponse.json(
        { ok: false, error: 'A data URL video is required' },
        { status: 400 },
      );
    }
    try {
      const video = await uploadVideoDataUrl(dataUrl);
      return NextResponse.json({ ok: true, video });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Video upload failed';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
  }

  // Host a client-side data URL (overlay burn-in, local upload) to Storage.
  if (action === 'hostImage') {
    const dataUrl =
      typeof body.dataUrl === 'string'
        ? body.dataUrl
        : typeof body.image === 'string'
          ? body.image
          : '';
    if (!dataUrl.startsWith('data:')) {
      // Already hosted — pass through.
      if (/^https?:\/\//i.test(dataUrl)) {
        return NextResponse.json({ ok: true, image: dataUrl });
      }
      return NextResponse.json(
        { ok: false, error: 'A data URL image is required' },
        { status: 400 },
      );
    }
    const image = await hostGeneratedImage(dataUrl);
    return NextResponse.json({ ok: true, image });
  }

  // Reel Director — Story Agent: one idea -> a four-chapter ReelStory.
  if (action === 'reel.story') {
    const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
    if (!idea) {
      return NextResponse.json(
        { ok: false, error: 'An idea is required' },
        { status: 400 },
      );
    }
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const result = await generateReelStory({
      idea,
      cta: str(body.cta),
      brandVoice: str(body.brandVoice),
      context: str(body.context),
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, story: result.data });
  }

  // Reel Director — Shot Director: per-board camera + scene direction.
  if (action === 'reel.shots') {
    if (!body.story || typeof body.story !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'A story is required' },
        { status: 400 },
      );
    }
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const boardSummaries = Array.isArray(body.boardSummaries)
      ? (body.boardSummaries as unknown[])
          .map((b) => (typeof b === 'string' ? b : ''))
          .filter((b): b is string => b.length > 0)
      : undefined;
    const result = await directReelShots({
      story: body.story as ReelStory,
      boardSummaries,
      brandVoice: str(body.brandVoice),
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, shots: result.data });
  }

  if (action === 'image') {
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: 'A prompt is required' },
        { status: 400 },
      );
    }
    const format = typeof body.format === 'string' ? body.format : undefined;
    const size = imageSizeForFormat(format);
    const model = modelId(body.model);
    // Append the shared art direction so generations stay on-brand.

    const fullPrompt = `${prompt}. ${IMAGE_STYLE}`;
    const result = await generateContentImage(fullPrompt, size, model);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    // Host immediately so the URL is renderable and GoHighLevel-postable.
    const image = await hostGeneratedImage(result.data);
    return NextResponse.json({ ok: true, image });
  }

  if (action === 'imageEdit') {
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: 'A prompt is required' },
        { status: 400 },
      );
    }
    const seed = typeof body.seed === 'string' ? body.seed.trim() : '';
    if (!seed) {
      return NextResponse.json(
        { ok: false, error: 'A seed image is required' },
        { status: 400 },
      );
    }
    const references = Array.isArray(body.references)
      ? body.references
          .filter((s): s is string => typeof s === 'string' && !!s.trim())
          .map((s) => s.trim())
          .slice(0, 4)
      : [];
    const format = typeof body.format === 'string' ? body.format : undefined;
    const size = imageSizeForFormat(format);
    const model = modelId(body.model);
    // Softer style suffix so the seed composition leads; brand palette still applies.

    const fullPrompt = `${prompt}. Keep the seed composition as the base. ${IMAGE_STYLE}`;
    const result = await editContentImage(
      fullPrompt,
      size,
      seed,
      references,
      model,
    );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    const image = await hostGeneratedImage(result.data);
    return NextResponse.json({ ok: true, image });
  }


  if (action === 'imagePrompts') {
    const hook = typeof body.hook === 'string' ? body.hook.trim() : '';
    if (!hook) {
      return NextResponse.json(
        { ok: false, error: 'a hook is required' },
        { status: 400 },
      );
    }
    const ctx =
      body.context && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : undefined;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const avoid = Array.isArray(body.avoid)
      ? body.avoid.filter((s): s is string => typeof s === 'string')
      : undefined;
    const result = await amplifyImagePrompts({
      count: Number(body.count) || 4,
      hook,
      guides: str(body.guides),
      avoid,
      context: ctx
        ? {
            theme: str(ctx.theme),
            tone: str(ctx.tone),
            platform: str(ctx.platform),
            format: str(ctx.format),
          }
        : undefined,
      model: modelId(body.model),
      imageFramework: str(body.imageFramework),
      recipeInputs: strMap(body.recipeInputs),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, prompts: result.data.prompts });
  }

  if (action === 'rewrite') {
    const field = body.field;
    if (field !== 'hook' && field !== 'caption' && field !== 'body') {
      return NextResponse.json(
        { ok: false, error: 'field must be hook, caption, or body' },
        { status: 400 },
      );
    }
    const ctx =
      body.context && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : undefined;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const input: RewriteInput = {
      field,
      text: typeof body.text === 'string' ? body.text : '',
      instructions: str(body.instructions),
      variant: body.variant === true,
      framework: str(body.framework),
      recipeInputs: strMap(body.recipeInputs),
      context: ctx
        ? {
            theme: str(ctx.theme),
            tone: str(ctx.tone),
            platform: str(ctx.platform),
            format: str(ctx.format),
          }
        : undefined,
      model: modelId(body.model),
    };
    const result = await rewriteContentText(input);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, text: result.data });
  }

  if (action === 'text-variations') {
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) {
      return NextResponse.json(
        { ok: false, error: 'text is required' },
        { status: 400 },
      );
    }
    const ctx =
      body.context && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : undefined;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const avoid = Array.isArray(body.avoid)
      ? body.avoid.filter((s): s is string => typeof s === 'string')
      : undefined;
    const result = await generateTextVariations({
      text,
      sub: str(body.sub),
      count: Math.max(1, Math.min(10, Math.round(Number(body.count) || 3))),
      instructions: str(body.instructions),

      avoid,
      context: ctx
        ? {
            theme: str(ctx.theme),
            tone: str(ctx.tone),
            platform: str(ctx.platform),
            format: str(ctx.format),
          }
        : undefined,
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, items: result.data });
  }

  if (action === 'amplifyParts') {

    if (!body.source || typeof body.source !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'a source piece is required' },
        { status: 400 },
      );
    }
    const isDim = (v: unknown): v is AmplifyPart['dimension'] =>
      v === 'hooks' || v === 'angles' || v === 'ctas' || v === 'bodies';
    const strList = (v: unknown): string[] | undefined =>
      Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : undefined;
    const rawParts = Array.isArray(body.parts) ? body.parts : [];
    const parts: AmplifyPart[] = [];
    for (const p of rawParts) {
      if (!p || typeof p !== 'object') continue;
      const rec = p as Record<string, unknown>;
      if (!isDim(rec.dimension)) continue;
      const count = Math.max(1, Math.min(10, Math.round(Number(rec.count) || 0)));
      if (count <= 0) continue;
      parts.push({ dimension: rec.dimension, count, avoid: strList(rec.avoid) });
    }
    if (parts.length === 0)
      return NextResponse.json(
        { ok: false, error: 'select at least one part to make' },
        { status: 400 },
      );
    const ctx =
      body.context && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : undefined;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const result = await amplifyParts({
      parts,
      source: body.source as ContentPiece,
      perspective: isPerspective(body.perspective) ? body.perspective : undefined,
      sophistication: isSophistication(body.sophistication)
        ? body.sophistication
        : undefined,
      guides: str(body.guides),
      framework: str(body.framework),
      recipeInputs: strMap(body.recipeInputs),
      context: ctx
        ? {
            theme: str(ctx.theme),
            tone: str(ctx.tone),
            platform: str(ctx.platform),
            format: str(ctx.format),
          }
        : undefined,
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, parts: result.data.parts });

  }

  if (action === 'amplify') {
    const dimension = body.dimension;
    if (
      dimension !== 'hooks' &&
      dimension !== 'angles' &&
      dimension !== 'ctas' &&
      dimension !== 'bodies'
    ) {
      return NextResponse.json(
        { ok: false, error: 'dimension must be hooks, angles, ctas, or bodies' },
        { status: 400 },
      );
    }
    if (!body.source || typeof body.source !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'a source piece is required' },
        { status: 400 },
      );
    }
    const ctx =
      body.context && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : undefined;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const input: AmplifyTextInput = {
      dimension,
      count: Number(body.count) || 5,
      source: body.source as ContentPiece,
      perspective: isPerspective(body.perspective) ? body.perspective : undefined,
      sophistication: isSophistication(body.sophistication)
        ? body.sophistication
        : undefined,
      guides: str(body.guides),
      framework: str(body.framework),
      recipeInputs: strMap(body.recipeInputs),
      context: ctx
        ? {
            theme: str(ctx.theme),
            tone: str(ctx.tone),
            platform: str(ctx.platform),
            format: str(ctx.format),
          }
        : undefined,
      model: modelId(body.model),
    };
    const result = await amplifyContent(input);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, items: result.data.items });
  }

  if (action === 'videoScript') {
    if (!body.piece || typeof body.piece !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'a piece is required' },
        { status: 400 },
      );
    }
    const p = body.piece as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const strList = (v: unknown): string[] | undefined =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === 'string' && !!s.trim())
        : undefined;
    const hook = str(p.hook);
    if (!hook) {
      return NextResponse.json(
        { ok: false, error: 'piece.hook is required' },
        { status: 400 },
      );
    }
    const durationSec = Math.max(
      6,
      Math.min(180, Math.round(Number(body.durationSec) || 30)),
    );
    const result = await generateVideoScript({
      piece: {
        hook,
        hooks: strList(p.hooks),
        caption: str(p.caption),
        body: strList(p.body),
        script: Array.isArray(p.script) ? (p.script as any) : undefined,
        theme: str(p.theme) ?? '',
        tone: str(p.tone) ?? '',
        platform: str(p.platform) ?? 'instagram',
        format: str(p.format) ?? 'reel',
      },
      durationSec,
      guides: str(body.guides),
      model: modelId(body.model),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      beats: result.data.beats,
      model: result.data.model,
      totalSeconds: durationSec,
    });
  }

  // -- cloneAutofill (AI Clone step 1: loose description -> the clone fields) --
  if (action === 'cloneAutofill') {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!description) {
      return NextResponse.json(
        { ok: false, error: 'Describe the person first' },
        { status: 400 },
      );
    }
    const result = await generateCloneAutofill({
      description: description.slice(0, 400),
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, autofill: result.data });
  }

  // -- cloneScript (AI Clone step 2: per-beat lines with voice programming) ----
  if (action === 'cloneScript') {
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const strList = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && !!s.trim()) : [];
    const topic = str(body.topic);
    if (!topic) {
      return NextResponse.json({ ok: false, error: 'topic is required' }, { status: 400 });
    }
    const result = await generateCloneScript({
      topic: topic.slice(0, 600),
      typeLabel: str(body.typeLabel) ?? 'Hook ad',
      frameworkLabel: str(body.frameworkLabel) ?? 'Hook · Story · Offer',
      frameworkBeats: strList(body.frameworkBeats).slice(0, 12),
      beatSec: Math.max(5, Math.min(15, Math.round(Number(body.beatSec) || 10))),
      beatCount: Math.max(1, Math.min(12, Math.round(Number(body.beatCount) || 3))),
      persona: (str(body.persona) ?? 'the founder').slice(0, 400),
      lookBible: (str(body.lookBible) ?? '').slice(0, 500),
      guides: str(body.guides)?.slice(0, 800),
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      beats: result.data.beats,
      model: result.data.model,
    });
  }

  if (action === 'storyboardPlan') {
    if (!body.piece || typeof body.piece !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'a piece is required' },
        { status: 400 },
      );
    }
    const p = body.piece as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const strList = (v: unknown): string[] | undefined =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === 'string' && !!s.trim())
        : undefined;
    const hook = str(p.hook);
    if (!hook) {
      return NextResponse.json(
        { ok: false, error: 'piece.hook is required' },
        { status: 400 },
      );
    }
    const mode = body.mode === 'broll' ? 'broll' : 'narrative';
    const sourceMode = body.sourceMode === 'script' ? 'script' : 'post';
    // Script-driven storyboards can need up to 6 boards (90s / 15s segments).
    const boardCount = Math.max(
      1,
      Math.min(6, Math.round(Number(body.boardCount) || 1)),
    );
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const segments = Array.isArray(body.segments)
      ? (body.segments as Array<Record<string, unknown>>)
          .map((s, i) => {
            const beats = Array.isArray(s.beats)
              ? (s.beats as Array<Record<string, unknown>>).map((b) => ({
                  shot: str(b.shot),
                  onScreen: str(b.onScreen),
                  voiceover: str(b.voiceover) ?? '',
                  action: str(b.action),
                  broll: str(b.broll),
                  brollPrompt: str(b.brollPrompt),
                }))
              : [];
            return {
              index: num(s.index) ?? i + 1,
              startSec: num(s.startSec) ?? 0,
              endSec: num(s.endSec) ?? 0,
              durationSec: num(s.durationSec) ?? 0,
              beats,
            };
          })
      : undefined;
    const result = await generateStoryboardPlan({
      piece: {
        hook,
        hooks: strList(p.hooks),
        caption: str(p.caption),
        body: strList(p.body),
        script: Array.isArray(p.script) ? (p.script as any) : undefined,
        theme: str(p.theme) ?? '',
        tone: str(p.tone) ?? '',
        platform: str(p.platform) ?? 'instagram',
        format: str(p.format) ?? 'feed',
        brollSeeds: strList(p.brollSeeds),
      },
      boardCount,
      mode,
      sourceMode,
      segments: sourceMode === 'script' ? segments : undefined,
      guides: str(body.guides),
      hasCharacterRef: body.hasCharacterRef === true,
      hasReferenceImages: body.hasReferenceImages === true,
      model: modelId(body.model),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      boards: result.data.boards,
      model: result.data.model,
      boardCount,
      mode,
    });
  }

  if (action === 'framePackPlan') {
    if (!body.piece || typeof body.piece !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'a piece is required' },
        { status: 400 },
      );
    }
    const p = body.piece as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const strList = (v: unknown): string[] | undefined =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === 'string' && !!s.trim())
        : undefined;
    const hook = str(p.hook);
    if (!hook) {
      return NextResponse.json(
        { ok: false, error: 'piece.hook is required' },
        { status: 400 },
      );
    }
    const slides = Array.isArray(p.slides)
      ? (p.slides as Array<Record<string, unknown>>)
          .map((s) => ({
            text: str(s.text),
            sub: str(s.sub),
            visual: str(s.visual),
          }))
          .filter((s) => s.text || s.sub || s.visual)
      : undefined;
    const slideCount = Math.max(
      2,
      Math.min(10, Math.round(Number(body.slideCount) || 5)),
    );
    const mode = body.mode === 'strip' ? 'strip' : 'frames';
    const aspectRaw = str(body.aspect);
    const aspect =
      aspectRaw === '4:5' || aspectRaw === '9:16' || aspectRaw === '1:1'
        ? aspectRaw
        : undefined;
    const result = await generateFramePackPlan({
      piece: {
        hook,
        hooks: strList(p.hooks),
        caption: str(p.caption),
        body: strList(p.body),
        theme: str(p.theme) ?? '',
        tone: str(p.tone) ?? '',
        platform: str(p.platform) ?? 'instagram',
        format: str(p.format) ?? 'carousel',
        slides,
      },
      slideCount,
      mode,
      aspect,
      guides: str(body.guides),
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      frames: result.data.frames,
      systemNotes: result.data.systemNotes,
      model: result.data.model,
      slideCount,
      mode,
      aspect,
    });
  }

  if (action === 'variationBrief') {

    const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
    if (!brief) {
      return NextResponse.json(
        { ok: false, error: 'A brief is required' },
        { status: 400 },
      );
    }
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const result = await generateVariationBrief({
      brief,
      platform: str(body.platform),
      format: str(body.format),
      hook: str(body.hook),
      theme: str(body.theme),
      tone: str(body.tone),
      altCount: Math.max(1, Math.min(6, Math.round(Number(body.altCount) || 3))),
      frameCount: Math.max(0, Math.min(10, Math.round(Number(body.frameCount) || 0))),
      guides: str(body.guides),
      model: modelId(body.model),
      imageFramework: str(body.imageFramework),
      recipeInputs: strMap(body.recipeInputs),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      masterPrompt: result.data.masterPrompt,
      altPrompts: result.data.altPrompts,
      frames: result.data.frames,
      model: result.data.model,
    });
  }

  if (action === 'variationPlan') {
    const dimensions = Array.isArray(body.dimensions)
      ? body.dimensions
          .filter((s): s is string => typeof s === 'string' && !!s.trim())
          .map((s) => s.trim())
      : [];
    if (!dimensions.length) {
      return NextResponse.json(
        { ok: false, error: 'Select at least one dimension' },
        { status: 400 },
      );
    }
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const result = await generateVariationPlan({
      dimensions,
      perDimension: Math.max(
        1,
        Math.min(4, Math.round(Number(body.perDimension) || 2)),
      ),
      seedDescription: str(body.seedDescription),
      platform: str(body.platform),
      format: str(body.format),
      hook: str(body.hook),
      theme: str(body.theme),
      guides: str(body.guides),
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      items: result.data.items,
      model: result.data.model,
    });
  }

  if (action === 'smartResize') {
    // Host data URLs first so fal gets a public http(s) URL.
    let imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';
    if (!imageUrl && typeof body.imageUrl === 'string') {
      imageUrl = body.imageUrl.trim();
    }
    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: 'image_url is required' },
        { status: 400 },
      );
    }
    if (imageUrl.startsWith('data:')) {
      try {
        imageUrl = await hostGeneratedImage(imageUrl);
      } catch (e) {
        return NextResponse.json(
          {
            ok: false,
            error:
              e instanceof Error
                ? e.message
                : 'Could not host image for resize',
          },
          { status: 502 },
        );
      }
    }
    if (!/^https?:\/\//i.test(imageUrl)) {
      return NextResponse.json(
        { ok: false, error: 'image_url must be a public http(s) URL' },
        { status: 400 },
      );
    }

    const target_sizes = Array.isArray(body.target_sizes)
      ? body.target_sizes
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim())
      : Array.isArray(body.targetSizes)
        ? body.targetSizes
            .filter((s): s is string => typeof s === 'string')
            .map((s) => s.trim())
        : [];

    const resolution =
      body.resolution === '2K' || body.resolution === '4K'
        ? body.resolution
        : '1K';
    const output_format =
      body.output_format === 'jpeg' ||
      body.output_format === 'webp' ||
      body.outputFormat === 'jpeg' ||
      body.outputFormat === 'webp'
        ? ((body.output_format || body.outputFormat) as 'jpeg' | 'webp')
        : 'png';
    const safetyRaw = String(
      body.safety_tolerance ?? body.safetyTolerance ?? '4',
    );
    const safety_tolerance = ['1', '2', '3', '4', '5', '6'].includes(safetyRaw)
      ? (safetyRaw as '1' | '2' | '3' | '4' | '5' | '6')
      : '4';
    const num_images_per_size = Math.max(
      1,
      Math.min(
        4,
        Math.round(
          Number(body.num_images_per_size ?? body.numImagesPerSize) || 1,
        ),
      ),
    );
    const prompt =
      typeof body.prompt === 'string' ? body.prompt.slice(0, 5000) : '';
    const seedRaw = body.seed;
    const seed =
      typeof seedRaw === 'number' && Number.isFinite(seedRaw)
        ? Math.round(seedRaw)
        : seedRaw === null
          ? null
          : undefined;

    const result = await runSmartResize({
      image_url: imageUrl,
      target_sizes,
      prompt,
      num_images_per_size,
      resolution,
      output_format,
      safety_tolerance,
      ...(seed !== undefined ? { seed } : {}),
      sync_mode: body.sync_mode === true || body.syncMode === true,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    // Re-host fal CDN URLs into our storage when possible so gallery links stay stable.
    const hosted: string[] = [];
    for (const img of result.data.images ?? []) {
      const url = typeof img?.url === 'string' ? img.url : '';
      if (!url) continue;
      if (url.startsWith('data:')) {
        hosted.push(await hostGeneratedImage(url));
      } else {
        // Best-effort: fetch and re-host; fall back to fal URL.
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const mime =
              res.headers.get('content-type')?.split(';')[0]?.trim() ||
              'image/png';
            const b64 = buf.toString('base64');
            hosted.push(await hostGeneratedImage(`data:${mime};base64,${b64}`));
          } else {
            hosted.push(url);
          }
        } catch {
          hosted.push(url);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      images: hosted,
      description: result.data.description,
      results: result.data.results,
      sourceUrl: imageUrl,
    });
  }

  if (action === 'complianceScore' || action === 'complianceFix') {
    const p =
      body.piece && typeof body.piece === 'object'
        ? (body.piece as Record<string, unknown>)
        : null;
    if (!p) {
      return NextResponse.json(
        { ok: false, error: 'piece is required' },
        { status: 400 },
      );
    }
    const str = (v: unknown) =>
      typeof v === 'string' ? v : v == null ? undefined : String(v);
    const strArr = (v: unknown) =>
      Array.isArray(v)
        ? v.filter((x) => typeof x === 'string').map(String)
        : undefined;
    const agentPiece: ComplianceAgentPiece = {
      hook: str(p.hook),
      hooks: strArr(p.hooks),
      caption: str(p.caption),
      body: strArr(p.body),
      cta: str(p.cta),
      title: str(p.title),
      theme: str(p.theme),
      tone: str(p.tone),
      platform: str(p.platform) || 'instagram',
      format: str(p.format) || 'feed',
      kind: str(p.kind) || 'organic',
      adPrimaryText: str(p.adPrimaryText),
      adHeadline: str(p.adHeadline),
      adDescription: str(p.adDescription),
      emailSubject: str(p.emailSubject),
      emailPreheader: str(p.emailPreheader),
    };
    const model = modelId(body.model);

    if (action === 'complianceScore') {
      // Always compute local first so the agent has a grounded baseline.
      const local = scoreLocalCompliance({
        id: 'tmp',
        platform: agentPiece.platform as ContentPiece['platform'],
        format: agentPiece.format as ContentPiece['format'],
        kind: agentPiece.kind as ContentPiece['kind'],
        tone: (agentPiece.tone as ContentPiece['tone']) || 'confidante',
        theme: agentPiece.theme || '',
        title: agentPiece.title || '',
        hook: agentPiece.hook || agentPiece.hooks?.[0] || '',
        hooks: agentPiece.hooks,
        caption: agentPiece.caption,
        body: agentPiece.body,
        cta: agentPiece.cta || '',
        ad:
          agentPiece.adPrimaryText || agentPiece.adHeadline
            ? {
                primaryText: agentPiece.adPrimaryText || '',
                headline: agentPiece.adHeadline || '',
                description: agentPiece.adDescription,
                button: 'LEARN_MORE',
              }
            : undefined,
        email: agentPiece.emailSubject
          ? {
              subject: agentPiece.emailSubject,
              preheader: agentPiece.emailPreheader,
            }
          : undefined,
      });
      const result = await scoreComplianceWithAgent({
        piece: agentPiece,
        local,
        model,
      });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error, local },
          { status: result.status },
        );
      }
      return NextResponse.json({ ok: true, ...result.data, local });
    }

    const issues = Array.isArray(body.issues) ? body.issues : undefined;
    const result = await fixComplianceWithAgent({
      piece: agentPiece,
      issues: issues as never,
      model,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      patch: result.data.patch,
      changelog: result.data.changelog,
      model: result.data.model,
    });
  }

  if (action === 'youtubeKit') {
    if (!body.piece || typeof body.piece !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'a piece is required' },
        { status: 400 },
      );
    }
    const p = body.piece as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const strList = (v: unknown): string[] | undefined =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === 'string' && !!s.trim())
        : undefined;
    const hook = str(p.hook);
    if (!hook) {
      return NextResponse.json(
        { ok: false, error: 'piece.hook is required' },
        { status: 400 },
      );
    }
    const result = await generateYouTubeKit({
      piece: {
        hook,
        hooks: strList(p.hooks),
        caption: str(p.caption),
        body: strList(p.body),
        script: strList(p.script),
        theme: str(p.theme) ?? '',
        tone: str(p.tone) ?? '',
      },
      durationSec:
        typeof body.durationSec === 'number'
          ? Math.max(0, Math.round(body.durationSec))
          : undefined,
      titleCount: Math.max(2, Math.min(6, Math.round(Number(body.titleCount) || 4))),
      thumbnailCount: Math.max(
        1,
        Math.min(4, Math.round(Number(body.thumbnailCount) || 3)),
      ),
      guides: str(body.guides),
      model: modelId(body.model),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, ...result.data });
  }

  return NextResponse.json(
    { ok: false, error: 'unknown action' },
    { status: 400 },
  );
}





