'use client';

/**
 * Optional edit context for MotherMode layout sections.
 *
 * Catalog pages (/mothermode/*) never provide this context, so MmEditable
 * renders plain children. Funnel builder pages (SalesPage / UpsellPage) wrap
 * the layout in SalesPageEditProvider so admins get optin-style hover-to-edit
 * on the real production copy.
 */
import React, { createContext, useContext } from 'react';
import type { SalesInlineEditApi } from './inlineEdit';
import type { FunnelMediaKind } from './FunnelMediaStudio';

export type SalesMediaOpenRequest = {
  kind: FunnelMediaKind;
  field: string;
  label: string;
};

type SalesPageEditValue = SalesInlineEditApi & {
  /** Open Funnel Media Studio for a media field (hero image/video, founder photo). */
  openMediaStudio?: (req: SalesMediaOpenRequest) => void;
};

const SalesPageEditContext = createContext<SalesPageEditValue | null>(null);

export function SalesPageEditProvider({
  edit,
  openMediaStudio,
  children,
}: {
  edit: SalesInlineEditApi;
  openMediaStudio?: (req: SalesMediaOpenRequest) => void;
  children: React.ReactNode;
}) {
  const value: SalesPageEditValue = {
    ...edit,
    openMediaStudio,
  };
  return (
    <SalesPageEditContext.Provider value={value}>
      {children}
    </SalesPageEditContext.Provider>
  );
}

export function useSalesPageEdit(): SalesPageEditValue | null {
  return useContext(SalesPageEditContext);
}

/**
 * Hover-to-edit wrapper used inside MotherMode section components.
 * No-ops (plain render) when not in funnel edit mode.
 */
export function MmEditable({
  field,
  multiline = false,
  className = '',
  as: Tag,
  children,
  value,
  onDark = false,
}: {
  /** Funnel JSON field key (SalesPageContent / UpsellContent), supports paths. */
  field: string;
  multiline?: boolean;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  children: React.ReactNode;
  /** Override value sent to the popup (defaults to string children). */
  value?: string;
  /**
   * Use high-contrast hover chrome for dark surfaces (timer bar, solid CTAs).
   * Default outline-mode is nearly invisible on bg-mode.
   */
  onDark?: boolean;
}) {
  const edit = useSalesPageEdit();
  const Comp = (Tag || 'span') as React.ElementType;

  if (!edit?.isEditMode) {
    if (Tag) {
      return <Comp className={className || undefined}>{children}</Comp>;
    }
    return <>{children}</>;
  }

  const resolved =
    value !== undefined
      ? value
      : typeof children === 'string'
        ? children
        : edit.getField(field);

  const hoverChrome = onDark
    ? 'outline-dashed outline-1 outline-transparent hover:outline-brass hover:bg-white/10 ring-offset-2'
    : 'outline-dashed outline-1 outline-transparent hover:outline-mode/50 hover:bg-mode/[0.04]';

  return (
    <Comp
      className={`${className} cursor-pointer ${hoverChrome} rounded transition-all relative`.trim()}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        edit.openEdit(e, field, resolved, multiline);
      }}
      title="Click to edit"
    >
      {children}
    </Comp>
  );
}

/**
 * Whole-control edit target for buttons / dark bars.
 * Prefer this over nesting MmEditable inside a <button> — larger hit area
 * and reliable click handling in edit mode.
 */
export function MmEditButton({
  field,
  value,
  multiline = false,
  onDark = true,
  className = '',
  children,
  type = 'button',
  onClick,
}: {
  field: string;
  value: string;
  multiline?: boolean;
  onDark?: boolean;
  className?: string;
  children: React.ReactNode;
  type?: 'button' | 'submit';
  /** Live-mode click handler (ignored while editing). */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const edit = useSalesPageEdit();
  const isEdit = Boolean(edit?.isEditMode);

  const hoverChrome = isEdit
    ? onDark
      ? ' outline-dashed outline-2 outline-transparent hover:outline-brass hover:ring-2 hover:ring-brass/40'
      : ' outline-dashed outline-2 outline-transparent hover:outline-mode hover:ring-2 hover:ring-mode/30'
    : '';

  return (
    <button
      type={type}
      className={`${className}${hoverChrome}${isEdit ? ' cursor-pointer' : ''}`.trim()}
      title={isEdit ? 'Click to edit button text' : undefined}
      onClick={(e) => {
        if (isEdit && edit) {
          e.preventDefault();
          e.stopPropagation();
          edit.openEdit(e, field, value, multiline);
          return;
        }
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
