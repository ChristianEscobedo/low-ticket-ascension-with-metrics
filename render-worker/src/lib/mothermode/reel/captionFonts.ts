/**
 * Caption webfont resolution — shared by the editor preview and the renderer.
 *
 * WHY THIS EXISTS
 * ---------------
 * `fontStackFor()` in captions.ts emits families like `"Anton", …` and
 * `"Inter", …`. The editor preview looked right because the studio page injects
 * a <link> to fonts.googleapis.com at runtime. The render worker never did, and
 * its Docker image installs only Noto — so headless Chromium silently fell back
 * to Noto Sans and every burned caption came out in the wrong typeface. The CSS
 * was identical on both sides; the *font file* was missing on one.
 *
 * The fix is NOT to bake fonts into the image. That can only ever cover fonts
 * we shipped, and custom styles let a user name any family. Instead the font is
 * resolved here, travels inside the RenderPlan as a URL, and the worker loads
 * whatever it is told to load. One resolver, both surfaces, no drift, and
 * custom families work by construction.
 */

/** A font the renderer must load before it may draw a single frame. */
export interface CaptionFont {
  /** The family name exactly as it appears in the CSS font stack. */
  family: string;
  /** Stylesheet URL (Google Fonts css2, or a self-hosted @font-face sheet). */
  cssUrl: string;
  /** Weights the style actually asks for — used to block on the right faces. */
  weights: number[];
}

/**
 * Families whose available weights we know. Getting this wrong is not cosmetic:
 * asking fonts.googleapis.com for a weight a family does NOT publish returns
 * HTTP 400 and the whole stylesheet fails, which would silently reinstate the
 * very fallback bug this module exists to kill.
 *
 * Anton is the trap — it ships a single 400 face. Presets ask it for 900, and
 * the browser synthesises that. So we must request Anton with no `wght` axis
 * at all and let synthesis happen, exactly as the preview already does.
 */
const KNOWN_AXES: Record<string, string | null> = {
  // family -> `wght` axis value, or null to request no axis at all
  Anton: null,
  Inter: 'wght@100..900',
};

/** Families the browser resolves locally; never fetch these. */
const SYSTEM_FAMILIES = new Set([
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'Courier New',
]);

/**
 * Split a CSS font stack into bare family names.
 * `'"Anton", Inter, system-ui, sans-serif'` -> `['Anton', 'Inter', …]`
 */
export function familiesInStack(stack: string): string[] {
  return stack
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** Build the Google Fonts css2 URL for one family. */
export function googleFontUrl(family: string): string {
  const axis = family in KNOWN_AXES ? KNOWN_AXES[family] : null;
  const spec = axis ? `${family}:${axis}` : family;
  // `display=block` (not swap): a swap would let Chromium paint a fallback face
  // first, and in a frame-by-frame render that fallback becomes a permanently
  // burned-in frame. Block waits instead.
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec).replace(
    /%20/g,
    '+',
  )}&display=block`;
}

/**
 * Every webfont a caption style needs, ready to be embedded in a RenderPlan.
 *
 * `fontUrl` on the style def wins when present — that's the escape hatch for a
 * genuinely custom or self-hosted face, so a user is never limited to Google's
 * catalogue.
 */
export function captionFontsFor(def: {
  font?: string;
  weight?: number;
  fontUrl?: string;
}): CaptionFont[] {
  const family = (def.font ?? '').trim();
  if (!family || SYSTEM_FAMILIES.has(family)) return [];

  const weights = [400, def.weight ?? 400].filter(
    (w, i, all) => all.indexOf(w) === i,
  );

  return [
    {
      family,
      cssUrl: def.fontUrl?.trim() || googleFontUrl(family),
      weights,
    },
  ];
}
