'use client';

/**
 * The shared prompt-bank picker for generator surfaces
 * (docs/PROMPT_BANK_GENERATOR_PICKERS_TASK.md): a "Steer with a bank
 * framework" toggle plus a selector hydrated from the live merged bank, strong
 * fits for the surface's platform/format first, grouped the way the admin
 * editor groups them. Text surfaces offer framework + style; image stages
 * offer image only. When the picked recipe declares custom inputs, the same
 * "Your material" fields from the Test lab render, and the host passes the
 * values through as recipeInputs. Off (or on with Auto selected) is exactly
 * today's behavior.
 */
import React, { useId, useMemo, useState } from 'react';
import { orderRecipesForPicker } from '@/lib/mothermode/content/promptBankActions';
import type { RecipeGroup } from '@/lib/mothermode/content/promptBank';
import type {
  ContentFormat,
  ContentPlatform,
} from '@/lib/mothermode/content/types';
import { usePromptBankRecipes } from './usePromptBankRecipes';

/** Optgroup titles, matching the admin editor's group filter. */
const GROUP_LABEL: Record<RecipeGroup, string> = {
  framework: 'Frameworks',
  style: 'Styles',
  image: 'Image creative',
};

/** The order optgroups appear in the selector. */
const GROUP_ORDER: RecipeGroup[] = ['framework', 'style', 'image'];

export const FrameworkPicker: React.FC<{
  /** Surface channel, used to float strong fits to the top. */
  platform?: ContentPlatform;
  /** Surface format, used to float strong fits to the top. */
  format?: ContentFormat;
  /** The groups this surface can execute. Default: framework + style. */
  groups?: RecipeGroup[];
  /**
   * When true, the selector lists ONLY the channel's strong fits (the
   * Generate drawer's behavior: nothing from other platforms shows) instead
   * of fits-first-then-the-whole-bank.
   */
  fitsOnly?: boolean;
  /** The picked recipe id. '' means no steering (today's behavior). */
  value: string;
  onChange: (id: string) => void;
  /** Filled custom-input values for the picked recipe, keyed by field id. */
  inputValues?: Record<string, string>;
  onInputValues?: (next: Record<string, string>) => void;
  /** Toggle text. Default 'Steer with a bank framework'. */
  toggleLabel?: string;
  /** Visual tone: light host surfaces (default) or dark studio surfaces. */
  tone?: 'light' | 'dark';
  className?: string;
}> = ({
  platform,
  format,
  groups = ['framework', 'style'],
  fitsOnly = false,
  value,
  onChange,
  inputValues,
  onInputValues,
  toggleLabel = 'Steer with a bank framework',
  tone = 'light',
  className,
}) => {
  const uid = useId();
  const { recipes } = usePromptBankRecipes();
  // Local toggle state so "on with nothing picked yet" is possible; an
  // explicit value from the host always forces the picker open.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const active = toggled ?? value !== '';

  const imageOnly = groups.length === 1 && groups[0] === 'image';

  /** Strong fits first, then the rest, partitioned per optgroup. */
  const byGroup = useMemo(() => {
    const ordered = orderRecipesForPicker(
      recipes,
      platform,
      format,
      groups,
      fitsOnly,
    );
    const map = new Map<RecipeGroup, typeof ordered>();
    for (const g of GROUP_ORDER) {
      const list = ordered.filter((r) => r.group === g);
      if (list.length > 0) map.set(g, list);
    }
    return map;
  }, [recipes, platform, format, groups, fitsOnly]);

  const selected = value ? recipes.find((r) => r.id === value) : undefined;
  const fields = selected?.inputs ?? [];

  const flip = (next: boolean) => {
    setToggled(next);
    if (!next) onChange('');
  };

  const dark = tone === 'dark';
  const textCls = dark ? 'text-bone/70' : 'text-ink/70';
  const selectCls = dark
    ? 'w-full rounded-lg border border-bone/20 bg-ink/40 px-2.5 py-1.5 text-sm text-bone focus:border-brass focus:outline-none'
    : 'w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-sm text-ink focus:border-mode focus:outline-none';
  const hintCls = dark ? 'text-[11px] text-bone/45' : 'text-[11px] text-ink/45';
  const fieldCls = dark
    ? 'w-full resize-none rounded-lg border border-bone/20 bg-ink/40 px-2.5 py-1.5 text-xs text-bone focus:border-brass focus:outline-none'
    : 'w-full resize-none rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-xs text-ink focus:border-mode focus:outline-none';
  const materialCls = dark
    ? 'space-y-2 rounded-lg border border-brass/35 bg-brass/10 p-2.5'
    : 'space-y-2 rounded-lg border border-brass/25 bg-brass/5 p-2.5';

  return (
    <div className={className}>
      <label
        className={`flex cursor-pointer items-center gap-2 text-xs font-semibold ${textCls}`}
      >
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => flip(e.target.checked)}
          className={dark ? 'accent-brass' : 'accent-mode'}
        />
        <span>{toggleLabel}</span>
      </label>

      {active && (
        <div className="mt-2 space-y-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={selectCls}
            aria-label="Bank framework"
          >
            <option value="">
              {imageOnly
                ? 'Auto (default scene brief)'
                : 'Auto (a different proven framework per piece)'}
            </option>
            {Array.from(byGroup.entries()).map(([g, list]) => (
              <optgroup key={g} label={GROUP_LABEL[g]}>
                {list.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} · {r.hint}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className={hintCls}>
            {selected?.hint ??
              (byGroup.size === 0
                ? 'No bank frameworks are tuned for this channel yet. Auto keeps the default behavior.'
                : imageOnly
                  ? 'The default scene brief writes every prompt.'
                  : 'Auto rotates proven frameworks across the run.')}
          </p>

          {fields.length > 0 && onInputValues && (
            <div className={materialCls}>
              <p
                className={`text-[11px] font-semibold ${
                  dark ? 'text-bone/60' : 'text-ink/55'
                }`}
              >
                Your material (this framework asks for it)
              </p>
              {fields.map((f) => (
                <div key={f.id}>
                  <label
                    className={`mb-0.5 block text-[11px] ${
                      dark ? 'text-bone/50' : 'text-ink/50'
                    }`}
                    htmlFor={`${uid}-${f.id}`}
                  >
                    {f.label || f.id}
                    {f.required === true && (
                      <span className="ml-1 text-brass">*</span>
                    )}
                  </label>
                  <textarea
                    id={`${uid}-${f.id}`}
                    value={inputValues?.[f.id] ?? ''}
                    onChange={(e) =>
                      onInputValues({
                        ...(inputValues ?? {}),
                        [f.id]: e.target.value,
                      })
                    }
                    rows={2}
                    className={fieldCls}
                    placeholder={f.placeholder}
                  />
                  {f.hint && (
                    <p
                      className={`mt-0.5 text-[10px] ${
                        dark ? 'text-bone/40' : 'text-ink/40'
                      }`}
                    >
                      Used as {f.hint}.
                    </p>
                  )}
                </div>
              ))}
              <p
                className={`text-[10px] ${
                  dark ? 'text-bone/40' : 'text-ink/40'
                }`}
              >
                Blank fields fall back to the model inventing from the offer
                facts.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
