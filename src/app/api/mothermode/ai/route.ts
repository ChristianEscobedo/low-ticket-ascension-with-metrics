import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  generateContentImage,
  editContentImage,
  rewriteContentText,
  amplifyContent,
  amplifyParts,
  amplifyImagePrompts,
  generateVideoScript,
  generateStoryboardPlan,
  generateVariationBrief,
  generateVariationPlan,
  imageSizeForFormat,
  type RewriteInput,
  type AmplifyTextInput,
  type AmplifyPart,
} from '@/utils/integrations/openai-content';
import { runSmartResize } from '@/utils/integrations/fal-smart-resize';



import { IMAGE_STYLE } from '@/lib/mothermode/content/constants';
import { hostGeneratedImage } from '@/utils/mothermode/storage';
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
 *   action 'variationBrief' -> brief → master/alt image prompts + optional
 *                       carousel/story frame pack.
 *   action 'variationPlan' -> dimension matrix of image-edit instructions.
 *   action 'smartResize' -> fal-ai/smart-resize to exact platform sizes.
 * The provider calls live in src/utils/integrations/openai-content.ts.
 */



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
    const boardCount = Math.max(
      1,
      Math.min(4, Math.round(Number(body.boardCount) || 1)),
    );
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

  return NextResponse.json(
    { ok: false, error: 'unknown action' },
    { status: 400 },
  );
}



