/**
 * R3 Hook Scorer (pure, unit-testable, zero server deps).
 *
 * Predicted-retention score (0-100) for a reel's opener, computed from what
 * the studio already knows: the first scene's Whisper words (when transcribed),
 * the opener's length, and the Vault's proven win rates. Every point is
 * explainable — the reasons array is the tooltip, so the score never lies
 * about why it moved. When scene 1 has no transcript the score is marked
 * unverified and structure-only (it says so, instead of guessing silently).
 */
import type { ReelClip, ReelWord } from './types';
import { effectiveClipDuration } from './timeline';

export type HookBand = 'cold' | 'warm' | 'hot';

export interface HookScore {
  /** 0-100, clamped. */
  score: number;
  /** hot >= 70, warm >= 40, cold below. */
  band: HookBand;
  /** Human-readable explanations, in the order they fired (the tooltip). */
  reasons: string[];
  /** false when scene 1 has no transcript — structure-only guess. */
  verified: boolean;
}

/** Hook-window patterns. Each family is worth one bonus — stacking synonyms doesn't game it. */
const PATTERNS: { re: RegExp; points: number; reason: string }[] = [
  {
    re: /\b(what|why|how|when|which|who|where)\b|\?/i,
    points: 6,
    reason: 'opens with a question',
  },
  { re: /\d/, points: 6, reason: 'opens with a number' },
  {
    re: /\b(you|your|yours|youre|you're)\b/i,
    points: 6,
    reason: "speaks to 'you' in the first seconds",
  },
  {
    re: /\b(secret|mistake|nobody|everybody|stop|never|always|truth|wrong|lie|lies|hack|trick|free|proven|exactly|warning|hate)\b/i,
    points: 6,
    reason: 'curiosity word in the hook window',
  },
];

/** Seconds of speech considered "the hook". */
const HOOK_WINDOW_SEC = 3.5;

export function scoreHook(input: {
  clips: ReelClip[];
  captions: Record<string, ReelWord[]>;
  /** Vault asset URL → win rate (null = unrated). Optional. */
  vaultWinRateByUrl?: Map<string, number | null>;
}): HookScore {
  const { clips, captions, vaultWinRateByUrl } = input;
  if (!clips.length) {
    return { score: 0, band: 'cold', reasons: ['Add a scene to score the hook.'], verified: false };
  }

  let score = 50;
  const reasons: string[] = [];
  const first = clips[0];
  const words = (captions[first.id] ?? []).slice().sort((a, b) => a.start - b.start);
  const verified = words.length > 0;

  if (verified) {
    // Dead air vs instant speech.
    const firstStart = words[0].start;
    if (firstStart <= 1.2) {
      score += 12;
      reasons.push(`first word lands at ${firstStart.toFixed(1)}s`);
    } else if (firstStart > 2) {
      score -= 12;
      reasons.push(`${firstStart.toFixed(1)}s of dead air before the first word`);
    }

    // Hook-window text patterns (one bonus per family).
    const hookWords = words.filter((w) => w.start < HOOK_WINDOW_SEC);
    const hookText = hookWords.map((w) => w.word).join(' ');
    for (const p of PATTERNS) {
      if (p.re.test(hookText)) {
        score += p.points;
        reasons.push(p.reason);
      }
    }

    // Energy: a dense opener reads as pace.
    if (hookWords.length >= 6) {
      score += 6;
      reasons.push(`dense opener — ${hookWords.length} words in the first ${HOOK_WINDOW_SEC}s`);
    } else if (hookWords.length <= 2) {
      score -= 6;
      reasons.push(
        `thin opener — only ${hookWords.length} word${hookWords.length === 1 ? '' : 's'} in the first ${HOOK_WINDOW_SEC}s`,
      );
    }
  } else {
    score -= 10;
    reasons.push('scene 1 is not transcribed — structure-only guess (hit CC to verify the hook)');
  }

  // Opener length: short first scenes pattern-interrupt.
  const openerSec = effectiveClipDuration(first);
  if (openerSec <= 2.5) {
    score += 8;
    reasons.push(`pattern-interrupt opener (${openerSec.toFixed(1)}s)`);
  } else if (openerSec <= 5) {
    score += 4;
    reasons.push(`tight opener (${openerSec.toFixed(1)}s)`);
  } else if (openerSec > 8) {
    score -= 8;
    reasons.push(`slow opener — ${openerSec.toFixed(1)}s before the first cut`);
  }

  // The Vault: a proven opener earns real points.
  if (vaultWinRateByUrl?.has(first.url)) {
    const wr = vaultWinRateByUrl.get(first.url) ?? null;
    if (wr != null && wr >= 0.05) {
      score += 10;
      reasons.push(`★★★ opener — ${(wr * 100).toFixed(1)}% proven win rate`);
    } else if (wr != null && wr >= 0.03) {
      score += 7;
      reasons.push(`★★ opener — ${(wr * 100).toFixed(1)}% proven win rate`);
    } else if (wr != null && wr >= 0.015) {
      score += 4;
      reasons.push(`★ opener — ${(wr * 100).toFixed(1)}% proven win rate`);
    } else {
      score += 2;
      reasons.push('vault opener (unrated — below the proof floor)');
    }
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: clamped,
    band: clamped >= 70 ? 'hot' : clamped >= 40 ? 'warm' : 'cold',
    reasons: reasons.slice(0, 8),
    verified,
  };
}
