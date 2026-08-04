/**
 * Shared formatting primitives for Help Center seed articles.
 *
 * These emit small HTML blocks with class hooks (`step`, `callout-*`,
 * `intro-box`, `chip`, `table-wrap`, `media-slot`) that are styled by the
 * article stylesheet on the public page and in the admin live-preview iframe.
 * Keeping them as functions guarantees every guide shares the exact same
 * visual language, and lets us restyle everything from one stylesheet.
 */

export interface SeedArticle {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  published: boolean;
  sortOrder: number;
  /** 'admin' (how to run the app) or 'buyer' (public help center). Defaults
   *  to 'admin' everywhere except the buyer seed module. */
  audience?: 'admin' | 'buyer';
}

export interface SeedChangelog {
  version: string | null;
  releasedOn: string; // YYYY-MM-DD
  entryType: 'added' | 'improved' | 'fixed' | 'removed';
  title: string;
  body: string;
  published: boolean;
}

/** A dashed media placeholder block. Drop real media in later via the editor. */
export function media(slug: string, kind: 'video' | 'image', caption: string): string {
  return `<div class="media-slot" data-media="help-media/${slug}/${kind === 'video' ? 'walkthrough.mp4' : 'screenshot.png'}"><p><strong>${kind === 'video' ? 'Video' : 'Image'} placeholder.</strong> ${caption}</p></div>`;
}

/** A numbered step in a how-to walkthrough. Renders as a big-index step card. */
export function step(n: number, title: string, ...body: string[]): string {
  return `<div class="step"><div class="step-head"><span class="step-num">${n}</span><h3>${title}</h3></div><div class="step-body">${body.join('')}</div></div>`;
}

/** A coloured callout box. kind: info (brass) | tip (green) | warn (amber). */
export function callout(kind: 'info' | 'tip' | 'warn', title: string, ...body: string[]): string {
  const label = kind === 'tip' ? 'Tip' : kind === 'warn' ? 'Watch out' : 'Note';
  return `<div class="callout callout-${kind}"><p class="callout-title">${label}: ${title}</p>${body.join('')}</div>`;
}

/** A pill-style intro box placed under the article title: what this is, where it lives, who it is for. */
export function introBox(rows: Array<[string, string]>): string {
  const items = rows
    .map(([k, v]) => `<div class="intro-row"><span class="intro-key">${k}</span><span class="intro-val">${v}</span></div>`)
    .join('');
  return `<div class="intro-box">${items}</div>`;
}

/** A keyboard / click target chip. */
export function chip(label: string): string {
  return `<span class="chip">${label}</span>`;
}

/** A compact data table. */
export function table(headers: string[], rows: string[][]): string {
  const head = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="table-wrap"><table>${head}${body}</table></div>`;
}

export function html(...parts: string[]): string {
  return parts.join('\n').trim();
}
