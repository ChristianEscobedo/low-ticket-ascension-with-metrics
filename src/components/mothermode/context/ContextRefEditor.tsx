'use client';

/**
 * Shared "attached context" picker for the admin kit editors (community,
 * high-ticket, lead-gen — mirrors the block first shipped in EmailKitEditor).
 *
 * Renders a small list of ContextRef rows. Each row picks a source kind, then
 * either an inline value (link/text) or a store-backed source chosen from the
 * server-built `sources` options (with a manual slug/id fallback). The parent
 * owns the `refs` array and passes an `onChange` to persist edits.
 */
import {
  CONTEXT_SOURCE_KINDS,
  type ContextRef,
  type ContextSourceKind,
  type ContextSourceOption,
} from '@/lib/mothermode/context';


const KIND_LABELS: Record<ContextSourceKind, string> = {
  offer: 'Front-end offer',
  'offer-bonuses': 'Offer bonus stack',
  'community-kit': 'Community kit',
  'high-ticket-kit': 'High-ticket kit',
  'lead-gen-kit': 'Lead-gen kit',
  'email-kit': 'Email kit',
  link: 'Link (URL)',
  text: 'Text notes',
};

const inputCls =
  'w-full rounded-lg bg-black/20 border border-bone/15 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/50';
const labelCls = 'block text-xs uppercase tracking-wider text-bone/50 mb-1';
const cardCls = 'rounded-xl border border-bone/10 bg-bone/[0.02] p-4';
const ghostBtn =
  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-bone/60 border border-bone/15 hover:text-bone hover:bg-bone/[0.05]';

export default function ContextRefEditor({
  refs,
  onChange,
  sources = [],
  disabled = false,
}: {
  refs: ContextRef[];
  onChange: (next: ContextRef[]) => void;
  sources?: ContextSourceOption[];
  disabled?: boolean;
}) {
  function addRef() {
    onChange([...refs, { kind: 'offer', id: '' }]);
  }
  function patchRef(index: number, patch: Partial<ContextRef>) {
    onChange(refs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRef(index: number) {
    onChange(refs.filter((_, i) => i !== index));
  }

  return (
    <section className={`${cardCls} space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Attached context</h2>
        <button className={ghostBtn} onClick={addRef} disabled={disabled}>
          + Add source
        </button>
      </div>
      <p className="text-xs text-bone/40">
        Point the generator at an existing offer or kit (resolved live at
        generation time), or paste an ad-hoc link / notes to steer the copy.
      </p>

      {refs.length === 0 && (
        <p className="text-xs text-bone/30">No sources attached.</p>
      )}

      {refs.map((ref, i) => {
        const matches = sources.filter((s) => s.kind === ref.kind);

        return (
          <div
            key={i}
            className="rounded-lg border border-bone/10 bg-black/20 p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <div>
                  <label className={labelCls}>Source type</label>
                  <select
                    className={inputCls}
                    value={ref.kind}
                    disabled={disabled}
                    onChange={(e) => {
                      const kind = e.target.value as ContextSourceKind;
                      // Reset id/value so we never carry a stale pointer across
                      // kinds when the admin switches the source type.
                      patchRef(i, { kind, id: '', value: '' });
                    }}
                  >
                    {CONTEXT_SOURCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                {ref.kind === 'link' ? (
                  <input
                    className={inputCls}
                    value={ref.value ?? ''}
                    disabled={disabled}
                    onChange={(e) => patchRef(i, { value: e.target.value })}
                    placeholder="https://…"
                  />
                ) : ref.kind === 'text' ? (
                  <textarea
                    className={`${inputCls} min-h-[70px] resize-y`}
                    value={ref.value ?? ''}
                    disabled={disabled}
                    onChange={(e) => patchRef(i, { value: e.target.value })}
                    placeholder="Paste positioning notes, facts, or do/don't guidance…"
                  />
                ) : matches.length > 0 ? (
                  <select
                    className={inputCls}
                    value={ref.id}
                    disabled={disabled}
                    onChange={(e) => {
                      const id = e.target.value;
                      const picked = matches.find((m) => m.id === id);
                      patchRef(i, { id, label: picked?.label ?? ref.label });
                    }}
                  >
                    <option value="">Select a source…</option>
                    {matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                        {m.hint ? ` — ${m.hint}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      className={inputCls}
                      value={ref.id}
                      disabled={disabled}
                      onChange={(e) => patchRef(i, { id: e.target.value })}
                      placeholder="slug or id"
                    />
                    <input
                      className={inputCls}
                      value={ref.label ?? ''}
                      disabled={disabled}
                      onChange={(e) => patchRef(i, { label: e.target.value })}
                      placeholder="label (optional)"
                    />
                  </div>
                )}
              </div>
              <button
                className="text-bone/40 hover:text-red-400 text-sm px-2 pt-6"
                onClick={() => removeRef(i)}
                disabled={disabled}
                aria-label="Remove source"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
