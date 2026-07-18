'use client';

import { useState } from 'react';
import { Check, Loader2, Mail, ChevronLeft, ChevronRight, Copy, Sparkles } from 'lucide-react';
import type { SaveStatus } from '@/hooks/mothermode/useResourceWorkspace';

/**
 * Shared, brand-styled primitives for interactive resource workspaces
 * (Bone/Ink/Mode/Brass palette, rounded-2xl cards, no em dashes). Every
 * workspace component (Brain Dump, Weekly Reset, Load Map, Delegate
 * Tracker) is built from these so the interactive layer feels like one
 * continuous product, not four different widgets bolted onto a document.
 */

export const WorkspaceCard: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ eyebrow, title, subtitle, children }) => (
  <div className="mt-8 rounded-3xl border border-mode/20 bg-white/60 p-5 sm:p-7 print:hidden">
    {eyebrow && (
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-mode">{eyebrow}</div>
    )}
    <h3 className="mt-1.5 font-display text-xl font-semibold text-ink sm:text-2xl">{title}</h3>
    {subtitle && <p className="mt-2 leading-relaxed text-ink/65">{subtitle}</p>}
    <div className="mt-6">{children}</div>
  </div>
);

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="mt-5">
    <label className="block text-sm font-medium text-ink">{label}</label>
    {hint && <p className="mt-0.5 text-xs text-ink/50">{hint}</p>}
    <div className="mt-2">{children}</div>
  </div>
);

export const WorkspaceTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink/35 focus:border-mode/50 focus:outline-none focus:ring-2 focus:ring-mode/15"
  />
);

export const WorkspaceInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode/50 focus:outline-none focus:ring-2 focus:ring-mode/15"
  />
);

export const WorkspaceSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: string[];
}> = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink focus:border-mode/50 focus:outline-none focus:ring-2 focus:ring-mode/15"
  >
    {options.map((o) => (
      <option key={o} value={o}>
        {o}
      </option>
    ))}
  </select>
);

export const WorkspaceCheckbox: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2.5 hover:bg-ink/[0.02]">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        checked ? 'border-mode bg-mode text-bone' : 'border-mode/40 text-transparent'
      }`}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </button>
    <span className="flex-1">
      <span className={`font-medium ${checked ? 'text-ink/50 line-through' : 'text-ink'}`}>{label}</span>
      {description && <span className="block text-sm leading-relaxed text-ink/55">{description}</span>}
    </span>
  </label>
);

export const SaveIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/45">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mode">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (status === 'error') {
    return <span className="text-xs font-medium text-red-600">Could not save, retrying</span>;
  }
  return null;
};

/**
 * Captures the self-reported email that scopes a buyer's saved data. Shown
 * inline at the top of every workspace card until an email is on file, then
 * collapses to a small "saving as" line.
 */
export const EmailGate: React.FC<{
  email: string;
  onSubmit: (email: string) => void;
}> = ({ email, onSubmit }) => {
  const [draft, setDraft] = useState('');

  if (email) {
    return (
      <p className="mb-5 flex items-center gap-1.5 text-xs text-ink/45">
        <Mail className="h-3 w-3" /> Saving your work for <span className="font-medium text-ink/65">{email}</span>
      </p>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-brass/30 bg-brass/[0.06] p-4">
      <p className="text-sm font-medium text-ink">Save your answers as you go</p>
      <p className="mt-1 text-sm leading-relaxed text-ink/60">
        Enter the email you checked out with. Nothing is shared, it just lets this page remember what you typed.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onSubmit(draft.trim());
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="email"
          required
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="you@email.com"
          className="flex-1 rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode/50 focus:outline-none focus:ring-2 focus:ring-mode/15"
        />
        <button
          type="submit"
          className="rounded-xl bg-mode px-4 py-2.5 text-sm font-semibold text-bone transition-colors hover:bg-mode-deep"
        >
          Start saving
        </button>
      </form>
    </div>
  );
};

/** Week-to-week navigation for weekly-mode workspaces: back/forward through
 *  stored weeks, plus a clone-forward action to start the next one. */
export const PeriodNav: React.FC<{
  periodLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onStartNext: (cloneForward: boolean) => void;
  isCurrent: boolean;
}> = ({ periodLabel, canGoBack, canGoForward, onBack, onForward, onStartNext, isCurrent }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-ink/[0.02] px-4 py-3">
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        className="rounded-lg border border-ink/10 p-1.5 text-ink/50 transition-colors hover:text-mode disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Previous period"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold text-ink">{periodLabel}</span>
      {isCurrent && (
        <span className="rounded-full bg-mode/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mode">
          Current
        </span>
      )}
      <button
        type="button"
        onClick={onForward}
        disabled={!canGoForward}
        className="rounded-lg border border-ink/10 p-1.5 text-ink/50 transition-colors hover:text-mode disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next period"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
    <button
      type="button"
      onClick={() => onStartNext(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brass/30 bg-brass/[0.08] px-3 py-1.5 text-xs font-semibold text-brass transition-colors hover:bg-brass/[0.15]"
    >
      <Copy className="h-3 w-3" /> Start next week
    </button>
  </div>
);

/** The recurring MotherMode OS lead-in, styled as a compact strip so it can
 *  sit at the bottom of any workspace card without overpowering the tool. */
export const AppLeadIn: React.FC<{ text: string; ctaLabel: string; href?: string }> = ({
  text,
  ctaLabel,
  href = '/mothermode/upsell',
}) => (
  <a
    href={href}
    className="mt-6 flex items-center gap-3 rounded-2xl border border-mode/20 bg-mode/[0.05] p-4 transition-colors hover:bg-mode/[0.08]"
  >
    <Sparkles className="h-4 w-4 flex-shrink-0 text-mode" />
    <span className="flex-1 text-sm leading-relaxed text-ink/75">{text}</span>
    <span className="flex-shrink-0 text-sm font-semibold text-mode">See how &rarr;</span>
  </a>
);
