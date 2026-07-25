/**
 * Phase 4: lead magnet picker + AI create-and-link for the sales funnel builder.
 * Idempotent. Safe to re-run.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'admin',
  'sales-funnels',
  'SalesFunnelEditor.tsx',
);

let src = fs.readFileSync(FILE, 'utf8');
const before = src;
const done = [];
const skipped = [];

function must(anchor) {
  if (src.indexOf(anchor) === -1) {
    throw new Error('Anchor not found: ' + anchor.slice(0, 60));
  }
}

function insertAfter(anchor, addition, marker, label) {
  if (src.indexOf(marker) !== -1) {
    skipped.push(label);
    return;
  }
  must(anchor);
  src = src.replace(anchor, anchor + addition);
  done.push(label);
}

function replaceOnce(from, to, marker, label) {
  if (src.indexOf(marker) !== -1) {
    skipped.push(label);
    return;
  }
  must(from);
  src = src.replace(from, to);
  done.push(label);
}

// 1) useEffect import -------------------------------------------------------
replaceOnce(
  "import { useMemo, useState } from 'react';",
  "import { useEffect, useMemo, useState } from 'react';",
  "import { useEffect, useMemo, useState } from 'react';",
  'useEffect import',
);

// 2) Busy union ------------------------------------------------------------
replaceOnce(
  "  | 'fillIntake'\n",
  "  | 'fillIntake'\n  | 'createMagnet'\n",
  "| 'createMagnet'",
  "busy: 'createMagnet'",
);

// 3) LeadMagnetOption interface -------------------------------------------
insertAfter(
  "function listToLines(list: string[]): string { return list.join('\\n'); }",
  `

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
}`,
  'interface LeadMagnetOption',
  'LeadMagnetOption type + mapper',
);

// 4) State ----------------------------------------------------------------
insertAfter(
  '  const [intake, setIntake] = useState<SalesAiIntake>(blankSalesAiIntake());',
  `
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnetOption[]>([]);
  const [leadMagnetId, setLeadMagnetId] = useState('');`,
  'const [leadMagnets, setLeadMagnets]',
  'lead magnet state',
);

// 5) Handlers -------------------------------------------------------------
insertAfter(
  '  function setOptinField<K extends keyof SalesOptinContent>(key: K, value: SalesOptinContent[K]) { setOptin((prev) => ({ ...prev, [key]: value })); }',
  `

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
  }`,
  'async function onCreateLeadMagnet()',
  'lead magnet handlers',
);

// 6) UI card, right after the 3-button build bar --------------------------
const UI_MARKER = 'Existing lead-gen kit';
if (src.indexOf(UI_MARKER) !== -1) {
  skipped.push('lead magnet UI card');
} else {
  const btnMark = "'3. Generate missing images'}";
  const at = src.indexOf(btnMark);
  if (at === -1) throw new Error('Build bar anchor not found');
  const closeDiv = src.indexOf('</div>', at);
  if (closeDiv === -1) throw new Error('Build bar closing div not found');
  const cut = closeDiv + '</div>'.length;
  const card = `

            {/* ---- Lead magnet link ---- */}
            <div className="rounded-xl border border-bone/12 bg-ink/20 p-4 space-y-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-bone/45 font-semibold">Lead magnet</div>
                <p className="mt-0.5 text-xs text-bone/45">
                  Link an existing lead-gen kit or let AI build one from this brief. Linking fills the
                  opt-in magnet title, description, and kit slug — the kit itself stays the source of truth.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Existing lead-gen kit</label>
                  <select className={inputClass} value={leadMagnetId} onChange={(e) => onPickLeadMagnet(e.target.value)}>
                    <option value="">— none linked —</option>
                    {leadMagnets.map((m) => (
                      <option key={m.id} value={m.id}>{(m.name || m.slug) + (m.status ? ' · ' + m.status : '')}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={onCreateLeadMagnet} disabled={busy !== null} className={btnGhost}>
                    {busy === 'createMagnet' ? 'Creating magnet…' : 'AI create + link new magnet'}
                  </button>
                </div>
              </div>
            </div>`;
  src = src.slice(0, cut) + card + src.slice(cut);
  done.push('lead magnet UI card');
}

if (src === before) {
  console.log('No changes (already applied).');
} else {
  fs.writeFileSync(FILE, src, 'utf8');
}
console.log('applied:', done.length ? done.join(', ') : '(none)');
console.log('skipped:', skipped.length ? skipped.join(', ') : '(none)');
