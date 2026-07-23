/**
 * Pure text/markdown renderers for a HighTicketKit (D.I.M.E. method).
 *
 * Used by the admin editor to (a) copy an individual section to the clipboard
 * and (b) build a full document that a print window turns into a PDF. Kept pure
 * and DOM-free so it can be unit tested and reused server-side later.
 */
import {
  KIT_SECTIONS,
  SEVEN_A_KEYS,
  type HighTicketKit,
  type KitSection,
  type SevenAKey,
} from './types';
import { htmlToPromptText } from '../richtext';

/** Human labels for each section (also used by the wizard + section cards). */
export const SECTION_LABELS: Record<KitSection, string> = {
  basics: 'Basics — who you help & the problems',
  sevenAs: "The 7 A's (offer extraction)",
  offer: 'The extracted offer',
  problems: 'D.I.M.E. problem pillars',
  offerScript: 'The offer script',
};

/** One-line description per section for the wizard. */
export const SECTION_HINTS: Record<KitSection, string> = {
  basics: 'The avatar (gender, age, labels) and the problem / cost / result rows',
  sevenAs: "Attention, Acknowledge, Agitate, Authority, Angst, Ambiguity, Appeal",
  offer: 'The Super "I help" statement, program name, price, and appeal add-ons',
  problems: '3-4 problems mapped Problem / Angst / Solution / Implementation',
  offerScript: 'The enrollment-call presentation, one spoken pillar per problem',
};

/** Human labels for each of the 7 A's. */
export const SEVEN_A_LABELS: Record<SevenAKey, string> = {
  attention: 'Attention',
  acknowledge: 'Acknowledge',
  agitate: 'Agitate',
  authority: 'Authority',
  angst: 'Angst',
  ambiguity: 'Ambiguity',
  appeal: 'Appeal',
};

/** Section order for the wizard, cards, and export. */
export function allSections(): KitSection[] {
  return [...KIT_SECTIONS];
}

function bullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}

/** Render a single section to a labeled markdown block. Returns '' if empty. */
export function sectionToText(kit: HighTicketKit, section: KitSection): string {
  const heading = `## ${SECTION_LABELS[section]}`;
  switch (section) {
    case 'basics': {
      const { avatar, problems } = kit.basics;
      const hasAvatar = avatar.genders || avatar.ageRange || avatar.labels;
      if (!hasAvatar && problems.length === 0) return '';
      const rows = problems
        .map(
          (p, i) =>
            `${i + 1}. Problem: ${p.problem}\n   Cost: ${p.cost}\n   Result: ${p.result}`,
        )
        .join('\n\n');
      return [
        heading,
        '',
        '### Who you help',
        `Gender(s): ${avatar.genders}`,
        `Age range: ${avatar.ageRange}`,
        `Labels / beliefs: ${avatar.labels}`,
        problems.length ? '\n### Problems / cost / result' : '',
        rows,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'sevenAs': {
      const filled = SEVEN_A_KEYS.filter((k) => kit.sevenAs[k].trim());
      if (filled.length === 0) return '';
      const blocks = SEVEN_A_KEYS.filter((k) => kit.sevenAs[k].trim()).map(
        (k) => `### ${SEVEN_A_LABELS[k]}\n${htmlToPromptText(kit.sevenAs[k])}`,
      );
      return [heading, '', ...blocks].join('\n\n');
    }
    case 'offer': {
      const o = kit.offer;
      if (!o.chosenName && !o.iHelpStatement && o.nameOptions.length === 0)
        return '';
      const options = o.nameOptions.length
        ? `Name options:\n${bullets(o.nameOptions)}`
        : '';
      const payments = o.paymentOptions.length
        ? `Payment options:\n${bullets(o.paymentOptions)}`
        : '';
      const addOns = o.addOns.length
        ? `Appeal add-ons:\n${bullets(o.addOns)}`
        : '';
      return [
        heading,
        '',
        `Name: ${o.chosenName}`,
        options,
        '',
        `I help statement:\n${htmlToPromptText(o.iHelpStatement)}`,
        '',
        `Price: ${o.price}`,
        payments,
        `Guarantee: ${o.guarantee}`,
        addOns,
        `Positioning: ${o.positioning}`,
      ]
        .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
        .join('\n');
    }
    case 'problems': {
      if (kit.problems.length === 0) return '';
      const blocks = kit.problems.map((p, i) => {
        const impl = p.implementation.length
          ? `Implementation:\n${p.implementation
              .map((s, n) => `${n + 1}. ${htmlToPromptText(s)}`)
              .join('\n')}`
          : '';
        return [
          `### ${p.title || `Problem ${i + 1}`}`,
          `Problem: ${htmlToPromptText(p.problem)}`,
          `Angst: ${htmlToPromptText(p.angst)}`,
          `Solution: ${htmlToPromptText(p.solution)}`,
          impl,
        ]
          .filter(Boolean)
          .join('\n\n');
      });
      return [heading, '', ...blocks].join('\n\n');
    }
    case 'offerScript': {
      if (kit.offerScript.length === 0) return '';
      const blocks = kit.offerScript.map(
        (p) => `### ${p.label}\n${htmlToPromptText(p.body)}`,
      );
      return [heading, '', ...blocks].join('\n\n');
    }
    default:
      return '';
  }
}

/** Render the entire kit to a single markdown document. */
export function kitToText(kit: HighTicketKit, title?: string): string {
  const parts = allSections()
    .map((s) => sectionToText(kit, s))
    .filter(Boolean);
  const header = `# ${title || kit.offer.chosenName || 'High Ticket Offer'}`;
  return [header, ...parts].join('\n\n');
}

/** Convert the markdown-ish document to minimal printable HTML for a PDF. */
export function kitToPrintableHtml(kit: HighTicketKit, title?: string): string {
  const text = kitToText(kit, title);
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = text
    .split('\n')
    .map((line) => {
      if (line.startsWith('### ')) return `<h3>${esc(line.slice(4))}</h3>`;
      if (line.startsWith('## ')) return `<h2>${esc(line.slice(3))}</h2>`;
      if (line.startsWith('# ')) return `<h1>${esc(line.slice(2))}</h1>`;
      if (line.startsWith('- ')) return `<li>${esc(line.slice(2))}</li>`;
      if (line.trim() === '') return '<br/>';
      return `<p>${esc(line)}</p>`;
    })
    .join('\n');
  const docTitle = esc(title || kit.offer.chosenName || 'High Ticket Offer');
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${docTitle}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; max-width: 720px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  h1 { font-size: 24px; border-bottom: 2px solid #b08d57; padding-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 28px; color: #7a5c2e; }
  h3 { font-size: 15px; margin-top: 18px; color: #444; }
  p { margin: 4px 0; white-space: pre-wrap; }
  li { margin-left: 20px; }
</style></head><body>${body}</body></html>`;
}
