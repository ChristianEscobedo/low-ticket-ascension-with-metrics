'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ExternalLink,
  Sparkles,
  Video as VideoIcon,
  X
} from 'lucide-react';
import { selectVisibleCtas, type VideoCTA } from './cta-visibility';

export type { VideoCTA } from './cta-visibility';

interface Props {
  ctas: VideoCTA[] | null | undefined;
  lessonId: string;
  currentTime: number;
}

const SHOWN_KEY = 'course-cta-shown';
const VIEW_PINGED_KEY = 'course-cta-viewed';

// Best-effort, one-shot view ping per (lesson, cta) per browser session.
// Dedupe lives in sessionStorage so a tab refresh re-pings (a new "view")
// but a re-render within the same session does not.
function pingViewOnce(lessonId: string, ctaId: string) {
  if (lessonId === '__preview__' || typeof window === 'undefined') return;
  const key = `${VIEW_PINGED_KEY}:${lessonId}:${ctaId}`;
  try {
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage can throw in strict/private modes — fall through and
    // ping anyway; worst case is a duplicate row, which the rollup tolerates.
  }
  void fetch('/api/courses/cta-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson_id: lessonId, cta_id: ctaId }),
    keepalive: true
  }).catch(() => {});
}

/**
 * Time-triggered CTA overlay that layers on top of the video container.
 * Slim port of the source overlay — supports time trigger, dismissal,
 * showOnce persistence and autoHide. No A/B, exit-intent or analytics.
 */
export default function VideoCTAOverlay({ ctas, lessonId, currentTime }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [autoHidden, setAutoHidden] = useState<Set<string>>(new Set());
  const appearedAt = useRef<Map<string, number>>(new Map());

  // Hydrate "showOnce" dismissals from localStorage on mount.
  useEffect(() => {
    if (!ctas?.length) return;
    const next = new Set<string>();
    for (const cta of ctas) {
      if (cta.showOnce && typeof window !== 'undefined') {
        if (localStorage.getItem(`${SHOWN_KEY}:${lessonId}:${cta.id}`) === '1') {
          next.add(cta.id);
        }
      }
    }
    if (next.size > 0) setDismissed(next);
  }, [ctas, lessonId]);

  const visible = useMemo(
    () => selectVisibleCtas(ctas, currentTime, dismissed, autoHidden),
    [ctas, dismissed, autoHidden, currentTime]
  );

  // Track first-visible timestamp + run autoHide timers.
  useEffect(() => {
    for (const cta of visible) {
      if (!appearedAt.current.has(cta.id)) {
        appearedAt.current.set(cta.id, Date.now());
        pingViewOnce(lessonId, cta.id);
      }
    }
    if (!visible.some((c) => c.autoHideSeconds && c.autoHideSeconds > 0)) return;
    const tick = setInterval(() => {
      const now = Date.now();
      for (const cta of visible) {
        if (!cta.autoHideSeconds) continue;
        const startedAt = appearedAt.current.get(cta.id);
        if (startedAt && (now - startedAt) / 1000 >= cta.autoHideSeconds) {
          setAutoHidden((prev) => {
            if (prev.has(cta.id)) return prev;
            const next = new Set(prev);
            next.add(cta.id);
            return next;
          });
        }
      }
    }, 500);
    return () => clearInterval(tick);
  }, [visible, lessonId]);

  if (!visible.length) return null;

  return (
    <>
      {visible.map((cta) => (
        <CTACard
          key={cta.id}
          cta={cta}
          onClick={() => {
            if (lessonId === '__preview__' || typeof window === 'undefined') return;
            void fetch('/api/courses/cta-click', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lesson_id: lessonId, cta_id: cta.id }),
              keepalive: true
            }).catch(() => {});
          }}
          onDismiss={() => {
            if (cta.showOnce && typeof window !== 'undefined') {
              localStorage.setItem(`${SHOWN_KEY}:${lessonId}:${cta.id}`, '1');
            }
            setDismissed((prev) => {
              const next = new Set(prev);
              next.add(cta.id);
              return next;
            });
          }}
        />
      ))}
    </>
  );
}

function CTACard({
  cta,
  onClick,
  onDismiss
}: {
  cta: VideoCTA;
  onClick: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className={`absolute z-20 ${positionClasses(cta.position)}`}>
      <div className={styleClasses(cta.style, cta.position)}>
        {cta.dismissable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            aria-label="Dismiss"
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <TypeIcon type={cta.type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">
              {cta.title}
            </p>
            {cta.subtitle && (
              <p className="text-xs text-white/60 leading-tight mt-0.5 truncate">
                {cta.subtitle}
              </p>
            )}
          </div>
          <a
            href={cta.link}
            target={cta.linkTarget || '_blank'}
            rel={cta.linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="shrink-0 inline-flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg shadow-lg"
          >
            {cta.buttonText}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: VideoCTA['type'] }) {
  const cls = 'w-5 h-5 text-amber-300';
  if (type === 'book-call') return <CalendarDays className={cls} />;
  if (type === 'webinar') return <VideoIcon className={cls} />;
  if (type === 'offer') return <Sparkles className={cls} />;
  return <ExternalLink className={cls} />;
}

function positionClasses(p: VideoCTA['position']) {
  switch (p) {
    case 'bottom-right':
      return 'bottom-4 right-4 max-w-sm';
    case 'top-bar':
      return 'top-0 inset-x-0 px-3 pt-3';
    case 'center-modal':
      return 'inset-0 flex items-center justify-center bg-black/50 px-6';
    case 'bottom-bar':
    default:
      return 'bottom-0 inset-x-0 px-3 pb-12';
  }
}

function styleClasses(s: VideoCTA['style'], p: VideoCTA['position']) {
  const base = `relative rounded-xl px-4 py-3 shadow-2xl ${
    p === 'center-modal' ? 'max-w-md w-full' : ''
  }`;
  switch (s) {
    case 'gradient':
      return `${base} bg-gradient-to-r from-amber-500/90 to-orange-500/90 border border-white/10 backdrop-blur-sm`;
    case 'glass':
      return `${base} bg-white/10 backdrop-blur-md border border-white/20`;
    case 'pulse':
      return `${base} bg-amber-500/90 border border-amber-400/30 backdrop-blur-sm animate-pulse`;
    case 'solid':
    default:
      return `${base} bg-gray-950/95 border border-amber-200/20 backdrop-blur-sm`;
  }
}
