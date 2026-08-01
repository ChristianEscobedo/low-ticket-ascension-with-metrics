'use client';

/**
 * "Build me an agent" (roadmap Phase 3): interview → draft → sandbox
 * test-drive → save. The four plain-English answers compose DETERMINISTICALLY
 * into a real expert config (experts/interview.ts — no AI in the composition);
 * the sandbox runs ONE real turn with the draft in a throwaway session (the
 * API deletes it in the finally), so what you test is exactly what you save.
 */
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Bot, Check, Loader2, Play, X } from 'lucide-react';
import { TEXT_MODELS, AUTO_MODEL } from '@/lib/mothermode/content/models';
import { RESEARCH_ARTIFACT_TYPES } from '@/lib/mothermode/research/types';
import {
  buildExpertDraft,
  expertDraftErrors,
  interviewToolOptions,
  type ExpertInterviewAnswers,
} from '@/lib/mothermode/research/experts/interview';
import type { ResearchExpert } from '@/lib/mothermode/research/experts/types';

const API = '/api/admin/mothermode-experts';
const TOOL_OPTIONS = interviewToolOptions();

function ChipRow({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
        {label} <span className="text-bone/25">(none picked = everything)</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onToggle(name)}
            className={clsx(
              'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
              values.includes(name)
                ? 'border-brass/50 bg-brass/15 text-brass'
                : 'border-bone/15 text-bone/45 hover:border-bone/30',
            )}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ExpertBuilder({
  onSaved,
}: {
  onSaved: (expert: ResearchExpert) => void;
}) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<ExpertInterviewAnswers>({
    name: '',
    does: '',
    optimizesFor: '',
    tools: [],
    artifactTypes: [],
    model: '',
  });
  const [testMessage, setTestMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [reply, setReply] = useState('');
  const [sandboxError, setSandboxError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const draft = useMemo(() => buildExpertDraft(answers), [answers]);
  const errors = useMemo(
    () => (answers.name.trim() ? expertDraftErrors(draft) : []),
    [answers.name, draft],
  );

  const toggle = (field: 'tools' | 'artifactTypes', name: string) => {
    const list = answers[field];
    setAnswers({
      ...answers,
      [field]: list.includes(name)
        ? list.filter((t) => t !== name)
        : [...list, name],
    });
  };

  const testDrive = async () => {
    setTesting(true);
    setReply('');
    setSandboxError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'sandbox',
          expert: draft,
          message: testMessage,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'sandbox failed');
      setReply(json.reply || '(no reply)');
    } catch (err) {
      setSandboxError(err instanceof Error ? err.message : 'sandbox failed');
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');
      onSaved(json.expert as ResearchExpert);
      setOpen(false);
      setReply('');
      setTestMessage('');
      setAnswers({
        name: '',
        does: '',
        optimizesFor: '',
        tools: [],
        artifactTypes: [],
        model: '',
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brass/30 px-3 py-1.5 text-sm font-medium text-brass hover:bg-brass/10"
      >
        <Bot className="h-4 w-4" /> Build me an agent
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-bone/10 bg-[#1a1512] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-bone">
                  Build me an agent
                </h2>
                <p className="text-xs text-bone/45">
                  Four answers → a real crew member. The composition is
                  deterministic (no AI): what you test-drive is exactly what
                  saves.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-bone/40 hover:text-bone"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  1 · What is it called?
                </div>
                <input
                  value={answers.name}
                  onChange={(e) => setAnswers({ ...answers, name: e.target.value })}
                  placeholder="Comment Reply Coach"
                  className="w-full rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/25 focus:border-brass/40"
                />
                {draft.slug && (
                  <div className="mt-1 text-[11px] text-bone/35">
                    joins the crew as <code className="text-brass/80">{draft.slug}</code>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  2 · What does it do? (one line)
                </div>
                <input
                  value={answers.does}
                  onChange={(e) => setAnswers({ ...answers, does: e.target.value })}
                  placeholder="answers audience comments in our voice"
                  className="w-full rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/25 focus:border-brass/40"
                />
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  3 · What does it optimize for?
                </div>
                <input
                  value={answers.optimizesFor}
                  onChange={(e) => setAnswers({ ...answers, optimizesFor: e.target.value })}
                  placeholder="turning skeptics into buyers"
                  className="w-full rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/25 focus:border-brass/40"
                />
              </div>

              <ChipRow
                label="4a · Tools it may call"
                options={TOOL_OPTIONS}
                values={answers.tools}
                onToggle={(n) => toggle('tools', n)}
              />
              <ChipRow
                label="4b · Artifacts it may save"
                options={RESEARCH_ARTIFACT_TYPES}
                values={answers.artifactTypes}
                onToggle={(n) => toggle('artifactTypes', n)}
              />

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  Model
                </div>
                <select
                  value={answers.model || AUTO_MODEL}
                  onChange={(e) =>
                    setAnswers({
                      ...answers,
                      model: e.target.value === AUTO_MODEL ? '' : e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-bone/10 bg-[#1a1512] px-2 py-1.5 text-sm text-bone outline-none focus:border-brass/40"
                >
                  <option value={AUTO_MODEL}>Auto (the cascade decides)</option>
                  {TEXT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {answers.name.trim() && (
                <div className="rounded-lg border border-bone/10 bg-black/20 p-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                    The persona it will run with
                  </div>
                  <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-bone/60">
                    {draft.persona}
                  </pre>
                </div>
              )}

              {errors.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
                  {errors[0]}
                </div>
              )}

              <div className="rounded-lg border border-bone/10 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-bone/40">
                  Test-drive (one sandbox turn, deleted after)
                </div>
                <div className="flex gap-2">
                  <input
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Ask it something (blank = introduce yourself)"
                    className="flex-1 rounded-md border border-bone/10 bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-bone/25 focus:border-brass/40"
                  />
                  <button
                    type="button"
                    disabled={testing || errors.length > 0 || !answers.name.trim()}
                    onClick={testDrive}
                    className="inline-flex items-center gap-1 rounded-md border border-brass/30 px-3 py-1.5 text-sm font-medium text-brass hover:bg-brass/10 disabled:opacity-40"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Run
                  </button>
                </div>
                {sandboxError && (
                  <div className="mt-2 text-xs text-red-300/90">{sandboxError}</div>
                )}
                {reply && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-black/20 p-2 text-[11px] leading-relaxed text-bone/70">
                    {reply}
                  </pre>
                )}
              </div>

              {saveError && (
                <div className="text-xs text-red-300/90">{saveError}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-bone/50 hover:text-bone"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || errors.length > 0 || !answers.name.trim()}
                  onClick={save}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-4 py-1.5 text-sm font-semibold text-[#1a1512] hover:brightness-110 disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save to the crew
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
