'use client';

import type { OfferStack, OfferStackBonus, OfferStackBump, OfferStackUpsell, SalesAiIntake } from '@/lib/mothermode/sales/aiIntake';
import {
  Area,
  Collapse,
  Field,
  btnDanger,
  btnGhost,
  btnPrimary,
  inputClass, selectClass,
  labelClass,
  linesToList,
  listToLines,
  panelClass,
} from './ui';

/**
 * The Offer tab: AI brief -> offer stack -> the slugs that wire the funnel into
 * the rest of MotherMode. This is the old `build` tab plus the old `links` tab,
 * merged because both describe the offer rather than a page.
 *
 * Stateless by design. Every value below lives in `useState` up in
 * SalesFunnelEditor, so unmounting this tab cannot drop a half-typed edit.
 */

/**
 * A lead-gen kit choice. Structural on purpose: the shell owns the real
 * `LeadMagnetOption` type and only ever hands this list down read-only.
 */
export type LeadMagnetChoice = {
  id: string;
  name?: string | null;
  slug?: string | null;
  status?: string | null;
};

type Props = {
  // --- brief ---
  intake: SalesAiIntake;
  setIntakeField: <K extends keyof SalesAiIntake>(key: K, value: SalesAiIntake[K]) => void;
  busy: string | null;
  onFillIntake: () => void;
  onGenerate: () => void;
  onGenerateImages: () => void;
  // --- lead magnet ---
  leadMagnetId: string;
  leadMagnets: LeadMagnetChoice[];
  onPickLeadMagnet: (id: string) => void;
  onCreateLeadMagnet: () => void;
  // --- offer stack ---
  stack: OfferStack;
  setFrontEndField: <K extends keyof OfferStack['frontEnd']>(
    key: K,
    value: OfferStack['frontEnd'][K],
  ) => void;
  addBonus: () => void;
  updateBonus: (idx: number, patch: Partial<OfferStackBonus>) => void;
  removeBonus: (idx: number) => void;
  addBump: () => void;
  updateBump: (idx: number, patch: Partial<OfferStackBump>) => void;
  removeBump: (idx: number) => void;
  updateUpsell: (slot: number, patch: Partial<OfferStackUpsell>) => void;
  // --- links ---
  offerSlug: string;
  setOfferSlug: (v: string) => void;
  leadGenSlug: string;
  setLeadGenSlug: (v: string) => void;
  deliverableSlug: string;
  setDeliverableSlug: (v: string) => void;
  deliverableKey: string;
  setDeliverableKey: (v: string) => void;
  productId: string;
  setProductId: (v: string) => void;
};

export default function OfferTab({
  intake,
  setIntakeField,
  busy,
  onFillIntake,
  onGenerate,
  onGenerateImages,
  leadMagnetId,
  leadMagnets,
  onPickLeadMagnet,
  onCreateLeadMagnet,
  stack,
  setFrontEndField,
  addBonus,
  updateBonus,
  removeBonus,
  addBump,
  updateBump,
  removeBump,
  updateUpsell,
  offerSlug,
  setOfferSlug,
  leadGenSlug,
  setLeadGenSlug,
  deliverableSlug,
  setDeliverableSlug,
  deliverableKey,
  setDeliverableKey,
  productId,
  setProductId,
}: Props) {
  return (
    <section className={panelClass + ' space-y-3'}>
      <Collapse
        title="AI self-build"
        defaultOpen
        hint="1) Fill a thin brief. 2) AI expands into a full offer stack (front-end, bonuses, bumps, upsells). 3) Edit the stack. 4) Generate all 10 funnel pages from the stack."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Niche / topic" value={intake.niche} onChange={(v) => setIntakeField('niche', v)} placeholder="Mental load for working mothers" />
          <Field label="Audience" value={intake.audience} onChange={(v) => setIntakeField('audience', v)} placeholder="Mothers who feel like the family OS runs on them" />
          <Field label="Core pain" value={intake.pain} onChange={(v) => setIntakeField('pain', v)} placeholder="Carrying every invisible task alone" />
          <Field label="Free magnet name" value={intake.magnetName} onChange={(v) => setIntakeField('magnetName', v)} placeholder="The Brain Dump Starter" />
          <Field label="Magnet promise" value={intake.magnetPromise} onChange={(v) => setIntakeField('magnetPromise', v)} placeholder="Unload your head in 20 minutes" />
          <Field label="Lead gen kit slug (optional)" value={intake.leadGenSlug} onChange={(v) => setIntakeField('leadGenSlug', v)} placeholder="brain-dump-starter" />
          <Field label="Paid offer name" value={intake.offerName} onChange={(v) => setIntakeField('offerName', v)} placeholder="The Brain Dump System" />
          <Field label="Paid offer price" value={intake.offerPrice} onChange={(v) => setIntakeField('offerPrice', v)} placeholder="$27" />
        </div>
        <Area label="Tone notes (optional)" value={intake.toneNotes} onChange={(v) => setIntakeField('toneNotes', v)} rows={2} />

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onFillIntake} disabled={busy !== null} className={btnPrimary}>
            {busy === 'fillIntake' ? 'Filling stack…' : '1. AI fill brief + stack'}
          </button>
          <button type="button" onClick={onGenerate} disabled={busy !== null} className={btnPrimary}>
            {busy === 'generate' ? 'Generating pages…' : '2. Generate full funnel'}
          </button>
          <button type="button" onClick={onGenerateImages} disabled={busy !== null} className={btnGhost}>
            {busy === 'generateImages' ? 'Generating images…' : '3. Generate missing images'}
          </button>
        </div>
      </Collapse>

      {/* ---- Lead magnet link ---- */}
      <Collapse
        title="Lead magnet"
        hint="Link an existing lead-gen kit or let AI build one from this brief. Linking fills the opt-in magnet title, description, and kit slug — the kit itself stays the source of truth."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className={labelClass}>Existing lead-gen kit</label>
            <select className={selectClass} value={leadMagnetId} onChange={(e) => onPickLeadMagnet(e.target.value)}>
              <option value="">— none linked —</option>
              {leadMagnets.map((m) => (
                <option key={m.id} value={m.id}>{String(m.name || m.slug || m.id) + (m.status ? ' · ' + m.status : '')}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 items-end">
            <button type="button" onClick={onCreateLeadMagnet} disabled={busy !== null} className={btnGhost}>
              {busy === 'createMagnet' ? 'Creating magnet…' : 'AI create + link new magnet'}
            </button>
          </div>
        </div>
      </Collapse>

      {/* ---- Offer stack ---- */}
      <Collapse
        title="Offer stack"
        defaultOpen
        hint="Money path source of truth. Generate maps this into sales bonuses, checkout bumps, and upsell pages."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Front-end name" value={stack.frontEnd.name} onChange={(v) => setFrontEndField('name', v)} placeholder="The Brain Dump System" />
          <Field label="Front-end price" value={stack.frontEnd.price} onChange={(v) => setFrontEndField('price', v)} placeholder="$27" />
          <Field label="Original / anchor price" value={stack.frontEnd.originalPrice} onChange={(v) => setFrontEndField('originalPrice', v)} placeholder="$97" />
          <Field label="Promise" value={stack.frontEnd.promise} onChange={(v) => setFrontEndField('promise', v)} placeholder="Clear your mental load in one weekend" />
        </div>
        <Area
          label="Deliverables (one per line)"
          value={listToLines(stack.frontEnd.deliverables)}
          onChange={(v) => setFrontEndField('deliverables', linesToList(v))}
          rows={4}
        />

        {/* Bonuses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-bone/50 font-semibold">Bonuses</div>
            <button type="button" onClick={addBonus} className={btnGhost}>+ Bonus</button>
          </div>
          {stack.bonuses.length === 0 && <p className="text-xs text-bone/40">No bonuses yet. AI fill or add manually.</p>}
          {stack.bonuses.map((b, i) => (
            <div key={i} className="rounded-lg border border-bone/10 bg-ink/40 p-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <Field label="Title" value={b.title} onChange={(v) => updateBonus(i, { title: v })} placeholder="Partner Scripts Pack" />
                <Field label="Value" value={b.value} onChange={(v) => updateBonus(i, { value: v })} placeholder="$47" />
                <div className="flex min-w-0 items-end">
                  <button type="button" onClick={() => removeBonus(i)} className={btnDanger}>Remove</button>
                </div>
              </div>
              <Area label="Description" value={b.description} onChange={(v) => updateBonus(i, { description: v })} rows={2} />
            </div>
          ))}
        </div>

        {/* Bumps */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-bone/50 font-semibold">Order bumps (checkout)</div>
            <button type="button" onClick={addBump} className={btnGhost}>+ Bump</button>
          </div>
          {stack.bumps.length === 0 && <p className="text-xs text-bone/40">No bumps yet. AI fill or add manually.</p>}
          {stack.bumps.map((b, i) => (
            <div key={i} className="rounded-lg border border-bone/10 bg-ink/40 p-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Id" value={b.id} onChange={(v) => updateBump(i, { id: v })} placeholder="bump_scripts" />
                <Field label="Title" value={b.title} onChange={(v) => updateBump(i, { title: v })} placeholder="Script Vault" />
                <Field label="Price" value={b.price} onChange={(v) => updateBump(i, { price: v })} placeholder="$17" />
                <div className="flex min-w-0 items-end">
                  <button type="button" onClick={() => removeBump(i)} className={btnDanger + ' w-full'}>Remove</button>
                </div>
              </div>
              <Area label="Description" value={b.description} onChange={(v) => updateBump(i, { description: v })} rows={2} />
            </div>
          ))}
        </div>

        {/* Upsells */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-bone/50 font-semibold">Upsells (1–4)</div>
          {stack.upsells.map((u) => (
            <div key={u.slot} className="rounded-lg border border-bone/10 bg-ink/40 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-bone">Upsell {u.slot}</div>
                <label className="flex items-center gap-2 text-xs text-bone/60">
                  <input
                    type="checkbox"
                    checked={u.enabled}
                    onChange={(e) => updateUpsell(u.slot, { enabled: e.target.checked })}
                    className="rounded border-bone/30"
                  />
                  Enabled
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Name" value={u.name} onChange={(v) => updateUpsell(u.slot, { name: v, enabled: true })} placeholder={u.slot === 1 ? 'Clearing Room' : 'Upsell name'} />
                <Field label="Price" value={u.price} onChange={(v) => updateUpsell(u.slot, { price: v })} placeholder={u.slot === 1 ? '$97/mo' : '$297'} />
                <Field label="Promise" value={u.promise} onChange={(v) => updateUpsell(u.slot, { promise: v })} placeholder="What they get / outcome" />
                <div className="min-w-0">
                  <label className={labelClass}>Billing</label>
                  <select
                    className={selectClass}
                    value={u.billingType}
                    onChange={(e) => updateUpsell(u.slot, { billingType: e.target.value as OfferStackUpsell['billingType'] })}
                  >
                    <option value="one_time">One-time</option>
                    <option value="subscription">Subscription</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Collapse>

      {/* ---- Links (was its own tab) ---- */}
      <Collapse
        title="Links & integrations"
        hint="Optional hooks into the rest of MotherMode. Success CTA falls back to offer slug, then /mothermode."
      >
        <Field label="Offer slug (/mothermode/[slug])" value={offerSlug} onChange={setOfferSlug} placeholder="brain-dump" />
        <Field label="Lead Gen kit slug" value={leadGenSlug} onChange={setLeadGenSlug} placeholder="optional" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Deliverable slug" value={deliverableSlug} onChange={setDeliverableSlug} />
          <Field label="Deliverable key" value={deliverableKey} onChange={setDeliverableKey} />
        </div>
        <Field label="Stripe product ID" value={productId} onChange={setProductId} placeholder="prod_" />
      </Collapse>
    </section>
  );
}
