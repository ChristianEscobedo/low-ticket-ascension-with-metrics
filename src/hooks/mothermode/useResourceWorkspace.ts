'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBuyerEmail } from './useBuyerEmail';
import { weekKey, weekLabel } from '@/lib/mothermode/period';

export interface WorkspacePeriod<T> {
  periodKey: string;
  periodLabel: string;
  data: T;
  updatedAt?: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseResourceWorkspaceOptions<T> {
  /** Offer slug, e.g. 'brain-dump-system'. */
  slug: string;
  /** Resource key, e.g. 'brain-dump-template'. */
  key: string;
  /** 'weekly' keys periods by ISO Monday date and defaults to the current
   *  week. 'single' keeps everything in one fixed 'ongoing' record. */
  mode: 'weekly' | 'single';
  defaultData: T;
}

/**
 * Shared state for every interactive resource workspace (Brain Dump
 * Template, Weekly Reset, Load Map, Delegate tracker). Handles the
 * self-reported buyer email gate, loading/saving to
 * /api/mothermode/resource-entries, debounced autosave, and, in weekly
 * mode, moving between stored weeks or cloning the current week forward.
 */
export function useResourceWorkspace<T extends Record<string, unknown>>({
  slug,
  key,
  mode,
  defaultData,
}: UseResourceWorkspaceOptions<T>) {
  const [email, setEmail] = useBuyerEmail();
  const [periods, setPeriods] = useState<WorkspacePeriod<T>[]>([]);
  const [periodKey, setPeriodKey] = useState<string>(
    mode === 'weekly' ? weekKey() : 'ongoing',
  );
  const [periodLabel, setPeriodLabel] = useState<string>(
    mode === 'weekly' ? weekLabel() : 'Ongoing',
  );
  const [data, setData] = useState<T>(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ periodKey: string; periodLabel: string }>({
    periodKey,
    periodLabel,
  });
  latest.current = { periodKey, periodLabel };

  useEffect(() => {
    if (!email) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const res = await fetch(
          `/api/mothermode/resource-entries?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`,
        );
        const json = await res.json();
        if (cancelled) return;
        const list: WorkspacePeriod<T>[] = Array.isArray(json.entries)
          ? json.entries
          : [];
        setPeriods(list);

        if (mode === 'weekly') {
          const currentKey = weekKey();
          const match = list.find((p) => p.periodKey === currentKey);
          if (match) {
            setPeriodKey(match.periodKey);
            setPeriodLabel(match.periodLabel);
            setData({ ...defaultData, ...match.data });
          } else {
            setPeriodKey(currentKey);
            setPeriodLabel(weekLabel());
            setData(defaultData);
          }
        } else {
          const match = list[0];
          if (match) {
            setPeriodKey(match.periodKey);
            setPeriodLabel(match.periodLabel);
            setData({ ...defaultData, ...match.data });
          }
        }
      } catch {
        /* keep defaults on fetch failure */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, slug, key]);

  const persist = useCallback(
    (nextData: T) => {
      if (!email) return;
      const { periodKey: pk, periodLabel: pl } = latest.current;
      setStatus('saving');
      fetch('/api/mothermode/resource-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          key,
          email,
          periodKey: pk,
          periodLabel: pl,
          data: nextData,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          setStatus(j.success ? 'saved' : 'error');
          setPeriods((prev) => {
            const others = prev.filter((p) => p.periodKey !== pk);
            return [
              { periodKey: pk, periodLabel: pl, data: nextData, updatedAt: new Date().toISOString() },
              ...others,
            ].sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
          });
        })
        .catch(() => setStatus('error'));
    },
    [email, slug, key],
  );

  const updateData = useCallback(
    (updater: (prev: T) => T) => {
      setData((prev) => {
        const next = updater(prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => persist(next), 600);
        return next;
      });
    },
    [persist],
  );

  function goToPeriod(pk: string) {
    const match = periods.find((p) => p.periodKey === pk);
    if (!match) return;
    setPeriodKey(match.periodKey);
    setPeriodLabel(match.periodLabel);
    setData({ ...defaultData, ...match.data });
    setStatus('idle');
  }

  /** Weekly mode only: creates the next week after the newest stored week
   *  (or the current week if nothing is stored yet) and switches to it.
   *  When `cloneForward` is true, carries the current period's data into it. */
  function startNextWeek(cloneForward: boolean) {
    if (mode !== 'weekly') return;
    const newestKey = periods.length > 0 ? periods[0].periodKey : periodKey;
    const base = new Date(`${newestKey}T00:00:00`);
    base.setDate(base.getDate() + 7);
    const nextKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    const nextLabel = `Week of ${base.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const nextData = cloneForward ? data : defaultData;
    setPeriodKey(nextKey);
    setPeriodLabel(nextLabel);
    setData(nextData);
    latest.current = { periodKey: nextKey, periodLabel: nextLabel };
    persist(nextData);
  }

  return {
    email,
    setEmail,
    periods,
    periodKey,
    periodLabel,
    data,
    setData: updateData,
    status,
    loaded,
    goToPeriod,
    startNextWeek,
    saveNow: () => persist(data),
  };
}
