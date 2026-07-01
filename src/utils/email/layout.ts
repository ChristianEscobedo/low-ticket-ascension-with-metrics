/**
 * MotherMode email layout. A pure, dependency-free renderer that turns a
 * structured {@link EmailDoc} into email-client-safe HTML (table + inline CSS)
 * plus a plaintext fallback. Shared by transactional receipts, per-offer
 * purchase emails, and the re-engagement sequences so every send carries the
 * same Editorial Warm look.
 *
 * Kept free of server-only imports (no supabase / next) so the admin editor
 * preview can render through the exact same code path as the sender.
 *
 * Voice rules apply to all copy passed in: no em dashes, no NO-list words.
 * Token markers like {{name}} are left intact for the render pipeline to fill.
 */
import { BRAND, FOUNDER, PALETTE as C } from '@/lib/mothermode/brand';

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  button?: EmailButton;
}

export interface EmailReceiptRow {
  label: string;
  value: string;
}

export interface EmailDoc {
  /** Hidden inbox-preview line. */
  preheader?: string;
  /** Small brass label above the title. */
  eyebrow?: string;
  title: string;
  /** Lead paragraphs under the title. */
  intro?: string[];
  sections?: EmailSection[];
  /** Primary call to action, rendered after the sections. */
  cta?: EmailButton;
  /** Optional details panel (amount / product / reference). */
  receipt?: EmailReceiptRow[];
  /** Closing paragraphs before the signoff. */
  outro?: string[];
  /** Signoff name + role. Defaults to the founder. */
  signName?: string;
  signRole?: string;
}

const FONT_SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_SERIF = "Georgia,'Times New Roman',serif";

const para = (t: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:${C.ink};font-family:${FONT_SANS}">${t}</p>`;

const heading = (t: string) =>
  `<h2 style="margin:30px 0 12px;font-size:19px;line-height:1.3;color:${C.ink};font-family:${FONT_SERIF};font-weight:700">${t}</h2>`;

const bullets = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">${items
    .map(
      (it) =>
        `<tr><td valign="top" style="width:22px;padding:5px 0;color:${C.brass};font-size:16px;line-height:1.6">&bull;</td><td style="padding:5px 0;font-size:16px;line-height:1.6;color:${C.ink};font-family:${FONT_SANS}">${it}</td></tr>`,
    )
    .join('')}</table>`;

const button = (b: EmailButton) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td align="center" style="background:${C.mode};border-radius:10px">` +
  `<a href="${b.url}" style="display:inline-block;padding:15px 30px;font-size:15px;font-weight:700;letter-spacing:0.01em;color:${C.bone};text-decoration:none;font-family:${FONT_SANS}">${b.label}</a>` +
  `</td></tr></table>`;

const receiptPanel = (rows: EmailReceiptRow[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid rgba(168,139,92,0.35);border-radius:12px;background:rgba(168,139,92,0.07)">` +
  rows
    .map(
      (r, i) =>
        `<tr><td style="padding:12px 18px;font-size:13px;color:${C.mode};font-family:${FONT_SANS}${i > 0 ? ';border-top:1px solid rgba(168,139,92,0.2)' : ''}">${r.label}</td>` +
        `<td style="padding:12px 18px;text-align:right;font-size:14px;color:${C.ink};font-family:${FONT_SANS}${i > 0 ? ';border-top:1px solid rgba(168,139,92,0.2)' : ''}">${r.value}</td></tr>`,
    )
    .join('') +
  `</table>`;

const renderSection = (s: EmailSection) =>
  [
    s.heading ? heading(s.heading) : '',
    ...(s.paragraphs ?? []).map(para),
    s.bullets && s.bullets.length ? bullets(s.bullets) : '',
    s.button ? button(s.button) : '',
  ].join('');

/** Render an {@link EmailDoc} to themed HTML + a plaintext fallback. */
export function renderEmail(doc: EmailDoc): { html: string; text: string } {
  const signName = doc.signName ?? FOUNDER.name;
  const signRole = doc.signRole ?? FOUNDER.role;
  const body =
    (doc.eyebrow
      ? `<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${C.brass};font-weight:700;margin:0 0 12px;font-family:${FONT_SANS}">${doc.eyebrow}</div>`
      : '') +
    `<h1 style="margin:0 0 20px;font-size:27px;line-height:1.25;color:${C.mode};font-family:${FONT_SERIF};font-weight:700">${doc.title}</h1>` +
    (doc.intro ?? []).map(para).join('') +
    (doc.sections ?? []).map(renderSection).join('') +
    (doc.cta ? button(doc.cta) : '') +
    (doc.receipt && doc.receipt.length ? receiptPanel(doc.receipt) : '') +
    (doc.outro ?? []).map(para).join('') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:34px 0 0;border-top:1px solid rgba(168,139,92,0.3)"><tr><td style="padding:22px 0 0">` +
    `<p style="margin:0 0 2px;font-size:16px;color:${C.ink};font-family:${FONT_SERIF}">${signName}</p>` +
    `<p style="margin:0;font-size:13px;color:${C.mode};font-family:${FONT_SANS}">${signRole}</p>` +
    `</td></tr></table>`;

  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:${C.bone}">` +
    (doc.preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${doc.preheader}</div>`
      : '') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bone}"><tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFDF9;border:1px solid rgba(168,139,92,0.25);border-radius:18px;overflow:hidden">` +
    `<tr><td style="background:${C.mode};padding:22px 40px;border-bottom:3px solid ${C.brass}">` +
    `<span style="font-size:18px;letter-spacing:0.04em;color:${C.bone};font-family:${FONT_SERIF};font-weight:700">${BRAND.name}</span>` +
    `<span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(245,241,235,0.7);font-family:${FONT_SANS};float:right;padding-top:6px">${BRAND.categoryLine}</span>` +
    `</td></tr>` +
    `<tr><td style="padding:38px 40px 34px">${body}</td></tr>` +
    `<tr><td style="background:${C.bone};padding:20px 40px;border-top:1px solid rgba(168,139,92,0.25)">` +
    `<p style="margin:0;font-size:12px;line-height:1.6;color:${C.mushroom};font-family:${FONT_SANS}">${BRAND.name}. ${BRAND.brandLine} If anything looks off, just reply to this email and a real person will help.</p>` +
    `</td></tr></table></td></tr></table></body></html>`;

  const text = renderText(doc, signName, signRole);
  return { html, text };
}

function renderText(doc: EmailDoc, signName: string, signRole: string): string {
  const lines: string[] = [BRAND.name.toUpperCase(), ''];
  if (doc.eyebrow) lines.push(doc.eyebrow.toUpperCase(), '');
  lines.push(doc.title, '');
  for (const p of doc.intro ?? []) lines.push(p, '');
  for (const s of doc.sections ?? []) {
    if (s.heading) lines.push(s.heading, '');
    for (const p of s.paragraphs ?? []) lines.push(p, '');
    for (const b of s.bullets ?? []) lines.push(`- ${b}`);
    if (s.bullets && s.bullets.length) lines.push('');
    if (s.button) lines.push(`${s.button.label}: ${s.button.url}`, '');
  }
  if (doc.cta) lines.push(`${doc.cta.label}: ${doc.cta.url}`, '');
  for (const r of doc.receipt ?? []) lines.push(`${r.label}: ${r.value}`);
  if (doc.receipt && doc.receipt.length) lines.push('');
  for (const p of doc.outro ?? []) lines.push(p, '');
  lines.push(signName, signRole);
  return lines.join('\n');
}
