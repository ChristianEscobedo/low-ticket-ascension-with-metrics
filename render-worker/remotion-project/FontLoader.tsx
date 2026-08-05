// @ts-nocheck — compiled by Remotion's bundler, same as the other files here.
/**
 * Blocks the render until the caption webfonts are actually usable.
 *
 * THE BUG THIS FIXES
 * ------------------
 * Captions rendered in the wrong typeface. `captionCssFor()` asked for Anton /
 * Inter, the editor preview loaded those from fonts.googleapis.com at runtime,
 * but this container never did — and its image installs only Noto. Chromium
 * silently fell back to Noto Sans, so the MP4 came out with correct timing,
 * colour, position and animation but the wrong face. Identical CSS on both
 * sides; missing font file on one.
 *
 * WHY delayRender IS THE WHOLE POINT
 * ----------------------------------
 * Injecting a <link> is not enough. Remotion screenshots frames as fast as it
 * can, and a webfont arrives asynchronously — so without an explicit gate the
 * early frames get captured mid-load and the fallback face is burned into the
 * video permanently. Unlike a normal web page, there is no "it'll repaint in a
 * moment" here: whatever is on screen at capture time IS the output. So we hold
 * the render open until document.fonts reports the faces ready.
 */
import React from 'react';
import { continueRender, delayRender } from 'remotion';

/** Mirrors CaptionFont in src/lib/mothermode/reel/captionFonts.ts. */
type PlanFont = { family: string; cssUrl: string; weights?: number[] };

/**
 * Anton publishes a single 400 face. Asking css2 for a weight a family doesn't
 * have returns HTTP 400 and the whole stylesheet fails — which would quietly
 * restore the exact fallback bug this file exists to prevent. So: no `wght`
 * axis unless we know the family has one.
 */
const KNOWN_AXES: Record<string, string | null> = {
  Anton: null,
  Inter: 'wght@100..900',
};

const SYSTEM_FAMILIES = new Set([
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
]);

function googleFontUrl(family: string): string {
  const axis = family in KNOWN_AXES ? KNOWN_AXES[family] : null;
  const spec = axis ? `${family}:${axis}` : family;
  // display=block, never swap: a swap would paint a fallback face first, and in
  // a frame render that fallback becomes a permanent frame.
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec).replace(
    /%20/g,
    '+',
  )}&display=block`;
}

/**
 * What must be loaded. `plan.fonts` (resolved app-side, and the path that makes
 * custom/self-hosted faces work) wins; otherwise fall back to deriving it from
 * the caption style so this still does the right thing for older plans.
 */
function fontsToLoad(plan: any): PlanFont[] {
  const fromPlan: PlanFont[] = Array.isArray(plan?.fonts) ? plan.fonts : [];
  if (fromPlan.length > 0) return fromPlan;

  const style = plan?.captionStyle ?? {};
  const family = typeof style.font === 'string' ? style.font.trim() : '';
  if (!family || SYSTEM_FAMILIES.has(family)) return [];

  const weight = typeof style.weight === 'number' ? style.weight : 400;
  return [
    {
      family,
      cssUrl:
        typeof style.fontUrl === 'string' && style.fontUrl.trim()
          ? style.fontUrl.trim()
          : googleFontUrl(family),
      weights: [400, weight],
    },
  ];
}

export const FontLoader: React.FC<{ plan: any; children: React.ReactNode }> = ({
  plan,
  children,
}) => {
  const fonts = React.useMemo(() => fontsToLoad(plan), [plan]);
  const [handle] = React.useState(() =>
    delayRender('Loading caption webfonts'),
  );
  const done = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (cancelled || done.current) return;
      done.current = true;
      continueRender(handle);
    };

    if (fonts.length === 0) {
      finish();
      return;
    }

    for (const font of fonts) {
      if (document.querySelector(`link[data-caption-font="${font.family}"]`)) {
        continue;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = font.cssUrl;
      link.setAttribute('data-caption-font', font.family);
      document.head.appendChild(link);
    }

    // Ask for each face explicitly. `document.fonts.ready` alone resolves once
    // *pending* work settles, and a face nothing has requested yet may not be
    // pending at all — so load() the exact family/weight combinations first.
    const wanted = fonts.flatMap((font) =>
      (font.weights?.length ? font.weights : [400]).map((w) =>
        document.fonts
          .load(`${w} 100px "${font.family}"`)
          .catch(() => undefined),
      ),
    );

    // A dead CDN must not hang the render forever — a late caption in the wrong
    // font beats a job that never returns. Loud, because a silent fallback here
    // is precisely the failure that shipped.
    const timeout = setTimeout(() => {
      if (!done.current) {
        console.warn(
          `[FontLoader] Timed out after 20s waiting for: ${fonts
            .map((f) => f.family)
            .join(', ')}. Captions may render in a fallback face.`,
        );
        finish();
      }
    }, 20_000);

    Promise.all(wanted)
      .then(() => document.fonts.ready)
      .then(finish)
      .catch(finish)
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [fonts, handle]);

  return <>{children}</>;
};
