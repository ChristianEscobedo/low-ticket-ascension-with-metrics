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
import * as client from './researchClient';
import ReasoningTrace from './ReasoningTrace';
import ArtifactView from './ArtifactView';
import Markdown from './Markdown';
import IntakePanel from './IntakePanel';

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
}: {
  offers: OfferOption[];
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
  } | null>(null);
  const [error, setError] = useState('');
  const [openArtifact, setOpenArtifact] = useState<ResearchArtifact | null>(
    null,
  );
  /** The research brief panel: open for new/seedless sessions until hidden. */
  const [briefOpen, setBriefOpen] = useState(true);
  /** Transient "Brief saved" confirmation (panel closes on save; this is the
   *  proof it persisted, auto-dismissing after a few seconds). */
  const [savedNotice, setSavedNotice] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await client.listSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions');
    }
  }, []);

  const openSession = useCallback(async (id: string) => {
    setError('');
    setOpenArtifact(null);
    try {
      const detail = await client.loadSession(id);
      setActiveId(id);
      setSession(detail.session);
      setMessages(detail.messages);
      setArtifacts(detail.artifacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load session');
    }
  }, []);

  useEffect(() => {
    refreshSessions();
    return () => abortRef.current?.abort();
  }, [refreshSessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;
    setDraft('');
    setError('');
    setStreaming({ status: 'Thinking.', toolCalls: [] });

    const optimistic: ResearchMessage = {
      id: `local_${Date.now()}`,
      sessionId: activeId ?? '',
      role: 'user',
      content: message,
      toolCalls: [],
      model: '',
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
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6"
          >
            {savedNotice && (
              <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-lg border border-brass/30 bg-brass/10 px-3 py-2 text-xs text-brass">
                <span className="font-semibold">Brief saved.</span> The agent
                uses these seeds on your next message. Reopen it any time with
                the Brief button.
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
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={clsx(
                    'rounded-xl px-4 py-3',
                    m.role === 'user'
                      ? 'ml-auto max-w-[80%] bg-mode/40 text-bone'
                      : 'mr-auto border border-bone/10 bg-bone/[0.03]',
                  )}
                >
                  {m.role === 'assistant' && m.toolCalls.length > 0 && (
                    <div className="mb-2">
                      <ReasoningTrace calls={m.toolCalls} />
                    </div>
                  )}
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                  ) : (
                    <Markdown>{m.content}</Markdown>
                  )}
                </div>
              ))}

              {streaming && (
                <div className="mr-auto rounded-xl border border-bone/10 bg-bone/[0.03] px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-bone/50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brass" />
                    {streaming.status}
                  </div>
                  <ReasoningTrace calls={streaming.toolCalls} live />
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

        {/* artifacts */}
        <aside className="hidden min-h-0 flex-col border-l border-bone/10 lg:flex">
          <div className="shrink-0 border-b border-bone/10 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-bone/50">
              Artifacts
            </span>
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
    </div>
  );
}
