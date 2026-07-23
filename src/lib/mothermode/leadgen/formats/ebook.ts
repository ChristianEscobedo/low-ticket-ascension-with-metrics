import type { LeadMagnetFormatSpec } from '../types';

/**
 * Ebook (ultra-long form). The flagship format: many chapters, each with
 * several subsections, built to expand section-by-section so it stays coherent
 * across thousands of words.
 *
 * TODO: owner framework — swap this skeleton for the owner's house ebook
 * structure when supplied.
 */
export const ebook: LeadMagnetFormatSpec = {
  label: 'Ebook (ultra-long form)',
  hint: 'Many chapters, deep subsections. Best for authority and full pre-sell.',
  skeleton: `EBOOK SKELETON
- Cover: title, subtitle, author line (the FOUNDER).
- Intro / hook: name the reader's problem, the stakes, and the promise of the read.
- 5 to 12 chapters. Each chapter is one section with:
  - A lead paragraph framing the chapter's single idea.
  - 3 to 6 subsections (h3 blocks) that teach one point each with paragraphs,
    lists, and the occasional pull quote or note.
  - A short chapter recap (a note block or a tight paragraph).
- Closing CTA that points to the next step, reusing the offer positioning.

Each chapter must earn its place: one clear idea, taught fully, with concrete
examples. Chapters build on each other, so use the prior headings to avoid
repeating ground already covered.`,
  styleNote: `Teach like a patient expert. Long, but never padded. Favor concrete
examples and specific numbers over abstractions. One pull quote per chapter at
most. Recaps are two or three sentences, not bullet dumps.`,
};
