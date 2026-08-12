/**
 * The reaction-preset registry — the spine of the AI hook sheet (phase 3).
 *
 * A preset is a reaction turned into a production brief: the prompt fragment
 * IS the reaction (so the bank's filter chips stay honest), plus the duration
 * the clip targets and the look the render carries. One preset per
 * HookReaction value, so the taxonomy is always coverable.
 *
 * WHY NOT THE STORYBOARD: a reaction hook is a silent 1-2s visual beat — no
 * voice, no line, no gate. The full clone pipeline (storyboard → per-beat
 * voice+video) is for talking content; a hook just needs the character sheet
 * + this fragment through Seedance. This module is the ONLY place hook
 * generation copy is built — deterministic for the same preset.
 */
import type { HookReaction } from './hookBank';

export interface HookReactionPreset {
  /** Stable id (the API + UI key). */
  id: string;
  /** The bank reaction this preset files under. */
  reaction: HookReaction;
  /** Human label for the picker. */
  label: string;
  /** The prompt fragment — the reaction, as a direction. */
  fragment: string;
  /** The clip duration the render targets (provider floor applies). */
  durationSec: number;
}

/**
 * One preset per reaction. The fragments are written as pattern-interrupt
 * directions — big, fast, readable in the first second, no words.
 */
export const HOOK_REACTION_PRESETS: HookReactionPreset[] = [
  {
    id: 'mind-blown',
    reaction: 'shock',
    label: 'Mind blown',
    fragment:
      'eyes go wide, a slow lean toward the camera, one hand half-rises — total disbelief landing in real time',
    durationSec: 2,
  },
  {
    id: 'burst-laugh',
    reaction: 'laugh',
    label: 'Bursts out laughing',
    fragment:
      'an involuntary laugh breaking through, head tipping back, hand coming up to cover it — genuine, not performed',
    durationSec: 2,
  },
  {
    id: 'wait-what',
    reaction: 'confusion',
    label: 'Wait — what',
    fragment:
      'a sharp double-take, brow furrowing, freezing mid-motion as the thought catches up',
    durationSec: 2,
  },
  {
    id: 'deep-exhale',
    reaction: 'satisfaction',
    label: 'Deep satisfied exhale',
    fragment:
      'a long contented exhale, shoulders dropping, a small settled smile — the exact moment a thing finally clicks into place',
    durationSec: 2,
  },
  {
    id: 'that-is-so-me',
    reaction: 'relatability',
    label: 'That is so me',
    fragment:
      'a wry knowing look straight into the lens, a slow nod, half a smile — seen, and a little called out',
    durationSec: 2,
  },
  {
    id: 'total-chaos',
    reaction: 'chaos',
    label: 'Total chaos',
    fragment:
      'overwhelmed in the best way — hands flying up, a laugh and a gasp at once, everything happening at the same time',
    durationSec: 2,
  },
  {
    id: 'lean-in',
    reaction: 'curiosity',
    label: 'Lean in',
    fragment:
      'stopping, tilting the head, then leaning in close with narrowed curious eyes — has to see what this is',
    durationSec: 2,
  },
  {
    id: 'quiet-awe',
    reaction: 'awe',
    label: 'Quiet awe',
    fragment:
      'breath catching, eyes softening and widening, a slow blink — watching something genuinely remarkable land',
    durationSec: 2,
  },
];

export function hookReactionPreset(id: string): HookReactionPreset | null {
  return HOOK_REACTION_PRESETS.find((p) => p.id === id) ?? null;
}

/** Every HookReaction the registry covers (the taxonomy check the UI runs). */
export function coveredReactions(): HookReaction[] {
  return Array.from(new Set(HOOK_REACTION_PRESETS.map((p) => p.reaction)));
}

/**
 * The production brief for a reaction hook. @image1 is the character sheet —
 * the source of truth for identity and wardrobe. The preset's fragment is the
 * ACTION. A steer note (optional) adjusts the read without re-describing the
 * character. Lean by design: the sheet owns the person, the preset owns the
 * reaction, nothing repeats.
 */
export function buildHookReactionPrompt(input: {
  preset: HookReactionPreset;
  note?: string;
}): string {
  const { preset } = input;
  const note = input.note?.trim().slice(0, 200);
  return [
    '[CHARACTER SHEET]',
    '@image1 — THE CHARACTER. Source of truth for identity, face, hair, body, wardrobe, distinguishing features. The person stays recognizable as the same one — match the sheet exactly.',
    '',
    `ACTION: the character reacts — ${preset.fragment}.`,
    'One clean reaction, readable in the first second. No words, no captions.',
    note ? `NOTE: ${note}.` : '',
    `CUT: close-up, head and shoulders, 9:16, ${preset.durationSec}s. Camera holds steady — the face carries it.`,
    'Photorealistic, real skin texture, natural motion, no text, no watermark, no logos.',
  ]
    .filter((l) => l !== '')
    .join('\n');
}
