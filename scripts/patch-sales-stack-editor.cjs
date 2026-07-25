/**
 * Patch SalesFunnelEditor Build tab:
 * - fillIntake action
 * - Offer stack editor (front-end, bonuses, bumps, upsells)
 * - Keep flat upsell fields in sync via offerStack
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'app', 'admin', 'sales-funnels', 'SalesFunnelEditor.tsx');
let t = fs.readFileSync(file, 'utf8');
const nl = t.includes('\r\n') ? '\r\n' : '\n';

// 1) Expand imports
const oldImport = `import {
  blankSalesAiIntake,
  type SalesAiIntake,
} from '@/lib/mothermode/sales/aiIntake';`;

const newImport = `import {
  blankSalesAiIntake,
  normalizeSalesAiIntake,
  syncIntakeStack,
  type OfferStack,
  type OfferStackBonus,
  type OfferStackBump,
  type OfferStackUpsell,
  type SalesAiIntake,
} from '@/lib/mothermode/sales/aiIntake';`;

if (!t.includes(oldImport)) {
  if (!t.includes('normalizeSalesAiIntake')) {
    console.error('import block not found');
    process.exit(1);
  } else {
    console.log('imports already patched');
  }
} else {
  t = t.replace(oldImport, newImport);
  console.log('imports patched');
}

// 2) Busy type
t = t.replace(
  /type Busy = null \| 'save' \| 'delete' \| 'loadDefaults' \| 'generate' \| 'duplicate';/,
  `type Busy = null | 'save' | 'delete' | 'loadDefaults' | 'generate' | 'fillIntake' | 'duplicate';`,
);
console.log('busy type ok');

// 3) Replace onGenerate + setIntakeField block with expanded handlers
const oldHandlers = `  async function onGenerate() {
    setBusy('generate'); setError(null); setNotice(null);
    try {
      const res = await fetch(AI_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'generate', intake }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Generate failed (HTTP ' + res.status + ')');
      if (data.optin) setOptin(data.optin); if (data.sales) setSales(data.sales);
      if (data.vsl) setVsl(data.vsl); if (data.checkout) setCheckout(data.checkout);
      if (data.upsell1) setUpsell1(data.upsell1); if (data.upsell2) setUpsell2(data.upsell2);
      if (data.upsell3) setUpsell3(data.upsell3); if (data.upsell4) setUpsell4(data.upsell4);
      if (data.successBlock) setSuccessBlock(data.successBlock); if (data.access) setAccess(data.access);
      if (typeof data.name === 'string' && data.name.trim()) {
        setName(data.name.trim());
        if (!slugTouched && typeof data.slugHint === 'string') setSlug(slugifySalesName(data.slugHint || data.name));
      } else if (!slugTouched && typeof data.slugHint === 'string' && data.slugHint) setSlug(slugifySalesName(data.slugHint));
      if (intake.offerName && !offerSlug) setOfferSlug(slugifySalesName(intake.offerName));
      setTab('optin'); setNotice('AI filled all 10 blocks. Review, then save.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Generate failed'); } finally { setBusy(null); }
  }

  function setIntakeField<K extends keyof SalesAiIntake>(key: K, value: SalesAiIntake[K]) { setIntake((prev) => ({ ...prev, [key]: value })); }`;

const newHandlers = `  async function onFillIntake() {
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

  const stack = intake.offerStack;`;

if (!t.includes(oldHandlers)) {
  if (t.includes('onFillIntake')) {
    console.log('handlers already patched');
  } else {
    console.error('onGenerate block not found exactly');
    // try softer match
    const idx = t.indexOf('async function onGenerate()');
    console.error('onGenerate at', idx);
    process.exit(1);
  }
} else {
  t = t.replace(oldHandlers, newHandlers);
  console.log('handlers patched');
}

// 4) Replace Build tab UI
// Find from `{tab === 'build' && (` through the closing of that section before next tab
const buildMarker = `{tab === 'build' && (`;
const buildStart = t.indexOf(buildMarker);
if (buildStart < 0) {
  console.error('build tab not found');
  process.exit(1);
}

// Find the matching section end: look for next `{tab === '` after buildStart
const afterBuild = t.indexOf(`{tab === '`, buildStart + buildMarker.length);
if (afterBuild < 0) {
  console.error('next tab not found');
  process.exit(1);
}

// Walk back to include the closing `)}` of the build section
// The structure is: {tab === 'build' && ( <section>...</section> )}
// afterBuild points at next tab; before that should be `)}`
let sectionEnd = afterBuild;
// trim whitespace backward
while (sectionEnd > buildStart && /\\s/.test(t[sectionEnd - 1])) sectionEnd--;
// expect `)}`
if (t.slice(sectionEnd - 2, sectionEnd) !== ')}') {
  // try find last `)}` before afterBuild
  const slice = t.slice(buildStart, afterBuild);
  const last = slice.lastIndexOf(')}');
  if (last < 0) {
    console.error('could not find end of build section');
    process.exit(1);
  }
  sectionEnd = buildStart + last + 2;
}

const oldBuild = t.slice(buildStart, sectionEnd);
console.log('old build length', oldBuild.length);

const newBuild = `{tab === 'build' && (
          <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-5">
            <div>
              <div className="text-sm font-semibold text-bone">AI self-build</div>
              <p className="mt-1 text-xs text-bone/50 max-w-2xl">
                1) Fill a thin brief. 2) AI expands into a full offer stack (front-end, bonuses, bumps, upsells).
                3) Edit the stack. 4) Generate all 10 funnel pages from the stack.
              </p>
            </div>

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
            </div>

            {/* ---- Offer stack ---- */}
            <div className="rounded-xl border border-brass/20 bg-brass/[0.04] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-brass/80 font-semibold">Offer stack</div>
                  <p className="mt-0.5 text-xs text-bone/45">Money path source of truth. Generate maps this into sales bonuses, checkout bumps, and upsell pages.</p>
                </div>
              </div>

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
                      <div className="flex items-end">
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
                      <div className="flex items-end">
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
                      <div>
                        <label className={labelClass}>Billing</label>
                        <select
                          className={inputClass}
                          value={u.billingType}
                          onChange={(e) => updateUpsell(u.slot, { billingType: e.target.value })}
                        >
                          <option value="one_time">One-time</option>
                          <option value="subscription">Subscription</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}`;

t = t.slice(0, buildStart) + newBuild + t.slice(sectionEnd);
console.log('build tab replaced');

fs.writeFileSync(file, t);
console.log('wrote', file, t.length);
console.log('OK');
