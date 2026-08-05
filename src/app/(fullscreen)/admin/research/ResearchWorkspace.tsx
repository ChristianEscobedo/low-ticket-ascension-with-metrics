'use client';

/**
 * The Research Lab workspace, full-viewport edition: a slim top bar, then
 * three always-on columns — sessions (left), chat with reasoning (center),
 * artifacts (right). The page owns the viewport; each column scrolls itself.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  FlaskConical,
  Plus,
  Send,
  Loader2,
  Trash2,
  FileText,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  Pin,
  Quote,
  Workflow,
  X,
} from 'lucide-react';

import {
  TEXT_MODELS,
  AUTO_MODEL,
} from '@/lib/mothermode/content/models';
import {
  ARTIFACT_TYPE_LABELS,
  type ResearchArtifact,
  type ResearchMessage,
  type ResearchSession,
  type ToolCallRecord,
} from '@/lib/mothermode/research/types';
import {
  inferEvidenceKind,
  type ResearchEvidence,
} from '@/lib/mothermode/research/evidence';
import { formatAge } from '@/lib/mothermode/research/freshness';
import type { LiveCardItem } from '@/lib/mothermode/research/liveCards';
import type { PhraseBankRow } from '@/lib/mothermode/research/phraseBank';
import type {
  Recipe,
  RecipeRun,
} from '@/lib/mothermode/research/recipes/types';
import {
  expertDisplayName,
  type ExpertInfo,
} from '@/lib/mothermode/research/recipes/crew';
import { buildFunnelMap } from '@/lib/mothermode/research/funnelMap';
import { buildPlayDraft } from '@/lib/mothermode/research/recipes/fromChat';
import RecipeDraftEditor, {
  draftStepsPayload,
  type RecipeDraft,
} from '@/app/admin/recipes/RecipeDraftEditor';

import * as client from './researchClient';
import ReasoningTrace from './ReasoningTrace';
import LiveCards from './LiveCards';
import ArtifactView from './ArtifactView';
import Markdown from './Markdown';
import IntakePanel from './IntakePanel';
import RecipeRunsPanel from './RecipeRunsPanel';
import FunnelMapCard from './FunnelMapCard';

interface OfferOption {
  slug: string;
  name: string;
}

// Broad everyday language on purpose: narrow suggestions steer the agent
// into narrow (read: empty) queries.
const DEFAULT_SUGGESTIONS = [
  'Scan the niche: what are overwhelmed moms asking about this week? Sweep Reddit and social broadly, then give me the 3 biggest themes.',
  'Find me a new lead magnet. Mine Amazon reviews of the top organizing books for the complaints people leave, then propose 3 concepts.',
  'What is our best performing content? Pull internal metrics and tell me what to double down on.',
  'Draft an offer brief for a $17 reset kit. Check our own numbers first, then mine reviews for language.',
];

/** Trigger cards built FROM the saved brief's seeds (specific-dig starters).
 *  Falls back to the defaults when the brief has fewer than two seeds. */
function suggestionsFor(intake: ResearchSession['intake'] | undefined): string[] {
  if (!intake) return DEFAULT_SUGGESTIONS;
  const cards: string[] = [];
  const kw = intake.problemKeywords[0];
  if (kw) {
    const sub = intake.subreddits[0];
    cards.push(
      `Dig into "${kw}"${sub ? ` in r/${sub}` : ' on Reddit'}: threads and top comments, then the pain language as 10 hooks.`,
    );
  }
  const product = intake.competitorProducts[0];
  if (product) {
    cards.push(
      `Mine Amazon reviews on ${product} — objections and unmet promises first, then what buyers actually wanted.`,
    );
  }
  const voice = intake.competitorVoices[0];
  if (voice && intake.depth === 'deep') {
    cards.push(
      `Deep dive @${voice.handle}: rank their recent posts by real engagement, mine the comments on the winners, and roll up the phrases and questions the audience keeps repeating.`,
    );
  } else if (voice) {
    cards.push(
      `Research the voice ${voice.handle}: what hooks and angles do they run, and what does the audience repeat back?`,
    );
  }
  if (cards.length < 2) return DEFAULT_SUGGESTIONS;
  // The two cross-cutting cards always ride along.
  cards.push(
    'Scan the niche broadly: what are moms asking about this week? Give me the 3 biggest themes with sources.',
  );
  cards.push(
    'What is our best performing content? Pull internal metrics and tell me what to double down on.',
  );
  return cards.slice(0, 4);
}

export default function ResearchWorkspace({
  offers,
  initialSessionId = '',
  focusRunId = '',
  focusArtifactId = '',
}: {
  offers: OfferOption[];
  /** Deep links (the recipes UI's "open in chat"): the session to open on
   *  load, with the transcript scrolled to a run's turns and/or one
   *  artifact popped. All optional; plain /admin/research behaves as
   *  before. */
  initialSessionId?: string;
  focusRunId?: string;
  focusArtifactId?: string;
}) {
  const [sessions, setSessions] = useState<ResearchSession[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [artifacts, setArtifacts] = useState<ResearchArtifact[]>([]);
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState<string>(AUTO_MODEL);
  const [offerSlug, setOfferSlug] = useState('');
  const [streaming, setStreaming] = useState<{
    status: string;
    toolCalls: ToolCallRecord[];
    /** Streamed assistant text as it lands (0.2). */
    text: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [openArtifact, setOpenArtifact] = useState<ResearchArtifact | null>(
    null,
  );
  /** The evidence base for the active session (roadmap 2.1). */
  const [evidence, setEvidence] = useState<ResearchEvidence[]>([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  /** Semantic evidence search (4.7): the query + ranked results. */
  const [evidenceQuery, setEvidenceQuery] = useState('');
  const [evidenceResults, setEvidenceResults] = useState<Array<{
    evidence: ResearchEvidence;
    score: number;
  }> | null>(null);
  const [evidenceSearchBusy, setEvidenceSearchBusy] = useState(false);
  /** The phrase bank for the active session (roadmap 2.3). */
  const [phraseBank, setPhraseBank] = useState<PhraseBankRow[]>([]);
  const [phrasesOpen, setPhrasesOpen] = useState(true);
  /** Today's paid usage for the active session (roadmap 2.4). */
  const [usage, setUsage] = useState<{
    paidRunsToday: number;
    estCostCentsToday: number;
  } | null>(null);
  /** The last re-verify result (4.5): the diff card until dismissed. */
  const [reverify, setReverify] = useState<{
    summary: string;
    diff: { added: string[]; removed: string[]; held: number };
  } | null>(null);
  const [reverifyBusy, setReverifyBusy] = useState(false);
  /** The outcome-digest notice (4.6): "saved" flashes after a run. */
  const [outcomeBusy, setOutcomeBusy] = useState(false);
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  /** A text selection inside the chat, awaiting a pin click. */
  const [pinCandidate, setPinCandidate] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  /** The research brief panel: open for new/seedless sessions until hidden. */
  const [briefOpen, setBriefOpen] = useState(true);
  /** Transient "Brief saved" confirmation (panel closes on save; this is the
   *  proof it persisted, auto-dismissing after a few seconds). */
  const [savedNotice, setSavedNotice] = useState(false);
  /** The crew directory + recipe catalog + recent runs: expert chips on
   *  turns and the transcript's run-step dividers read from here. */
  const [recipeMeta, setRecipeMeta] = useState<{
    recipes: Recipe[];
    experts: ExpertInfo[];
    runs: RecipeRun[];
  }>({ recipes: [], experts: [], runs: [] });
  /** "Turn this chat into a play" (Phase 3): the distilled draft in the
   *  fork editor, then the saved card with the one-click weekly watch. */
  const [playDraft, setPlayDraft] = useState<RecipeDraft | null>(null);
  const [playBusy, setPlayBusy] = useState<'' | 'save' | 'watch'>('');
  const [playSaved, setPlaySaved] = useState<{
    slug: string;
    name: string;
    watched: boolean;
  } | null>(null);
  const [playError, setPlayError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const abortRef = useRef<AbortController | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await client.listSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions');
    }
  }, []);

  /** The recipes payload (recipes + experts + runs) — small; refreshed on
   *  mount and on every run poll tick so chips/dividers stay current. */
  const loadRecipeMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/mothermode-recipes', {
        cache: 'no-store',
      });
      const json = await res.json();
      setRecipeMeta({
        recipes: (json.recipes ?? []) as Recipe[],
        experts: (json.experts ?? []) as ExpertInfo[],
        runs: (json.runs ?? []) as RecipeRun[],
      });
    } catch {
      /* chips fall back to prettified slugs */
    }
  }, []);

  const openSession = useCallback(
    async (id: string, opts?: { preserveArtifact?: boolean }) => {
      setError('');
      // Live-follow reloads keep an open artifact on screen; user-initiated
      // session switches always reset it.
      if (!opts?.preserveArtifact) setOpenArtifact(null);
      try {
        const detail = await client.loadSession(id);
        setActiveId(id);
        setSession(detail.session);
        setMessages(detail.messages);
        setArtifacts(detail.artifacts);
        setEvidence(detail.evidence ?? []);
        setPhraseBank(detail.phraseBank ?? []);
        setUsage(detail.usage ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load session');
      }
    },
    [],
  );

  /** Scroll the transcript to a run's turns (its first stamped message). */
  const jumpToRun = useCallback((runId: string) => {
    const el = scrollRef.current?.querySelector(
      `[data-run-id="${runId}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    refreshSessions();
    loadRecipeMeta();
    return () => abortRef.current?.abort();
  }, [refreshSessions, loadRecipeMeta]);

  // Deep link (?session=<id>): open the linked session once, on load.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || !initialSessionId) return;
    deepLinkedRef.current = true;
    openSession(initialSessionId).catch(() => {});
  }, [initialSessionId, openSession]);

  // Deep link (?artifact=<id>): pop the artifact once it is loaded.
  const artifactLinkedRef = useRef(false);
  useEffect(() => {
    if (artifactLinkedRef.current || !focusArtifactId) return;
    const hit = artifacts.find((a) => a.id === focusArtifactId);
    if (!hit) return;
    artifactLinkedRef.current = true;
    setOpenArtifact(hit);
  }, [focusArtifactId, artifacts]);

  // Deep link (?run=<id>): scroll to the run's turns once messages exist.
  const runLinkedRef = useRef(false);
  useEffect(() => {
    if (runLinkedRef.current || !focusRunId || messages.length === 0) return;
    runLinkedRef.current = true;
    window.setTimeout(() => jumpToRun(focusRunId), 80);
  }, [focusRunId, messages, jumpToRun]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;
    setDraft('');
    setError('');
    setStreaming({ status: 'Thinking.', toolCalls: [], text: '' });

    const optimistic: ResearchMessage = {
      id: `local_${Date.now()}`,
      sessionId: activeId ?? '',
      role: 'user',
      content: message,
      toolCalls: [],
      model: '',
      expertSlug: '',
      recipeRunId: '',
      recipeStepIndex: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    let sessionId = activeId ?? '';
    // The reload at the end of the turn clears transient state — a stream
    // error must survive it, or every failure reads as "nothing happened".
    let streamError = '';
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await client.streamChatTurn({
        sessionId: sessionId || undefined,
        message,
        model: model || undefined,
        offerSlug: sessionId ? undefined : offerSlug || undefined,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'session') {
            sessionId = event.session.id;
            setSession(event.session);
            setActiveId((prev) => prev ?? event.session.id);
            setSessions((prev) =>
              prev
                ? [event.session, ...prev.filter((s) => s.id !== event.session.id)]
                : prev,
            );
          } else if (event.type === 'status') {
            setStreaming((s) => (s ? { ...s, status: event.text } : s));
          } else if (event.type === 'tool') {
            setStreaming((s) =>
              s ? { ...s, toolCalls: [...s.toolCalls, event.call] } : s,
            );
          } else if (event.type === 'artifact') {
            setArtifacts((prev) => [
              event.artifact,
              ...prev.filter((a) => a.id !== event.artifact.id),
            ]);
          } else if (event.type === 'text-delta') {
            setStreaming((s) => (s ? { ...s, text: s.text + event.text } : s));
          } else if (event.type === 'error') {
            streamError = event.error;
            setError(event.error);
          }
        },
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        streamError =
          err instanceof Error ? err.message : 'The research turn failed.';
      }
    } finally {
      setStreaming(null);
      abortRef.current = null;
      if (sessionId) {
        await openSession(sessionId);
        refreshSessions();
      }
      // Re-apply AFTER the reload (openSession clears it): the reason a turn
      // failed stays on screen until the next send, not for one render.
      if (streamError) setError(streamError);
    }
  };

  const removeSession = async (id: string) => {
    if (!window.confirm('Delete this research session and its artifacts?')) {
      return;
    }
    try {
      await client.deleteSession(id);
      if (activeId === id) {
        setActiveId(null);
        setSession(null);
        setMessages([]);
        setArtifacts([]);
      }
      refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const artifactUpdated = (a: ResearchArtifact) => {
    setArtifacts((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    setOpenArtifact(a);
  };
  const artifactDeleted = (id: string) => {
    setArtifacts((prev) => prev.filter((x) => x.id !== id));
  };

  /** Capture a chat text selection as a pin candidate (roadmap 2.1). */
  const captureSelection = () => {
    const sel = window.getSelection();
    const text = sel?.toString().replace(/\s+/g, ' ').trim() ?? '';
    if (!sel || text.length < 3 || sel.rangeCount === 0) {
      setPinCandidate(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setPinCandidate({
      text: text.slice(0, 500),
      x: Math.min(rect.left, window.innerWidth - 180),
      y: Math.max(rect.top - 44, 8),
    });
  };

  const pinSelection = async () => {
    if (!pinCandidate || !activeId || pinBusy) return;
    setPinBusy(true);
    setError('');
    try {
      const pinned = await client.pinEvidence({
        sessionId: activeId,
        offerSlug: session?.offerSlug,
        kind: inferEvidenceKind(pinCandidate.text),
        body: pinCandidate.text,
        sourceTool: 'manual-pin',
      });
      setEvidence((prev) => [pinned, ...prev]);
      setPinCandidate(null);
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pin failed');
    } finally {
      setPinBusy(false);
    }
  };

  const removeEvidence = async (id: string) => {
    try {
      await client.deleteEvidence(id);
      setEvidence((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  /** Semantic evidence search (4.7): backfill first run, then rank. */
  const runEvidenceSearch = async () => {
    const q = evidenceQuery.trim();
    if (!activeId || !q || evidenceSearchBusy) return;
    setEvidenceSearchBusy(true);
    setError('');
    try {
      // The first search backfills embeddings for pre-4.7 pins.
      await client.embedEvidence(activeId).catch(() => ({ embedded: 0 }));
      setEvidenceResults(await client.searchEvidence(activeId, q));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setEvidenceSearchBusy(false);
    }
  };

  /** Pin one card item into the evidence base (roadmap 2.2). */
  const pinFromCard = async (toolName: string, item: LiveCardItem) => {
    if (!activeId) return;
    setError('');
    try {
      const pinned = await client.pinEvidence({
        sessionId: activeId,
        offerSlug: session?.offerSlug,
        kind: inferEvidenceKind(item.text),
        body: item.text,
        sourceUrl: item.url,
        sourceTool: toolName,
      });
      setEvidence((prev) =>
        prev.some((e) => e.id === pinned.id) ? prev : [pinned, ...prev],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pin failed');
    }
  };

  const pinnedBodies = useMemo(
    () => new Set(evidence.map((e) => e.body)),
    [evidence],
  );

  /** Post-publish learning (4.6): the analyst reads our numbers and writes
   *  the outcome digest, lineage-linked to the research that produced it. */
  const runOutcome = async () => {
    if (!activeId || outcomeBusy) return;
    setOutcomeBusy(true);
    setError('');
    try {
      await client.runOutcomeDigest(activeId);
      await openSession(activeId);
      setOutcomeSaved(true);
      window.setTimeout(() => setOutcomeSaved(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Outcome digest failed');
    } finally {
      setOutcomeBusy(false);
    }
  };

  /** Re-verify the session's research brief and show the diff (4.5). */
  const runReverify = async () => {
    if (!activeId || reverifyBusy) return;
    setReverifyBusy(true);
    setError('');
    try {
      const res = await client.reverifySession(activeId);
      setReverify({ summary: res.summary, diff: res.diff });
      await openSession(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-verify failed');
    } finally {
      setReverifyBusy(false);
    }
  };

  const isNew = activeId === null;
  const suggestions = useMemo(
    () => suggestionsFor(session?.intake),
    [session?.intake],
  );
  const seedCount = session
    ? session.intake.problemKeywords.length +
      session.intake.categoryKeywords.length +
      session.intake.competitorProducts.length +
      session.intake.competitorVoices.length +
      session.intake.subreddits.length +
      session.intake.seedLinks.length
    : 0;

  /** Switch the evidence mode on the active session (auto/external/internal). */
  const setMode = async (mode: ResearchSession['intake']['mode']) => {
    if (!session) return;
    const optimistic: ResearchSession = {
      ...session,
      intake: { ...session.intake, mode },
    };
    setSession(optimistic);
    try {
      const saved = await client.upsertSession({
        id: session.id,
        intake: optimistic.intake,
      });
      setSession(saved);
    } catch (err) {
      setSession(session); // roll back on failure
      setError(err instanceof Error ? err.message : 'Could not switch mode');
    }
  };

  /** Switch the research depth (standard/deep) on the active session. */
  const setDepth = async (depth: ResearchSession['intake']['depth']) => {
    if (!session) return;
    const optimistic: ResearchSession = {
      ...session,
      intake: { ...session.intake, depth },
    };
    setSession(optimistic);
    try {
      const saved = await client.upsertSession({
        id: session.id,
        intake: optimistic.intake,
      });
      setSession(saved);
    } catch (err) {
      setSession(session); // roll back on failure
      setError(err instanceof Error ? err.message : 'Could not switch depth');
    }
  };

  const onBriefSaved = (saved: ResearchSession) => {
    setSession(saved);
    setActiveId(saved.id);
    setSessions((prev) =>
      prev
        ? [saved, ...prev.filter((s) => s.id !== saved.id)]
        : prev,
    );
    setBriefOpen(false);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 5000);
    refreshSessions();
  };

  // A different chat distills a different play — the panel never carries
  // one session's draft into another's.
  useEffect(() => {
    setPlayDraft(null);
    setPlaySaved(null);
    setPlayError('');
  }, [activeId]);

  /** Compose the play draft from THIS chat's artifacts (deterministic —
   *  recipes/fromChat.ts) and open the fork editor on it. */
  const openPlayDraft = () => {
    if (!session || artifacts.length === 0) return;
    const composed = buildPlayDraft({ session, artifacts });
    if (!composed) return;
    setPlayError('');
    setPlaySaved(null);
    setPlayDraft({
      slug: composed.slug,
      name: composed.name,
      description: composed.description,
      budgetEstCents: composed.budgetEstCents,
      citationMode: 'flag',

      steps: composed.steps.map((s) => ({
        expert: s.expert,
        instruction: s.instruction,
        inputFrom:
          s.inputFrom === 'brief' || s.inputFrom === 'none'
            ? s.inputFrom
            : 'previous',
        outputArtifact: s.outputArtifact,
        gate: s.gate === 'approve' ? 'approve' : 'auto',
        handoffTarget: s.handoff?.target ?? '',
        handoffGenerate: s.handoff?.generate ?? false,
      })),
    });
  };

  const closePlay = () => {
    setPlayDraft(null);
    setPlaySaved(null);
    setPlayError('');
  };

  /** Save the play BY SLUG (the same action as /admin/recipes' fork editor —
   *  re-distilling the same chat updates the same play). */
  const savePlayDraft = async () => {
    if (!playDraft || playBusy) return;
    setPlayBusy('save');
    setPlayError('');
    try {
      const res = await fetch('/api/admin/mothermode-recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          slug: playDraft.slug,
          name: playDraft.name,
          description: playDraft.description,
          budgetEstCents: playDraft.budgetEstCents,
          steps: draftStepsPayload(playDraft),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');
      setPlaySaved({
        slug: (json.recipe?.slug as string) ?? playDraft.slug,
        name: (json.recipe?.name as string) ?? playDraft.name,
        watched: false,
      });
      loadRecipeMeta();
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPlayBusy('');
    }
  };

  /** One click to schedule: this session + the new play join the watchlist
   *  (the weekly lane; a metric trigger can arm later from /admin/recipes). */
  const watchPlay = async () => {
    if (!playSaved || !activeId || playBusy) return;
    setPlayBusy('watch');
    setPlayError('');
    try {
      const res = await fetch('/api/admin/mothermode-recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'watch',
          sessionId: activeId,
          recipeSlug: playSaved.slug,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Watch failed');
      setPlaySaved({ ...playSaved, watched: true });
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : 'Watch failed');
    } finally {
      setPlayBusy('');
    }
  };

  return (

    <div className="flex h-screen flex-col">
      {/* ------------------------------------------------------- top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-bone/10 px-4 py-2.5">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/5 hover:text-bone"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Admin
        </Link>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-brass" />
          <h1 className="font-display text-lg font-semibold text-bone">
            Research Lab
          </h1>
          {session && (
            <span className="hidden max-w-[280px] truncate text-sm text-bone/40 sm:block">
              · {session.title}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {session && usage && usage.paidRunsToday > 0 && (
            <span
              className="text-[10px] text-bone/35"
              title="Today's paid scraper usage for this session (budget: 25 runs / ~$2.00 per day)"
            >
              {usage.paidRunsToday} paid runs today · ~$
              {(usage.estCostCentsToday / 100).toFixed(2)}
            </span>
          )}
          {session && (
            <div
              className="flex items-center overflow-hidden rounded-lg border border-bone/15 text-[10px]"
              title="Evidence strategy: whose numbers win the argument (auto leans internal as metrics thicken)"
            >
              {(['auto', 'external', 'internal'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={session.intake.mode === m}
                  className={clsx(
                    'px-2 py-1.5 capitalize',
                    session.intake.mode === m
                      ? 'bg-brass/20 text-brass'
                      : 'text-bone/50 hover:text-bone',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          {session && (
            <div
              className="flex items-center overflow-hidden rounded-lg border border-bone/15 text-[10px]"
              title="Research depth: Deep adds post-performance ranking, per-post comment mining, and influencer deep dives — it spends more per turn"
            >
              {(['standard', 'deep'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepth(d)}
                  disabled={session.intake.depth === d}
                  className={clsx(
                    'px-2 py-1.5 capitalize',
                    session.intake.depth === d
                      ? d === 'deep'
                        ? 'bg-brass/20 text-brass'
                        : 'bg-bone/15 text-bone'
                      : 'text-bone/50 hover:text-bone',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          {session && artifacts.some((a) => a.type === 'research-brief') && (
            <button
              type="button"
              onClick={runReverify}
              disabled={reverifyBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:text-bone disabled:opacity-50"
              title="Re-check the research brief against fresh data and diff what changed"
            >
              {reverifyBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Re-verify
            </button>
          )}
          {session && artifacts.some((a) => a.type === 'research-brief') && (
            <button
              type="button"
              onClick={runOutcome}
              disabled={outcomeBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:text-bone disabled:opacity-50"
              title="The analyst reads our numbers and writes an outcome digest, linked to the research that produced the work"
            >
              {outcomeBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Outcomes
            </button>
          )}
          <button
            type="button"
            onClick={() => setBriefOpen((v) => !v)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
              briefOpen
                ? 'border-brass/40 text-brass'
                : 'border-bone/15 text-bone/60 hover:text-bone',
            )}
            title="The seeds the agent searches with"
          >
            Brief
            <span
              className={clsx(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                seedCount > 0
                  ? 'bg-brass/20 text-brass'
                  : 'bg-bone/10 text-bone/40',
              )}
            >
              {seedCount}
            </span>
          </button>
          {isNew && (
            <select
              value={offerSlug}
              onChange={(e) => setOfferSlug(e.target.value)}
              className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/70"
              title="Scope this session to an offer"
            >
              <option value="">No offer scope</option>
              {offers.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/70"
            title="Agent model"
          >
            <option value={AUTO_MODEL}>Auto model</option>
            {TEXT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* ------------------------------------------------------ 3 columns */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
        {/* sessions */}
        <aside className="hidden min-h-0 flex-col border-r border-bone/10 lg:flex">
          <div className="flex shrink-0 items-center justify-between border-b border-bone/10 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-bone/50">
              Sessions
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveId(null);
                setSession(null);
                setMessages([]);
                setArtifacts([]);
                setOpenArtifact(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-brass/30 px-2 py-1 text-xs font-medium text-brass hover:bg-brass/10"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {sessions === null ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-bone/40" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="px-2 py-4 text-xs text-bone/40">
                No research yet. Start a new session.
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={clsx(
                    'group mb-1 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm',
                    s.id === activeId
                      ? 'bg-brass/15 text-brass'
                      : 'text-bone/60 hover:bg-bone/5 hover:text-bone',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openSession(s.id)}
                    className="min-w-0 flex-1 truncate text-left"
                    title={s.title}
                  >
                    {s.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(s.id)}
                    className="hidden shrink-0 rounded p-0.5 text-bone/30 hover:text-red-300 group-hover:block"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* chat */}
        <section className="flex min-h-0 flex-col">
          <div
            ref={scrollRef}
            onMouseUp={captureSelection}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6"
          >
            {savedNotice && (
              <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-lg border border-brass/30 bg-brass/10 px-3 py-2 text-xs text-brass">
                <span className="font-semibold">Brief saved.</span> The agent
                uses these seeds on your next message. Reopen it any time with
                the Brief button.
              </div>
            )}

            {outcomeSaved && (
              <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-lg border border-brass/30 bg-brass/10 px-3 py-2 text-xs text-brass">
                <span className="font-semibold">Outcome digest saved.</span>{' '}
                It is in the artifacts rail, linked to the research that
                produced the work.
              </div>
            )}

            {reverify && (
              <div className="mx-auto max-w-3xl rounded-lg border border-brass/25 bg-brass/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-brass">
                    Re-verified: {reverify.summary}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReverify(null)}
                    className="ml-auto text-[10px] text-bone/40 hover:text-bone"
                  >
                    dismiss
                  </button>
                </div>
                {reverify.diff.added.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {reverify.diff.added.slice(0, 5).map((l, i) => (
                      <li key={i} className="text-[11px] text-emerald-300/80">
                        + {l}
                      </li>
                    ))}
                  </ul>
                )}
                {reverify.diff.removed.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {reverify.diff.removed.slice(0, 5).map((l, i) => (
                      <li key={i} className="text-[11px] text-red-300/70">
                        − {l}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {briefOpen && (
              <div className="mx-auto max-w-3xl">
                <IntakePanel
                  key={activeId ?? 'new'}
                  session={session}
                  offers={offers}
                  sessions={sessions ?? undefined}
                  onSaved={onBriefSaved}
                />
              </div>
            )}

            {messages.length === 0 && !streaming && (
              <div className="mx-auto max-w-2xl py-10 text-center">
                <Sparkles className="mx-auto h-9 w-9 text-brass/60" />
                <h3 className="mt-3 font-display text-2xl font-semibold text-bone">
                  What are we researching?
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm text-bone/50">
                  The agent pulls Reddit threads, social posts, Amazon reviews,
                  web search, and your own clicks/leads/sales, then saves
                  briefs, plans, and concepts as artifacts you hand off for
                  creation.
                </p>
                <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="flex items-start gap-2 rounded-xl border border-bone/10 bg-bone/[0.03] px-3 py-2.5 text-left text-xs leading-relaxed text-bone/60 hover:border-brass/30 hover:text-bone"
                    >
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass/70" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((m, idx) => {
                // The run-step divider: opens each new (run, step) group of
                // stamped turns so a recipe reads step by step in the chat.
                const prev = idx > 0 ? messages[idx - 1] : null;
                const stepKey = m.recipeRunId
                  ? `${m.recipeRunId}:${m.recipeStepIndex ?? -1}`
                  : '';
                const prevKey = prev?.recipeRunId
                  ? `${prev.recipeRunId}:${prev.recipeStepIndex ?? -1}`
                  : '';
                const showDivider = stepKey !== '' && stepKey !== prevKey;
                const dividerRun = showDivider
                  ? recipeMeta.runs.find((r) => r.id === m.recipeRunId)
                  : undefined;
                const dividerRecipe = dividerRun
                  ? recipeMeta.recipes.find((r) => r.id === dividerRun.recipeId)
                  : undefined;
                const dividerStep =
                  dividerRecipe && m.recipeStepIndex !== null
                    ? dividerRecipe.steps[m.recipeStepIndex]
                    : undefined;
                // The expert chip: recipe turns always labeled; plain-chat
                // turns only when a non-default expert answered.
                const expertChip =
                  m.role === 'assistant' &&
                  m.expertSlug &&
                  (m.recipeRunId || m.expertSlug !== 'research')
                    ? expertDisplayName(m.expertSlug, recipeMeta.experts)
                    : '';
                // The build map rides under a handoff-COMPLETED beat: the
                // notice's run + step stamps resolve the artifact, whose
                // manifest/handed_off_to draws every asset with its status.
                let noticeMap = null;
                if (
                  m.role === 'assistant' &&
                  m.recipeRunId &&
                  m.recipeStepIndex !== null &&
                  m.content.startsWith('**Handoff completed:**')
                ) {
                  const noticeRun = recipeMeta.runs.find(
                    (r) => r.id === m.recipeRunId,
                  );
                  const noticeArtifactId =
                    noticeRun?.stepsState[m.recipeStepIndex]?.artifactId;
                  const noticeArtifact = noticeArtifactId
                    ? artifacts.find((a) => a.id === noticeArtifactId)
                    : undefined;
                  if (noticeArtifact) {
                    noticeMap = buildFunnelMap({
                      artifact: noticeArtifact,
                      artifacts,
                    });
                  }
                }
                return (
                  <div key={m.id}>
                    {showDivider && (
                      <div
                        data-run-id={m.recipeRunId}
                        className="flex items-center gap-2 pt-1"
                      >
                        <div className="h-px flex-1 bg-brass/20" />
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-brass/70">
                          <Workflow className="h-3 w-3" />
                          {dividerRecipe ? dividerRecipe.name : 'Recipe run'}
                          {m.recipeStepIndex !== null && (
                            <span>
                              · step {m.recipeStepIndex + 1}
                              {dividerRecipe
                                ? `/${dividerRecipe.steps.length}`
                                : ''}
                            </span>
                          )}
                          {dividerStep && (
                            <span className="normal-case text-bone/45">
                              {expertDisplayName(
                                dividerStep.expert,
                                recipeMeta.experts,
                              )}{' '}
                              → {dividerStep.outputArtifact}
                            </span>
                          )}
                        </span>
                        <div className="h-px flex-1 bg-brass/20" />
                      </div>
                    )}
                    <div
                      className={clsx(
                        'rounded-xl px-4 py-3',
                        m.role === 'user'
                          ? 'ml-auto max-w-[80%] bg-mode/40 text-bone'
                          : 'mr-auto border border-bone/10 bg-bone/[0.03]',
                      )}
                    >
                      {expertChip && (
                        <span className="mb-1.5 inline-flex items-center rounded-full border border-brass/30 bg-brass/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brass">
                          {expertChip}
                        </span>
                      )}
                      {m.role === 'assistant' && m.toolCalls.length > 0 && (
                        <div className="mb-2">
                          <ReasoningTrace calls={m.toolCalls} />
                          {m.toolCalls
                            .filter((c) => c.cards && c.cards.length > 0)
                            .map((c) => (
                              <LiveCards
                                key={c.id}
                                cards={c.cards!}
                                onPin={(item) => pinFromCard(c.name, item)}
                                pinnedBodies={pinnedBodies}
                              />
                            ))}
                        </div>
                      )}
                      {m.role === 'user' ? (
                        <p className="whitespace-pre-wrap text-sm">
                          {m.content}
                        </p>
                      ) : (
                        <Markdown>{m.content}</Markdown>
                      )}
                      {noticeMap && (
                        <div className="mt-2 border-t border-bone/10 pt-2">
                          <FunnelMapCard map={noticeMap} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {streaming && (
                <div className="mr-auto rounded-xl border border-bone/10 bg-bone/[0.03] px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-bone/50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brass" />
                    {streaming.status}
                  </div>
                  <ReasoningTrace calls={streaming.toolCalls} live />
                  {streaming.toolCalls
                    .filter((c) => c.cards && c.cards.length > 0)
                    .map((c) => (
                      <LiveCards
                        key={c.id}
                        cards={c.cards!}
                        onPin={(item) => pinFromCard(c.name, item)}
                        pinnedBodies={pinnedBodies}
                      />
                    ))}
                  {/* 0.2: the assistant's text as it streams in. */}
                  {streaming.text && (
                    <div className="mt-2 border-t border-bone/10 pt-2">
                      <Markdown>{streaming.text}</Markdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* composer */}
          <div className="shrink-0 border-t border-bone/10 px-4 py-3 sm:px-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="mx-auto flex max-w-3xl items-end gap-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                rows={2}
                placeholder="Research a topic, mine Reddit or Amazon reviews, plan an offer, plan content."
                className="flex-1 resize-none rounded-xl border border-bone/15 bg-black/30 px-3 py-2.5 text-sm text-bone outline-none placeholder:text-bone/30 focus:border-brass/50"
              />
              <button
                type="submit"
                disabled={!draft.trim() || streaming !== null}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brass text-ink hover:bg-brass/90 disabled:opacity-40"
                aria-label="Send"
              >
                {streaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </section>

        {/* artifacts + evidence */}
        <aside className="hidden min-h-0 flex-col border-l border-bone/10 lg:flex">
          <button
            type="button"
            onClick={() => setEvidenceOpen((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 border-b border-bone/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-bone/50 hover:text-bone"
          >
            <Quote className="h-3.5 w-3.5 text-brass/70" />
            Evidence
            <span className="rounded-full bg-bone/10 px-1.5 py-0.5 text-[10px] text-bone/40">
              {evidence.length}
            </span>
          </button>
          {evidenceOpen && (
            <div className="max-h-72 shrink-0 overflow-y-auto border-b border-bone/10 p-2">
              {/* semantic search (4.7): find evidence by meaning, not keywords */}
              {evidence.length > 0 && (
                <div className="mb-1.5 flex items-center gap-1">
                  <input
                    value={evidenceQuery}
                    onChange={(e) => {
                      setEvidenceQuery(e.target.value);
                      if (!e.target.value.trim()) setEvidenceResults(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        runEvidenceSearch();
                      }
                    }}
                    placeholder="search evidence semantically."
                    className="min-w-0 flex-1 rounded-md border border-bone/10 bg-transparent px-1.5 py-1 text-[11px] text-bone outline-none placeholder:text-bone/25 focus:border-brass/40"
                  />
                  <button
                    type="button"
                    onClick={runEvidenceSearch}
                    disabled={evidenceSearchBusy || !evidenceQuery.trim()}
                    className="shrink-0 rounded-md border border-bone/15 px-1.5 py-1 text-[10px] text-bone/50 hover:text-bone disabled:opacity-40"
                  >
                    {evidenceSearchBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'find'
                    )}
                  </button>
                </div>
              )}
              {evidenceResults !== null && (
                <div className="mb-1.5 rounded-lg border border-brass/25 bg-brass/[0.06] p-1.5">
                  {evidenceResults.length === 0 ? (
                    <p className="px-1 py-1 text-[11px] text-bone/45">
                      Nothing semantically close to that yet.
                    </p>
                  ) : (
                    evidenceResults.map((r) => (
                      <div
                        key={r.evidence.id}
                        className="mb-1 flex items-start gap-1.5 rounded px-1 py-1"
                      >
                        <span className="mt-0.5 shrink-0 text-[9px] font-semibold text-brass/70">
                          {(r.score * 100).toFixed(0)}%
                        </span>
                        <p className="min-w-0 flex-1 text-[11px] leading-snug text-bone/70">
                          {r.evidence.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
              {evidence.length === 0 ? (
                <p className="px-2 py-2 text-xs text-bone/40">
                  Select any text in the chat and pin it here — quotes,
                  phrases, and numbers with their source.
                </p>
              ) : (
                evidence.map((e) => (
                  <div
                    key={e.id}
                    className="group mb-1 flex items-start gap-1.5 rounded-lg border border-bone/10 bg-bone/[0.03] px-2 py-1.5"
                  >
                    <span className="mt-0.5 shrink-0 rounded bg-brass/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-brass/80">
                      {e.kind}
                    </span>
                    {/* 0.4: the freshness badge — how old this evidence is. */}
                    {formatAge(e.createdAt) && (
                      <span
                        className="mt-0.5 shrink-0 text-[9px] text-bone/30"
                        title={e.createdAt ?? ''}
                      >
                        {formatAge(e.createdAt)}
                      </span>
                    )}
                    <p className="min-w-0 flex-1 text-[11px] leading-snug text-bone/65">
                      {e.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeEvidence(e.id)}
                      className="hidden shrink-0 text-bone/30 hover:text-red-300 group-hover:block"
                      aria-label="Delete evidence"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
          {/* phrase bank (2.3): what the audience keeps saying, with trend */}
          {phraseBank.length > 0 && (
            <div className="shrink-0 border-b border-bone/10">
              <button
                type="button"
                onClick={() => setPhrasesOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-bone/50 hover:text-bone"
              >
                Phrases
                <span className="rounded-full bg-bone/10 px-1.5 py-0.5 text-[10px] text-bone/40">
                  {phraseBank.length}
                </span>
              </button>
              {phrasesOpen && (
                <div className="flex flex-wrap gap-1 px-2 pb-2.5">
                  {phraseBank.map((row) => (
                    <span
                      key={row.phrase}
                      title={`${row.count} total · ${row.recent} this week · ${row.prior} the week before`}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                        row.trend === 'new' || row.trend === 'up'
                          ? 'border-brass/35 bg-brass/10 text-brass'
                          : row.trend === 'down'
                            ? 'border-bone/15 text-bone/40'
                            : 'border-bone/15 text-bone/60',
                      )}
                    >
                      {row.phrase}
                      <span className="text-[9px] font-semibold opacity-70">
                        ×{row.count}
                        {row.trend === 'new'
                          ? ' new'
                          : row.trend === 'up'
                            ? ' ↑'
                            : row.trend === 'down'
                              ? ' ↓'
                              : ''}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* plays: this session's recipe runs, live — start one, watch the
              steps land in the transcript as they happen (live tick), open a
              step's output, approve the gates, all without leaving the chat. */}
          {activeId && (
            <RecipeRunsPanel
              sessionId={activeId}
              onRunsChanged={() => {
                openSession(activeId);
                loadRecipeMeta();
              }}
              onLiveTick={() => {
                openSession(activeId, { preserveArtifact: true });
                loadRecipeMeta();
              }}
              onOpenArtifact={(artifactId) => {
                const hit = artifacts.find((a) => a.id === artifactId);
                if (hit) setOpenArtifact(hit);
              }}
              onJumpToRun={jumpToRun}
            />
          )}
          <div className="flex shrink-0 items-center gap-2 border-b border-bone/10 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-bone/50">
              Artifacts
            </span>
            {session && artifacts.length > 0 && (
              <button
                type="button"
                onClick={openPlayDraft}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-brass/30 px-2 py-1 text-[11px] font-medium text-brass hover:bg-brass/10"
                title="Distill this chat's artifacts into a recipe — run it again, or schedule it weekly"
              >
                <Workflow className="h-3 w-3" />
                Turn into a play
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {activeId === null ? (
              <p className="px-2 py-4 text-xs text-bone/40">
                Artifacts the agent saves will land here.
              </p>
            ) : artifacts.length === 0 ? (
              <p className="px-2 py-4 text-xs text-bone/40">
                No artifacts yet. Ask the agent to save a brief, a plan, or a
                concept.
              </p>
            ) : (
              artifacts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setOpenArtifact(a)}
                  className="mb-1.5 flex w-full items-start gap-2 rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-2 text-left hover:border-brass/30"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brass/70" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-bone/90">
                      {a.title || 'Untitled'}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider text-bone/40">
                      {ARTIFACT_TYPE_LABELS[a.type]}
                      {a.handedOffTo ? ` · sent` : ''}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {openArtifact && activeId && (
        <ArtifactView
          artifact={openArtifact}
          sessionId={activeId}
          onClose={() => setOpenArtifact(null)}
          onUpdated={artifactUpdated}
          onDeleted={artifactDeleted}
        />
      )}

      {/* Turn this chat into a play (Phase 3): the distilled draft in the
          fork editor, then the saved card with the one-click weekly watch. */}
      {playDraft && session && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-3xl rounded-2xl border border-bone/15 bg-ink shadow-2xl">
            <div className="flex items-center gap-2 border-b border-bone/10 px-4 py-3">
              <Workflow className="h-4 w-4 text-brass" />
              <span className="font-display text-sm font-semibold text-bone">
                Turn this chat into a play
              </span>
              <button
                type="button"
                onClick={closePlay}
                className="ml-auto rounded-lg p-1 text-bone/40 hover:bg-bone/10 hover:text-bone"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3">
              {playError && (
                <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {playError}
                </p>
              )}
              {playSaved ? (
                <div className="py-2">
                  <p className="text-sm text-bone/80">
                    <span className="font-semibold text-brass">
                      Play saved.
                    </span>{' '}
                    {playSaved.name} (
                    <code className="text-xs">{playSaved.slug}</code>) is in
                    your plays.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {playSaved.watched ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300">
                        Watching weekly — it runs from this session’s brief
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={watchPlay}
                        disabled={playBusy === 'watch'}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brass/90 disabled:opacity-50"
                        title="Schedule this play to run weekly against this session"
                      >
                        {playBusy === 'watch' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Workflow className="h-3.5 w-3.5" />
                        )}
                        Watch weekly
                      </button>
                    )}
                    <Link
                      href="/admin/recipes"
                      className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/10"
                    >
                      Open plays
                    </Link>
                    <button
                      type="button"
                      onClick={closePlay}
                      className="inline-flex items-center gap-1 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/10"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-1 text-[11px] leading-snug text-bone/40">
                    Distilled from this chat’s {artifacts.length} artifact
                    {artifacts.length === 1 ? '' : 's'} — the expert that made
                    each one, its handoff, and a gate where money moves. Edit
                    anything, then save (re-distilling this chat updates the
                    same play).
                  </p>
                  <RecipeDraftEditor
                    draft={playDraft}
                    experts={recipeMeta.experts}
                    busy={playBusy === 'save'}
                    onChange={setPlayDraft}
                    onSave={savePlayDraft}
                    onCancel={closePlay}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* floating pin button on text selection (roadmap 2.1) */}
      {pinCandidate && activeId && (

        <button
          type="button"
          onClick={pinSelection}
          disabled={pinBusy}
          style={{ left: pinCandidate.x, top: pinCandidate.y }}
          className="fixed z-50 inline-flex items-center gap-1.5 rounded-lg bg-brass px-2.5 py-1.5 text-xs font-semibold text-ink shadow-lg hover:bg-brass/90 disabled:opacity-60"
        >
          {pinBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
          Pin as evidence
        </button>
      )}
    </div>
  );
}
