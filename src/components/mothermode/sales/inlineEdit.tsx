'use client';

/**
 * On-page inline edit for MotherMode sales funnels.
 * Admins get a floating toolbar; click any Editable field to patch copy,
 * then Save posts the merged funnel back through /api/admin/mothermode-sales.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';

const CRUD_URL = '/api/admin/mothermode-sales';

/** Immutable deep set for dotted paths (supports numeric array indexes). */
function setPathValue(
  root: Record<string, unknown>,
  parts: string[],
  value: unknown,
): Record<string, unknown> {
  if (parts.length === 0) return root;
  const [head, ...rest] = parts;
  if (rest.length === 0) {
    return { ...root, [head]: value };
  }
  const nextIsIndex = /^\d+$/.test(rest[0]);
  const existing = root[head];
  if (nextIsIndex) {
    const arr: unknown[] = Array.isArray(existing) ? [...existing] : [];
    const idx = Number(rest[0]);
    const afterIndex = rest.slice(1);
    if (afterIndex.length === 0) {
      arr[idx] = value;
    } else {
      const item =
        arr[idx] && typeof arr[idx] === 'object' && !Array.isArray(arr[idx])
          ? { ...(arr[idx] as Record<string, unknown>) }
          : {};
      arr[idx] = setPathValue(item, afterIndex, value);
    }
    return { ...root, [head]: arr };
  }
  const child =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...root, [head]: setPathValue(child, rest, value) };
}

export type SalesBlockKey =

  | 'optin'
  | 'sales'
  | 'vsl'
  | 'checkout'
  | 'upsell1'
  | 'upsell2'
  | 'upsell3'
  | 'upsell4'
  | 'success'
  | 'access'
  | 'footer';

export interface InlineEditState {
  field: string;
  value: string;
  multiline: boolean;
  top: number;
  left: number;
  width: number;
}

const LIST_FIELDS = new Set([
  'benefits',
  'bullets',
  'features',
  'problemPoints',
  'oldWayItems',
  'newWayItems',
  'letter',
]);

/** Multi-paragraph arrays edited as blank-line-separated text. */
const PARA_FIELDS = new Set([
  'originParagraphs',
  'whatIsParagraphs',
  'mechanismParagraphs',
  'founderParagraphs',
]);


const NUMBER_FIELDS = new Set([
  'ctaRevealSeconds',
  'timerMinutes',
  'priceCents',
  'trialDays',
]);

const BOOL_FIELDS = new Set([
  'enabled',
  'collectName',
  'stickyPlayer',
  'autoplay',
]);

export function useSalesInlineEdit(
  funnel: SalesFunnelRecord,
  block: SalesBlockKey,
  isAdmin: boolean,
) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState<SalesFunnelRecord>(funnel);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);

  useEffect(() => {
    if (!dirty) setDraft(funnel);
  }, [funnel, dirty]);

  const blockContent = draft[block];

  const getField = useCallback(
    (field: string): string => {
      // Root-level footer paths: footer.brandLine, footer.links.0.label
      if (field === 'footer' || field.startsWith('footer.')) {
        const parts = field === 'footer' ? ['footer'] : field.split('.');
        let cur: unknown = draft as unknown as Record<string, unknown>;
        for (const p of parts) {
          if (cur == null) return '';
          if (Array.isArray(cur) && /^\d+$/.test(p)) {
            cur = cur[Number(p)];
          } else if (typeof cur === 'object') {
            cur = (cur as Record<string, unknown>)[p];
          } else {
            return '';
          }
        }
        if (typeof cur === 'string') return cur;
        if (typeof cur === 'number' || typeof cur === 'boolean') return String(cur);
        return '';
      }
      const b = draft[block] as unknown as Record<string, unknown>;
      // Nested path: methodSteps.0.title, insideItems.2.description, faqs.1.answer
      if (field.includes('.')) {
        const parts = field.split('.');
        let cur: unknown = b;
        for (const p of parts) {
          if (cur == null) return '';
          if (Array.isArray(cur) && /^\d+$/.test(p)) {
            cur = cur[Number(p)];
          } else if (typeof cur === 'object') {
            cur = (cur as Record<string, unknown>)[p];
          } else {
            return '';
          }
        }
        if (typeof cur === 'string') return cur;
        if (typeof cur === 'number' || typeof cur === 'boolean') return String(cur);
        return '';
      }
      const v = b[field];
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return '';
    },
    [draft, block],
  );


  const getList = useCallback(
    (field: string): string[] => {
      const b = draft[block] as unknown as Record<string, unknown>;
      const v = b[field];
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    },
    [draft, block],
  );

  const setField = useCallback(
    (field: string, value: unknown) => {
      setDraft((prev) => {
        // Root-level footer writes: footer.brandLine, footer.links.0.href
        if (field === 'footer' || field.startsWith('footer.')) {
          if (field === 'footer') {
            return { ...prev, footer: value as SalesFunnelRecord['footer'] };
          }
          const parts = field.split('.').slice(1);
          const nextFooter = setPathValue(
            (prev.footer || {}) as unknown as Record<string, unknown>,
            parts,
            value,
          );
          return {
            ...prev,
            footer: nextFooter as unknown as SalesFunnelRecord['footer'],
          };
        }

        const prevBlock = prev[block] as unknown as Record<string, unknown>;
        // Nested path write: methodSteps.0.title
        if (field.includes('.')) {
          const nextBlock = setPathValue({ ...prevBlock }, field.split('.'), value);
          return { ...prev, [block]: nextBlock } as SalesFunnelRecord;
        }
        const nextBlock = {
          ...prevBlock,
          [field]: value,
        };
        return { ...prev, [block]: nextBlock } as SalesFunnelRecord;

      });
      setDirty(true);
    },
    [block],
  );



  const openEdit = useCallback(
    (e: React.MouseEvent, field: string, value: string, multiline = false) => {
      if (!isEditMode) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setInlineEdit({
        field,
        value,
        multiline,
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 340),
        width: Math.max(rect.width, 300),
      });
    },
    [isEditMode],
  );

  const save = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(CRUD_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: draft.id,
          name: draft.name,
          slug: draft.slug,
          status: draft.status,
          offerSlug: draft.offerSlug,
          leadGenSlug: draft.leadGenSlug,
          deliverableSlug: draft.deliverableSlug,
          deliverableKey: draft.deliverableKey,
          emailKitId: draft.emailKitId,
          emailKits: draft.emailKits,
          productId: draft.productId,
          optin: draft.optin,
          sales: draft.sales,
          vsl: draft.vsl,
          checkout: draft.checkout,
          upsell1: draft.upsell1,
          upsell2: draft.upsell2,
          upsell3: draft.upsell3,
          upsell4: draft.upsell4,
          success: draft.success,
          access: draft.access,
          footer: draft.footer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Save failed');
      }
      if (data.item) setDraft(data.item as SalesFunnelRecord);
      setDirty(false);
      setMessage('Saved');
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setSaving(false);
    }
  }, [dirty, draft]);

  const discard = useCallback(() => {
    setDraft(funnel);
    setDirty(false);
    setInlineEdit(null);
    setMessage(null);
  }, [funnel]);

  return {
    isAdmin,
    isEditMode,
    setIsEditMode,
    draft,
    blockContent,
    dirty,
    saving,
    message,
    inlineEdit,
    setInlineEdit,
    getField,
    getList,
    setField,
    openEdit,
    save,
    discard,
  };
}

export type SalesInlineEditApi = ReturnType<typeof useSalesInlineEdit>;

export function Editable({
  edit,
  field,
  multiline = false,
  className = '',
  as: Tag = 'div',
  children,
}: {
  edit: SalesInlineEditApi;
  field: string;
  multiline?: boolean;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  children: React.ReactNode;
}) {
  const value = edit.getField(field);
  const editClass = edit.isEditMode
    ? 'cursor-pointer outline-dashed outline-1 outline-transparent hover:outline-mode/50 hover:bg-mode/[0.04] rounded transition-all relative'
    : '';
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      className={`${className} ${editClass}`.trim()}
      onClick={
        edit.isEditMode
          ? (e: React.MouseEvent) => edit.openEdit(e, field, value, multiline)
          : undefined
      }
      title={edit.isEditMode ? 'Click to edit' : undefined}
    >
      {children}
    </Comp>
  );
}

export function EditableList({
  edit,
  field,
  className = '',
  itemClassName = '',
  renderItem,
}: {
  edit: SalesInlineEditApi;
  field: string;
  className?: string;
  itemClassName?: string;
  renderItem: (item: string, index: number) => React.ReactNode;
}) {
  const list = edit.getList(field);
  const joined = list.join('\n');
  return (
    <ul
      className={`${className} ${
        edit.isEditMode
          ? 'cursor-pointer outline-dashed outline-1 outline-transparent hover:outline-mode/50 hover:bg-mode/[0.04] rounded transition-all'
          : ''
      }`.trim()}
      onClick={
        edit.isEditMode ? (e) => edit.openEdit(e, field, joined, true) : undefined
      }
      title={edit.isEditMode ? 'Click to edit list' : undefined}
    >
      {list.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className={itemClassName}>
          {renderItem(item, i)}
        </li>
      ))}
      {list.length === 0 && edit.isEditMode && (
        <li className="text-sm italic text-ink/40">Click to add items...</li>
      )}
    </ul>
  );
}

export function InlineEditPopup({ edit }: { edit: SalesInlineEditApi }) {
  const state = edit.inlineEdit;
  const [value, setValue] = useState(state?.value ?? '');
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(state?.value ?? '');
    if (state) {
      requestAnimationFrame(() => ref.current?.focus());
    }
  }, [state]);

  if (!state) return null;

  const apply = () => {
    const field = state.field;
    if (LIST_FIELDS.has(field)) {
      const items = value
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      edit.setField(field, items);
    } else if (PARA_FIELDS.has(field)) {
      const paras = value
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      edit.setField(field, paras);
    } else if (NUMBER_FIELDS.has(field)) {
      edit.setField(field, Number(value) || 0);
    } else if (BOOL_FIELDS.has(field)) {
      edit.setField(
        field,
        value === 'true' || value === '1' || value.toLowerCase() === 'yes',
      );
    } else if (field === 'priceLabel' || field === 'originalPriceLabel') {
      edit.setField(field, value);
      const dollars = Number(String(value).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(dollars)) {
        edit.setField(
          field === 'priceLabel' ? 'priceCents' : 'originalPriceCents',
          Math.round(dollars * 100),
        );
      }
    } else {
      edit.setField(field, value);
    }
    edit.setInlineEdit(null);
  };


  return (
    <>
      <div
        className="fixed inset-0 z-[90]"
        onClick={() => edit.setInlineEdit(null)}
        aria-hidden
      />
      <div
        className="fixed z-[100] rounded-xl border border-ink/15 bg-bone p-3 shadow-xl"
        style={{
          top: Math.min(state.top, window.innerHeight - 200),
          left: Math.max(8, state.left),
          width: Math.min(state.width, window.innerWidth - 16),
          maxWidth: 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-mode/70">
          {state.field}
        </div>
        {state.multiline ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-mode/40 focus:outline-none focus:ring-2 focus:ring-mode/15"
            onKeyDown={(e) => {
              if (e.key === 'Escape') edit.setInlineEdit(null);
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) apply();
            }}
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-mode/40 focus:outline-none focus:ring-2 focus:ring-mode/15"
            onKeyDown={(e) => {
              if (e.key === 'Escape') edit.setInlineEdit(null);
              if (e.key === 'Enter') apply();
            }}
          />
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => edit.setInlineEdit(null)}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-mode px-3 py-1.5 text-xs font-semibold text-bone hover:bg-modeDeep"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}

export function SalesEditToolbar({ edit }: { edit: SalesInlineEditApi }) {
  if (!edit.isAdmin) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-ink/10 bg-ink px-3 py-2 shadow-2xl">
      <button
        type="button"
        onClick={() => {
          edit.setIsEditMode((v) => !v);
          edit.setInlineEdit(null);
        }}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
          edit.isEditMode
            ? 'bg-brass text-ink'
            : 'bg-bone/10 text-bone hover:bg-bone/20'
        }`}
      >
        {edit.isEditMode ? 'Editing...' : 'Edit page'}
      </button>
      {edit.isEditMode && (
        <>
          <button
            type="button"
            disabled={!edit.dirty || edit.saving}
            onClick={() => void edit.save()}
            className="rounded-full bg-mode px-4 py-1.5 text-xs font-semibold text-bone disabled:opacity-40"
          >
            {edit.saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            disabled={!edit.dirty || edit.saving}
            onClick={edit.discard}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-bone/60 hover:text-bone disabled:opacity-40"
          >
            Discard
          </button>
        </>
      )}
      {edit.message && (
        <span className="px-2 text-xs font-medium text-brass">{edit.message}</span>
      )}
    </div>
  );
}
