/**
 * The Hook Bank store — a tagged, scored library of 0.5-3s opening clips that
 * mount as beat 0 on the reel timeline (the pattern interrupt before the
 * content starts).
 *
 * House pattern: lazy service client, degrades to empty arrays, never throws
 * on missing env/table. Mirrors mediaLibrary.ts.
 *
 * THE BEAT-0 MOUNT
 * ----------------
 * A hook is just a ReelClip with id `hook-<id>` prepended to the project's
 * clips. The render plan + preview already handle a hard cut between clips, so
 * "mount a hook" is a pure prepend — no render-engine change. The hook plays
 * for its (short) duration, then the content starts. That contrast IS the
 * pattern interrupt.
 */
import { createClient } from '@supabase/supabase-js';
import type { ReelClip } from './types';
import { createVaultAsset } from './vault';

const TABLE = 'mothermode_hook_clips';

export type HookSource = 'uploaded' | 'fetched' | 'generated';

/** What the first second is supposed to make the viewer feel. */
export type HookReaction =
  | 'shock'
  | 'laugh'
  | 'confusion'
  | 'satisfaction'
  | 'relatability'
  | 'chaos'
  | 'curiosity'
  | 'awe';

/** Whether the clip can go in a paid ad without a takedown risk. */
export type HookRights = 'owned' | 'licensed' | 'meme-fair-use' | 'unknown';

export const HOOK_REACTIONS: HookReaction[] = [
  'shock',
  'laugh',
  'confusion',
  'satisfaction',
  'relatability',
  'chaos',
  'curiosity',
  'awe',
];

export const HOOK_SOURCES: HookSource[] = ['uploaded', 'fetched', 'generated'];
export const HOOK_RIGHTS: HookRights[] = ['owned', 'licensed', 'meme-fair-use', 'unknown'];

export interface HookClip {
  id: string;
  name: string;
  url: string;
  source: HookSource;
  reaction: HookReaction;
  rights: HookRights;
  durationSec: number | null;
  spriteUrl: string | null;
  sheetRef: string | null;
  hookScore: number | null;
  tags: string[];
  notes: string | null;
  createdAt: string | null;
}

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function toHookSource(v: unknown): HookSource {
  return (HOOK_SOURCES as string[]).includes(String(v)) ? (v as HookSource) : 'uploaded';
}

function toHookReaction(v: unknown): HookReaction {
  return (HOOK_REACTIONS as string[]).includes(String(v)) ? (v as HookReaction) : 'shock';
}

function toHookRights(v: unknown): HookRights {
  return (HOOK_RIGHTS as string[]).includes(String(v)) ? (v as HookRights) : 'unknown';
}

function clampScore(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function rowToHookClip(r: Record<string, unknown>): HookClip {
  return {
    id: String(r.id),
    name: asStr(r.name),
    url: asStr(r.url),
    source: toHookSource(r.source),
    reaction: toHookReaction(r.reaction),
    rights: toHookRights(r.rights),
    durationSec: r.duration_sec != null ? Number(r.duration_sec) : null,
    spriteUrl: r.sprite_url ? asStr(r.sprite_url) : null,
    sheetRef: r.sheet_ref ? asStr(r.sheet_ref) : null,
    hookScore: clampScore(r.hook_score),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    notes: r.notes ? asStr(r.notes) : null,
    createdAt: r.created_at ? asStr(r.created_at) : null,
  };
}

function normalizeTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const n = t.trim().toLowerCase().replace(/\s+/g, '-');
    if (n) out.add(n);
  }
  return Array.from(out);
}

// ---------------------------------------------------------------------------
// The beat-0 mount
// ---------------------------------------------------------------------------

/** The duration a hook occupies on the timeline when the probe missed. */
export const DEFAULT_HOOK_SECONDS = 1.5;

/**
 * A hook clip IS a ReelClip with a `hook-` prefixed id. Mounting prepends it
 * to the project's clip list; the render plan's hard cut between clip 0 and
 * clip 1 does the pattern interrupt.
 */
export function hookToReelClip(hook: HookClip): ReelClip {
  return {
    id: `hook-${hook.id}`,
    name: hook.name || 'Hook',
    url: hook.url,
    durationSec: hook.durationSec && hook.durationSec > 0 ? hook.durationSec : DEFAULT_HOOK_SECONDS,
    trimEndSec: 0,
  };
}

/**
 * Prepend a hook to a clip list, idempotently — if this hook is already
 * mounted (its `hook-<id>` is clip[0]) the list comes back unchanged, so
 * double-mounting in the studio can't stack two of the same opener.
 */
export function mountHookOnClips(clips: ReelClip[], hook: HookClip): ReelClip[] {
  const hookClip = hookToReelClip(hook);
  const rest = clips.filter((c) => c.id !== hookClip.id);
  return [hookClip, ...rest];
}

/** Remove any mounted hook (a clip whose id starts with `hook-`). */
export function unmountHookFromClips(clips: ReelClip[]): ReelClip[] {
  return clips.filter((c) => !c.id.startsWith('hook-'));
}

/** The hook currently mounted on a clip list, if any. */
export function mountedHookId(clips: ReelClip[]): string | null {
  const first = clips[0];
  return first && first.id.startsWith('hook-') ? first.id.slice('hook-'.length) : null;
}

// ---------------------------------------------------------------------------
// Leaderboard + filters (pure, client-side on the grid)
// ---------------------------------------------------------------------------

/** Hooks ranked by score, unscored last (the leaderboard view). */
export function rankHooksByScore(hooks: HookClip[]): HookClip[] {
  return [...hooks].sort((a, b) => (b.hookScore ?? -1) - (a.hookScore ?? -1));
}

/** Case-insensitive name + tag + reaction match for the grid search. */
export function hookMatches(hook: HookClip, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    hook.name.toLowerCase().includes(q) ||
    hook.reaction.includes(q) ||
    hook.source.includes(q) ||
    hook.tags.some((t) => t.includes(q))
  );
}

/** Hooks cleared for paid use (owned or licensed — never meme/unknown). */
export function paidSafeHooks(hooks: HookClip[]): HookClip[] {
  return hooks.filter((h) => h.rights === 'owned' || h.rights === 'licensed');
}

// ---------------------------------------------------------------------------
// Store (service-role only)
// ---------------------------------------------------------------------------

export async function listHookClips(opts?: {
  source?: HookSource;
  reaction?: HookReaction;
  limit?: number;
}): Promise<HookClip[]> {
  try {
    let q = (serviceClient() as any)
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 300);
    if (opts?.source) q = q.eq('source', opts.source);
    if (opts?.reaction) q = q.eq('reaction', opts.reaction);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToHookClip);
  } catch {
    return [];
  }
}

/** Upsert by URL — the same clip never double-lists. */
export async function ingestHookClip(input: {
  name: string;
  url: string;
  source?: HookSource;
  reaction?: HookReaction;
  rights?: HookRights;
  durationSec?: number | null;
  spriteUrl?: string | null;
  sheetRef?: string | null;
  hookScore?: number | null;
  tags?: string[];
  notes?: string | null;
}): Promise<HookClip | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .upsert(
        {
          name: input.name.trim().slice(0, 150) || 'Hook',
          url: input.url,
          source: input.source ?? 'uploaded',
          reaction: input.reaction ?? 'shock',
          rights: input.rights ?? 'owned',
          duration_sec: input.durationSec ?? null,
          sprite_url: input.spriteUrl ?? null,
          sheet_ref: input.sheetRef ?? null,
          hook_score: clampScore(input.hookScore),
          tags: normalizeTags(input.tags ?? []),
          notes: input.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'url' },
      )
      .select('*')
      .maybeSingle();
    return error || !data ? null : rowToHookClip(data);
  } catch {
    return null;
  }
}

export async function patchHookClip(
  id: string,
  patch: {
    name?: string;
    reaction?: HookReaction;
    rights?: HookRights;
    hookScore?: number | null;
    tags?: string[];
    notes?: string | null;
    spriteUrl?: string | null;
  },
): Promise<boolean> {
  try {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 150);
    if (patch.reaction !== undefined) row.reaction = toHookReaction(patch.reaction);
    if (patch.rights !== undefined) row.rights = toHookRights(patch.rights);
    if (patch.hookScore !== undefined) row.hook_score = clampScore(patch.hookScore);
    if (patch.tags !== undefined) row.tags = normalizeTags(patch.tags);
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.spriteUrl !== undefined) row.sprite_url = patch.spriteUrl;
    const { error } = await (serviceClient() as any).from(TABLE).update(row).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteHookClip(id: string): Promise<boolean> {
  try {
    const { error } = await (serviceClient() as any).from(TABLE).delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/** Map hook rights onto the vault's provenance source. */
export function hookVaultSource(rights: HookRights): 'mine' | 'licensed' | 'reference-only' {
  if (rights === 'owned') return 'mine';
  if (rights === 'licensed') return 'licensed';
  return 'reference-only'; // meme-fair-use + unknown never claim ownership
}

/**
 * Mirror a hook into the clipping vault as a `reaction` asset, so it shows up
 * in the reel studio's existing vault rail (the picker that insertVaultHook
 * mounts from). One write in the bank, two views — the bank is the curated,
 * scored front-end; the vault is the studio-facing rail. Best-effort: a vault
 * miss never fails the bank ingest.
 */
export async function syncHookToVault(hook: HookClip): Promise<void> {
  try {
    await createVaultAsset({
      kind: 'reaction',
      name: hook.name,
      url: hook.url,
      thumbnailUrl: hook.spriteUrl,
      durationSec:
        hook.durationSec && hook.durationSec > 0 ? hook.durationSec : DEFAULT_HOOK_SECONDS,
      tags: ['hook-bank', ...hook.tags].slice(0, 12),
      emotion: hook.reaction,
      source: hookVaultSource(hook.rights),
    });
  } catch {
    /* vault is a mirror — never block the bank on it */
  }
}
