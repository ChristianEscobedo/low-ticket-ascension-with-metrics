'use client';

/**
 * /admin/skills (Phase 3 kickoff): the declarative-skill registry. Every
 * skill is a ROW — an allowlisted HTTPS request template + dotted-path
 * extraction, never eval'd code. The editor writes drafts (a draft may
 * be imperfect); ACTIVATION requires zero issues (the same
 * skillDraftErrors the API enforces), and the test bench runs any skill
 * once, live, with the outcome unrecorded.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  Wrench,
  Plus,
  Loader2,
  Check,
  Trash2,
  Pause,
  Play,
  FlaskConical,
} from 'lucide-react';
import {
  skillDraftErrors,
  type ResearchSkill,
} from '@/lib/mothermode/research/skills/types';
import { formatAgo } from '@/lib/mothermode/research/recipes/crew';

const API = '/api/admin/mothermode-skills';

type Draft = {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  inputKeys: string; // comma-separated
  allowedHosts: string; // comma-separated
  method: 'GET' | 'POST';
  urlTemplate: string;
  headersText: string; // "Key: value" per line ({{secret:NAME}} allowed here)
  bodyTemplate: string; // POST only
  extractText: string; // "name: dotted.path" per line
  costDollars: string;
  maxCalls: string;
};

function blankDraft(): Draft {
  return {
    id: null,
    slug: '',
    name: '',
    description: '',
    inputKeys: 'query',
    allowedHosts: '',
    method: 'GET',
    urlTemplate: '',
    headersText: '',
    bodyTemplate: '',
    extractText: '',
    costDollars: '0.01',
    maxCalls: '100',
  };
}

const splitList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

function parseKvLines(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of s.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function parseExtract(s: string): Array<{ name: string; path: string }> {
  const out: Array<{ name: string; path: string }> = [];
  for (const line of s.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) {
      out.push({ name: line.slice(0, i).trim(), path: line.slice(i + 1).trim() });
    }
  }
  return out;
}

function toDraft(s: ResearchSkill): Draft {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    inputKeys: s.inputKeys.join(', '),
    allowedHosts: s.allowedHosts.join(', '),
    method: s.executor.method,
    urlTemplate: s.executor.urlTemplate,
    headersText: Object.entries(s.executor.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n'),
    bodyTemplate: s.executor.bodyTemplate ?? '',
    extractText: s.executor.extract.map((e) => `${e.name}: ${e.path}`).join('\n'),
    costDollars: (s.costEstCents / 100).toFixed(2),
    maxCalls: String(s.maxCallsPerDay),
  };
}

/** The draft's executor as the API + validator see it. */
function draftExecutor(d: Draft) {
  return {
    kind: 'http' as const,
    method: d.method,
    urlTemplate: d.urlTemplate.trim(),
    headers: parseKvLines(d.headersText),
    bodyTemplate: d.method === 'POST' && d.bodyTemplate.trim() ? d.bodyTemplate : undefined,
    extract: parseExtract(d.extractText),
  };
}

function draftValidation(d: Draft) {
  return skillDraftErrors({
    slug: d.slug,
    name: d.name,
    inputKeys: splitList(d.inputKeys),
    allowedHosts: splitList(d.allowedHosts),
    executor: draftExecutor(d),
    costEstCents: Math.round((Number.parseFloat(d.costDollars) || 0) * 100),
    maxCallsPerDay: Number.parseInt(d.maxCalls, 10) || 0,
  });
}

const STATUS_STYLE: Record<ResearchSkill['status'], string> = {
  active: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  paused: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  draft: 'border-bone/20 text-bone/45',
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<ResearchSkill[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  /** The bench: which skill + the input JSON + the last result. */
  const [testing, setTesting] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('{}');
  const [testResult, setTestResult] = useState<string>('');

  const load = useCallback(async () => {
    const res = await fetch(API, { cache: 'no-store' });
    const json = await res.json();
    setSkills(json.skills ?? []);
  }, []);

  useEffect(() => {
    load().catch(() => setSkills([]));
  }, [load]);

  const errors = useMemo(() => (draft ? draftValidation(draft) : []), [draft]);

  const save = async (activate: boolean) => {
    if (!draft) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          slug: draft.slug,
          name: draft.name,
          description: draft.description,
          inputKeys: splitList(draft.inputKeys),
          allowedHosts: splitList(draft.allowedHosts),
          executor: draftExecutor(draft),
          costEstCents: Math.round((Number.parseFloat(draft.costDollars) || 0) * 100),
          maxCallsPerDay: Number.parseInt(draft.maxCalls, 10) || 100,
          status: activate ? 'active' : 'draft',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');
      await load();
      setDraft(null);
      setNote(
        activate
          ? `Saved and ACTIVATED ${json.skill.slug}.`
          : `Saved draft ${json.skill.slug}${(json.errors ?? []).length ? ` (still needs: ${(json.errors as string[]).join(', ')})` : ''}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: 'pause' | 'unpause' | 'delete', id: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `${action} failed`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (id: string) => {
    setBusy(true);
    setTestResult('');
    setError('');
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(testInput || '{}');
    } catch {
      setError('the test input is not valid JSON');
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'test', id, input }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Test failed');
      const r = json.result;
      setTestResult(
        r.ok
          ? `OK in ${r.ms}ms (HTTP ${r.httpStatus})\n\nextracted:\n${JSON.stringify(r.extracted, null, 2)}`
          : `FAILED: ${r.error}${r.raw ? `\n\nraw:\n${r.raw}` : ''}`,
      );
    } catch (err) {
      setTestResult(`FAILED: ${err instanceof Error ? err.message : 'request failed'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Wrench className="h-6 w-6 text-brass" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-bone">Skills</h1>
          <p className="text-sm text-bone/45">
            Declarative HTTP skills the crew can call — a row with an
            allowlisted host, scoped secrets, a daily limit, and a breaker.
            Never eval'd code.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(blankDraft())}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-brass/30 px-3 py-1.5 text-sm font-medium text-brass hover:bg-brass/10"
        >
          <Plus className="h-4 w-4" /> New skill
        </button>
      </div>

      {note && (
        <p className="mb-3 rounded-lg border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass/90">
          {note}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/100/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* the registry */}
        <div className="space-y-2">
          {skills === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-bone/40" />
          ) : skills.length === 0 ? (
            <p className="rounded-lg border border-bone/10 px-3 py-3 text-xs text-bone/40">
              No skills yet. Create one — a draft saves imperfect, activation
              requires zero issues.
            </p>
          ) : (
            skills.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-bone/10 bg-bone/[0.03] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-bone/90">
                    {s.name}
                  </span>
                  <span
                    className={clsx(
                      'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                      STATUS_STYLE[s.status],
                    )}
                  >
                    {s.status}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-bone/35">
                    {s.executor.method} · {s.allowedHosts.join(', ') || 'no hosts'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-bone/45">{s.description || 'no description'}</p>
                <p className="mt-0.5 text-[10px] text-bone/30">
                  {s.slug} · ~${(s.costEstCents / 100).toFixed(2)}/call · {s.maxCallsPerDay}/day
                  {s.consecutiveFailures > 0 && (
                    <span className="text-red-300/80"> · {s.consecutiveFailures} consecutive failures</span>
                  )}
                  {s.lastCalledAt && <> · last called {formatAgo(s.lastCalledAt)}</>}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDraft(toDraft(s))}
                    className="text-bone/50 hover:text-bone"
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTesting(s.id);
                      setTestResult('');
                    }}
                    className="inline-flex items-center gap-1 text-brass/80 hover:text-brass"
                  >
                    <FlaskConical className="h-3 w-3" /> test
                  </button>
                  {s.status === 'paused' || s.status === 'draft' ? (
                    <button
                      type="button"
                      onClick={() => act('unpause', s.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 text-emerald-300/80 hover:text-emerald-300"
                      title="Activate — re-validates first, loudly"
                    >
                      <Play className="h-3 w-3" /> activate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => act('pause', s.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 text-amber-300/80 hover:text-amber-300"
                    >
                      <Pause className="h-3 w-3" /> pause
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => act('delete', s.id)}
                    disabled={busy}
                    className="ml-auto inline-flex items-center gap-1 text-bone/35 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {/* the bench, inline under the row it tests */}
                {testing === s.id && (
                  <div className="mt-2 rounded-lg border border-brass/25 bg-brass/[0.05] p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-bone/40">input JSON:</span>
                      <input
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder='{"query":"standing desk"}'
                        className="min-w-0 flex-1 rounded border border-bone/15 bg-ink px-1.5 py-1 font-mono text-[11px] text-bone/80 outline-none placeholder:text-bone/25"
                      />
                      <button
                        type="button"
                        onClick={() => runTest(s.id)}
                        disabled={busy}
                        className="rounded bg-brass px-2 py-1 text-[10px] font-semibold text-bone disabled:opacity-50"
                      >
                        run once
                      </button>
                      <button
                        type="button"
                        onClick={() => setTesting(null)}
                        className="text-[10px] text-bone/35 hover:text-bone"
                      >
                        close
                      </button>
                    </div>
                    {testResult && (
                      <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-ink/60 p-2 font-mono text-[10px] leading-relaxed text-bone/70">
                        {testResult}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* the editor */}
        {draft ? (
          <div className="space-y-2.5 rounded-xl border border-bone/10 bg-bone/[0.02] p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Skill name"
                className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-sm text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/40"
              />
              <input
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value.trim().toLowerCase() })}
                placeholder="slug-like-this"
                className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 font-mono text-sm text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/40"
              />
            </div>
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="what the crew uses this for, in one line"
              className="w-full rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-sm text-bone/85 outline-none placeholder:text-bone/25 focus:border-brass/40"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={draft.inputKeys}
                onChange={(e) => setDraft({ ...draft, inputKeys: e.target.value })}
                placeholder="input vars: query, locale"
                title="The declared {{input.*}} vars — every var the templates use must be declared here"
                className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/80 outline-none placeholder:text-bone/25 focus:border-brass/40"
              />
              <input
                value={draft.allowedHosts}
                onChange={(e) => setDraft({ ...draft, allowedHosts: e.target.value })}
                placeholder="allowed hosts: api.example.com"
                title="Bare hostnames — the URL may only point at these (subdomains allowed)"
                className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/80 outline-none placeholder:text-bone/25 focus:border-brass/40"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={draft.method}
                onChange={(e) => setDraft({ ...draft, method: e.target.value as 'GET' | 'POST' })}
                className="rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-xs text-bone/80"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
              <input
                value={draft.urlTemplate}
                onChange={(e) => setDraft({ ...draft, urlTemplate: e.target.value })}
                placeholder="https://api.example.com/search?q={{input.query}}"
                className="min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink px-2 py-1.5 font-mono text-xs text-bone/80 outline-none placeholder:text-bone/25 focus:border-brass/40"
              />
            </div>
            <textarea
              value={draft.headersText}
              onChange={(e) => setDraft({ ...draft, headersText: e.target.value })}
              rows={2}
              placeholder={'headers, one per line — Authorization: Bearer {{secret:my_api_key}}'}
              title="Secrets resolve ONLY from SKILL_SECRET_<NAME> env vars, and only ever in headers"
              className="w-full resize-y rounded-lg border border-bone/15 bg-ink px-2 py-1.5 font-mono text-xs text-bone/80 outline-none placeholder:text-bone/25 focus:border-brass/40"
            />
            {draft.method === 'POST' && (
              <textarea
                value={draft.bodyTemplate}
                onChange={(e) => setDraft({ ...draft, bodyTemplate: e.target.value })}
                rows={2}
                placeholder='POST body template — {"q": "{{input.query}}"}'
                className="w-full resize-y rounded-lg border border-bone/15 bg-ink px-2 py-1.5 font-mono text-xs text-bone/80 outline-none placeholder:text-bone/25 focus:border-brass/40"
              />
            )}
            <textarea
              value={draft.extractText}
              onChange={(e) => setDraft({ ...draft, extractText: e.target.value })}
              rows={2}
              placeholder={'extract, name: dotted.path per line — titles: data.items.0.title'}
              className="w-full resize-y rounded-lg border border-bone/15 bg-ink px-2 py-1.5 font-mono text-xs text-bone/80 outline-none placeholder:text-bone/25 focus:border-brass/40"
            />
            <div className="flex items-center gap-2 text-xs">
              <input
                value={draft.costDollars}
                onChange={(e) => setDraft({ ...draft, costDollars: e.target.value })}
                title="Estimated $ per call (the meter's number)"
                className="w-20 rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-bone/80 outline-none"
              />
              <span className="text-bone/35">$/call est.</span>
              <input
                value={draft.maxCalls}
                onChange={(e) => setDraft({ ...draft, maxCalls: e.target.value })}
                title="Agent calls per day before the limit refuses"
                className="w-20 rounded-lg border border-bone/15 bg-ink px-2 py-1.5 text-bone/80 outline-none"
              />
              <span className="text-bone/35">calls/day</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => save(false)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-2.5 py-1.5 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-50"
                title="Save as a draft — imperfect is fine, it just can't run for the agent yet"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={() => save(true)}
                disabled={busy || errors.length > 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-bone hover:bg-brass/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save + activate
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-xs text-bone/40 hover:text-bone"
              >
                close
              </button>
              {errors.length > 0 && (
                <span className="text-[10px] text-red-300/80">needs {errors.join(', ')}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-bone/10 p-10 text-sm text-bone/35">
            Pick a skill to edit, or create one.
          </div>
        )}
      </div>
    </div>
  );
}
