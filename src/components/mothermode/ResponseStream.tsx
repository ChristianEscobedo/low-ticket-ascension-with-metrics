'use client';

/**
 * ResponseStream — the AI's answer reveals word-by-word with a soft fade, the
 * streaming-text effect. Splits on whitespace (keeping it, so the spacing
 * survives), reveals one token at a time on a timer. Re-runs when the text
 * changes (a new answer streams in fresh).
 */
import { useEffect, useState } from 'react';

export function ResponseStream({
  textStream,
  fadeDuration = 350,
  segmentDelay = 22,
  className,
}: {
  textStream: string;
  /** How long each word's fade takes (ms). */
  fadeDuration?: number;
  /** The gap between words (ms) — the stream's speed. */
  segmentDelay?: number;
  className?: string;
}) {
  // Split into words + the whitespace between them, so the stream keeps the
  // text's spacing and line breaks.
  const tokens = textStream.split(/(\s+)/).filter((t) => t.length > 0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (tokens.length === 0) return;
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= tokens.length) window.clearInterval(t);
    }, segmentDelay);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textStream, segmentDelay]);

  return (
    <span className={className}>
      {/* the fade keyframe, injected once */}
      <style>{`@keyframes mmStreamFade{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}`}</style>
      {tokens.slice(0, shown).map((tok, i) => (
        <span
          key={i}
          style={{
            whiteSpace: 'pre-wrap',
            animation: `mmStreamFade ${fadeDuration}ms ease-out both`,
          }}
        >
          {tok}
        </span>
      ))}
    </span>
  );
}

export default ResponseStream;
