'use client';

/**
 * Export drawer for the content hub. Choose Metricool or GHL (basic/advanced),
 * pick a selection scope (current filters, selected ids, weeks, months,
 * platforms, date range, or all), set campaign start/time, then download CSV
 * or push to Google Sheets when configured.
 */
import React, { useMemo, useState } from 'react';
import {
  X as XIcon,
  Download,
  Table2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  PLATFORM_LABEL,
  WEEKS,
  type ContentPiece,
  type ContentPlatform,
  type ExportOptions,
  type ExportScope,
  type ExportTarget,
  type CampaignMonth,
  SOCIAL_EXPORT_PLATFORMS,
  defaultCampaignStart,
  previewExport,
} from '@/lib/mothermode/content';
import type { PieceReview } from '@/lib/mothermode/content/review';

import { getAllReviews } from './reviewClient';
import {
  buildExportCsv,
  downloadExportCsv,
  exportToGoogleSheets,
} from './exportClient';

const labelCls = 'text-[11px] uppercase tracking-[0.16em] text-ink/45';
const fieldCls =
  'mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 px-2.5 py-1.5 text-sm text-ink focus:border-mode focus:outline-none';

const TARGETS: { id: ExportTarget; label: string; hint: string }[] = [
  {
    id: 'metricool',
    label: 'Metricool',
    hint: 'Calendar import CSV',
  },
  {
    id: 'ghl-advanced',
    label: 'GHL Advanced',
    hint: 'Social Planner advanced',
  },
  {
    id: 'ghl-basic',
    label: 'GHL Basic',
    hint: 'Social Planner basic',
  },
];

const SCOPES: { id: ExportScope; label: string }[] = [
  { id: 'current', label: 'Current filters' },
  { id: 'selected', label: 'Selected pieces' },
  { id: 'weeks', label: 'By week' },
  { id: 'months', label: 'By month' },
  { id: 'platforms', label: 'By platform' },
  { id: 'range', label: 'Date range + platform' },
  { id: 'all', label: 'Export all' },
];

const MONTHS: { id: CampaignMonth; label: string }[] = [
  { id: 1, label: 'Month 1 (weeks 1–4)' },
  { id: 2, label: 'Month 2 (weeks 5–8)' },
  { id: 3, label: 'Month 3 (weeks 9–12)' },
];

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value];
}

export const ExportPanel: React.FC<{
  allPieces: ContentPiece[];
  currentPieces: ContentPiece[];
  selectedIds: string[];
  offerSlug: string;
  offerUrl?: string;
  onClose: () => void;
  /** Enter multi-select mode on the hub when scope is selected. */
  onRequestSelectMode?: () => void;
}> = ({
  allPieces,
  currentPieces,
  selectedIds,
  offerSlug,
  offerUrl,
  onClose,
  onRequestSelectMode,
}) => {
  const [target, setTarget] = useState<ExportTarget>('metricool');
  const [scope, setScope] = useState<ExportScope>('current');
  const [weeks, setWeeks] = useState<number[]>([]);
  const [months, setMonths] = useState<CampaignMonth[]>([]);
  const [platforms, setPlatforms] = useState<ContentPlatform[]>([
    ...SOCIAL_EXPORT_PLATFORMS,
  ]);
  const [campaignStart, setCampaignStart] = useState(defaultCampaignStart());
  const [defaultTime, setDefaultTime] = useState('10:00:00');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [includeAds, setIncludeAds] = useState(true);
  const [includeNonSocial, setIncludeNonSocial] = useState(false);
  const [asDraft, setAsDraft] = useState(false);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('MotherMode');
  const [busy, setBusy] = useState(false);
  const [sheetsBusy, setSheetsBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    msg: string;
    url?: string;
  } | null>(null);

  const options: ExportOptions = useMemo(
    () => ({
      target,
      scope,
      selectedIds,
      weeks,
      months,
      platforms,
      rangeStart: rangeStart || undefined,
      rangeEnd: rangeEnd || undefined,
      campaignStart,
      defaultTime,
      includeAds,
      includeNonSocial,
      asDraft,
      category: category.trim() || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      offerUrl,
      brandName: 'MotherMode',
      useScheduledVersions: true,
    }),
    [
      target,
      scope,
      selectedIds,
      weeks,
      months,
      platforms,
      rangeStart,
      rangeEnd,
      campaignStart,
      defaultTime,
      includeAds,
      includeNonSocial,
      asDraft,
      category,
      tags,
      offerUrl,
    ],
  );

  const reviews: Record<string, PieceReview> = useMemo(
    () => getAllReviews(offerSlug),
    // Re-read when panel opens / scope changes; cache is sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offerSlug, scope, selectedIds, weeks, months, platforms],
  );

  const preview = useMemo(() => {
    try {
      return previewExport({
        allPieces,
        currentPieces,
        options,
        reviews,
      });
    } catch {
      return { count: 0, withImages: 0, missingMedia: 0, byPlatform: {} };
    }
  }, [allPieces, currentPieces, options, reviews]);

  const runDownload = () => {
    setBusy(true);
    setResult(null);
    try {
      const out = downloadExportCsv({
        allPieces,
        currentPieces,
        options,
        reviews,
      });
      setResult({
        ok: true,
        msg: `Downloaded ${out.filename} (${out.count} posts).`,
      });
    } catch (err) {
      setResult({
        ok: false,
        msg: err instanceof Error ? err.message : 'Export failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const runSheets = async () => {
    setSheetsBusy(true);
    setResult(null);
    try {
      const built = buildExportCsv({
        allPieces,
        currentPieces,
        options,
        reviews,
      });
      const title = `MotherMode ${target} export ${campaignStart}`;
      const res = await exportToGoogleSheets({
        title,
        csv: built.csv,
        target,
      });
      if (!res.ok) {
        setResult({ ok: false, msg: res.error });
      } else {
        setResult({
          ok: true,
          msg: 'Opened in Google Sheets.',
          url: res.url,
        });
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setResult({
        ok: false,
        msg: err instanceof Error ? err.message : 'Sheets export failed',
      });
    } finally {
      setSheetsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-ink/10 bg-bone shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brass">
              Export
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">
              Planner CSV
            </h2>
            <p className="mt-1 text-sm text-ink/55">
              Metricool or GoHighLevel Social Planner, from the hub library.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-ink"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <span className={labelCls}>Platform</span>
            <div className="mt-2 grid gap-2">
              {TARGETS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTarget(t.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    target === t.id
                      ? 'border-mode bg-mode/10'
                      : 'border-ink/15 hover:border-ink/30'
                  }`}
                >
                  <span className="block text-sm font-semibold text-ink">
                    {t.label}
                  </span>
                  <span className="text-xs text-ink/50">{t.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <span className={labelCls}>What to export</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setScope(s.id);
                    if (s.id === 'selected') onRequestSelectMode?.();
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    scope === s.id
                      ? 'border-mode bg-mode text-bone'
                      : 'border-ink/15 text-ink/70 hover:border-ink/30'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {scope === 'selected' && (
              <p className="mt-2 text-xs text-ink/50">
                {selectedIds.length} piece
                {selectedIds.length === 1 ? '' : 's'} selected on the hub.
                Tick cards while this panel is open.
              </p>
            )}
          </section>

          {scope === 'weeks' && (
            <section>
              <span className={labelCls}>Weeks</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WEEKS.map((w) => {
                  const on = weeks.includes(w);
                  return (
                    <button
                      key={w}
                      onClick={() => setWeeks(toggleIn(weeks, w))}
                      className={`h-8 w-8 rounded-full text-xs ${
                        on
                          ? 'bg-mode text-bone'
                          : 'border border-ink/15 text-ink/65'
                      }`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {scope === 'months' && (
            <section>
              <span className={labelCls}>Campaign months</span>
              <div className="mt-2 space-y-1.5">
                {MONTHS.map((m) => {
                  const on = months.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMonths(toggleIn(months, m.id))}
                      className={`flex w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        on
                          ? 'border-mode bg-mode/10 font-semibold text-mode'
                          : 'border-ink/15 text-ink/70'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {(scope === 'platforms' || scope === 'range') && (
            <section>
              <span className={labelCls}>Platforms</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {SOCIAL_EXPORT_PLATFORMS.map((p) => {
                  const on = platforms.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => setPlatforms(toggleIn(platforms, p))}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        on
                          ? 'border-mode bg-mode/10 font-semibold text-mode'
                          : 'border-ink/15 text-ink/65'
                      }`}
                    >
                      {PLATFORM_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {scope === 'range' && (
            <section className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>From</span>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>To</span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className={fieldCls}
                />
              </label>
            </section>
          )}

          <section className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Campaign start</span>
              <input
                type="date"
                value={campaignStart}
                onChange={(e) => setCampaignStart(e.target.value)}
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Default time</span>
              <input
                type="time"
                step={1}
                value={defaultTime.slice(0, 8)}
                onChange={(e) => {
                  const v = e.target.value;
                  setDefaultTime(v.length === 5 ? `${v}:00` : v);
                }}
                className={fieldCls}
              />
            </label>
          </section>
          <p className="text-xs text-ink/45">
            Weeks 1–12 map from campaign start (week 1 = first 7 days). Posts
            in the same week are staggered across the week.
          </p>

          <section className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink/75">
              <input
                type="checkbox"
                checked={includeAds}
                onChange={(e) => setIncludeAds(e.target.checked)}
              />
              Include paid ads
            </label>
            <label className="flex items-center gap-2 text-sm text-ink/75">
              <input
                type="checkbox"
                checked={includeNonSocial}
                onChange={(e) => setIncludeNonSocial(e.target.checked)}
              />
              Include email / blog / AEO
            </label>
            {target === 'metricool' && (
              <label className="flex items-center gap-2 text-sm text-ink/75">
                <input
                  type="checkbox"
                  checked={asDraft}
                  onChange={(e) => setAsDraft(e.target.checked)}
                />
                Mark as Metricool drafts
              </label>
            )}
          </section>

          {target === 'ghl-advanced' && (
            <section className="grid gap-3">
              <label className="block">
                <span className={labelCls}>Tags (comma-separated)</span>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Category</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={fieldCls}
                  placeholder="Optional"
                />
              </label>
            </section>
          )}

          <section className="rounded-xl border border-ink/10 bg-white/50 px-4 py-3 text-sm text-ink/70">
            <p className="font-semibold text-ink">
              {preview.count} post{preview.count === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-xs text-ink/50">
              {preview.withImages} with media URLs
              {preview.missingMedia > 0
                ? ` · ${preview.missingMedia} missing absolute media`
                : ''}
            </p>
          </section>

          {result && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                result.ok
                  ? 'border-mode/30 bg-mode/5 text-ink/80'
                  : 'border-brass/40 bg-brass/10 text-ink/75'
              }`}
            >
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mode" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" />
              )}
              <div>
                <p>{result.msg}</p>
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-mode underline"
                  >
                    Open spreadsheet
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-ink/10 px-5 py-4">
          <button
            onClick={runDownload}
            disabled={busy || preview.count === 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-mode px-4 py-2.5 text-sm font-semibold text-bone hover:bg-mode-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download CSV
          </button>
          <button
            onClick={runSheets}
            disabled={sheetsBusy || preview.count === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-semibold text-ink/80 hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-40"
            title="Requires Google Sheets credentials on the server"
          >
            {sheetsBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Table2 className="h-4 w-4" />
            )}
            Sheets

          </button>
        </footer>
      </aside>
    </div>
  );
};
