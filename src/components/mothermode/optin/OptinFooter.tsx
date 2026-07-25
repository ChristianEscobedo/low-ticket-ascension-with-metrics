'use client';

import React from 'react';
import type { OptinFooterContent } from '@/lib/mothermode/optin/types';

/**
 * Minimal edit surface both optin + sales inline-edit hooks satisfy.
 * Footer fields live at the funnel root (`footer.*`), not inside a page block.
 */
export type FooterEditApi = {
  isEditMode: boolean;
  draft: { footer: OptinFooterContent };
  getField: (field: string) => string;
  openEdit: (
    e: React.MouseEvent,
    field: string,
    value: string,
    multiline?: boolean,
  ) => void;
};

function FooterEditable({
  edit,
  field,
  multiline = false,
  className = '',
  as: Tag = 'div',
  children,
}: {
  edit?: FooterEditApi;
  field: string;
  multiline?: boolean;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  children: React.ReactNode;
}) {
  if (!edit?.isEditMode) {
    const Comp = Tag as React.ElementType;
    return <Comp className={className}>{children}</Comp>;
  }
  const value = edit.getField(field);
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      className={`${className} cursor-pointer outline-dashed outline-1 outline-transparent hover:outline-mode/50 hover:bg-mode/[0.04] rounded transition-all relative`.trim()}
      onClick={(e: React.MouseEvent) => edit.openEdit(e, field, value, multiline)}
      title="Click to edit"
    >
      {children}
    </Comp>
  );
}

/**
 * Programmable footer for optin + sales funnel pages. No header chrome on these
 * routes; the footer carries disclaimers, advertising disclosures, links, and
 * copyright. All editable inline by admins via footer.* root paths.
 */
export function OptinFooter({
  footer,
  edit,
}: {
  footer: OptinFooterContent;
  edit?: FooterEditApi;
}) {
  const f = edit?.draft?.footer ?? footer;
  if (!f?.enabled) return null;

  return (
    <footer className="border-t border-ink/10 bg-bone/60 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-4 text-center">
        {(f.brandLine || edit?.isEditMode) && (
          <FooterEditable
            edit={edit}
            field="footer.brandLine"
            className="text-sm font-semibold uppercase tracking-[0.2em] text-mode"
          >
            {f.brandLine || (edit?.isEditMode ? 'Brand line…' : '')}
          </FooterEditable>
        )}
        {(f.disclaimer || edit?.isEditMode) && (
          <FooterEditable
            edit={edit}
            field="footer.disclaimer"
            multiline
            as="p"
            className="mx-auto max-w-2xl text-xs leading-relaxed text-ink/45"
          >
            {f.disclaimer || (edit?.isEditMode ? 'Disclaimer…' : '')}
          </FooterEditable>
        )}
        {(f.links.length > 0 || edit?.isEditMode) && (
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {f.links.map((link, i) => (
              <span key={`${i}-${link.label}`} className="inline-flex items-center gap-1">
                <FooterEditable
                  edit={edit}
                  field={`footer.links.${i}.label`}
                  as="span"
                  className="text-xs font-medium text-ink/55 underline-offset-2 hover:text-ink hover:underline"
                >
                  {edit?.isEditMode ? (
                    <span>{link.label || 'Link label'}</span>
                  ) : (
                    <a href={link.href}>{link.label}</a>
                  )}
                </FooterEditable>
                {edit?.isEditMode && (
                  <FooterEditable
                    edit={edit}
                    field={`footer.links.${i}.href`}
                    as="span"
                    className="text-[10px] text-mode/70"
                  >
                    [{link.href || 'href'}]
                  </FooterEditable>
                )}
              </span>
            ))}
            {f.links.length === 0 && edit?.isEditMode && (
              <span className="text-xs italic text-ink/40">
                Add footer links in admin (or seed defaults)
              </span>
            )}
          </nav>
        )}
        {(f.copyright || edit?.isEditMode) && (
          <FooterEditable
            edit={edit}
            field="footer.copyright"
            as="p"
            className="text-xs text-ink/35"
          >
            {f.copyright || (edit?.isEditMode ? 'Copyright…' : '')}
          </FooterEditable>
        )}
      </div>
    </footer>
  );
}
