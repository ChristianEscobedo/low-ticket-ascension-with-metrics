'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Captions, ChevronLeft, ChevronRight, ImageIcon, Info, Pause, Play } from 'lucide-react';

// Classic VSL rhythm: one punchy thought per slide, big bold text over the
// b-roll, the narration carried in the notes (not dumped on screen).
export type VSLSlideLayout =
  | 'cover'
  | 'line'
  | 'proof'
  | 'tworoads'
  | 'offer'
  | 'close';

export interface VSLSlide {
  layout?: VSLSlideLayout; // defaults to 'line'
  label: string; // "CH1" / "INTRO"
  timecode?: string; // "0:00 to 0:20"
  title: string;
  kicker?: string; // small line above the headline (cover)
  text?: string; // the big punchy on-screen line (hero)
  sub?: string; // optional short support line under the headline
  vo?: string; // full narration, shown only in notes
  scene?: string; // b-roll prompt (small caption)
  why?: string; // rationale, shown in notes
  shot?: string; // e.g. "Shot 1"
  image?: string; // optional real image URL once rendered
  // proof layout
  stat?: string; // big number, e.g. "$1,000"
  statSub?: string;
  // tworoads layout
  roadLeft?: { title: string; body: string };
  roadRight?: { title: string; body: string };
  // offer layout
  price?: string;
  originalPrice?: string;
  priceNote?: string;
}

interface VSLSlideshowProps {
  deckTitle: string;
  backHref?: string;
  slides: VSLSlide[];
}

export const VSLSlideshow: React.FC<VSLSlideshowProps> = ({ deckTitle, backHref, slides }) => {
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [playing, setPlaying] = useState(false);
  const total = slides.length;
  const s = slides[index];

  const go = useCallback(
    (dir: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + dir))),
    [total],
  );

  // Each beat lingers roughly as long as its narration would take to read.
  const duration = useMemo(() => {
    const words = (s.vo || s.text || s.title || '').trim().split(/\s+/).length;
    return Math.min(9000, Math.max(3400, words * 360));
  }, [s]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); setPlaying((v) => !v); }
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(total - 1);
      else if (e.key.toLowerCase() === 'n') setNotes((v) => !v);
      else if (e.key.toLowerCase() === 'c') setCaptions((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, total]);

  // Autoplay: advance like a video, then stop on the last slide.
  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setIndex((i) => i + 1), duration);
    return () => clearTimeout(t);
  }, [playing, index, total, duration]);

  const progress = total > 1 ? (index / (total - 1)) * 100 : 100;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-amber-200/20">
      <style>{`
        @keyframes vslRise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes vslFade{from{opacity:0}to{opacity:1}}
        @keyframes vslKen{from{transform:scale(1.06)}to{transform:scale(1.18)}}
        @keyframes vslFill{from{width:0%}to{width:100%}}
      `}</style>

      {/* Top bar */}
      <header className="relative z-20 border-b border-amber-200/15 bg-black/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link
            href={backHref || '/millionaire-mindshift/vsl'}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-amber-200 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="text-amber-200/80 text-xs uppercase tracking-[0.16em] font-semibold truncate">
            {deckTitle}
          </span>
          <span className="text-gray-400 text-sm tabular-nums">
            {index + 1} / {total}
          </span>
        </div>
        <div className="h-0.5 bg-white/5">
          <div className="h-full bg-gradient-to-r from-amber-200 to-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {/* Stage */}
      <main className="relative z-10 flex-1 flex overflow-hidden">
        <div key={index} className="w-full" style={{ animation: 'vslFade .45s ease' }}>
          <SlideBody slide={s} notes={notes} />
        </div>

        {/* Burned-in caption, the way a real VSL reads sound-off */}
        {captions && s.vo && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-6">
            <p
              key={`cap-${index}`}
              className="max-w-3xl text-center text-base md:text-xl font-semibold leading-snug text-white"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.95)', animation: 'vslFade .5s ease .15s backwards' }}
            >
              {s.vo}
            </p>
          </div>
        )}
      </main>

      {/* Controls */}
      <footer className="relative z-20 border-t border-amber-200/15 bg-black/70 backdrop-blur-md">
        {/* Per-slide autoplay timer */}
        <div className="h-0.5 bg-white/5">
          {playing && index < total - 1 && (
            <div key={`fill-${index}`} className="h-full bg-amber-300/70" style={{ animation: `vslFill ${duration}ms linear forwards` }} />
          )}
        </div>

        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={() => go(-1)} disabled={index === 0} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Prev</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaying((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-200 to-amber-400 px-5 py-2 text-sm font-bold text-black transition-transform hover:scale-[1.03]"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => setCaptions((v) => !v)} title="Captions (c)" className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${captions ? 'text-amber-100 bg-amber-200/10' : 'text-gray-400 hover:text-amber-200'}`}>
              <Captions className="w-4 h-4" /> <span className="hidden md:inline">CC</span>
            </button>
            <button onClick={() => setNotes((v) => !v)} title="Notes (n)" className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${notes ? 'text-amber-100 bg-amber-200/10' : 'text-gray-400 hover:text-amber-200'}`}>
              <Info className="w-4 h-4" /> <span className="hidden md:inline">Notes</span>
            </button>
          </div>

          <button onClick={() => go(1)} disabled={index === total - 1} className="inline-flex items-center gap-1 rounded-lg border border-amber-200/30 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-200/10 disabled:opacity-30">
            <span className="hidden sm:inline">Next</span> <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Beat scrubber */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex items-center justify-center flex-wrap gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-7 bg-amber-300' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>
      </footer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const Chip: React.FC<{ slide: VSLSlide; center?: boolean }> = ({ slide, center }) => (
  <div className={`flex items-center gap-3 mb-5 ${center ? 'justify-center' : ''}`}>
    <span className="inline-flex items-center rounded-full border border-amber-200/30 bg-white/[0.04] px-3 py-1 text-xs font-bold text-amber-200 tracking-wide">
      {slide.label}
    </span>
    {slide.timecode && <span className="text-gray-500 text-xs tabular-nums">{slide.timecode}</span>}
  </div>
);

// Script + rationale, hidden by default so the slide itself stays clean.
const Notes: React.FC<{ slide: VSLSlide; show: boolean; center?: boolean }> = ({ slide, show, center }) => {
  if (!show || (!slide.vo && !slide.why)) return null;
  return (
    <div className={`mt-8 space-y-3 text-left ${center ? 'max-w-2xl mx-auto' : 'max-w-2xl'}`}>
      {slide.vo && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300 leading-relaxed">
          <span className="text-amber-200/80 font-semibold">Narration: </span>
          {slide.vo}
        </div>
      )}
      {slide.why && (
        <div className="rounded-xl border border-amber-200/15 bg-white/[0.03] px-4 py-3 text-sm text-gray-400 leading-relaxed">
          <span className="text-amber-200/80 font-semibold">Why: </span>
          {slide.why}
        </div>
      )}
    </div>
  );
};

// Tiny muted b-roll note so the storyboard stays useful without cluttering the slide.
const SceneCaption: React.FC<{ slide: VSLSlide; center?: boolean }> = ({ slide, center }) =>
  slide.scene ? (
    <p className={`mt-6 text-xs text-gray-500 leading-relaxed max-w-xl ${center ? 'mx-auto' : ''}`}>
      <span className="text-amber-200/60 font-semibold uppercase tracking-wide">{slide.shot || 'Scene'}:</span> {slide.scene}
    </p>
  ) : null;

// Full-bleed background render with a slow Ken Burns push and a cinematic
// vignette, so even a placeholder beat feels like a moving shot.
const BgScene: React.FC<{ slide: VSLSlide }> = ({ slide }) => (
  <div className="absolute inset-0 z-0 overflow-hidden">
    {slide.image ? (
      <img
        src={slide.image}
        alt={slide.title}
        className="w-full h-full object-cover will-change-transform"
        style={{ animation: 'vslKen 16s ease-out forwards' }}
      />
    ) : (
      <div
        className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center will-change-transform"
        style={{ animation: 'vslKen 16s ease-out forwards' }}
      >
        <div className="flex flex-col items-center text-center opacity-25">
          <ImageIcon className="w-10 h-10 text-amber-200/60 mb-2" />
          <p className="text-amber-100/70 text-sm font-semibold">{slide.shot || 'Scene'} background</p>
        </div>
      </div>
    )}
    {/* bottom-up scrim for caption legibility */}
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/25" />
    {/* edge vignette */}
    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 38%, transparent 45%, rgba(0,0,0,0.88) 100%)' }} />
    {/* warm gold glow toward the headline */}
    <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 55% at 50% 32%, rgba(251,191,36,0.12), transparent 70%)' }} />
  </div>
);

// Kinetic gold headline: words rise in one after another, like a real VSL build.
const GoldHeadline: React.FC<{ children: string; className?: string }> = ({ children, className }) => (
  <h2 className={`font-black leading-[1.04] tracking-tight bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent ${className || ''}`}>
    {children.split(' ').map((w, i) => (
      <span
        key={i}
        className="inline-block will-change-transform"
        style={{ animation: 'vslRise .6s cubic-bezier(.2,.7,.2,1) backwards', animationDelay: `${0.055 * i}s` }}
      >
        {w}&nbsp;
      </span>
    ))}
  </h2>
);

// ---------------------------------------------------------------------------
// Layout switch
// ---------------------------------------------------------------------------

const SlideBody: React.FC<{ slide: VSLSlide; notes: boolean }> = ({ slide, notes }) => {
  switch (slide.layout) {
    case 'cover':
      return <CoverSlide slide={slide} notes={notes} />;
    case 'proof':
      return <ProofSlide slide={slide} notes={notes} />;
    case 'tworoads':
      return <TwoRoadsSlide slide={slide} notes={notes} />;
    case 'offer':
      return <OfferSlide slide={slide} notes={notes} />;
    case 'close':
      return <CloseSlide slide={slide} notes={notes} />;
    case 'line':
    default:
      return <LineSlide slide={slide} notes={notes} />;
  }
};

type LayoutProps = { slide: VSLSlide; notes: boolean };

// Default beat: one big line over the b-roll. The whole deck breathes on this.
const LineSlide: React.FC<LayoutProps> = ({ slide, notes }) => (
  <div className="relative min-h-[72vh] flex items-center justify-center overflow-hidden">
    <BgScene slide={slide} />
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
      <Chip slide={slide} center />
      {slide.text && <GoldHeadline className="text-4xl md:text-6xl">{slide.text}</GoldHeadline>}
      {slide.sub && <p className="mt-6 text-gray-300 text-xl md:text-2xl font-light leading-snug">{slide.sub}</p>}
      <SceneCaption slide={slide} center />
      <Notes slide={slide} show={notes} center />
    </div>
  </div>
);

// Title / opener: centered over a soft full-bleed background.
const CoverSlide: React.FC<LayoutProps> = ({ slide, notes }) => (
  <div className="relative min-h-[72vh] flex items-center justify-center overflow-hidden">
    <BgScene slide={slide} />
    <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
      <Chip slide={slide} center />
      {slide.kicker && <p className="text-amber-200/70 uppercase tracking-[0.25em] text-xs font-semibold mb-4">{slide.kicker}</p>}
      <GoldHeadline className="text-5xl md:text-7xl">{slide.text || slide.title}</GoldHeadline>
      {slide.sub && <p className="mt-6 text-gray-300 text-xl md:text-2xl font-light">{slide.sub}</p>}
      <Notes slide={slide} show={notes} center />
    </div>
  </div>
);

// Big number proof beat.
const ProofSlide: React.FC<LayoutProps> = ({ slide, notes }) => (
  <div className="relative min-h-[72vh] flex items-center justify-center overflow-hidden">
    <BgScene slide={slide} />
    <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
      <Chip slide={slide} center />
      {slide.stat && (
        <div className="mb-5">
          <span className="block text-7xl md:text-9xl font-black bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-transparent tracking-tight">
            {slide.stat}
          </span>
          {slide.statSub && <span className="block text-amber-200/80 text-sm uppercase tracking-[0.2em] font-semibold mt-2">{slide.statSub}</span>}
        </div>
      )}
      {slide.text && <GoldHeadline className="text-3xl md:text-4xl">{slide.text}</GoldHeadline>}
      {slide.sub && <p className="mt-5 text-gray-300 text-lg md:text-xl font-light">{slide.sub}</p>}
      <Notes slide={slide} show={notes} center />
    </div>
  </div>
);

// Two-roads compare beat.
const TwoRoadsSlide: React.FC<LayoutProps> = ({ slide, notes }) => (
  <div className="relative min-h-[72vh] flex items-center overflow-hidden">
    <BgScene slide={slide} />
    <div className="relative z-10 max-w-5xl mx-auto px-4 py-16 w-full">
      <div className="text-center mb-8">
        <Chip slide={slide} center />
        {slide.text && <GoldHeadline className="text-3xl md:text-5xl">{slide.text}</GoldHeadline>}
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <p className="text-gray-500 uppercase tracking-[0.18em] text-xs font-bold mb-3">{slide.roadLeft?.title || 'Stay the same'}</p>
          <p className="text-gray-400 text-lg leading-relaxed">{slide.roadLeft?.body}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/30 bg-amber-200/[0.06] backdrop-blur-sm p-6 relative">
          <ArrowRight className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-amber-300 hidden md:block" />
          <p className="text-amber-200/80 uppercase tracking-[0.18em] text-xs font-bold mb-3">{slide.roadRight?.title || 'Reset'}</p>
          <p className="text-amber-50 text-lg leading-relaxed">{slide.roadRight?.body}</p>
        </div>
      </div>
      <Notes slide={slide} show={notes} center />
    </div>
  </div>
);

// Offer / price reveal.
const OfferSlide: React.FC<LayoutProps> = ({ slide, notes }) => (
  <div className="relative min-h-[72vh] flex items-center justify-center overflow-hidden">
    <BgScene slide={slide} />
    <div className="relative z-10 max-w-2xl mx-auto px-6 py-20 text-center">
      <Chip slide={slide} center />
      {slide.text && <GoldHeadline className="text-3xl md:text-5xl mb-8">{slide.text}</GoldHeadline>}
      <div className="rounded-3xl border border-amber-200/30 bg-black/60 backdrop-blur-sm p-8 inline-block shadow-2xl shadow-amber-500/10">
        {slide.originalPrice && <span className="block text-gray-500 text-2xl line-through">{slide.originalPrice}</span>}
        <span className="block text-6xl md:text-8xl font-black bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-transparent my-2">
          {slide.price || '$27'}
        </span>
        {slide.priceNote && <span className="block text-amber-200/80 text-sm font-semibold tracking-wide">{slide.priceNote}</span>}
      </div>
      {slide.sub && <p className="mt-6 text-gray-300 text-lg font-light">{slide.sub}</p>}
      <Notes slide={slide} show={notes} center />
    </div>
  </div>
);

// Final call to identity.
const CloseSlide: React.FC<LayoutProps> = ({ slide, notes }) => (
  <div className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
    <BgScene slide={slide} />
    <div
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{ background: 'radial-gradient(50% 50% at 50% 60%, rgba(251,191,36,0.18), transparent 70%)' }}
    />
    <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
      <Chip slide={slide} center />
      {slide.text && <GoldHeadline className="text-4xl md:text-6xl">{slide.text}</GoldHeadline>}
      {slide.sub && <p className="mt-6 text-gray-200 text-xl md:text-2xl font-light leading-snug">{slide.sub}</p>}
      <Notes slide={slide} show={notes} center />
    </div>
  </div>
);
