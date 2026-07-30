'use client';

import { useState } from 'react';

import { newManualPieceId } from '@/lib/mothermode/planner/utm';

/**
 * Add a content card straight onto the board.
 *
 * WHY THE PIECE ID IS VISIBLE AND REQUIRED
 * ----------------------------------------
 * `piece_id` is the join key for three separate systems: the export bridge
 * (`scheduleByPieceId`), tracked links (`utm_content = piece_id`), and per-post
 * attribution. A card saved with a blank piece id looks completely normal on the
 * board and is invisible to all three, permanently — and nothing anywhere
 * reports that, because "no attribution rows" and "no such piece id" are the
 * same empty result.
 *
 * So the form pre-fills a generated `manual_<date>_<code>` id and shows it as an
 * editable field rather than hiding it. Showing it also gives the admin the
 * chance to paste a real content-hub piece id when the card represents one,
 * which is what links the board card to the library piece.
 *
 * The id is generated once per open form, not on every keystroke: regenerating
 * as you type would mean the value you saw is not the value you saved.
 */
export default function AddPlanCard({
  columns,
  defaultStage,
  saving,
  post,
  onCreated,
}: {
  columns: { id: string; name: string }[];
  defaultStage: string;
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<{ record?: unknown }>;
  onCreated: (record: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pieceId, setPieceId] = useState(() => newManualPieceId());
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [format, setFormat] = useState('');
  const [day, setDay] = useState('');
  const [stage, setStage] = useState(defaultStage);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    // A fresh id for the next card — reusing one would collide on the unique
    // index and, worse, pool two posts' clicks under one utm_content.
    setPieceId(newManualPieceId());
    setTitle('');
    setPlatform('');
    setFormat('');
    setDay('');
    setStage(defaultStage);
    setErr(null);
  }

  async function submit() {
    const trimmedTitle = title.trim();
    const trimmedPiece = pieceId.trim();
    if (!trimmedTitle) {
      setErr('Give the card a title so it is recognisable on the board.');
      return;
    }
    if (!trimmedPiece) {
      setErr(
        'A piece id is required — without one this card cannot be exported or attributed.',
      );
      return;
    }

    setErr(null);
    try {
      const json = await post({
        action: 'upsertPlan',
        pieceId: trimmedPiece,
        title: trimmedTitle,
        platform: platform.trim(),
        format: format.trim(),
        stage,
        // Noon local, not midnight: a midnight-local date converted to UTC lands
        // on the previous day for anyone west of GMT, which silently shifts every
        // scheduled post by a day in the calendar view and the CSV export.
        scheduledAt: day ? new Date(`${day}T12:00`).toISOString() : null,
      });
      if (json.record) onCreated(json.record);
      reset();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the card.');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-brass/30 px-3 py-1.5 text-sm font-medium text-bone/80 transition-colors hover:border-brass/60 hover:text-bone"
      >
        + Add card
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-brass/25 bg-ink/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-bone">New content card</div>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs text-bone/50 hover:text-bone/80"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="6 things running in my head right now"
            className="w-full rounded-md border border-bone/15 bg-ink/70 px-2 py-1.5 text-sm text-bone placeholder:text-bone/30"
          />
        </Field>
        <Field label="Column">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full rounded-md border border-bone/15 bg-ink/70 px-2 py-1.5 text-sm text-bone"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Platform">
          <input
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="facebook"
            className="w-full rounded-md border border-bone/15 bg-ink/70 px-2 py-1.5 text-sm text-bone placeholder:text-bone/30"
          />
        </Field>
        <Field label="Format">
          <input
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            placeholder="reel"
            className="w-full rounded-md border border-bone/15 bg-ink/70 px-2 py-1.5 text-sm text-bone placeholder:text-bone/30"
          />
        </Field>
        <Field label="Scheduled date (optional)">
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-full rounded-md border border-bone/15 bg-ink/70 px-2 py-1.5 text-sm text-bone"
          />
        </Field>
        <Field label="Piece id — the attribution key">
          <input
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            spellCheck={false}
            className="w-full rounded-md border border-bone/15 bg-ink/70 px-2 py-1.5 font-mono text-xs text-bone"
          />
        </Field>
      </div>

      <p className="text-xs text-bone/45">
        The piece id becomes <code className="text-bone/70">utm_content</code> on
        every tracked link for this post, and the join key for its clicks, opt-ins
        and CSV export. Keep the generated value, or paste a content-hub piece id
        if this card represents one.
      </p>

      {err && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="rounded-lg bg-brass/90 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-brass disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create card'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-brass/70">
        {label}
      </span>
      {children}
    </label>
  );
}
