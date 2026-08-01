/**
 * Recipe crew + run display helpers (PURE — no server imports): expert
 * display names, crew summaries, run progress, relative timestamps, and
 * the research-lab deep link. Shared by the mission UI (/admin/recipes),
 * the lab's Plays rail, and the transcript's run-step dividers.
 */
import type { Recipe, RecipeRun } from './types';
// Type-only (erased at build): the watchlists module is service-role
// server code, and this file is shared with client bundles.
import type { WatchTrigger } from '../watchlists';

/** Minimal expert identity — the recipes API payload's experts list. */
export interface ExpertInfo {
  slug: string;
  name: string;
  tagline: string;
}

/**
 * The expert's display name: the crew directory's name wins (Atlas, Wren,
 * Nova...); an unknown/unseeded slug degrades to a prettified slug
 * ('leadmagnet' -> 'Leadmagnet'), never to a raw lowercase slug.
 */
export function expertDisplayName(
  slug: string,
  experts: ExpertInfo[],
): string {
  const clean = (slug || '').trim();
  if (!clean) return 'Expert';
  const found = experts.find((e) => e.slug === clean);
  if (found?.name.trim()) return found.name.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * The recipe's crew: unique expert slugs in first-use order. A recipe that
 * runs the same expert twice (research x2 -> copy) lists the expert once —
 * the crew is WHO is involved, not how many turns they take.
 */
export function recipeCrew(recipe: Pick<Recipe, 'steps'>): string[] {
  const out: string[] = [];
  for (const step of recipe.steps) {
    const slug = (step.expert || '').trim();
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

/** One-line crew summary: 'Research -> Atlas -> Wren'. */
export function crewSummary(
  recipe: Pick<Recipe, 'steps'>,
  experts: ExpertInfo[],
): string {
  return recipeCrew(recipe)
    .map((slug) => expertDisplayName(slug, experts))
    .join(' → ');
}

/** Run progress for the bar: completed steps (done or gated) of the total. */
export function runProgress(run: Pick<RecipeRun, 'stepsState'>): {
  done: number;
  total: number;
  percent: number;
} {
  const total = run.stepsState.length;
  const done = run.stepsState.filter(
    (s) => s.status === 'done' || s.status === 'gated',
  ).length;
  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

/** A run the lane is (or could be) working on right now. */
export function isRunActive(run: Pick<RecipeRun, 'status'>): boolean {
  return run.status === 'running' || run.status === 'gated';
}

/**
 * The first step that still needs work (pending or mid-flight running) —
 * the step-sized lane's resume index. Returns past-the-end when every step
 * settled, so a fully-run recipe never restarts by accident.
 */
export function nextUnfinishedStepIndex(
  run: Pick<RecipeRun, 'stepsState'>,
): number {
  for (let i = 0; i < run.stepsState.length; i++) {
    const s = run.stepsState[i].status;
    if (s === 'pending' || s === 'running') return i;
  }
  return run.stepsState.length;
}

// ---------------------------------------------------------------------------
// Citation coverage (the "research with receipts" check)
// ---------------------------------------------------------------------------

export interface CitationCoverage {
  /** Claim-length lines carrying a receipt marker. */
  sourced: number;
  /** Claim-length lines total (40+ chars, non-heading). */
  total: number;
  /** sourced/total (0 when there is nothing to judge). */
  ratio: number;
}

/** A line carries a receipt: a URL, a subreddit, a handle, a `source:` tag,
 *  an exact percentage, a k-suffixed count, or a verbatim quote of 20+
 *  chars. Cheap and honest — it measures EVIDENCE PRESENCE, not truth. */
function hasReceipt(line: string): boolean {
  return (
    /https?:\/\//.test(line) ||
    /(^|\W)r\/[A-Za-z0-9_]+/.test(line) ||
    /(^|\W)@[A-Za-z0-9_.]+/.test(line) ||
    /source:/i.test(line) ||
    /\d+(\.\d+)?%/.test(line) ||
    /\d+(\.\d+)?k\b/i.test(line) ||
    /"[^"]{20,}"/.test(line)
  );
}

/**
 * How much of a brief's claim text carries receipts (0..1). The
 * interpreter nudges once below the floor, then flags honestly.
 */
export function citationCoverage(markdown: string): CitationCoverage {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 40 && !l.startsWith('#'));
  let sourced = 0;
  for (const line of lines) {
    if (hasReceipt(line)) sourced += 1;
  }
  return {
    sourced,
    total: lines.length,
    ratio: lines.length > 0 ? sourced / lines.length : 0,
  };
}

/** Below this share of sourced claim lines, the step nudges + flags. */
export const CITATION_FLOOR = 0.3;

// ---------------------------------------------------------------------------
// Watchlist trigger display (Phase 2)
// ---------------------------------------------------------------------------

/** Human labels for the trigger metrics (the rollups' vocabulary). */
export const TRIGGER_METRIC_LABELS: Record<string, string> = {
  recentClicks: '30-day clicks',
  totalClicks: 'all-time clicks',
  optins: 'attributed leads',
  purchases: 'attributed sales',
  revenueCents: 'attributed revenue',
};

/**
 * The armed-trigger line for the recipe card: "also runs when 30-day
 * clicks drop below 100". Null without a trigger. Revenue displays in
 * dollars (the stored value is cents — money is cents until formatted).
 */
export function watchTriggerLine(
  trigger: WatchTrigger | null | undefined,
): string | null {
  if (!trigger) return null;
  const label = TRIGGER_METRIC_LABELS[trigger.metric] ?? trigger.metric;
  const value =
    trigger.metric === 'revenueCents'
      ? `$${(trigger.value / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : trigger.value.toLocaleString();
  const op = trigger.op === 'lt' ? 'drop below' : 'reach';
  const cooldown =
    trigger.cooldownHours && trigger.cooldownHours !== 24
      ? ` (max once per ${trigger.cooldownHours}h)`
      : '';
  return `also runs when ${label} ${op} ${value}${cooldown}`;
}

// ---------------------------------------------------------------------------
// Mission Control (the fleet at a glance, for the admin home)
// ---------------------------------------------------------------------------

/** One running run, as the crew-presence row: who's working, on what, where. */
export interface MissionCrewEntry {
  runId: string;
  recipeName: string;
  expertSlug: string;
  /** 'step 2 of 5' — the in-flight step (stepsState's running row wins,
   *  currentStep the fallback). */
  stepLabel: string;
}

export interface MissionSummary {
  /** Runs mid-flight right now. */
  activeRuns: number;
  /** Runs paused for the owner's yes. */
  gatesWaiting: number;
  /** Active watches (weekly + any armed triggers). */
  watches: number;
  crew: MissionCrewEntry[];
}

/**
 * Roll the recent runs + recipes + watches into the home strip. Settled
 * runs (done/failed/canceled) are not crew and not gates — they already
 * said their piece in the feed. A gated run waits on a HUMAN, so it is
 * never "working". A run whose recipe is gone still lists (the default
 * slug, like the interpreter's own fallback).
 */
export function missionSummary(input: {
  runs: Array<
    Pick<RecipeRun, 'id' | 'recipeId' | 'status' | 'currentStep' | 'stepsState'>
  >;
  recipes: Array<Pick<Recipe, 'id' | 'name' | 'steps'>>;
  watchlists: Array<{ status: string }>;
}): MissionSummary {
  const recipeById = new Map(input.recipes.map((r) => [r.id, r] as const));
  const crew: MissionCrewEntry[] = [];
  let activeRuns = 0;
  let gatesWaiting = 0;

  for (const run of input.runs) {
    if (run.status === 'gated') {
      gatesWaiting += 1;
      continue;
    }
    if (run.status !== 'running' || run.stepsState.length === 0) continue;
    activeRuns += 1;
    const recipe = recipeById.get(run.recipeId);
    const inFlight = run.stepsState.findIndex((s) => s.status === 'running');
    const idx =
      inFlight >= 0
        ? inFlight
        : Math.min(run.currentStep, run.stepsState.length - 1);
    const step = recipe?.steps[idx];
    crew.push({
      runId: run.id,
      recipeName: recipe?.name.trim() || 'a play',
      expertSlug: (step?.expert || '').trim() || 'research',
      stepLabel: `step ${idx + 1} of ${run.stepsState.length}`,
    });
  }

  return {
    activeRuns,
    gatesWaiting,
    watches: input.watchlists.filter((w) => w.status === 'active').length,
    crew,
  };
}

/** Relative timestamp: 'just now', '4m ago', '2h ago', '3d ago', else date. */
export function formatAgo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

/**
 * The research-lab deep link: open a session, optionally focused on a run's
 * transcript turns or one artifact. The workspace reads these params once.
 */
export function researchLabHref(input: {
  sessionId: string;
  runId?: string;
  artifactId?: string;
}): string {
  const params = new URLSearchParams({ session: input.sessionId });
  if (input.runId) params.set('run', input.runId);
  if (input.artifactId) params.set('artifact', input.artifactId);
  return `/admin/research?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Handoff notices (the chat feed's "build initiated / completed" trail)
// ---------------------------------------------------------------------------

/** Human label for a handoff target, for notices and badges. */
export function handoffTargetLabel(target: string): string {
  switch (target) {
    case 'planner-cards':
      return 'planner cards';
    case 'leadgen-kit':
      return 'lead gen kit';
    case 'email-kit':
      return 'email kit';
    case 'sales-funnel':
      return 'sales funnel draft';
    case 'system':
      return 'full system';
    default:
      return target;
  }
}

/**
 * The chat-feed notice text for one handoff beat. Fired by the interpreter
 * (recipe step handoffs) and by the manual artifact buttons; both land in
 * the session transcript as assistant notices.
 */
export function handoffNotice(input: {
  phase: 'initiated' | 'completed' | 'failed';
  target: string;
  /** Build (true) runs the target's generation pipeline; Draft pre-fills.
   *  Ignored by 'system' — the fan-out always builds. */
  generate: boolean;
  artifactTitle: string;
  /** The outcome label on completion ('12 planner cards', 'The Offload Map
   *  nurture (drafted)') or the error on failure. */
  detail?: string;
}): string {
  const target = handoffTargetLabel(input.target);
  const title = input.artifactTitle.trim() || 'untitled';
  if (input.phase === 'initiated') {
    const action =
      input.target === 'system'
        ? `Building the full system`
        : input.generate
          ? `Building the ${target}`
          : `Drafting the ${target}`;
    return `**Handoff initiated:** ${action} from "${title}".`;
  }
  if (input.phase === 'completed') {
    return `**Handoff completed:** ${input.detail?.trim() || target} — from "${title}".`;
  }
  return `**Handoff failed:** the ${target} from "${title}" — ${input.detail?.trim() || 'unknown error'}.`;
}

// ---------------------------------------------------------------------------
// The ⌘K palette + the mobile gates page (roadmap UI/UX threads)
// ---------------------------------------------------------------------------

/** One row in the command palette. Gates first — a human is waiting. */
export interface PaletteAction {
  id: string;
  kind: 'gate' | 'play' | 'session';
  label: string;
  hint: string;
  /** gate: the run id to approve; play: the slug to focus; session: the id to open. */
  target: string;
}

/**
 * The palette's action list, ordered: waiting gates (approve from
 * anywhere), then every play (jump to its card), then sessions (jump to
 * the lab). Deliberately NO "run" action — a play spends money, so the
 * palette navigates to the card; the run button stays a click away with
 * its context around it.
 */
export function buildPaletteActions(input: {
  recipes: Array<Pick<Recipe, 'id' | 'slug' | 'name'>>;
  runs: Array<Pick<RecipeRun, 'id' | 'status' | 'recipeId' | 'currentStep'>>;
  sessions: Array<{ id: string; title: string }>;
}): PaletteAction[] {
  const out: PaletteAction[] = [];
  for (const run of input.runs) {
    if (run.status !== 'gated') continue;
    const recipe = input.recipes.find((r) => r.id === run.recipeId);
    out.push({
      id: `gate-${run.id}`,
      kind: 'gate',
      label: `Approve: ${recipe?.name ?? 'a play'}`,
      hint: `gate waiting · step ${(run.currentStep ?? 0) + 1}`,
      target: run.id,
    });
  }

  for (const recipe of input.recipes) {
    out.push({
      id: `play-${recipe.slug}`,
      kind: 'play',
      label: recipe.name,
      hint: `play · ${recipe.slug}`,
      target: recipe.slug,
    });
  }
  for (const session of input.sessions) {
    out.push({
      id: `session-${session.id}`,
      kind: 'session',
      label: session.title || 'Research session',
      hint: 'research session',
      target: session.id,
    });
  }
  return out;
}

/** Case-insensitive substring match over label + hint. */
export function paletteMatches(action: PaletteAction, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    action.label.toLowerCase().includes(q) ||
    action.hint.toLowerCase().includes(q)
  );
}

/** The mobile gates page's list: every run paused on a human yes. */
export function gatedRuns<T extends Pick<RecipeRun, 'status'>>(
  runs: T[],
): T[] {
  return runs.filter((r) => r.status === 'gated');
}


