/**
 * Deterministic media-cue proposals: match the transcript's strong words
 * against Media Library asset names/tags and propose (wordIndex → asset) cues
 * for one-click approval. No AI round-trip — the same input always proposes
 * the same cues, which is what makes it testable.
 *
 * The manual path (click a word in cue mode, pick an image) is the primary
 * one; this is the "fill my reel with sensible cues" accelerator.
 */
import { powerKey } from './captions';
import type { ReelWord } from './types';

/** The library asset shape the picker works with (subset of MediaAsset). */
export interface CueAsset {
  url: string;
  /** Name and tags are both matched against the transcript's strong words. */
  name?: string;
  tags?: string[];
}

/** Words worth cueing: long enough to be topical, not glue. */
const MIN_WORD_LEN = 4;

/** Words that are long but never cue-worthy (common glue + profanity-adjacent fillers). */
const STOP = new Set([
  'this', 'that', 'with', 'from', 'they', 'them', 'then', 'than', 'when', 'what',
  'your', 'you', 'have', 'been', 'were', 'will', 'would', 'could', 'should',
  'about', 'there', 'their', 'which', 'because', 'really', 'just', 'like',
  'know', 'think', 'want', 'going', 'gonna', 'right', 'okay', 'yeah',
]);

/**
 * Propose cues for one clip's transcript. One cue per asset (first strong word
 * that matches), one cue per word (first asset that matches), capped at `max`.
 */
export function suggestCuesForWords(
  words: ReelWord[],
  assets: CueAsset[],
  max = 8,
): { wordIndex: number; url: string; word: string }[] {
  const out: { wordIndex: number; url: string; word: string }[] = [];
  const usedWords = new Set<number>();
  const usedAssets = new Set<string>();
  for (const asset of assets) {
    if (out.length >= max) break;
    if (!asset.url || usedAssets.has(asset.url)) continue;
    const hay = new Set(
      [asset.name ?? '', ...(asset.tags ?? [])]
        .flatMap((s) => s.toLowerCase().split(/[^a-z0-9'$]+/))
        .filter((t) => t.length >= MIN_WORD_LEN && !STOP.has(t)),
    );
    if (!hay.size) continue;
    for (let i = 0; i < words.length; i += 1) {
      if (usedWords.has(i)) continue;
      const key = powerKey(words[i].word);
      if (key.length < MIN_WORD_LEN || STOP.has(key) || !hay.has(key)) continue;
      out.push({ wordIndex: i, url: asset.url, word: words[i].word });
      usedWords.add(i);
      usedAssets.add(asset.url);
      break;
    }
  }
  return out;
}
