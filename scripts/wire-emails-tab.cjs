/**
 * Moves the email-kit binding grid + autobuild panel out of the always-mounted
 * meta section of `SalesFunnelEditor` into an `Emails` nav group with two tabs
 * (`Kits`, `Analytics`), and lifts the autobuild / analytics state into the
 * shell so a tab switch cannot drop an in-flight run.
 *
 * Idempotent: re-running is a no-op once the EmailsTab import is present.
 * Every edit asserts its anchor first so a drifted shell fails loudly instead
 * of silently producing a half-wired editor.
 *
 * Usage: node scripts/wire-emails-tab.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHELL = path.join(ROOT, 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx');
const EMAILS_TAB = path.join(ROOT, 'src/app/admin/sales-funnels/parts/EmailsTab.tsx');

function die(msg) {
  console.error('FAIL: ' + msg);
  process.exit(1);
}

let src = fs.readFileSync(SHELL, 'utf8');
const emailsTabSrc = fs.readFileSync(EMAILS_TAB, 'utf8');
const NL = src.includes('\r\n') ? '\r\n' : '\n';

if (src.includes("./parts/EmailsTab")) {
  console.log('no-op: EmailsTab already wired.');
  process.exit(0);
}

function replaceOnce(needle, replacement, label) {
  const idx = src.indexOf(needle);
  if (idx === -1) die('anchor not found (' + label + '): ' + needle.slice(0, 80));
  if (src.indexOf(needle, idx + 1) !== -1) die('anchor is ambiguous (' + label + ')');
  src = src.slice(0, idx) + replacement + src.slice(idx + needle.length);
}

// ---------------------------------------------------------------------------
// 1. Cut the binding grid + autobuild panel out of the meta section.
//    Brace-free scan: walk lines from the wrapper div and stop when the JSX
//    element depth returns to zero, so the exact block moves as one piece.
// ---------------------------------------------------------------------------
const marker = '<label className={labelClass}>Email kits by funnel event</label>';
const markerIdx = src.indexOf(marker);
if (markerIdx === -1) die('email-kit region marker not found');
const wrapper = '<div className="sm:col-span-2">';
const startIdx = src.lastIndexOf(wrapper, markerIdx);
if (startIdx === -1) die('email-kit region wrapper not found');
const lineStart = src.lastIndexOf(NL, startIdx) + NL.length;

const lines = src.slice(lineStart).split(NL);
let depth = 0;
let endLine = -1;
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  const opens = (line.match(/<div\b/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - closes;
  if (i > 0 && depth === 0) {
    endLine = i;
    break;
  }
}
if (endLine === -1) die('could not find the end of the email-kit region');
const region = lines.slice(0, endLine + 1).join(NL);
if (!region.includes('EmailKitAutobuildPanel')) die('cut region is missing the autobuild panel');
if (!region.includes('SALES_EMAIL_EVENTS.map')) die('cut region is missing the event grid');

// Field-parity guard: every label the region rendered must exist in the new
// tab, so a move cannot quietly drop an input an admin relies on.
for (const needed of [
  'Email kits by funnel event',
  'SALES_EMAIL_EVENT_LABELS[event]',
  'None — no auto-enroll',
  'setKitForEvent(event',
]) {
  if (!emailsTabSrc.includes(needed)) die('EmailsTab.tsx is missing moved content: ' + needed);
}

src = src.slice(0, lineStart) + src.slice(lineStart + region.length + NL.length);

// ---------------------------------------------------------------------------
// 2. Imports.
// ---------------------------------------------------------------------------
replaceOnce(
  "import { useEffect, useMemo, useState } from 'react';",
  "import { useCallback, useEffect, useMemo, useState } from 'react';",
  'react import',
);
replaceOnce(
  "import EmailKitAutobuildPanel from '@/components/mothermode/sales/EmailKitAutobuildPanel';",
  "import type {" +
    NL +
    '  AutobuildPlanRow,' +
    NL +
    '  AutobuildResultRow,' +
    NL +
    "} from '@/components/mothermode/sales/EmailKitAutobuildPanel';" +
    NL +
    "import { sequenceTotals } from '@/lib/mothermode/email/analytics';",
  'panel import',
);
replaceOnce(
  "import LeadsTab from './parts/LeadsTab';",
  "import LeadsTab from './parts/LeadsTab';" +
    NL +
    "import EmailsTab from './parts/EmailsTab';" +
    NL +
    "import EmailStatsTab, { type EmailStatsRow } from './parts/EmailStatsTab';",
  'parts imports',
);

// ---------------------------------------------------------------------------
// 3. Tab union + endpoint constants.
// ---------------------------------------------------------------------------
replaceOnce("| 'footer' | 'leads'", "| 'footer' | 'leads' | 'emails' | 'emailStats'", 'tab union');

const crudMatch = src.match(/^const CRUD_URL = '[^']+';$/m);
if (!crudMatch) die('CRUD_URL constant not found');
replaceOnce(
  crudMatch[0],
  crudMatch[0] +
    NL +
    "const EMAIL_KITS_URL = '/api/mothermode/sales-email-kits';" +
    NL +
    "const EMAIL_STATS_URL = '/api/admin/mothermode-email/stats';",
  'endpoint consts',
);

// ---------------------------------------------------------------------------
// 4. Lift the autobuild + analytics state into the shell.
// ---------------------------------------------------------------------------
const STATE = [
  '  // --- Emails group state ---------------------------------------------------',
  '  // Both email tabs unmount on every nav switch, so their state lives up here.',
  '  // Autobuild runs for a while server-side: keeping the run state in the tab',
  '  // would throw away the only UI able to report what a still-running job did.',
  '  const [autobuildPlans, setAutobuildPlans] = useState<AutobuildPlanRow[] | null>(null);',
  '  const [autobuildPlanError, setAutobuildPlanError] = useState<string | null>(null);',
  "  const [autobuildBusy, setAutobuildBusy] = useState<SalesEmailEvent | 'all' | null>(null);",
  '  const [autobuildResults, setAutobuildResults] = useState<AutobuildResultRow[]>([]);',
  '  const [autobuildNotice, setAutobuildNotice] = useState<string | null>(null);',
  '  const [emailStatsRows, setEmailStatsRows] = useState<EmailStatsRow[] | null>(null);',
  '  const [emailStatsBusy, setEmailStatsBusy] = useState(false);',
  '  const [emailStatsError, setEmailStatsError] = useState<string | null>(null);',
  '',
  '  // A different funnel means different kits: drop both caches so the next',
  "  // visit reads fresh instead of showing the previous funnel's numbers.",
  '  useEffect(() => {',
  '    setAutobuildPlans(null); setAutobuildPlanError(null);',
  '    setAutobuildResults([]); setAutobuildNotice(null);',
  '    setEmailStatsRows(null); setEmailStatsError(null);',
  '  }, [selectedId]);',
  '',
  '  const loadAutobuildPlan = useCallback(async (funnelId: string) => {',
  '    try {',
  '      const res = await fetch(EMAIL_KITS_URL, {',
  "        method: 'POST',",
  "        headers: { 'content-type': 'application/json' },",
  "        body: JSON.stringify({ action: 'plan', funnelId }),",
  '      });',
  '      const json = await res.json();',
  "      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to read the funnel');",
  '      setAutobuildPlans(Array.isArray(json.plans) ? json.plans : []);',
  '    } catch (e) {',
  "      setAutobuildPlanError(e instanceof Error ? e.message : 'Failed to read the funnel');",
  '      setAutobuildPlans([]);',
  '    }',
  '  }, []);',
  '',
  '  // Lazy: the plan POST only fires once the Kits tab is opened, and never',
  '  // while results are already loaded (that would clobber a finished run).',
  '  useEffect(() => {',
  "    if (tab !== 'emails' || !selectedId) return;",
  '    if (autobuildPlans !== null || autobuildPlanError) return;',
  '    void loadAutobuildPlan(selectedId);',
  '  }, [tab, selectedId, autobuildPlans, autobuildPlanError, loadAutobuildPlan]);',
  '',
  '  async function onAutobuild(events?: SalesEmailEvent[], onlyMissing = false) {',
  '    if (!selectedId) return;',
  "    setAutobuildBusy(events && events.length === 1 ? events[0] : 'all');",
  '    setAutobuildNotice(null);',
  '    try {',
  '      const res = await fetch(EMAIL_KITS_URL, {',
  "        method: 'POST',",
  "        headers: { 'content-type': 'application/json' },",
  "        body: JSON.stringify({ action: 'generate', funnelId: selectedId, events, onlyMissing }),",
  '      });',
  '      const json = await res.json();',
  '      const results: AutobuildResultRow[] = Array.isArray(json?.results) ? json.results : [];',
  '      // Merge, so re-running one event keeps the other rows on screen.',
  '      setAutobuildResults((prev) => [',
  '        ...prev.filter((p) => !results.some((r) => r.event === p.event)),',
  '        ...results,',
  '      ]);',
  '      if (!res.ok || (!json?.success && results.length === 0)) {',
  "        throw new Error(json?.error || json?.message || 'Generation failed');",
  '      }',
  '      const bound: Partial<Record<SalesEmailEvent, string>> = {};',
  '      for (const r of results) if (r.ok && r.kitId) bound[r.event] = r.kitId;',
  '      if (Object.keys(bound).length) adoptGeneratedKits(bound);',
  '      setAutobuildNotice(',
  '        json?.message ||',
  "          'Built ' + (json?.built ?? 0) + ' sequence(s)' + (json?.failed ? ', ' + json.failed + ' failed' : '') + '. Save the funnel to keep the bindings.',",
  '      );',
  "      // Bindings moved, so the plan's alreadyBound flags and the stats rows",
  '      // are both stale; null makes the next tab visit refetch.',
  '      setAutobuildPlans(null); setEmailStatsRows(null);',
  '    } catch (e) {',
  "      setAutobuildNotice(e instanceof Error ? e.message : 'Generation failed');",
  '    } finally {',
  '      setAutobuildBusy(null);',
  '    }',
  '  }',
  '',
  '  async function loadEmailStats() {',
  '    const bound = SALES_EMAIL_EVENTS',
  "      .map((event) => ({ event, kitId: emailKitsMap[event] || (event === 'optin' ? emailKitId : '') }))",
  '      .filter((b) => Boolean(b.kitId));',
  '    if (bound.length === 0) { setEmailStatsRows([]); setEmailStatsError(null); return; }',
  '    setEmailStatsBusy(true); setEmailStatsError(null);',
  '    try {',
  '      const rows = await Promise.all(',
  '        bound.map(async ({ event, kitId }) => {',
  "          const res = await fetch(EMAIL_STATS_URL + '?kitId=' + encodeURIComponent(kitId));",
  '          const json = await res.json();',
  "          if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to read stats');",
  '          // A kit no provider has ever posted for has no stored row; treat',
  '          // that as zeroes rather than an error.',
  '          const stats = json.stats && json.stats.byEmail ? json.stats : { kitId, byEmail: {}, updatedAt: null };',
  '          const totals = sequenceTotals(stats);',
  '          const row: EmailStatsRow = {',
  '            event,',
  '            eventLabel: SALES_EMAIL_EVENT_LABELS[event],',
  '            kitId,',
  '            kitName: emailKits.find((k) => k.id === kitId)?.name || kitId,',
  '            sent: totals.sent,',
  '            delivered: totals.delivered,',
  '            opened: totals.opened,',
  '            clicked: totals.clicked,',
  '            unsubscribed: totals.unsubscribed,',
  '            bounced: totals.bounced,',
  '            revenue: totals.revenue,',
  '            updatedAt: stats.updatedAt ?? null,',
  '          };',
  '          return row;',
  '        }),',
  '      );',
  '      setEmailStatsRows(rows);',
  '    } catch (e) {',
  "      setEmailStatsError(e instanceof Error ? e.message : 'Failed to read stats');",
  '      setEmailStatsRows([]);',
  '    } finally {',
  '      setEmailStatsBusy(false);',
  '    }',
  '  }',
  '',
  '  // One request per bound kit is too much to pay on every editor load, so',
  '  // analytics is fetched when its tab is opened and cached until it changes.',
  '  useEffect(() => {',
  "    if (tab !== 'emailStats') return;",
  '    if (emailStatsRows !== null || emailStatsBusy) return;',
  '    void loadEmailStats();',
  '    // eslint-disable-next-line react-hooks/exhaustive-deps',
  '  }, [tab, emailStatsRows, emailStatsBusy]);',
  '',
].join(NL);

replaceOnce(
  '  function adoptGeneratedKits(',
  STATE + '  function adoptGeneratedKits(',
  'state insertion point',
);

// ---------------------------------------------------------------------------
// 5. Nav: Emails group + its sub-tabs.
// ---------------------------------------------------------------------------
replaceOnce(
  "  const GROUPS: { id: string; label: string; tabs: Tab[] }[] = [",
  '  const EMAIL_TABS: { id: Tab; label: string }[] = [' +
    NL +
    "    { id: 'emails', label: 'Kits' }," +
    NL +
    "    { id: 'emailStats', label: 'Analytics' }," +
    NL +
    '  ];' +
    NL +
    '  const GROUPS: { id: string; label: string; tabs: Tab[] }[] = [',
  'EMAIL_TABS',
);
replaceOnce(
  "    { id: 'chrome', label: 'Chrome', tabs: ['footer'] },",
  "    { id: 'emails', label: 'Emails', tabs: EMAIL_TABS.map((t) => t.id) }," +
    NL +
    "    { id: 'chrome', label: 'Chrome', tabs: ['footer'] },",
  'GROUPS entry',
);

const pagesBar = src.match(
  /\{activeGroup\.id === 'pages' && \([\s\S]*?\r?\n {8}\)\}\r?\n/,
);
if (!pagesBar) die('pages sub-tab bar not found');
const emailsBar =
  pagesBar[0] +
  [
    "        {activeGroup.id === 'emails' && (",
    '          <div className="flex flex-wrap gap-1">',
    '            {EMAIL_TABS.map((t) => (',
    '              <button key={t.id} type="button" onClick={() => setTab(t.id)} className={\'rounded-md px-2.5 py-1 text-xs transition-colors \' + (tab === t.id ? \'bg-bone/10 text-bone font-semibold border border-bone/20\' : \'text-bone/45 hover:text-bone/80 border border-transparent\')}>{t.label}</button>',
    '            ))}',
    '          </div>',
    '        )}',
    '',
  ].join(NL);
replaceOnce(pagesBar[0], emailsBar, 'emails sub-tab bar');

// ---------------------------------------------------------------------------
// 6. Render the two tabs.
// ---------------------------------------------------------------------------
replaceOnce(
  "        {tab === 'footer' && (",
  [
    "        {tab === 'emails' && (",
    '          <EmailsTab',
    '            emailKits={emailKits}',
    '            emailKitsMap={emailKitsMap}',
    '            emailKitId={emailKitId}',
    '            setKitForEvent={setKitForEvent}',
    '            funnelId={selectedId}',
    '            autobuildPlans={autobuildPlans}',
    '            autobuildPlanError={autobuildPlanError}',
    '            autobuildBusy={autobuildBusy}',
    '            autobuildResults={autobuildResults}',
    '            autobuildNotice={autobuildNotice}',
    '            onAutobuild={onAutobuild}',
    '          />',
    '        )}',
    "        {tab === 'emailStats' && (",
    '          <EmailStatsTab',
    '            rows={emailStatsRows}',
    '            busy={emailStatsBusy}',
    '            error={emailStatsError}',
    '            onReload={() => { setEmailStatsRows(null); setEmailStatsError(null); }}',
    '          />',
    '        )}',
    "        {tab === 'footer' && (",
  ].join(NL),
  'tab renders',
);

if (src.includes('<EmailKitAutobuildPanel')) die('the old panel usage is still in the shell');

fs.writeFileSync(SHELL, src);
console.log('wired: Emails group (Kits + Analytics) in SalesFunnelEditor.');
