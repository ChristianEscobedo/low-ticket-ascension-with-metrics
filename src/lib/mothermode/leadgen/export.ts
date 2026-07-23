/**
 * Pure renderers for a Lead Gen document. No React, no DB — deterministic
 * string builders so they can be unit tested and reused by the admin editor
 * (copy / print), the download endpoint, and the Publish-to-Deliverables step.
 *
 *   - docToText: plain-text export for copy-all and .txt download.
 *   - docToDeliverableHtml: the brand-styled HTML body a buyer sees. The markup
 *     mirrors the deliverable document convention (semantic tags + a handful of
 *     data-block classes), so it drops straight into the /mothermode/resource
 *     renderer that already ships in this app.
 *   - docToDeliverableDoc: wraps that HTML into the DeliverableDoc shape
 *     (slug, key, title, subtitle, html) the deliverables store persists.
 */
import type { DocBlock, DocSection, LeadGenDoc } from './types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Escape a string for safe HTML text/attribute interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nonEmpty(items: string[] | undefined): string[] {
  return (items ?? []).map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

function blockToText(block: DocBlock): string {
  const text = (block.text ?? '').trim();
  const items = nonEmpty(block.items);
  const title = (block.title ?? '').trim();
  switch (block.kind) {
    case 'lead':
    case 'p':
      return text;
    case 'h3':
      return text ? `## ${text}` : '';
    case 'pullQuote':
      return text ? `“${text}”` : '';
    case 'ul':
      return items.map((i) => `- ${i}`).join('\n');
    case 'checklist':
      return items.map((i) => `[ ] ${i}`).join('\n');
    case 'note':
      return [title ? `NOTE — ${title}` : 'NOTE', text].filter(Boolean).join('\n');
    case 'nextStep':
      return [title ? `NEXT STEP — ${title}` : 'NEXT STEP', text]
        .filter(Boolean)
        .join('\n');
    case 'template':
      return [title ? `TEMPLATE — ${title}` : 'TEMPLATE', text]
        .filter(Boolean)
        .join('\n');
    default:
      return text;
  }
}

function sectionToText(section: DocSection): string {
  const parts: string[] = [];
  if (section.heading.trim()) parts.push(`# ${section.heading.trim()}`);
  if (section.summary.trim()) parts.push(section.summary.trim());
  for (const block of section.blocks) {
    const t = blockToText(block);
    if (t) parts.push(t);
  }
  for (const lesson of section.lessons ?? []) {
    if (lesson.title.trim()) parts.push(`### ${lesson.title.trim()}`);
    for (const block of lesson.blocks) {
      const t = blockToText(block);
      if (t) parts.push(t);
    }
  }
  return parts.join('\n\n');
}

/** Full plain-text export of the document. */
export function docToText(doc: LeadGenDoc): string {
  const parts: string[] = [];
  if (doc.title.trim()) parts.push(doc.title.trim().toUpperCase());
  if (doc.subtitle.trim()) parts.push(doc.subtitle.trim());
  if (doc.hook.trim()) parts.push(doc.hook.trim());
  for (const section of doc.sections) {
    const t = sectionToText(section);
    if (t) parts.push(t);
  }
  const cta = doc.cta;
  if (cta.title.trim() || cta.body.trim() || cta.button.trim()) {
    parts.push(
      [
        cta.title.trim() ? `→ ${cta.title.trim()}` : '',
        cta.body.trim(),
        cta.button.trim() ? `[ ${cta.button.trim()} ]` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return parts.join('\n\n').trim();
}

// ---------------------------------------------------------------------------
// HTML (brand-styled deliverable body)
// ---------------------------------------------------------------------------

function blockToHtml(block: DocBlock): string {
  const text = escapeHtml((block.text ?? '').trim());
  const title = escapeHtml((block.title ?? '').trim());
  const items = nonEmpty(block.items).map(escapeHtml);
  switch (block.kind) {
    case 'lead':
      return text ? `<p class="lead">${text}</p>` : '';
    case 'p':
      return text ? `<p>${text}</p>` : '';
    case 'h3':
      return text ? `<h3>${text}</h3>` : '';
    case 'pullQuote':
      return text ? `<blockquote class="pull-quote">${text}</blockquote>` : '';
    case 'ul':
      return items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '';
    case 'checklist':
      return items.length
        ? `<ul class="checklist">${items
            .map((i) => `<li><span class="box"></span>${i}</li>`)
            .join('')}</ul>`
        : '';
    case 'note':
      return text || title
        ? `<aside class="note">${title ? `<strong>${title}</strong>` : ''}${
            text ? `<p>${text}</p>` : ''
          }</aside>`
        : '';
    case 'nextStep':
      return text || title
        ? `<aside class="next-step">${
            title ? `<strong>${title}</strong>` : ''
          }${text ? `<p>${text}</p>` : ''}</aside>`
        : '';
    case 'template':
      return text || title
        ? `<div class="template-block">${
            title ? `<div class="template-label">${title}</div>` : ''
          }${text ? `<pre>${text}</pre>` : ''}</div>`
        : '';
    default:
      return text ? `<p>${text}</p>` : '';
  }
}

function sectionToHtml(section: DocSection): string {
  const parts: string[] = ['<section class="doc-section">'];
  if (section.heading.trim()) parts.push(`<h2>${escapeHtml(section.heading.trim())}</h2>`);
  if (section.summary.trim())
    parts.push(`<p class="section-summary">${escapeHtml(section.summary.trim())}</p>`);
  for (const block of section.blocks) parts.push(blockToHtml(block));
  for (const lesson of section.lessons ?? []) {
    parts.push('<div class="lesson">');
    if (lesson.title.trim()) parts.push(`<h3>${escapeHtml(lesson.title.trim())}</h3>`);
    for (const block of lesson.blocks) parts.push(blockToHtml(block));
    parts.push('</div>');
  }
  parts.push('</section>');
  return parts.filter(Boolean).join('\n');
}

/**
 * Scoped stylesheet that travels with the deliverable body. Every selector is
 * namespaced under `.lead-gen-doc`, so it styles this document without leaking
 * into (or being overridden by) the host page. This makes a published lead
 * magnet render as a polished, print-ready document anywhere the HTML is
 * injected, including ultra-long-form ebooks with many sections.
 */
export const LEAD_GEN_STYLES = `
.lead-gen-doc{max-width:44rem;margin:0 auto;padding:0 1rem 4rem;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.7;font-size:1.05rem;-webkit-font-smoothing:antialiased;}
.lead-gen-doc .doc-cover{display:block;width:100%;height:auto;border-radius:14px;margin:0 0 2rem;box-shadow:0 12px 30px rgba(0,0,0,.12);}
.lead-gen-doc .doc-header{margin:0 0 1.5rem;padding-bottom:1.25rem;border-bottom:2px solid #ececec;}
.lead-gen-doc .doc-header h1{font-size:2.25rem;line-height:1.15;margin:0 0 .5rem;letter-spacing:-.01em;}
.lead-gen-doc .doc-subtitle{font-size:1.2rem;color:#555;margin:0;font-weight:500;}
.lead-gen-doc .doc-hook{font-size:1.15rem;color:#333;background:#f7f7f5;border-left:4px solid #c9a24b;padding:1rem 1.25rem;border-radius:0 8px 8px 0;margin:0 0 2.5rem;}
.lead-gen-doc .doc-section{margin:0 0 2.75rem;}
.lead-gen-doc .doc-section h2{font-size:1.6rem;line-height:1.2;margin:0 0 .5rem;padding-top:1rem;letter-spacing:-.01em;}
.lead-gen-doc .section-summary{color:#666;font-style:italic;margin:0 0 1.25rem;}
.lead-gen-doc h3{font-size:1.2rem;margin:1.75rem 0 .5rem;}
.lead-gen-doc p{margin:0 0 1rem;}
.lead-gen-doc p.lead{font-size:1.15rem;font-weight:500;color:#111;}
.lead-gen-doc ul{margin:0 0 1.25rem;padding-left:1.4rem;}
.lead-gen-doc ul li{margin:0 0 .5rem;}
.lead-gen-doc ul.checklist{list-style:none;padding-left:0;}
.lead-gen-doc ul.checklist li{position:relative;padding-left:2rem;margin:0 0 .65rem;}
.lead-gen-doc ul.checklist .box{position:absolute;left:0;top:.15rem;width:1.15rem;height:1.15rem;border:2px solid #c9a24b;border-radius:4px;display:inline-block;}
.lead-gen-doc blockquote.pull-quote{margin:1.75rem 0;padding:.5rem 0 .5rem 1.5rem;border-left:4px solid #c9a24b;font-size:1.35rem;font-style:italic;color:#222;line-height:1.4;}
.lead-gen-doc aside.note,.lead-gen-doc aside.next-step{margin:1.5rem 0;padding:1.1rem 1.35rem;border-radius:10px;background:#f7f7f5;border:1px solid #e6e6e0;}
.lead-gen-doc aside.next-step{background:#fbf7ec;border-color:#eadfbf;}
.lead-gen-doc aside.note strong,.lead-gen-doc aside.next-step strong{display:block;margin:0 0 .4rem;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:#8a7327;}
.lead-gen-doc aside.note p,.lead-gen-doc aside.next-step p{margin:0;}
.lead-gen-doc .template-block{margin:1.5rem 0;border:1px dashed #c9a24b;border-radius:10px;overflow:hidden;}
.lead-gen-doc .template-label{background:#c9a24b;color:#fff;font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;padding:.45rem .9rem;font-weight:600;}
.lead-gen-doc .template-block pre{margin:0;padding:1rem 1.1rem;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.95rem;line-height:1.6;background:#fbfbf9;}
.lead-gen-doc .doc-cta{margin:3rem 0 0;padding:2rem 1.75rem;border-radius:14px;background:#1a1a1a;color:#f7f7f5;text-align:center;}
.lead-gen-doc .doc-cta h2{margin:0 0 .6rem;font-size:1.6rem;color:#fff;}
.lead-gen-doc .doc-cta p{margin:0 0 1.25rem;color:#d8d8d2;}
.lead-gen-doc .cta-button{display:inline-block;background:#c9a24b;color:#1a1a1a;font-weight:700;padding:.85rem 1.75rem;border-radius:999px;font-size:1.05rem;}
@media print{.lead-gen-doc{max-width:none;}.lead-gen-doc .doc-section{page-break-inside:avoid;}}
`.trim();

/**
 * Brand-styled HTML body for the buyer-facing deliverable. A scoped <style>
 * block travels with the body so it renders as a polished document wherever the
 * HTML is injected, without leaking styles into the host page. No <html>/<head>
 * wrapper — the resource page supplies the shell.
 */
export function docToDeliverableHtml(doc: LeadGenDoc): string {
  const parts: string[] = [];

  parts.push(`<style>${LEAD_GEN_STYLES}</style>`);
  parts.push('<article class="lead-gen-doc">');


  if (doc.coverImageUrl.trim()) {
    parts.push(
      `<img class="doc-cover" src="${escapeHtml(doc.coverImageUrl.trim())}" alt="${escapeHtml(
        doc.title.trim() || 'Cover',
      )}" />`,
    );
  }

  parts.push('<header class="doc-header">');
  if (doc.title.trim()) parts.push(`<h1>${escapeHtml(doc.title.trim())}</h1>`);
  if (doc.subtitle.trim())
    parts.push(`<p class="doc-subtitle">${escapeHtml(doc.subtitle.trim())}</p>`);
  parts.push('</header>');

  if (doc.hook.trim()) parts.push(`<p class="doc-hook">${escapeHtml(doc.hook.trim())}</p>`);

  for (const section of doc.sections) parts.push(sectionToHtml(section));

  const cta = doc.cta;
  if (cta.title.trim() || cta.body.trim() || cta.button.trim()) {
    parts.push('<section class="doc-cta">');
    if (cta.title.trim()) parts.push(`<h2>${escapeHtml(cta.title.trim())}</h2>`);
    if (cta.body.trim()) parts.push(`<p>${escapeHtml(cta.body.trim())}</p>`);
    if (cta.button.trim())
      parts.push(`<div class="cta-button">${escapeHtml(cta.button.trim())}</div>`);
    parts.push('</section>');
  }

  parts.push('</article>');
  return parts.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Deliverable doc
// ---------------------------------------------------------------------------

/** The DeliverableDoc shape the deliverables store persists and resolve reads. */
export interface DeliverableDocShape {
  slug: string;
  key: string;
  title: string;
  subtitle: string;
  html: string;
}

/**
 * Wrap a document into a publishable DeliverableDoc for (slug, key). The
 * resulting object is what upsertDeliverable stores and the buyer page renders.
 */
export function docToDeliverableDoc(
  doc: LeadGenDoc,
  slug: string,
  key: string,
): DeliverableDocShape {
  return {
    slug,
    key,
    title: doc.title.trim() || key,
    subtitle: doc.subtitle.trim(),
    html: docToDeliverableHtml(doc),
  };
}
