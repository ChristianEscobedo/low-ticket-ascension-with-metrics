/**
 * R6 gene model (pure, unit-testable, zero server deps).
 *
 * A reel is a gene list: HOOK (scene 0), BODY (middle scenes), OUTRO (last
 * scene). The Variant Lab recombines genes (vault hook × body shape × vault
 * outro) into descendant projects; the scoreboard reports which GENE wins,
 * not just which reel. Gene tags ride the project name in a deterministic
 * `(H:...)/(B:...)/(O:...)` suffix so the report needs no schema change.
 */
import type { ReelClip, ReelProject } from './types';
import { makeClipId } from './types';
import { effectiveClipDuration } from './timeline';

export type GeneSlot = 'hook' | 'body' | 'outro';

/** Which slot a scene index owns. Empty/single-scene reels are all hook. */
export function slotOf(index: number, clipsLen: number): GeneSlot {
  if (clipsLen <= 1 || index === 0) return 'hook';
  if (index === clipsLen - 1) return 'outro';
  return 'body';
}

export type BodyShape = 'full' | 'tight';

/** Body shape applied to the middle scenes: full = as-is, tight = 5s cap each. */
export function shapeBody(clips: ReelClip[], shape: BodyShape): ReelClip[] {
  if (shape === 'full' || clips.length <= 2) return clips.slice(1, clips.length > 1 ? -1 : undefined);
  const body = clips.slice(1, -1);
  return body.map((c) => {
    const eff = effectiveClipDuration(c);
    if (eff <= 5) return c;
    const trim = Math.min(c.durationSec - 0.5, Math.max(0, c.trimEndSec + (eff - 5)));
    return { ...c, trimEndSec: Math.round(trim * 10) / 10 };
  });
}

export interface GeneAsset {
  name: string;
  url: string;
  durationSec: number;
}

/** One spun descendant: a name (with gene tag) and its clip list. */
export interface SpunVariant {
  name: string;
  clips: ReelClip[];
  geneTag: { hook: string; body: string; outro: string };
}

function toClip(name: string, url: string, durationSec: number): ReelClip {
  return { id: makeClipId(), name: name.slice(0, 60), url, durationSec: durationSec > 0 ? durationSec : 2.5, trimEndSec: 0 };
}

/** Name format carrying the gene tag: "Base (H:shock q) (B:tight) (O:cta)" — parsed back by parseGeneTags. */
export function geneTaggedName(base: string, tag: { hook?: string; body?: string; outro?: string }): string {
  let n = base.slice(0, 90);
  if (tag.hook) n += ` (H:${tag.hook.slice(0, 24)})`;
  if (tag.body && tag.body !== 'full') n += ` (B:${tag.body.slice(0, 16)})`;
  if (tag.outro) n += ` (O:${tag.outro.slice(0, 24)})`;
  return n.slice(0, 150);
}

/**
 * The Variant Lab combinator: vault hooks × body shapes × vault outros over
 * one base reel. The base's own hook/outro are the defaults; vault assets
 * swap the hook slot (scene 0 becomes the asset) and outro slot (last scene).
 */
export function spinVariants(input: {
  base: Pick<ReelProject, 'name' | 'clips'>;
  hooks: (GeneAsset | null)[]; // null = keep the base hook
  bodies: BodyShape[];
  outros: (GeneAsset | null)[]; // null = keep the base outro
  cap?: number;
}): SpunVariant[] {
  const { base, hooks, bodies, outros } = input;
  const cap = input.cap ?? 8;
  if (base.clips.length === 0) return [];
  const hookClip = base.clips[0];
  const outroClip = base.clips.length > 1 ? base.clips[base.clips.length - 1] : null;
  const bodyClips = base.clips.slice(1, base.clips.length > 1 ? -1 : undefined);

  const out: SpunVariant[] = [];
  for (const h of hooks) {
    for (const b of bodies) {
      for (const o of outros) {
        if (out.length >= cap) return out;
        // Skip the identity recombination (base hook × full body × base outro).
        if (!h && b === 'full' && !o) continue;
        const hookGene = h ? h.name : hookClip.name;
        const outroGene = o ? o.name : outroClip?.name ?? '';
        const bodyShaped = shapeBody(
          [hookClip, ...bodyClips, outroClip ?? hookClip],
          b === 'tight' ? 'tight' : 'full',
        );
        const clips: ReelClip[] = [
          h ? toClip(h.name, h.url, h.durationSec) : { ...hookClip, id: makeClipId() },
          ...bodyShaped.map((c) => ({ ...c, id: makeClipId() })),
        ];
        if (o && outroClip) clips.push(toClip(o.name, o.url, o.durationSec));
        else if (outroClip) clips.push({ ...outroClip, id: makeClipId() });
        out.push({
          name: geneTaggedName(base.name, { hook: h ? h.name : undefined, body: b, outro: o ? o.name : undefined }),
          clips,
          geneTag: { hook: hookGene, body: b, outro: outroGene },
        });
      }
    }
  }
  return out;
}

/** Parse the gene tags back out of a variant/project name. Missing = null. */
export function parseGeneTags(name: string): { hook: string | null; body: string | null; outro: string | null } {
  const m = (k: string) => {
    const re = new RegExp(`\\(${k}:([^)]+)\\)`);
    const hit = name.match(re);
    return hit ? hit[1] : null;
  };
  return { hook: m('H'), body: m('B'), outro: m('O') };
}

export interface GeneLeader {
  gene: string;
  avgCtr: number;
  variants: number;
}

/**
 * R6c gene leaders: average CTR per hook gene across variants that carry the
 * tag and have a meaningful impression floor. Honest: untagged variants don't
 * vote, and a gene needs ≥2 impressions-bearing variants to lead.
 */
export function geneLeaders(
  rows: { projectName: string; impressions: number; clicks: number }[],
  minImpressions = 50,
): { hook: GeneLeader | null } {
  const byGene = new Map<string, { i: number; c: number; n: number }>();
  for (const r of rows) {
    if (r.impressions < minImpressions) continue;
    const g = parseGeneTags(r.projectName).hook;
    if (!g) continue;
    const cur = byGene.get(g) ?? { i: 0, c: 0, n: 0 };
    cur.i += r.impressions;
    cur.c += r.clicks;
    cur.n += 1;
    byGene.set(g, cur);
  }
  let best: GeneLeader | null = null;
  byGene.forEach((v, gene) => {
    const ctr = v.i > 0 ? v.c / v.i : 0;
    if (!best || ctr > best.avgCtr) best = { gene, avgCtr: ctr, variants: v.n };
  });
  return { hook: best };
}
