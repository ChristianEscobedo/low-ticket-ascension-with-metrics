/**
 * R14: client-side audio waveform peaks for the timeline's audio lane.
 * Fetches the file once (module-level cache), decodes with WebAudio,
 * downsamples to N peak buckets. CORS/host/decode failures all resolve
 * to null — the lane falls back to flat bars and never blocks the timeline.
 */

/** Pure: collapse one channel into `buckets` absolute-max peaks (0..1). */
export function downsamplePeaks(channel: ArrayLike<number>, buckets: number): number[] {
  const n = channel.length;
  if (n === 0 || buckets <= 0) return [];
  const out = new Array<number>(buckets).fill(0);
  const step = n / buckets;
  for (let b = 0; b < buckets; b += 1) {
    const from = Math.floor(b * step);
    const to = Math.min(n, Math.max(from + 1, Math.floor((b + 1) * step)));
    let max = 0;
    for (let i = from; i < to; i += 1) {
      const v = Math.abs(Number(channel[i]) || 0);
      if (v > max) max = v;
    }
    out[b] = max;
  }
  // normalize to 1 so quiet beds still draw visibly
  const peak = out.reduce((m, v) => Math.max(m, v), 0);
  if (peak > 0.001) return out.map((v) => Math.round((v / peak) * 100) / 100);
  return out;
}

/** Don't decode podcasts into the waveform — cap the fetch. */
const MAX_BYTES = 30 * 1024 * 1024;

const cache = new Map<string, Promise<number[] | null>>();

/**
 * Peaks for a URL (cached per URL+buckets). `false`-ish results are cached
 * too — a CORS failure shouldn't re-fetch every render.
 */
export function peaksFor(url: string, buckets = 800): Promise<number[] | null> {
  const key = `${url}#${buckets}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      try {
        if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        const size = Number(res.headers.get('content-length') || 0);
        if (size > MAX_BYTES) return null;
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) return null;
        const ctx = new AudioContext();
        try {
          const audio = await ctx.decodeAudioData(buf);
          const channel = audio.getChannelData(0);
          return downsamplePeaks(channel, buckets);
        } finally {
          void ctx.close().catch(() => {});
        }
      } catch {
        return null;
      }
    })();
    cache.set(key, p);
  }
  return p;
}
