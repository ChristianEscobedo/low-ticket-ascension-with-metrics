'use client';

/**
 * A headless platform picker that shows each channel's brand logo next to its
 * name — both in the closed/selected state and in the dropdown list. Native
 * <select>/<option> can't render SVG icons, so this is a small custom popover
 * dropdown that emits the same ContentPlatform value a <select> would.
 *
 * Keyboard: Up/Down to move, Enter/Space to choose, Esc to close, Home/End to
 * jump. Click-outside closes. ARIA listbox/option semantics throughout.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PlatformIcon, PLATFORM_BRAND } from './PlatformIcon';
import {
  PLATFORM_LABEL,
  type ContentPlatform,
} from '@/lib/mothermode/content';

const labelCls = 'mb-1 block text-xs uppercase tracking-wide text-ink/45';
const triggerCls =
  'flex w-full items-center gap-2 rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-sm text-ink focus:border-mode focus:outline-none';

export const PlatformSelect: React.FC<{
  label?: string;
  value: ContentPlatform;
  options: ContentPlatform[];
  onChange: (v: ContentPlatform) => void;
  className?: string;
}> = ({ label, value, options, onChange, className }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.indexOf(value)),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // When opening, sync the active option to the current value and focus the list.
  useEffect(() => {
    if (open) {
      setActiveIndex(Math.max(0, options.indexOf(value)));
      listRef.current?.focus();
    }
  }, [open, options, value]);

  const choose = (p: ContentPlatform) => {
    onChange(p);
    setOpen(false);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (options[activeIndex]) choose(options[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className={className}>
      {label ? <label className={labelCls}>{label}</label> : null}
      <div ref={rootRef} className="relative">
        <button
          type="button"
          className={triggerCls}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
        >
          <PlatformIcon
            platform={value}
            className="h-4 w-4 shrink-0"
            style={{ color: PLATFORM_BRAND[value] }}
          />
          <span className="min-w-0 flex-1 truncate text-left">
            {PLATFORM_LABEL[value]}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-ink/40 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open ? (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={`${listboxId}-opt-${activeIndex}`}
            onKeyDown={onListKeyDown}
            className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-ink/15 bg-white py-1 shadow-lg focus:outline-none"
          >
            {options.map((p, i) => {
              const selected = p === value;
              const active = i === activeIndex;
              return (
                <li
                  key={p}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(p)}
                  className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm ${
                    active ? 'bg-mode/10' : ''
                  } ${selected ? 'font-semibold text-ink' : 'text-ink/75'}`}
                >
                  <PlatformIcon
                    platform={p}
                    className="h-4 w-4 shrink-0"
                    style={{ color: PLATFORM_BRAND[p] }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {PLATFORM_LABEL[p]}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
};
