/**
 * Pure export/render helpers for an email sequence. No server or DB imports so
 * the API boundary, the editor, and the tests can share one renderer.
 *
 * Two surfaces:
 *   - sequenceToText:  a copy-paste plain-text bundle of the whole sequence.
 *   - renderEmailHtml / sequenceToHtml: brand-styled, inline-CSS HTML suitable
 *     for pasting into an ESP. bodyText is the source of truth; HTML is derived
 *     from it so the two never drift.
 *
 * The plain-text body uses blank-line-separated paragraphs; the HTML renderer
 * turns each paragraph into a <p> and any line that starts with "- " into a
 * bullet list, which is all the structure our frameworks emit.
 */
import type { EmailMessage, EmailSequence } from './types';
import { EMAIL_FRAMEWORK_SPECS } from './frameworks';
import { EMAIL_CAMPAIGN_SPECS } from './campaigns';
import type { EmailCampaignType } from './types';
import { htmlToPromptText, looksLikeHtml } from '../richtext';
import { applyEmailTokens } from './tokens';
import { renderEmail, type EmailDoc, type EmailSection } from '@/utils/email/layout';
import { PALETTE as C } from '@/lib/mothermode/brand';

const BODY_FONT_SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const BODY_FONT_SERIF = "Georgia,'Times New Roman',serif";

/** Tags we keep (with inline styling) when converting kit HTML for email. */
const ALLOWED_BODY_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'h2', 'h3',
  'ul', 'ol', 'li', 'blockquote', 'hr', 'img', 'span',
]);

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

/** Render one email as a labeled plain-text block. */
export function emailToText(email: EmailMessage, index: number): string {
  const lines: string[] = [];
  lines.push(`=== Email ${index + 1} · ${email.role} · ${email.sendOffset} ===`);
  lines.push(`Subject: ${email.subject}`);
  if (email.subjectIdeas.length) {
    lines.push(`Alt subjects: ${email.subjectIdeas.join(' | ')}`);
  }
  if (email.preview) lines.push(`Preview: ${email.preview}`);
  lines.push('');
  lines.push(htmlToPromptText(email.bodyText));
  if (email.cta.label) {
    lines.push('');
    lines.push(`CTA: ${email.cta.label}${email.cta.url ? ` -> ${email.cta.url}` : ''}`);
  }
  return lines.join('\n');
}

/**
 * Render the whole sequence as a single plain-text bundle. When `values` are
 * supplied (e.g. custom-token defaults at export time), matching `{{token}}`
 * markers resolve; any token without a value is preserved for the ESP to fill.
 */
export function sequenceToText(
  sequence: EmailSequence,
  values: Record<string, string> = {},
): string {
  const header = [
    sequence.name || 'Email sequence',
    sequence.goal ? `Goal: ${sequence.goal}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const blocks = sequence.emails.map((e, i) => emailToText(e, i));
  const out = [header, '', ...blocks].join('\n\n').trim() + '\n';
  return applyEmailTokens(out, values);
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Turn a flattened plain-text body into the structured {@link EmailSection}[]
 * the brand layout renders. Blank lines split blocks; a block whose every line
 * starts with "- " becomes a bullet section, otherwise a paragraph section.
 * Text is HTML-escaped here because {@link renderEmail} injects section content
 * verbatim. `{{token}}` markers survive escaping untouched, so they flow into
 * the output for the ESP to fill at send time.
 */
function bodyTextToSections(bodyText: string): EmailSection[] {
  const blocks = bodyText.trim().split(/\n{2,}/).filter((b) => b.trim());
  return blocks.map((block) => {
    const rows = block.split('\n');
    const isList = rows.length > 0 && rows.every((r) => /^\s*-\s+/.test(r));
    if (isList) {
      return {
        bullets: rows.map((r) => escapeHtml(r.replace(/^\s*-\s+/, ''))),
      };
    }
    return { paragraphs: [escapeHtml(block).replace(/\n/g, '<br/>')] };
  });
}

/** Pull a text-align value out of a raw tag attribute string, if present. */
function extractAlign(attrs: string): string {
  const m = /text-align:\s*(left|right|center|justify)/i.exec(attrs);
  return m ? m[1].toLowerCase() : '';
}

/**
 * Convert kit-editor HTML into email-client-safe HTML with inline CSS. Keeps a
 * small whitelist (headings, lists, blockquote, rule, links, images, color +
 * highlight spans, and basic marks), inlines brand styling, and preserves
 * {{token}} markers. Anything outside the whitelist (script/style/divs) is
 * dropped so recipients see the admin's formatting without unsafe markup.
 * NOTE: admin-authored input only; this is not a sanitizer for untrusted HTML.
 */
export function emailBodyHtml(input: string): string {
  if (!input) return '';
  let html = input;

  html = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');

  html = html.replace(/<h2([^>]*)>/gi, (_m, a: string) => {
    const al = extractAlign(a);
    return `<h2 style="margin:26px 0 10px;font-size:20px;line-height:1.3;color:${C.ink};font-family:${BODY_FONT_SERIF};font-weight:700${al ? `;text-align:${al}` : ''}">`;
  });
  html = html.replace(/<h3([^>]*)>/gi, (_m, a: string) => {
    const al = extractAlign(a);
    return `<h3 style="margin:20px 0 8px;font-size:16px;line-height:1.35;color:${C.ink};font-family:${BODY_FONT_SERIF};font-weight:700${al ? `;text-align:${al}` : ''}">`;
  });
  html = html.replace(/<p([^>]*)>/gi, (_m, a: string) => {
    const al = extractAlign(a);
    return `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:${C.ink};font-family:${BODY_FONT_SANS}${al ? `;text-align:${al}` : ''}">`;
  });
  html = html.replace(
    /<blockquote[^>]*>/gi,
    `<blockquote style="margin:18px 0;padding:8px 0 8px 16px;border-left:3px solid ${C.brass};color:${C.mushroom};font-style:italic;font-family:${BODY_FONT_SANS}">`,
  );
  html = html.replace(
    /<hr\s*\/?>/gi,
    `<hr style="border:none;border-top:1px solid rgba(168,139,92,0.3);margin:22px 0"/>`,
  );
  html = html.replace(
    /<ul[^>]*>/gi,
    `<ul style="margin:4px 0 18px;padding-left:22px;color:${C.ink};font-family:${BODY_FONT_SANS};font-size:16px;line-height:1.6">`,
  );
  html = html.replace(
    /<ol[^>]*>/gi,
    `<ol style="margin:4px 0 18px;padding-left:22px;color:${C.ink};font-family:${BODY_FONT_SANS};font-size:16px;line-height:1.6">`,
  );
  html = html.replace(/<li[^>]*>/gi, `<li style="margin:6px 0">`);

  html = html.replace(/<a\b([^>]*)>/gi, (_m, a: string) => {
    const href = /href=["']([^"']*)["']/i.exec(a)?.[1] ?? '#';
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${C.brass};text-decoration:underline">`;
  });

  html = html.replace(/<img\b([^>]*?)\/?>/gi, (_m, a: string) => {
    const src = /src=["']([^"']*)["']/i.exec(a)?.[1];
    if (!src) return '';
    const alt = /alt=["']([^"']*)["']/i.exec(a)?.[1] ?? '';
    return `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:16px 0"/>`;
  });

  html = html.replace(/<span\b([^>]*)>/gi, (_m, a: string) => {
    const color = /(?:^|[^-])color:\s*([^;"']+)/i.exec(a)?.[1]?.trim();
    return color ? `<span style="color:${color}">` : '<span>';
  });

  html = html.replace(/<mark\b([^>]*)>/gi, (_m, a: string) => {
    const bg =
      /background(?:-color)?:\s*([^;"']+)/i.exec(a)?.[1]?.trim() ||
      /data-color=["']([^"']*)["']/i.exec(a)?.[1]?.trim() ||
      '#f3e6c4';
    return `<span style="background:${bg};padding:0 2px;color:${C.ink}">`;
  });
  html = html.replace(/<\/mark>/gi, '</span>');

  // Drop anything outside the whitelist (keeps inner text of removed tags).
  html = html.replace(/<(\/?)([a-z0-9]+)\b[^>]*>/gi, (m, _slash: string, name: string) =>
    ALLOWED_BODY_TAGS.has(name.toLowerCase()) ? m : '',
  );

  return html.trim();
}

/**
 * Map one {@link EmailMessage} to the brand {@link EmailDoc} shape. The role +
 * send-offset become the eyebrow, the subject is the title, the preview is the
 * hidden preheader, and the CTA becomes the primary button. Rich HTML bodies
 * (from the kit editor) flow through {@link emailBodyHtml} so formatting and
 * images survive; legacy plain-text bodies still render as brand sections.
 */
export function emailToEmailDoc(email: EmailMessage): EmailDoc {
  const isHtml = looksLikeHtml(email.bodyText);
  return {
    preheader: email.preview || undefined,
    eyebrow: `${email.role} · ${email.sendOffset}`,
    title: escapeHtml(email.subject),
    ...(isHtml
      ? { bodyHtml: emailBodyHtml(email.bodyText) }
      : { sections: bodyTextToSections(htmlToPromptText(email.bodyText)) }),
    cta: email.cta.label
      ? { label: escapeHtml(email.cta.label), url: escapeHtml(email.cta.url || '#') }
      : undefined,
  };
}

/**
 * Render one email as a standalone, brand-styled HTML document (Editorial Warm
 * table + inline CSS), suitable for pasting straight into an ESP.
 */
export function renderEmailHtml(email: EmailMessage): string {
  return renderEmail(emailToEmailDoc(email)).html;
}

/**
 * Render the whole sequence as a stack of brand-styled email documents, one per
 * send, separated by a labeled comment so an admin can copy the block they need.
 * When `values` are supplied, matching `{{token}}` markers resolve (HTML-escaped);
 * unresolved tokens survive for the ESP to fill at send time.
 */
export function sequenceToHtml(
  sequence: EmailSequence,
  values: Record<string, string> = {},
): string {
  const html = sequence.emails
    .map((e, i) => `<!-- Email ${i + 1} -->\n${renderEmailHtml(e)}`)
    .join('\n\n');
  return applyEmailTokens(html, values, { escapeHtml: true });
}

/** Populate every email's bodyHtml from its bodyText (source of truth). */
export function renderSequenceHtml(sequence: EmailSequence): EmailSequence {
  return {
    ...sequence,
    emails: sequence.emails.map((e) => ({ ...e, bodyHtml: renderEmailHtml(e) })),
  };
}

// ---------------------------------------------------------------------------
// GHL / CSV-friendly rows
// ---------------------------------------------------------------------------

/** One flat row per email for a scheduler/ESP CSV import. */
export interface EmailExportRow {
  order: number;
  role: string;
  sendOffset: string;
  subject: string;
  preview: string;
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
}

export function sequenceToRows(
  sequence: EmailSequence,
  values: Record<string, string> = {},
): EmailExportRow[] {
  const t = (s: string) => applyEmailTokens(s, values);
  return sequence.emails.map((e, i) => ({
    order: i + 1,
    role: e.role,
    sendOffset: e.sendOffset,
    subject: t(e.subject),
    preview: t(e.preview),
    bodyText: t(htmlToPromptText(e.bodyText)),
    ctaLabel: t(e.cta.label),
    ctaUrl: t(e.cta.url),
  }));
}

/** A short human summary of a campaign's arc, for editor headers. */
export function campaignArcSummary(type: EmailCampaignType): string {
  const spec = EMAIL_CAMPAIGN_SPECS[type];
  if (!spec) return '';
  const roles = spec.emailRoles
    .map((r) => `${r} (${EMAIL_FRAMEWORK_SPECS[spec.frameworkByRole?.[r] ?? 'story-lesson'].label})`)
    .join(' → ');
  return `${spec.label}: ${roles}`;
}
