/**
 * Remotion render client — the ONE way a reel becomes an MP4.
 *
 * Design constraints that drove this file:
 *
 * 1. NO HARD DEPENDENCY. `@remotion/lambda` is loaded with a dynamic import
 *    inside a try/catch, so the app builds and boots on machines (and on
 *    Vercel) where the render packages aren't installed yet. If it's missing
 *    the feature reports "not configured" instead of exploding at import time —
 *    which is exactly how the fal/ffmpeg path used to take the whole route down.
 *
 * 2. RENDERING NEVER RUNS IN THE WEB PROCESS. Vercel functions cap out long
 *    before a 60s 1080×1920 render finishes, which is the real reason the
 *    in-process ffmpeg attempts kept timing out. Remotion Lambda fans the
 *    render out across many short-lived lambdas and hands back a public URL.
 *
 * 3. PROGRESS IS POLLED, NOT GUESSED. `renderReel` returns the renderId so the
 *    UI can poll `renderProgress` and show a real bar.
 *
 * Env:
 *   REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY
 *   REMOTION_AWS_REGION           (e.g. us-east-1)
 *   REMOTION_LAMBDA_FUNCTION_NAME (from `npx remotion lambda functions deploy`)
 *   REMOTION_SERVE_URL            (from `npx remotion lambda sites create`)
 */
import type { RenderPlan } from '@/lib/mothermode/reel/render/plan';

export const REEL_COMPOSITION_ID = 'Reel';

export interface RemotionConfig {
  region: string;
  functionName: string;
  serveUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type RemotionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Read the render config from env, or null when it isn't set up. */
export function remotionConfig(): RemotionConfig | null {
  const region = (process.env.REMOTION_AWS_REGION ?? '').trim();
  const functionName = (process.env.REMOTION_LAMBDA_FUNCTION_NAME ?? '').trim();
  const serveUrl = (process.env.REMOTION_SERVE_URL ?? '').trim();
  const accessKeyId = (process.env.REMOTION_AWS_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = (process.env.REMOTION_AWS_SECRET_ACCESS_KEY ?? '').trim();
  if (!region || !functionName || !serveUrl || !accessKeyId || !secretAccessKey) return null;
  return { region, functionName, serveUrl, accessKeyId, secretAccessKey };
}

export function isRemotionConfigured(): boolean {
  return remotionConfig() !== null;
}

/**
 * The human-readable reason renders are unavailable — surfaced straight into
 * the Studio so nobody has to read server logs to find a missing env var.
 */
export function remotionSetupHint(): string {
  const cfg = remotionConfig();
  if (cfg) return '';
  const missing: string[] = [];
  if (!process.env.REMOTION_AWS_REGION) missing.push('REMOTION_AWS_REGION');
  if (!process.env.REMOTION_LAMBDA_FUNCTION_NAME) missing.push('REMOTION_LAMBDA_FUNCTION_NAME');
  if (!process.env.REMOTION_SERVE_URL) missing.push('REMOTION_SERVE_URL');
  if (!process.env.REMOTION_AWS_ACCESS_KEY_ID) missing.push('REMOTION_AWS_ACCESS_KEY_ID');
  if (!process.env.REMOTION_AWS_SECRET_ACCESS_KEY) missing.push('REMOTION_AWS_SECRET_ACCESS_KEY');
  return `Rendering is not configured yet — missing ${missing.join(', ')}. Run the deploy steps in docs/REEL_RENDER_ENGINE_PORT.md.`;
}

/**
 * Load @remotion/lambda/client lazily. Kept in one place so the "package not
 * installed" message is identical everywhere and never a raw MODULE_NOT_FOUND.
 */
const LAMBDA_PKG: string = '@remotion/lambda/client';

async function loadLambdaClient(): Promise<RemotionResult<Record<string, unknown>>> {
  try {
    // The specifier is a variable on purpose: it keeps the app type-checking and
    // bundling on machines where the render packages aren't installed yet.
    const mod: unknown = await import(/* webpackIgnore: true */ LAMBDA_PKG);

    return { ok: true, data: mod as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      error:
        'The render engine is not installed. Run: npm i @remotion/lambda remotion @remotion/cli @remotion/player',
    };
  }
}

/** Lambda credentials go through env vars — that's the contract the SDK expects. */
function applyCredentials(cfg: RemotionConfig): void {
  process.env.REMOTION_AWS_ACCESS_KEY_ID = cfg.accessKeyId;
  process.env.REMOTION_AWS_SECRET_ACCESS_KEY = cfg.secretAccessKey;
}

export interface StartRenderResult {
  renderId: string;
  bucketName: string;
  region: string;
}

/**
 * Kick off a render. Returns immediately with a renderId — the caller polls.
 *
 * `plan` travels verbatim as inputProps, so the MP4 is a pixel-for-pixel replay
 * of the plan the editor built. No second interpretation layer, which is what
 * made preview and output drift before.
 */
export async function startReelRender(
  plan: RenderPlan,
  opts: { codec?: 'h264' | 'h265'; crf?: number; privacy?: 'public' | 'private' } = {},
): Promise<RemotionResult<StartRenderResult>> {
  const cfg = remotionConfig();
  if (!cfg) return { ok: false, error: remotionSetupHint() };
  const loaded = await loadLambdaClient();
  if (!loaded.ok) return loaded;
  applyCredentials(cfg);

  const renderMediaOnLambda = loaded.data.renderMediaOnLambda as
    | ((input: Record<string, unknown>) => Promise<{ renderId: string; bucketName: string }>)
    | undefined;
  if (typeof renderMediaOnLambda !== 'function') {
    return { ok: false, error: 'The installed @remotion/lambda is missing renderMediaOnLambda.' };
  }

  try {
    const res = await renderMediaOnLambda({
      region: cfg.region,
      functionName: cfg.functionName,
      serveUrl: cfg.serveUrl,
      composition: REEL_COMPOSITION_ID,
      inputProps: { plan },
      codec: opts.codec ?? 'h264',
      // 18 is visually lossless for social re-encodes without doubling the file.
      crf: opts.crf ?? 18,
      privacy: opts.privacy ?? 'public',
      // Frame-exact durations come from the plan, so let Remotion pick the
      // shard size rather than hand-tuning a value that rots.
      framesPerLambda: undefined,
      downloadBehavior: { type: 'play-in-browser' },
    });
    return {
      ok: true,
      data: { renderId: res.renderId, bucketName: res.bucketName, region: cfg.region },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Render failed to start.' };
  }
}

export interface RenderProgress {
  done: boolean;
  /** 0–1. */
  progress: number;
  videoUrl: string;
  errorMessage: string;
  costUsd: number;
}

/** Poll one render. Safe to call on a short interval from the client. */
export async function reelRenderProgress(input: {
  renderId: string;
  bucketName: string;
}): Promise<RemotionResult<RenderProgress>> {
  const cfg = remotionConfig();
  if (!cfg) return { ok: false, error: remotionSetupHint() };
  const loaded = await loadLambdaClient();
  if (!loaded.ok) return loaded;
  applyCredentials(cfg);

  const getRenderProgress = loaded.data.getRenderProgress as
    | ((input: Record<string, unknown>) => Promise<Record<string, unknown>>)
    | undefined;
  if (typeof getRenderProgress !== 'function') {
    return { ok: false, error: 'The installed @remotion/lambda is missing getRenderProgress.' };
  }

  try {
    const p = await getRenderProgress({
      renderId: input.renderId,
      bucketName: input.bucketName,
      functionName: cfg.functionName,
      region: cfg.region,
    });
    const errors = Array.isArray(p.errors) ? p.errors : [];
    const firstError =
      errors.length > 0 && typeof errors[0] === 'object' && errors[0]
        ? String((errors[0] as Record<string, unknown>).message ?? 'Render error')
        : '';
    const cost = p.costs && typeof p.costs === 'object'
      ? Number((p.costs as Record<string, unknown>).accruedSoFar ?? 0)
      : 0;
    return {
      ok: true,
      data: {
        done: p.done === true,
        progress: typeof p.overallProgress === 'number' ? p.overallProgress : 0,
        videoUrl: typeof p.outputFile === 'string' ? p.outputFile : '',
        errorMessage: p.fatalErrorEncountered === true ? firstError || 'Render failed.' : '',
        costUsd: Number.isFinite(cost) ? cost : 0,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not read progress.' };
  }
}

/**
 * Convenience: start a render and wait for it. Only for scripts/cron — a web
 * request should start + poll so it never sits on an open connection.
 */
export async function renderReelAndWait(
  plan: RenderPlan,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<RemotionResult<{ videoUrl: string; costUsd: number }>> {
  const started = await startReelRender(plan);
  if (!started.ok) return started;
  const timeoutMs = opts.timeoutMs ?? 15 * 60 * 1000;
  const pollMs = Math.max(1000, opts.pollMs ?? 3000);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const prog = await reelRenderProgress({
      renderId: started.data.renderId,
      bucketName: started.data.bucketName,
    });
    if (!prog.ok) return prog;
    if (prog.data.errorMessage) return { ok: false, error: prog.data.errorMessage };
    if (prog.data.done && prog.data.videoUrl) {
      return { ok: true, data: { videoUrl: prog.data.videoUrl, costUsd: prog.data.costUsd } };
    }
  }
  return { ok: false, error: 'Render timed out.' };
}
