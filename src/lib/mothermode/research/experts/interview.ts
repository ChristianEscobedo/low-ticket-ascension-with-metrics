/**
 * "Build me an agent" (roadmap Phase 3): the interview → config composer.
 *
 * The owner answers four plain-English questions; this module turns the
 * answers into a REAL expert config (slug / persona / tool policy /
 * artifact contract / model) deterministically — NO AI call. The shape
 * is data, not generation: the same interview always produces the same
 * expert, which is what makes the sandbox test-drive honest (what you
 * tested is exactly what you saved).
 *
 * `expertDraftErrors` is the SHARED validator: the builder's live error
 * line and the API's 400 are the same function, so they can never
 * disagree (the fork editor's contract, applied to experts).
 *
 * Pure: no server imports.
 */
import { RESEARCH_ARTIFACT_TYPES } from '../types';
import { buildResearchToolDefs } from '../agent/toolDefs';
import { TEXT_MODELS, AUTO_MODEL } from '@/lib/mothermode/content/models';

/** The four questions, structured. */
export interface ExpertInterviewAnswers {
  /** "Comment Reply Coach" — becomes the slug + display name. */
  name: string;
  /** One line: what the agent does ("answers comments in our voice"). */
  does: string;
  /** What it optimizes for / who it serves ("turn skeptics into buyers"). */
  optimizesFor: string;
  /** Tool policy ([] = the full lane). */
  tools: string[];
  /** Artifact contract ([] = every type). */
  artifactTypes: string[];
  /** Picker model id ('' = Auto). */
  model: string;
}

/** The composer's output — the exact upsert payload + the derived slug. */
export interface ExpertDraft {
  slug: string;
  name: string;
  tagline: string;
  glyph: string;
  persona: string;
  model: string;
  tools: string[];
  artifactTypes: string[];
}

/** Every callable tool EXCEPT create_artifact (always granted — the
 *  artifact contract, not the policy, decides what it may save). */
export function interviewToolOptions(): string[] {
  return buildResearchToolDefs({ deep: true })
    .map((d) => d.name)
    .filter((n) => n !== 'create_artifact');
}

const KNOWN_MODELS = new Set([AUTO_MODEL, ...TEXT_MODELS.map((m) => m.id)]);

/**
 * The slug: lowercase, dash-joined, leading letter, ≤ 40 chars. Same
 * rules as the house slugs (atlas, wren, comment-coach), so a drafted
 * expert is indistinguishable in kind from a seeded one.
 */
export function slugifyExpertName(name: string): string {
  const slug = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  // A slug must start with a letter; a pure-number name gets a prefix.
  if (slug && !/^[a-z]/.test(slug)) return `agent-${slug}`.slice(0, 40);
  return slug;
}

/**
 * The persona prompt, house-voice, deterministic. It mirrors the seeded
 * experts' shape: WHO you are, WHAT you do, WHAT you optimize for, and
 * the standing rules (pull data first, honest numbers, save the work).
 */
export function composeExpertPersona(a: ExpertInterviewAnswers): string {
  const name = (a.name || '').trim();
  const does = (a.does || '').trim();
  const optimizes = (a.optimizesFor || '').trim();
  const lines = [
    `You are ${name}, a MotherMode expert agent.`,
    does ? `Your job: ${does.replace(/\.$/, '')}.` : '',
    optimizes
      ? `You optimize for one thing: ${optimizes.replace(/\.$/, '')}. Every answer moves that number or says plainly why it cannot.`
      : '',
    'The business sells low-ticket resources to overwhelmed moms; when the brief or the attached context says otherwise, the brief wins.',
    'Work like a practitioner, not a chatterbot: pull data before you advise (your granted tools), quote numbers exactly as the tools returned them, and say when a source failed instead of guessing.',
    'Anything worth keeping goes through create_artifact — a chat-only answer is invisible to the owner.',
  ].filter(Boolean);
  return lines.join('\n\n');
}

/** Answers → the full draft config. */
export function buildExpertDraft(a: ExpertInterviewAnswers): ExpertDraft {
  const name = (a.name || '').trim();
  return {
    slug: slugifyExpertName(name),
    name,
    tagline: (a.does || '').trim(),
    glyph: 'bot',
    persona: composeExpertPersona(a),
    model: (a.model || '').trim(),
    tools: Array.from(
      new Set((a.tools ?? []).map((t) => t.trim()).filter(Boolean)),
    ),
    artifactTypes: Array.from(
      new Set((a.artifactTypes ?? []).map((t) => t.trim()).filter(Boolean)),
    ),

  };
}

const TOOL_OPTIONS = new Set(interviewToolOptions());
const ARTIFACT_OPTIONS = new Set<string>(RESEARCH_ARTIFACT_TYPES);

/**
 * The shared validator. Returns [] when the draft can save. Every error
 * is one readable line naming the hole — never a silent trim.
 */
export function expertDraftErrors(d: Partial<ExpertDraft>): string[] {
  const errors: string[] = [];
  const slug = (d.slug ?? '').trim();
  const name = (d.name ?? '').trim();
  const persona = (d.persona ?? '').trim();
  const model = (d.model ?? '').trim();
  const tools = d.tools ?? [];
  const artifactTypes = d.artifactTypes ?? [];

  if (!name) errors.push('Name is required.');
  if (!slug) {
    errors.push('Slug is required (it derives from the name).');
  } else if (!/^[a-z][a-z0-9-]{1,39}$/.test(slug)) {
    errors.push(
      `Slug "${slug}" must be 2-40 chars of lowercase letters, numbers, and dashes, starting with a letter.`,
    );
  }
  if (slug === 'research') {
    errors.push('Slug "research" is the built-in agent — pick another name.');
  }
  if (!persona) errors.push('Persona is required (compose one from the interview answers).');
  if (model && !KNOWN_MODELS.has(model)) {
    errors.push(`Model "${model}" is not in the text-model catalog.`);
  }
  for (const t of tools) {
    if (!TOOL_OPTIONS.has(t)) errors.push(`Unknown tool "${t}".`);
  }
  for (const t of artifactTypes) {
    if (!ARTIFACT_OPTIONS.has(t)) errors.push(`Unknown artifact type "${t}".`);
  }
  return errors;
}
