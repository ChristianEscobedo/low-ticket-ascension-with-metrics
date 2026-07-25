'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiGenerateImage } from '@/components/mothermode/content/aiClient';
import type {
  AutobuildPlanRow,
  AutobuildResultRow,
} from '@/components/mothermode/sales/EmailKitAutobuildPanel';
import { sequenceTotals } from '@/lib/mothermode/email/analytics';

import {
  defaultMotherModeSalesOptin,
  defaultMotherModeSalesPage,
  defaultMotherModeVsl,
  defaultMotherModeCheckout,
  defaultMotherModeUpsell1,
  defaultMotherModeUpsell2,
  defaultMotherModeUpsell3,
  defaultMotherModeUpsell4,
  defaultMotherModeSuccess,
  defaultMotherModeAccess,
  defaultMotherModeSalesFooter,
} from '@/lib/mothermode/sales/defaults';
import {
  SALES_FUNNEL_STATUSES,
  salesOptinRate,
  checkoutCompletionRate,
  upsellTakeRate,
  revenueDollars,
  slugifySalesName,
  SALES_EMAIL_EVENTS,
  SALES_EMAIL_EVENT_LABELS,
  type SalesEmailEvent,
  type SalesEmailKitBinding,
  type SalesFooterContent,
  type SalesFunnelRecord,
  type SalesFunnelStatus,
  type SalesLeadRecord,
  type SalesOptinContent,
  type SalesPageContent,
  type VslPageContent,
  type CheckoutContent,
  type UpsellContent,
  type SuccessContent,
  type AccessContent,
} from '@/lib/mothermode/sales/types';
import {
  blankSalesAiIntake,
  normalizeSalesAiIntake,
  syncIntakeStack,
  type OfferStack,
  type OfferStackBonus,
  type OfferStackBump,
  type OfferStackUpsell,
  type SalesAiIntake,
} from '@/lib/mothermode/sales/aiIntake';
import UpsellTab from './parts/UpsellTab';
import SalesTab from './parts/SalesTab';
import OfferTab from './parts/OfferTab';
import LeadsTab from './parts/LeadsTab';
import ChromeTab from './parts/ChromeTab';
import { StatChip } from './parts/ui';
import EmailsTab from './parts/EmailsTab';
import EmailStatsTab, { type EmailStatsRow } from './parts/EmailStatsTab';
import { OptinTab, VslTab, CheckoutTab, SuccessTab, AccessTab } from './parts/PageTabs';

const CRUD_URL = '/api/admin/mothermode-sales';
const EMAIL_KITS_URL = '/api/mothermode/sales-email-kits';
const EMAIL_STATS_URL = '/api/admin/mothermode-email/stats';
const AI_URL = '/api/mothermode/sales-ai';

interface Props {
  initialFunnels: SalesFunnelRecord[];
  initialLeads: SalesLeadRecord[];
  emailKits?: { id: string; slug: string; name: string; status: string }[];
}

type Busy =
  | null
  | 'save'
  | 'delete'
  | 'loadDefaults'
  | 'generate'
  | 'generatePage'
  | 'generateImages'
  | 'fillIntake'
  | 'createMagnet'
  | 'duplicate';

type Tab = 'build' | 'optin' | 'sales' | 'vsl' | 'checkout' | 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4' | 'success' | 'access' | 'footer' | 'leads' | 'emails' | 'emailStats';

const inputClass = 'w-full rounded-lg bg-ink/40 border border-bone/15 px-3 py-2 text-sm text-bone placeholder-bone/30 focus:outline-none focus:border-brass/40';
const labelClass = 'block text-xs uppercase tracking-wide text-bone/50 mb-1';
const btn = 'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = btn + ' bg-brass/[0.14] text-brass border border-brass/30 hover:bg-brass/20';
const btnGhost = btn + ' text-bone/60 border border-bone/15 hover:text-bone hover:bg-bone/[0.05]';
const btnDanger = btn + ' text-red-300/80 border border-red-400/20 hover:bg-red-500/10';

function linesToList(text: string): string[] { return text.split('\n').map((s) => s.trim()).filter(Boolean); }
function listToLines(list: string[]): string { return list.join('\n'); }

/** One selectable lead-gen kit, flattened for the picker. */
interface LeadMagnetOption {
  id: string;
  slug: string;
  name: string;
  status: string;
  title: string;
  subtitle: string;
}

/** Flatten a lead-gen kit row/record into a picker option. Tolerates partials. */
function magnetOptionFromRow(raw: unknown): LeadMagnetOption {
  const r = (raw ?? {}) as Record<string, unknown>;
  const doc = (r.doc ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    slug: String(r.slug ?? ''),
    name: String(r.name ?? ''),
    status: String(r.status ?? ''),
    title: String(doc.title ?? ''),
    subtitle: String(doc.subtitle ?? ''),
  };
}

export default function SalesFunnelEditor({ initialFunnels, initialLeads, emailKits = [] }: Props) {
  const [funnels, setFunnels] = useState<SalesFunnelRecord[]>(initialFunnels);
  const [leads] = useState<SalesLeadRecord[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('build');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<SalesFunnelStatus>('draft');
  const [offerSlug, setOfferSlug] = useState('brain-dump-system');
  const [leadGenSlug, setLeadGenSlug] = useState('');
  const [deliverableSlug, setDeliverableSlug] = useState('');
  const [deliverableKey, setDeliverableKey] = useState('');
  const [emailKitId, setEmailKitId] = useState('');
  const [emailKitsMap, setEmailKitsMap] = useState<Partial<Record<SalesEmailEvent, string>>>({});
  const [productId, setProductId] = useState('');
  const [viewCount, setViewCount] = useState(0);
  const [conversionCount, setConversionCount] = useState(0);
  const [checkoutCount, setCheckoutCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [revenueCents, setRevenueCents] = useState(0);
  const [optin, setOptin] = useState<SalesOptinContent>(defaultMotherModeSalesOptin());
  const [sales, setSales] = useState<SalesPageContent>(defaultMotherModeSalesPage());
  const [vsl, setVsl] = useState<VslPageContent>(defaultMotherModeVsl());
  const [checkout, setCheckout] = useState<CheckoutContent>(defaultMotherModeCheckout());
  const [upsell1, setUpsell1] = useState<UpsellContent>(defaultMotherModeUpsell1());
  const [upsell2, setUpsell2] = useState<UpsellContent>(defaultMotherModeUpsell2());
  const [upsell3, setUpsell3] = useState<UpsellContent>(defaultMotherModeUpsell3());
  const [upsell4, setUpsell4] = useState<UpsellContent>(defaultMotherModeUpsell4());
  const [successBlock, setSuccessBlock] = useState<SuccessContent>(defaultMotherModeSuccess());
  const [access, setAccess] = useState<AccessContent>(defaultMotherModeAccess());
  const [footer, setFooter] = useState<SalesFooterContent>(defaultMotherModeSalesFooter());
  const [intake, setIntake] = useState<SalesAiIntake>(blankSalesAiIntake());
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnetOption[]>([]);
  const [leadMagnetId, setLeadMagnetId] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const publicUrl = useMemo(() => (slug ? '/funnel/' + slugifySalesName(slug) : ''), [slug]);

  function bindingsFromMap(map: Partial<Record<SalesEmailEvent, string>>): SalesEmailKitBinding[] {
    return SALES_EMAIL_EVENTS
      .map((event) => ({ event, emailKitId: (map[event] || '').trim() }))
      .filter((b) => Boolean(b.emailKitId));
  }

  function mapFromBindings(bindings: SalesEmailKitBinding[] | undefined | null, fallbackOptinId?: string | null): Partial<Record<SalesEmailEvent, string>> {
    const map: Partial<Record<SalesEmailEvent, string>> = {};
    for (const b of bindings || []) {
      if (b?.event && b?.emailKitId) map[b.event] = b.emailKitId;
    }
    if (!map.optin && fallbackOptinId) map.optin = fallbackOptinId;
    return map;
  }

  /**
   * Adopt bindings the autobuild route already wrote to the funnel row. Without
   * this the next "Save" would post the stale map and unbind the fresh kits.
   */
  // --- Emails group state ---------------------------------------------------
  // Both email tabs unmount on every nav switch, so their state lives up here.
  // Autobuild runs for a while server-side: keeping the run state in the tab
  // would throw away the only UI able to report what a still-running job did.
  const [autobuildPlans, setAutobuildPlans] = useState<AutobuildPlanRow[] | null>(null);
  const [autobuildPlanError, setAutobuildPlanError] = useState<string | null>(null);
  const [autobuildBusy, setAutobuildBusy] = useState<SalesEmailEvent | 'all' | null>(null);
  const [autobuildResults, setAutobuildResults] = useState<AutobuildResultRow[]>([]);
  const [autobuildNotice, setAutobuildNotice] = useState<string | null>(null);
  const [emailStatsRows, setEmailStatsRows] = useState<EmailStatsRow[] | null>(null);
  const [emailStatsBusy, setEmailStatsBusy] = useState(false);
  const [emailStatsError, setEmailStatsError] = useState<string | null>(null);

  // A different funnel means different kits: drop both caches so the next
  // visit reads fresh instead of showing the previous funnel's numbers.
  useEffect(() => {
    setAutobuildPlans(null); setAutobuildPlanError(null);
    setAutobuildResults([]); setAutobuildNotice(null);
    setEmailStatsRows(null); setEmailStatsError(null);
  }, [selectedId]);

  const loadAutobuildPlan = useCallback(async (funnelId: string) => {
    try {
      const res = await fetch(EMAIL_KITS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'plan', funnelId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to read the funnel');
      setAutobuildPlans(Array.isArray(json.plans) ? json.plans : []);
    } catch (e) {
      setAutobuildPlanError(e instanceof Error ? e.message : 'Failed to read the funnel');
      setAutobuildPlans([]);
    }
  }, []);

  // Lazy: the plan POST only fires once the Kits tab is opened, and never
  // while results are already loaded (that would clobber a finished run).
  useEffect(() => {
    if (tab !== 'emails' || !selectedId) return;
    if (autobuildPlans !== null || autobuildPlanError) return;
    void loadAutobuildPlan(selectedId);
  }, [tab, selectedId, autobuildPlans, autobuildPlanError, loadAutobuildPlan]);

  async function onAutobuild(events?: SalesEmailEvent[], onlyMissing = false) {
    if (!selectedId) return;
    setAutobuildBusy(events && events.length === 1 ? events[0] : 'all');
    setAutobuildNotice(null);
    try {
      const res = await fetch(EMAIL_KITS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate', funnelId: selectedId, events, onlyMissing }),
      });
      const json = await res.json();
      const results: AutobuildResultRow[] = Array.isArray(json?.results) ? json.results : [];
      // Merge, so re-running one event keeps the other rows on screen.
      setAutobuildResults((prev) => [
        ...prev.filter((p) => !results.some((r) => r.event === p.event)),
        ...results,
      ]);
      if (!res.ok || (!json?.success && results.length === 0)) {
        throw new Error(json?.error || json?.message || 'Generation failed');
      }
      const bound: Partial<Record<SalesEmailEvent, string>> = {};
      for (const r of results) if (r.ok && r.kitId) bound[r.event] = r.kitId;
      if (Object.keys(bound).length) adoptGeneratedKits(bound);
      setAutobuildNotice(
        json?.message ||
          'Built ' + (json?.built ?? 0) + ' sequence(s)' + (json?.failed ? ', ' + json.failed + ' failed' : '') + '. Save the funnel to keep the bindings.',
      );
      // Bindings moved, so the plan's alreadyBound flags and the stats rows
      // are both stale; null makes the next tab visit refetch.
      setAutobuildPlans(null); setEmailStatsRows(null);
    } catch (e) {
      setAutobuildNotice(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setAutobuildBusy(null);
    }
  }

  async function loadEmailStats() {
    const bound = SALES_EMAIL_EVENTS
      .map((event) => ({ event, kitId: emailKitsMap[event] || (event === 'optin' ? emailKitId : '') }))
      .filter((b) => Boolean(b.kitId));
    if (bound.length === 0) { setEmailStatsRows([]); setEmailStatsError(null); return; }
    setEmailStatsBusy(true); setEmailStatsError(null);
    try {
      const rows = await Promise.all(
        bound.map(async ({ event, kitId }) => {
          const res = await fetch(EMAIL_STATS_URL + '?kitId=' + encodeURIComponent(kitId));
          const json = await res.json();
          if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to read stats');
          // A kit no provider has ever posted for has no stored row; treat
          // that as zeroes rather than an error.
          const stats = json.stats && json.stats.byEmail ? json.stats : { kitId, byEmail: {}, updatedAt: null };
          const totals = sequenceTotals(stats);
          const row: EmailStatsRow = {
            event,
            eventLabel: SALES_EMAIL_EVENT_LABELS[event],
            kitId,
            kitName: emailKits.find((k) => k.id === kitId)?.name || kitId,
            sent: totals.sent,
            delivered: totals.delivered,
            opened: totals.opened,
            clicked: totals.clicked,
            unsubscribed: totals.unsubscribed,
            bounced: totals.bounced,
            revenue: totals.revenue,
            updatedAt: stats.updatedAt ?? null,
          };
          return row;
        }),
      );
      setEmailStatsRows(rows);
    } catch (e) {
      setEmailStatsError(e instanceof Error ? e.message : 'Failed to read stats');
      setEmailStatsRows([]);
    } finally {
      setEmailStatsBusy(false);
    }
  }

  // One request per bound kit is too much to pay on every editor load, so
  // analytics is fetched when its tab is opened and cached until it changes.
  useEffect(() => {
    if (tab !== 'emailStats') return;
    if (emailStatsRows !== null || emailStatsBusy) return;
    void loadEmailStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, emailStatsRows, emailStatsBusy]);
  function adoptGeneratedKits(bound: Partial<Record<SalesEmailEvent, string>>) {
    setEmailKitsMap((prev) => ({ ...prev, ...bound }));
    if (bound.optin) setEmailKitId(bound.optin);
  }

  function setKitForEvent(event: SalesEmailEvent, kitId: string) {

    setEmailKitsMap((prev) => {
      const next = { ...prev };
      if (!kitId) delete next[event];
      else next[event] = kitId;
      return next;
    });
    if (event === 'optin') setEmailKitId(kitId);
  }

  function resetToNew() {
    setSelectedId(null); setName(''); setSlug(''); setStatus('draft');
    setOfferSlug('brain-dump-system'); setLeadGenSlug(''); setDeliverableSlug(''); setDeliverableKey('');
    setEmailKitId(''); setEmailKitsMap({}); setProductId(''); setViewCount(0); setConversionCount(0);
    setCheckoutCount(0); setPurchaseCount(0); setRevenueCents(0);
    setOptin(defaultMotherModeSalesOptin()); setSales(defaultMotherModeSalesPage());
    setVsl(defaultMotherModeVsl()); setCheckout(defaultMotherModeCheckout());
    setUpsell1(defaultMotherModeUpsell1()); setUpsell2(defaultMotherModeUpsell2());
    setUpsell3(defaultMotherModeUpsell3()); setUpsell4(defaultMotherModeUpsell4());
    setSuccessBlock(defaultMotherModeSuccess()); setAccess(defaultMotherModeAccess());
    setFooter(defaultMotherModeSalesFooter()); setIntake(blankSalesAiIntake());
    setSlugTouched(false); setError(null); setNotice(null); setTab('build');
  }

  function loadFunnel(f: SalesFunnelRecord) {
    setSelectedId(f.id); setName(f.name); setSlug(f.slug); setStatus(f.status);
    setOfferSlug(f.offerSlug ?? ''); setLeadGenSlug(f.leadGenSlug ?? '');
    setDeliverableSlug(f.deliverableSlug ?? ''); setDeliverableKey(f.deliverableKey ?? '');
    setEmailKitId(f.emailKitId ?? ''); setEmailKitsMap(mapFromBindings(f.emailKits, f.emailKitId)); setProductId(f.productId ?? '');
    setViewCount(f.viewCount); setConversionCount(f.conversionCount);
    setCheckoutCount(f.checkoutCount); setPurchaseCount(f.purchaseCount);
    setRevenueCents(f.revenueCents); setOptin(f.optin); setSales(f.sales);
    setVsl(f.vsl); setCheckout(f.checkout); setUpsell1(f.upsell1); setUpsell2(f.upsell2);
    setUpsell3(f.upsell3); setUpsell4(f.upsell4); setSuccessBlock(f.success);
    setAccess(f.access); setFooter(f.footer); setSlugTouched(true);
    setError(null); setNotice(null); setTab('build');
  }

  function setOptinField<K extends keyof SalesOptinContent>(key: K, value: SalesOptinContent[K]) { setOptin((prev) => ({ ...prev, [key]: value })); }

  // ---- Lead magnet linking ------------------------------------------------
  /** Load lead-gen kits for the picker. Non-fatal: the picker just stays empty. */
  async function loadLeadMagnets() {
    try {
      const res = await fetch('/api/admin/mothermode-leadgen');
      const json = await res.json();
      if (!json?.success) return;
      const items: unknown[] = Array.isArray(json.items) ? json.items : [];
      setLeadMagnets(items.map(magnetOptionFromRow).filter((m) => m.id));
    } catch {
      /* picker is optional */
    }
  }

  useEffect(() => { void loadLeadMagnets(); }, []);

  // Keep the picker in sync when a funnel with an existing kit slug is loaded.
  useEffect(() => {
    if (!leadGenSlug) { setLeadMagnetId(''); return; }
    const found = leadMagnets.find((m) => m.slug === leadGenSlug);
    setLeadMagnetId(found ? found.id : '');
  }, [leadGenSlug, leadMagnets]);

  /** Copy a magnet's identity into the funnel's optin + brief. Never forks copy. */
  function applyLeadMagnet(m: LeadMagnetOption) {
    const title = m.title || m.name;
    setLeadGenSlug(m.slug);
    setIntake((prev) => ({
      ...prev,
      leadGenSlug: m.slug,
      magnetName: title || prev.magnetName,
      magnetPromise: m.subtitle || prev.magnetPromise,
    }));
    setOptin((prev) => ({
      ...prev,
      magnetTitle: title || prev.magnetTitle,
      magnetDescription: m.subtitle || prev.magnetDescription,
    }));
  }

  function onPickLeadMagnet(id: string) {
    setLeadMagnetId(id);
    if (!id) return;
    const found = leadMagnets.find((m) => m.id === id);
    if (!found) return;
    applyLeadMagnet(found);
    setNotice('Linked lead magnet "' + (found.title || found.name) + '". Save to persist.');
  }

  /** AI-generate a lead-gen kit from this funnel's brief, save it, then link it. */
  async function onCreateLeadMagnet() {
    setBusy('createMagnet');
    setError(null);
    setNotice(null);
    try {
      const magnetName = intake.magnetName || stack.frontEnd.name || name || 'Lead magnet';
      const paidName = stack.frontEnd.name || intake.offerName || 'the paid offer';
      const leadIntake = {
        topic: intake.magnetName || intake.niche,
        audience: intake.audience,
        goal: 'Free opt-in magnet that leads into ' + paidName,
        transformation: intake.magnetPromise || stack.frontEnd.promise,
        length: 'standard',
        tone: intake.toneNotes,
        cta: 'Get ' + paidName,
        offerSlug,
        notes: intake.pain ? 'Core pain: ' + intake.pain : '',
      };

      const genRes = await fetch('/api/mothermode/leadgen-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', intake: leadIntake, format: 'guide' }),
      });
      const genJson = await genRes.json();
      if (!genRes.ok || !genJson?.success) {
        throw new Error(genJson?.error || 'Lead magnet generation failed');
      }

      const magnetSlug = slugifySalesName(magnetName) || 'lead-magnet';
      const saveRes = await fetch('/api/admin/mothermode-leadgen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          slug: magnetSlug,
          name: magnetName,
          format: 'guide',
          status: 'draft',
          intake: leadIntake,
          doc: genJson.doc,
        }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok || !saveJson?.success) {
        throw new Error(saveJson?.error || 'Lead magnet save failed');
      }

      const created = magnetOptionFromRow(saveJson.item);
      setLeadMagnets((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
      setLeadMagnetId(created.id);
      applyLeadMagnet(created);
      setNotice(
        'Created and linked "' + (created.title || created.name) +
        '". Edit it in Lead Gen; save this funnel to persist the link.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lead magnet creation failed');
    } finally {
      setBusy(null);
    }
  }
  function setSalesField<K extends keyof SalesPageContent>(key: K, value: SalesPageContent[K]) { setSales((prev) => ({ ...prev, [key]: value })); }
  function setVslField<K extends keyof VslPageContent>(key: K, value: VslPageContent[K]) { setVsl((prev) => ({ ...prev, [key]: value })); }
  function setCheckoutField<K extends keyof CheckoutContent>(key: K, value: CheckoutContent[K]) { setCheckout((prev) => ({ ...prev, [key]: value })); }
  function setUpsell1Field<K extends keyof UpsellContent>(key: K, value: UpsellContent[K]) { setUpsell1((prev) => ({ ...prev, [key]: value })); }
  function setUpsell2Field<K extends keyof UpsellContent>(key: K, value: UpsellContent[K]) { setUpsell2((prev) => ({ ...prev, [key]: value })); }
  function setUpsell3Field<K extends keyof UpsellContent>(key: K, value: UpsellContent[K]) { setUpsell3((prev) => ({ ...prev, [key]: value })); }
  function setUpsell4Field<K extends keyof UpsellContent>(key: K, value: UpsellContent[K]) { setUpsell4((prev) => ({ ...prev, [key]: value })); }
  function setSuccessField<K extends keyof SuccessContent>(key: K, value: SuccessContent[K]) { setSuccessBlock((prev) => ({ ...prev, [key]: value })); }
  function setAccessField<K extends keyof AccessContent>(key: K, value: AccessContent[K]) { setAccess((prev) => ({ ...prev, [key]: value })); }
  function setFooterField<K extends keyof SalesFooterContent>(key: K, value: SalesFooterContent[K]) { setFooter((prev) => ({ ...prev, [key]: value })); }

  async function onSave() {
    setBusy('save'); setError(null); setNotice(null);
    try {
      const res = await fetch(CRUD_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save', id: selectedId, name, slug, status, offerSlug, leadGenSlug, deliverableSlug, deliverableKey, emailKitId: emailKitId || emailKitsMap.optin || null, emailKits: bindingsFromMap(emailKitsMap), productId: productId || null, optin, sales, vsl, checkout, upsell1, upsell2, upsell3, upsell4, successBlock, access, footer }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Save failed (HTTP ' + res.status + ')');
      const item = data.item as SalesFunnelRecord;
      setFunnels((prev) => { const rest = prev.filter((f) => f.id !== item.id); return [item, ...rest]; });
      setSelectedId(item.id); setSlug(item.slug); setEmailKitId(item.emailKitId ?? ''); setEmailKitsMap(mapFromBindings(item.emailKits, item.emailKitId));
      setViewCount(item.viewCount); setConversionCount(item.conversionCount);
      setCheckoutCount(item.checkoutCount); setPurchaseCount(item.purchaseCount);
      setRevenueCents(item.revenueCents);
      setNotice(status === 'published' ? 'Saved and published.' : 'Saved as draft.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); } finally { setBusy(null); }
  }

  async function onDuplicate() {
    if (!selectedId) return; setBusy('duplicate'); setError(null); setNotice(null);
    try {
      const res = await fetch(CRUD_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'duplicate', id: selectedId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Duplicate failed');
      const item = data.item as SalesFunnelRecord;
      setFunnels((prev) => [item, ...prev]); loadFunnel(item);
      setNotice('Duplicated as draft. Edit slug/name and save.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Duplicate failed'); } finally { setBusy(null); }
  }

  function exportLeadsCsv() {
    const rows = selectedId ? leads.filter((l) => l.funnelId === selectedId) : leads;
    const header = ['email', 'first_name', 'funnel', 'status', 'step_reached', 'purchased', 'utm_source', 'utm_medium', 'utm_campaign', 'created_at'];
    const lines = [header.join(',')];
    for (const l of rows) {
      const cells = [l.email, l.firstName || '', l.funnelSlug || l.funnelName || '', l.status, l.stepReached, l.purchased ? 'yes' : 'no', l.utmSource || '', l.utmMedium || '', l.utmCampaign || '', l.createdAt].map((c) => '"' + String(c).replace(/"/g, '""') + '"');
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'sales-funnel-leads-' + (slug || 'all') + '.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const checklist = useMemo(() => [
    { ok: Boolean(slug.trim()), label: 'Slug set' },
    { ok: Boolean(optin.headline.trim()), label: 'Optin headline' },
    { ok: Boolean(sales.headline.trim()), label: 'Sales headline' },
    { ok: Boolean(checkout.priceLabel.trim()), label: 'Checkout price' },
    { ok: Boolean(checkout.priceCents > 0), label: 'Checkout price (cents)' },
    { ok: Boolean(successBlock.headline.trim()), label: 'Success headline' },
    { ok: Boolean(access.headline.trim()), label: 'Access headline' },
    { ok: Boolean(footer.disclaimer.trim()), label: 'Footer disclaimer' },
    { ok: Boolean(emailKitId || emailKitsMap.optin || Object.keys(emailKitsMap).length), label: 'Email kit linked (optional but recommended)' },
  ], [slug, optin.headline, sales.headline, checkout.priceLabel, checkout.priceCents, successBlock.headline, access.headline, footer.disclaimer, emailKitId, emailKitsMap]);

  const optinRate = salesOptinRate(viewCount, conversionCount);
  const checkoutRate = checkoutCompletionRate(checkoutCount, purchaseCount);
  const selected = funnels.find((f) => f.id === selectedId);
  const upsell1Rate = upsellTakeRate(selected?.upsell1Yes ?? 0, selected?.upsell1No ?? 0);

  async function onDelete() {
    if (!selectedId) return; if (!confirm('Delete this funnel and its leads?')) return;
    setBusy('delete'); setError(null);
    try {
      const res = await fetch(CRUD_URL + '?id=' + encodeURIComponent(selectedId), { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Delete failed');
      setFunnels((prev) => prev.filter((f) => f.id !== selectedId)); resetToNew(); setNotice('Deleted.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); } finally { setBusy(null); }
  }

  function loadDefaults() {
    setBusy('loadDefaults');
    setOptin(defaultMotherModeSalesOptin()); setSales(defaultMotherModeSalesPage());
    setVsl(defaultMotherModeVsl()); setCheckout(defaultMotherModeCheckout());
    setUpsell1(defaultMotherModeUpsell1()); setUpsell2(defaultMotherModeUpsell2());
    setUpsell3(defaultMotherModeUpsell3()); setUpsell4(defaultMotherModeUpsell4());
    setSuccessBlock(defaultMotherModeSuccess()); setAccess(defaultMotherModeAccess());
    setFooter(defaultMotherModeSalesFooter());
    if (!name) setName('Brain Dump Sales Funnel');
    if (!slug) { setSlug('brain-dump-sales'); setSlugTouched(true); }
    if (!offerSlug) setOfferSlug('brain-dump-system');
    setNotice('Loaded MotherMode default copy. Edit and save.'); setBusy(null);
  }

  async function onFillIntake() {
    setBusy('fillIntake'); setError(null); setNotice(null);
    try {
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'fillIntake', intake }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Fill intake failed (HTTP ' + res.status + ')');
      const next = normalizeSalesAiIntake(data.intake);
      setIntake(next);
      if (next.offerName && !name.trim()) setName(next.offerName + ' Funnel');
      if (next.offerName && !offerSlug.trim()) setOfferSlug(slugifySalesName(next.offerName));
      if (next.leadGenSlug && !leadGenSlug.trim()) setLeadGenSlug(next.leadGenSlug);
      setNotice('AI filled the brief + offer stack. Edit the stack, then Generate funnel.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fill intake failed');
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate() {
    setBusy('generate'); setError(null); setNotice(null);
    try {
      const synced = syncIntakeStack(intake);
      setIntake(synced);
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate', intake: synced }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Generate failed (HTTP ' + res.status + ')');
      if (data.optin) setOptin(data.optin);
      if (data.sales) setSales(data.sales);
      if (data.vsl) setVsl(data.vsl);
      if (data.checkout) setCheckout(data.checkout);
      if (data.upsell1) setUpsell1(data.upsell1);
      if (data.upsell2) setUpsell2(data.upsell2);
      if (data.upsell3) setUpsell3(data.upsell3);
      if (data.upsell4) setUpsell4(data.upsell4);
      if (data.successBlock) setSuccessBlock(data.successBlock);
      if (data.access) setAccess(data.access);
      if (typeof data.name === 'string' && data.name.trim()) {
        setName(data.name.trim());
        if (!slugTouched && typeof data.slugHint === 'string') setSlug(slugifySalesName(data.slugHint || data.name));
      } else if (!slugTouched && typeof data.slugHint === 'string' && data.slugHint) {
        setSlug(slugifySalesName(data.slugHint));
      }
      const feName = synced.offerStack?.frontEnd?.name || synced.offerName;
      if (feName && !offerSlug) setOfferSlug(slugifySalesName(feName));
      setTab('optin');
      setNotice('AI filled all 10 blocks from your offer stack. Review, then save.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setBusy(null);
    }
  }


  async function onGeneratePage(page: 'optin' | 'sales' | 'vsl' | 'checkout' | 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4' | 'success' | 'access') {
    setBusy('generatePage'); setError(null); setNotice(null);
    try {
      const synced = syncIntakeStack(intake);
      setIntake(synced);
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generatePage', page, intake: synced }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Page generate failed (HTTP ' + res.status + ')');
      const content = data.content;
      if (!content) throw new Error('No content returned for ' + page);
      if (page === 'optin') setOptin(content);
      else if (page === 'sales') setSales(content);
      else if (page === 'vsl') setVsl(content);
      else if (page === 'checkout') setCheckout(content);
      else if (page === 'upsell1') setUpsell1(content);
      else if (page === 'upsell2') setUpsell2(content);
      else if (page === 'upsell3') setUpsell3(content);
      else if (page === 'upsell4') setUpsell4(content);
      else if (page === 'success') setSuccessBlock(content);
      else if (page === 'access') setAccess(content);
      setNotice('Regenerated ' + page + ' from offer stack. Review, then save.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Page generate failed');
    } finally {
      setBusy(null);
    }
  }

  /** Fill every empty image slot across the funnel in one AI pass. */
  async function onGenerateImages() {
    const subject = stack.frontEnd.name || intake.offerName || sales.name || 'digital offer';
    const niche = intake.niche || sales.category || 'online business';
    const audience = intake.audience || sales.audience || 'busy founders';
    const base =
      'Premium editorial product visual for "' +
      subject +
      '", a ' +
      niche +
      ' offer for ' +
      audience +
      '. Warm dark background, brass and bone palette, calm luxury, no text.';

    type ImageSlot = { label: string; current: string; prompt: string; apply: (url: string) => void };
    const slots: ImageSlot[] = [
      {
        label: 'Optin cover',
        current: optin.coverImageUrl || '',
        prompt: base + ' Lead magnet cover mockup for "' + (optin.magnetTitle || intake.magnetName || subject) + '".',
        apply: (url) => setOptinField('coverImageUrl', url),
      },
      {
        label: 'Sales hero',
        current: sales.heroImageUrl || '',
        prompt: base + ' Wide hero image, product in context, aspirational and quiet.',
        apply: (url) => setSalesField('heroImageUrl', url),
      },
      {
        label: 'Founder photo',
        current: sales.founderPhotoUrl || '',
        prompt: base + ' Editorial portrait-style brand image for the founder note section, soft light, no text.',
        apply: (url) => setSalesField('founderPhotoUrl', url),
      },
      {
        label: 'Checkout product',
        current: checkout.productImageUrl || '',
        prompt: base + ' Compact product thumbnail on a clean surface, order-summary style.',
        apply: (url) => setCheckoutField('productImageUrl', url),
      },
      {
        label: 'Upsell 1 product',
        current: upsell1.imageUrl || '',
        prompt: base + ' Upsell product mockup for "' + (upsell1.productName || upsell1.headline || 'upgrade') + '".',
        apply: (url) => setUpsell1Field('imageUrl', url),
      },
      {
        label: 'Upsell 2 product',
        current: upsell2.imageUrl || '',
        prompt: base + ' Upsell product mockup for "' + (upsell2.productName || upsell2.headline || 'upgrade') + '".',
        apply: (url) => setUpsell2Field('imageUrl', url),
      },
      {
        label: 'Upsell 3 product',
        current: upsell3.imageUrl || '',
        prompt: base + ' Upsell product mockup for "' + (upsell3.productName || upsell3.headline || 'upgrade') + '".',
        apply: (url) => setUpsell3Field('imageUrl', url),
      },
      {
        label: 'Upsell 4 product',
        current: upsell4.imageUrl || '',
        prompt: base + ' Upsell product mockup for "' + (upsell4.productName || upsell4.headline || 'upgrade') + '".',
        apply: (url) => setUpsell4Field('imageUrl', url),
      },
    ];

    const pending = slots.filter((s) => !s.current.trim());
    if (pending.length === 0) {
      setError(null);
      setNotice('Every image slot already has an image. Clear a URL to regenerate it.');
      return;
    }

    setBusy('generateImages');
    setError(null);
    setNotice('Generating ' + pending.length + ' image' + (pending.length === 1 ? '' : 's') + '…');
    const failed: string[] = [];
    let done = 0;
    for (const slot of pending) {
      try {
        const url = await aiGenerateImage(slot.prompt, 'feed');
        if (url) {
          slot.apply(url);
          done += 1;
        } else {
          failed.push(slot.label);
        }
      } catch {
        failed.push(slot.label);
      }
      setNotice('Generated ' + done + '/' + pending.length + '…');
    }
    setBusy(null);
    if (failed.length) {
      setNotice('Generated ' + done + ' of ' + pending.length + '. Save when ready.');
      setError('Image generation failed for: ' + failed.join(', '));
    } else {
      setNotice('Generated ' + done + ' image' + (done === 1 ? '' : 's') + '. Save to persist.');
    }
  }

  function setIntakeField<K extends keyof SalesAiIntake>(key: K, value: SalesAiIntake[K]) {
    setIntake((prev) => {
      const next = { ...prev, [key]: value };
      // Keep flat offer fields mirrored into stack front-end
      if (key === 'offerName' || key === 'offerPrice') {
        return syncIntakeStack({
          ...next,
          offerStack: {
            ...next.offerStack,
            frontEnd: {
              ...next.offerStack.frontEnd,
              name: key === 'offerName' ? String(value) : next.offerStack.frontEnd.name,
              price: key === 'offerPrice' ? String(value) : next.offerStack.frontEnd.price,
            },
          },
        });
      }
      return next;
    });
  }

  function setStack(updater: (stack: OfferStack) => OfferStack) {
    setIntake((prev) => syncIntakeStack({ ...prev, offerStack: updater(prev.offerStack) }));
  }

  function setFrontEndField<K extends keyof OfferStack['frontEnd']>(key: K, value: OfferStack['frontEnd'][K]) {
    setStack((s) => ({ ...s, frontEnd: { ...s.frontEnd, [key]: value } }));
  }

  function updateBonus(idx: number, patch: Partial<OfferStackBonus>) {
    setStack((s) => ({
      ...s,
      bonuses: s.bonuses.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  }

  function addBonus() {
    setStack((s) => ({
      ...s,
      bonuses: [...s.bonuses, { title: '', description: '', value: '' }],
    }));
  }

  function removeBonus(idx: number) {
    setStack((s) => ({ ...s, bonuses: s.bonuses.filter((_, i) => i !== idx) }));
  }

  function updateBump(idx: number, patch: Partial<OfferStackBump>) {
    setStack((s) => ({
      ...s,
      bumps: s.bumps.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  }

  function addBump() {
    setStack((s) => ({
      ...s,
      bumps: [
        ...s.bumps,
        {
          id: 'bump_' + (s.bumps.length + 1),
          title: '',
          price: '',
          description: '',
          imageUrl: '',
        },
      ],
    }));
  }

  function removeBump(idx: number) {
    setStack((s) => ({ ...s, bumps: s.bumps.filter((_, i) => i !== idx) }));
  }

  function updateUpsell(slot: number, patch: Partial<OfferStackUpsell>) {
    setStack((s) => ({
      ...s,
      upsells: s.upsells.map((u) => (u.slot === slot ? { ...u, ...patch } : u)),
    }));
  }

  const stack = intake.offerStack;

  const PAGE_TABS: { id: Tab; label: string }[] = [
    { id: 'optin', label: 'Opt-in' },
    { id: 'sales', label: 'Sales' },
    { id: 'vsl', label: 'VSL' },
    { id: 'checkout', label: 'Checkout' },
    { id: 'upsell1', label: 'Upsell 1' },
    { id: 'upsell2', label: 'Upsell 2' },
    { id: 'upsell3', label: 'Upsell 3' },
    { id: 'upsell4', label: 'Upsell 4' },
    { id: 'success', label: 'Success' },
    { id: 'access', label: 'Access' },
  ];
  const EMAIL_TABS: { id: Tab; label: string }[] = [
    { id: 'emails', label: 'Kits' },
    { id: 'emailStats', label: 'Analytics' },
  ];
  const GROUPS: { id: string; label: string; tabs: Tab[] }[] = [
    { id: 'offer', label: 'Offer', tabs: ['build'] },
    { id: 'pages', label: 'Pages', tabs: PAGE_TABS.map((t) => t.id) },
    { id: 'emails', label: 'Emails', tabs: EMAIL_TABS.map((t) => t.id) },
    { id: 'chrome', label: 'Chrome', tabs: ['footer'] },
    { id: 'leads', label: 'Leads', tabs: ['leads'] },
  ];
  // `tab` stays the source of truth; the group is derived from it so that
  // handlers jumping straight to a page (onGenerate -> setTab('optin')) still
  // light up the right group with no extra bookkeeping.
  const activeGroup = GROUPS.find((g) => g.tabs.includes(tab)) ?? GROUPS[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <button type="button" onClick={resetToNew} className={btnPrimary + ' w-full'}>+ New funnel</button>
        <div className="rounded-xl border border-bone/10 bg-ink/30 divide-y divide-bone/10 max-h-[70vh] overflow-y-auto">
          {funnels.length === 0 && <div className="p-4 text-sm text-bone/45">No funnels yet. Create one.</div>}
          {funnels.map((f) => (
            <button key={f.id} type="button" onClick={() => loadFunnel(f)} className={'w-full text-left px-3 py-3 transition-colors ' + (selectedId === f.id ? 'bg-brass/[0.12]' : 'hover:bg-bone/[0.04]')}>
              <div className="text-sm font-semibold text-bone truncate">{f.name || f.slug}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-bone/45">
                <span className={f.status === 'published' ? 'text-emerald-400/90' : f.status === 'archived' ? 'text-bone/35' : 'text-brass/80'}>{f.status}</span>
                <span></span><span>{f.conversionCount} leads</span><span></span><span>${revenueDollars(f.revenueCents).toFixed(0)}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-bone/35 truncate">/funnel/{f.slug}</div>
            </button>
          ))}
        </div>
      </aside>
      <div className="space-y-5">
        <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-[0.2em] text-brass/80 font-semibold">{selectedId ? 'Edit funnel' : 'New funnel'}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={loadDefaults} disabled={busy !== null} className={btnGhost}>Load MotherMode defaults</button>
              {selectedId && <button type="button" onClick={onDuplicate} disabled={busy !== null} className={btnGhost}>{busy === 'duplicate' ? 'Duplicating' : 'Duplicate'}</button>}
              {publicUrl && (
                <>
                <a href={publicUrl} target="_blank" rel="noreferrer" className={btnGhost}>Preview optin</a>
                <a href={publicUrl + '/sales'} target="_blank" rel="noreferrer" className={btnGhost}>Sales</a>
                <a href={publicUrl + '/vsl'} target="_blank" rel="noreferrer" className={btnGhost}>VSL</a>
                <a href={publicUrl + '/checkout'} target="_blank" rel="noreferrer" className={btnGhost}>Checkout</a>
                <a href={publicUrl + '/upsell'} target="_blank" rel="noreferrer" className={btnGhost}>Upsell 1</a>
                <a href={publicUrl + '/upsell-2'} target="_blank" rel="noreferrer" className={btnGhost}>Upsell 2</a>
                <a href={publicUrl + '/upsell-3'} target="_blank" rel="noreferrer" className={btnGhost}>Upsell 3</a>
                <a href={publicUrl + '/upsell-4'} target="_blank" rel="noreferrer" className={btnGhost}>Upsell 4</a>
                <a href={publicUrl + '/success'} target="_blank" rel="noreferrer" className={btnGhost}>Success</a>
                <a href={publicUrl + '/access'} target="_blank" rel="noreferrer" className={btnGhost}>Access</a>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelClass}>Name</label><input className={inputClass} value={name} onChange={(e) => { const v = e.target.value; setName(v); if (!slugTouched) setSlug(slugifySalesName(v)); }} placeholder="Brain Dump Sales Funnel" /></div>
            <div><label className={labelClass}>Slug (URL)</label><input className={inputClass} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} placeholder="brain-dump-sales" /></div>
            <div><label className={labelClass}>Status</label><select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as SalesFunnelStatus)}>{SALES_FUNNEL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          {selectedId && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

              <StatChip label="Views" value={String(viewCount)} /><StatChip label="Optins" value={String(conversionCount)} />
              <StatChip label="Optin rate" value={(optinRate * 100).toFixed(1) + '%'} /><StatChip label="Purchases" value={String(purchaseCount)} />
              <StatChip label="Checkout rate" value={(checkoutRate * 100).toFixed(1) + '%'} /><StatChip label="Upsell 1 take" value={(upsell1Rate * 100).toFixed(1) + '%'} />
              <StatChip label="Revenue" value={'$' + revenueDollars(revenueCents).toFixed(2)} />
            </div>
          )}
          <div className="rounded-lg border border-bone/10 bg-ink/40 px-3 py-2">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-bone/45">Publish checklist</div>
            <ul className="grid gap-1 sm:grid-cols-2">{checklist.map((c) => <li key={c.label} className={'text-xs ' + (c.ok ? 'text-emerald-400/90' : 'text-bone/40')}><span className="mr-1">{c.ok ? "[x]" : "[ ]"}</span>{c.label}</li>)}</ul>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={onSave} disabled={busy !== null || !slug.trim()} className={btnPrimary}>{busy === 'save' ? 'Saving' : status === 'published' ? 'Save & publish' : 'Save draft'}</button>
            {selectedId && <button type="button" onClick={onDelete} disabled={busy !== null} className={btnDanger}>{busy === 'delete' ? 'Deleting' : 'Delete'}</button>}
          </div>
          {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
          {notice && <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</div>}
        </section>
        <div className="flex flex-wrap gap-1 border-b border-bone/10 pb-2">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" onClick={() => setTab(g.tabs[0])} className={'rounded-lg px-3 py-1.5 text-sm transition-colors ' + (activeGroup.id === g.id ? 'bg-brass/[0.14] text-brass font-semibold border border-brass/30' : 'text-bone/55 hover:text-bone border border-transparent')}>{g.label}</button>
          ))}
        </div>
        {activeGroup.id === 'pages' && (
          <div className="flex flex-wrap gap-1">
            {PAGE_TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className={'rounded-md px-2.5 py-1 text-xs transition-colors ' + (tab === t.id ? 'bg-bone/10 text-bone font-semibold border border-bone/20' : 'text-bone/45 hover:text-bone/80 border border-transparent')}>{t.label}</button>
            ))}
          </div>
        )}
        {activeGroup.id === 'emails' && (
          <div className="flex flex-wrap gap-1">
            {EMAIL_TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className={'rounded-md px-2.5 py-1 text-xs transition-colors ' + (tab === t.id ? 'bg-bone/10 text-bone font-semibold border border-bone/20' : 'text-bone/45 hover:text-bone/80 border border-transparent')}>{t.label}</button>
            ))}
          </div>
        )}
        {tab === 'build' && (
          <OfferTab
            intake={intake}
            setIntakeField={setIntakeField}
            busy={busy}
            onFillIntake={onFillIntake}
            onGenerate={onGenerate}
            onGenerateImages={onGenerateImages}
            leadMagnetId={leadMagnetId}
            leadMagnets={leadMagnets}
            onPickLeadMagnet={onPickLeadMagnet}
            onCreateLeadMagnet={onCreateLeadMagnet}
            stack={stack}
            setFrontEndField={setFrontEndField}
            addBonus={addBonus}
            updateBonus={updateBonus}
            removeBonus={removeBonus}
            addBump={addBump}
            updateBump={updateBump}
            removeBump={removeBump}
            updateUpsell={updateUpsell}
            offerSlug={offerSlug}
            setOfferSlug={setOfferSlug}
            leadGenSlug={leadGenSlug}
            setLeadGenSlug={setLeadGenSlug}
            deliverableSlug={deliverableSlug}
            setDeliverableSlug={setDeliverableSlug}
            deliverableKey={deliverableKey}
            setDeliverableKey={setDeliverableKey}
            productId={productId}
            setProductId={setProductId}
          />
        )}
        {tab === 'optin' && <OptinTab optin={optin} setField={setOptinField} onRegenerate={() => onGeneratePage('optin')} busy={busy === 'generatePage'} disabled={busy !== null} />}
        {tab === 'sales' && (
          <SalesTab
            sales={sales}
            setField={setSalesField}
            onRegenerate={() => onGeneratePage('sales')}
            regenBusy={busy === 'generatePage'}
            disabled={busy !== null}
          />
        )}
        {tab === 'vsl' && <VslTab vsl={vsl} setField={setVslField} onRegenerate={() => onGeneratePage('vsl')} busy={busy === 'generatePage'} disabled={busy !== null} />}
        {tab === 'checkout' && <CheckoutTab checkout={checkout} setField={setCheckoutField} onRegenerate={() => onGeneratePage('checkout')} busy={busy === 'generatePage'} disabled={busy !== null} />}
        {tab === 'upsell1' && <UpsellTab label="Upsell 1" upsell={upsell1} setField={setUpsell1Field} onRegenerate={() => onGeneratePage('upsell1')} regenBusy={busy === 'generatePage'} />}
        {tab === 'upsell2' && <UpsellTab label="Upsell 2" upsell={upsell2} setField={setUpsell2Field} onRegenerate={() => onGeneratePage('upsell2')} regenBusy={busy === 'generatePage'} />}
        {tab === 'upsell3' && <UpsellTab label="Upsell 3" upsell={upsell3} setField={setUpsell3Field} onRegenerate={() => onGeneratePage('upsell3')} regenBusy={busy === 'generatePage'} />}
        {tab === 'upsell4' && <UpsellTab label="Upsell 4" upsell={upsell4} setField={setUpsell4Field} onRegenerate={() => onGeneratePage('upsell4')} regenBusy={busy === 'generatePage'} />}
        {tab === 'success' && <SuccessTab success={successBlock} setField={setSuccessField} onRegenerate={() => onGeneratePage('success')} busy={busy === 'generatePage'} disabled={busy !== null} />}
        {tab === 'access' && <AccessTab access={access} setField={setAccessField} onRegenerate={() => onGeneratePage('access')} busy={busy === 'generatePage'} disabled={busy !== null} />}
        {tab === 'emails' && (
          <EmailsTab
            emailKits={emailKits}
            emailKitsMap={emailKitsMap}
            emailKitId={emailKitId}
            setKitForEvent={setKitForEvent}
            funnelId={selectedId}
            autobuildPlans={autobuildPlans}
            autobuildPlanError={autobuildPlanError}
            autobuildBusy={autobuildBusy}
            autobuildResults={autobuildResults}
            autobuildNotice={autobuildNotice}
            onAutobuild={onAutobuild}
          />
        )}
        {tab === 'emailStats' && (
          <EmailStatsTab
            rows={emailStatsRows}
            busy={emailStatsBusy}
            error={emailStatsError}
            onReload={() => { setEmailStatsRows(null); setEmailStatsError(null); }}
          />
        )}
        {tab === 'footer' && <ChromeTab footer={footer} setField={setFooterField} />}
        {tab === 'leads' && <LeadsTab leads={leads} selectedId={selectedId} onExportCsv={exportLeadsCsv} />}
      </div>
    </div>
  );
}

