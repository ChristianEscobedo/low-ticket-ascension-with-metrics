/**
 * "Turn this chat into a play" (roadmap Phase 3): distill a successful
 * manual session into a recipe DRAFT — deterministic, no AI call.
 *
 * THE IDEA
 * --------
 * A manual session already DID the play once: the owner steered, the
 * agent swept, and the artifacts landed in order — brief, offer, assets.
 * Replaying that arc as a recipe means naming each artifact's step:
 * which expert runs it, what it reads, what it emits, and where the
 * handoffs (and the gates around them) go. All of that is KNOWABLE from
 * the artifact rows themselves, so the draft is composed, not generated
 * — an AI pass can season instructions later, but the shape is data.
 *
 * THE RULES (all mirror the house plays in ./seed.ts)
 * -------------------------------------------------
 * - ORDER: the artifacts' creation order IS the step order. Step 1
 *   reads the session brief; every later step reads the previous
 *   artifact (the recipe model's linear chain).
 * - EXPERT: the artifact's `createdBy` wins (a custom-expert session
 *   replays as the expert that actually produced the work); the
 *   fallbacks ('', 'agent', 'owner') resolve through the house type map
 *   (research→research, offer-brief→strategist, lead-magnet→leadmagnet,
 *   email-outline→email, content/angles→copy, notes→copy).
 * - HANDOFF: an artifact that was handed off replays with the same
 *   target; `generate` mirrors the seeds (kits build, everything else
 *   drafts).
 * - GATE: handoffs to 'system' or 'sales-funnel' pause for approval —
 *   money surfaces get a human yes, exactly like the house plays.
 * - SLUG: `play-<session id suffix>` — deterministic per session, so
 *   re-distilling the same chat UPDATES the same play (the save upserts
 *   by slug) instead of forking endlessly.
 * - INSTRUCTIONS: house-voice templates per artifact type with {input}
 *   where the seeds put it. They are STARTING points — the draft opens
 *   in the fork editor, where the owner rewrites before saving.
 *
 * Pure: no server imports — the workspace maps live rows in.
 */
import type { ResearchArtifact, ResearchSession } from '../types';
import type { RecipeDraftStep } from './types';

export interface ChatPlayDraft {
  slug: string;
  name: string;
  description: string;
  budgetEstCents: number;
  steps: RecipeDraftStep[];
}

/** The house type -> expert fallback (createdBy wins when it's real). */
const EXPERT_FOR_TYPE: Record<string, string> = {
  'research-brief': 'research',
  'offer-brief': 'strategist',
  'lead-magnet': 'leadmagnet',
  'email-outline': 'email',
  'content-plan': 'copy',
  'ad-angles': 'copy',
  notes: 'copy',
};

/** createdBy values that are NOT an expert identity. */
const CREATED_BY_FALLBACKS = new Set(['', 'agent', 'owner']);

function expertFor(
  artifact: Pick<ResearchArtifact, 'type' | 'createdBy'>,
): string {
  const created = (artifact.createdBy || '').trim();
  if (created && !CREATED_BY_FALLBACKS.has(created)) return created;
  return EXPERT_FOR_TYPE[artifact.type] ?? 'research';
}

/** House-voice instruction per artifact type; {input} sits where the
 *  seeds put it (the brief for step 1, the previous artifact after). */
function instructionFor(
  artifact: Pick<ResearchArtifact, 'type'>,
  isFirst: boolean,
): string {

  switch (artifact.type) {
    case 'research-brief':
      return isFirst
        ? "Research the niche for the next offer. Sweep Reddit and one social platform broadly across the brief's problem keywords, mine the pain language and the objections, then save a research-brief artifact with the 3-5 biggest themes and the exact phrases to reuse. Brief goal: {input}"
        : 'Keep researching with one more sweep angle the picture so far is missing, then save a research-brief artifact. The picture so far:\n\n{input}';
    case 'offer-brief':
      return 'Turn this research brief into an offer decision. Pick the ONE promise the evidence supports best, the mechanism that delivers it in one sitting, the price point, and 3-5 angles. Save an offer-brief artifact with the exact documented structure. Research brief:\n\n{input}';
    case 'lead-magnet':
      return 'Design the lead magnet for this offer: the FIRST slice of its promise, consumable in one sitting, bridging to the paid mechanism. Save a lead-magnet artifact with the exact documented structure. Offer brief:\n\n{input}';
    case 'email-outline':
      return 'Write the nurture sequence for this lead magnet: 4-5 emails from download to offer, subject lines from the research language, one job per email. Save an email-outline artifact with the exact documented structure. Lead magnet:\n\n{input}';
    case 'content-plan':
      return 'Plan the launch content for this offer: 7 posts across instagram and tiktok, hooks pulled from the research language verbatim, one paid angle per platform. Save a content-plan artifact with the exact documented items structure. Offer brief:\n\n{input}';
    case 'ad-angles':
      return 'Turn this research into angles worth running: 5 hooks pulled from the audience language verbatim, each with the theme it rides and the platform it fits. Save an ad-angles artifact with the exact documented items structure. The brief:\n\n{input}';
    default:
      return 'Save a notes artifact with anything worth keeping from this pass. The picture so far:\n\n{input}';
  }
}

/** The session's share of a slug: first 8 non-dash chars of its id (the
 *  handoff layer's suffix convention). */
function sessionSuffix(sessionId: string): string {
  return (sessionId || '').replace(/-/g, '').slice(0, 8) || 'x';
}

/** Budget mirror of the seeds: ~75c a step + 50c, capped at the
 *  mega-recipe's 450c. */
function budgetFor(stepCount: number): number {
  return Math.min(450, 50 + stepCount * 75);
}

/**
 * Compose the draft, or null when the chat has nothing to replay (no
 * artifacts yet — the button simply doesn't render then).
 */
export function buildPlayDraft(input: {
  session: Pick<ResearchSession, 'id' | 'title'>;
  artifacts: Array<
    Pick<
      ResearchArtifact,
      'type' | 'createdBy' | 'handedOffTo' | 'createdAt'
    >
  >;
}): ChatPlayDraft | null {
  const artifacts = (input.artifacts ?? []).filter((a) => a && a.type);
  if (artifacts.length === 0) return null;

  // Creation order IS the step order; rows without timestamps keep their
  // current (store) order at the end.
  const ordered = [...artifacts].sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
    const bt = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
    if (Number.isFinite(at) && Number.isFinite(bt)) return at - bt;
    if (Number.isFinite(at)) return -1;
    if (Number.isFinite(bt)) return 1;
    return 0;
  });

  const steps: RecipeDraftStep[] = ordered.map((artifact, i) => {
    const handoffKind = artifact.handedOffTo?.kind;
    const gated = handoffKind === 'system' || handoffKind === 'sales-funnel';
    return {
      expert: expertFor(artifact),
      instruction: instructionFor(artifact, i === 0),

      inputFrom: i === 0 ? 'brief' : 'previous',
      outputArtifact: artifact.type,
      gate: gated ? 'approve' : 'auto',
      handoff: handoffKind
        ? {
            target: handoffKind,
            generate:
              handoffKind === 'leadgen-kit' || handoffKind === 'email-kit',
          }
        : null,
    };
  });

  const title = (input.session.title || '').trim() || 'Chat play';
  return {
    slug: `play-${sessionSuffix(input.session.id)}`,
    name: title,
    description: `Distilled from the "${title}" chat — ${steps.length} step${steps.length === 1 ? '' : 's'} from ${steps.length} artifact${steps.length === 1 ? '' : 's'}.`,
    budgetEstCents: budgetFor(steps.length),
    steps,
  };
}
