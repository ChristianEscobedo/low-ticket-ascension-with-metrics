/**
 * Adds the optin (lead-magnet) step URL builders to planner/utm.ts.
 *
 * Appended rather than edited in place: the file's existing exports are load
 * bearing and a mis-anchored replace would be worse than a clearly separated
 * section at the end.
 */
const fs = require('fs');

const file = 'src/lib/mothermode/planner/utm.ts';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

if (src.includes('OPTIN_PAGES')) {
  console.log('already present — no changes');
  process.exit(0);
}

src += `
// ============================================================================
// Lead-magnet (optin funnel) destinations
//
// Kept separate from FUNNEL_PAGES on purpose: the two vocabularies are NOT
// interchangeable. A sales funnel has checkout/upsell1..4; an optin funnel has
// an OTO and a thank-you. Merging them into one list would offer steps that
// don't exist for the chosen funnel and mint links to 404s.
// ============================================================================

/** Steps of an optin funnel, in the order a lead walks them. */
export const OPTIN_PAGES = ['optin', 'oto', 'thank-you'] as const;

export type OptinPage = (typeof OPTIN_PAGES)[number];

/**
 * Path for an optin funnel step.
 *
 * Mirrors funnelPagePath's one irregularity: step 1 IS the funnel index
 * (/optin/<slug>), not /optin/<slug>/optin. The routes are
 * src/app/optin/[slug]/{page.tsx, oto, thank-you}, so anything else 404s.
 */
export function optinPagePath(slug: string, page: OptinPage | string): string {
  const s = (slug || '').trim();
  if (!s) return '';
  const p = (page || 'optin').trim();
  return p === 'optin' || p === '' ? \`/optin/\${s}\` : \`/optin/\${s}/\${p}\`;
}

/** Absolute URL for an optin funnel step, given a site origin. */
export function optinPageUrl(
  origin: string,
  slug: string,
  page: OptinPage | string,
): string {
  const path = optinPagePath(slug, page);
  if (!path) return '';
  return \`\${(origin || '').replace(/\\/$/, '')}\${path}\`;
}

/** Human label for an optin step, for dropdowns and card badges. */
export function optinPageLabel(page: OptinPage | string): string {
  const labels: Record<string, string> = {
    optin: 'Opt-in page',
    oto: 'OTO (one-time offer)',
    'thank-you': 'Thank you / delivery',
  };
  return labels[page] || page;
}
`;

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log('added optin step builders to', file);
