/**
 * Import parser for the prompt bank. Turns a pasted Notion-style framework
 * entry (the format the owner keeps in their swipe-file database) into a
 * recipe draft the /admin/prompt-bank editor can review and save:
 *
 *   - Why it works:
 *       - Shows that you are an interesting person.
 *       - Gets people engaged in your progress.
 *   - Template:
 *       How I went from:
 *       - {CrappyThing1}
 *       To:
 *       - {ImpressiveAccomplishment1}
 *       {HereIsMyStory:}
 *   - Examples:
 *       https://twitter.com/someone/status/123
 *
 * Tolerant of the leading "- " on section headers, missing Examples, extra
 * blank lines, and nested dashes inside templates. Client-safe and pure so
 * the editor and tests share it.
 */

/** The parsed pieces of one pasted entry. */
export interface ImportedRecipeDraft {
  whyItWorks: string[];
  template: string;
  sourceUrls: string[];
}

type Section = 'why' | 'template' | 'examples';

const HEADER = /^\s*-?\s*(why it works|template|examples)\s*:?\s*$/i;
const BULLET = /^\s*-\s+(.+?)\s*$/;
const URL_LINE = /^\s*(https?:\/\/\S+)\s*$/;

/**
 * Parse one pasted entry. Returns empty arrays/strings for sections that are
 * missing, so the editor can fill the gaps by hand.
 */
export function parseNotionEntry(raw: string): ImportedRecipeDraft {
  const out: ImportedRecipeDraft = {
    whyItWorks: [],
    template: '',
    sourceUrls: [],
  };
  if (!raw.trim()) return out;

  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const buckets: Record<Section, string[]> = {
    why: [],
    template: [],
    examples: [],
  };
  let current: Section | null = null;

  for (const line of lines) {
    const header = HEADER.exec(line);
    if (header) {
      const name = header[1].toLowerCase();
      current =
        name === 'why it works'
          ? 'why'
          : name === 'examples'
            ? 'examples'
            : 'template';
      continue;
    }
    if (current) buckets[current].push(line);
  }

  // Why-it-works bullets: strip the dash, keep the sentence.
  out.whyItWorks = buckets.why
    .map((l) => BULLET.exec(l)?.[1] ?? l.trim())
    .map((l) => l.trim())
    .filter(Boolean);

  // Template: dedent the common indent (Notion pastes nest under the header),
  // then trim the blank edges so the skeleton starts on line one.
  const tplLines = buckets.template;
  const indents = tplLines
    .filter((l) => l.trim())
    .map((l) => l.match(/^\s*/)?.[0].length ?? 0);
  const dedent = indents.length ? Math.min(...indents) : 0;
  out.template = tplLines
    .map((l) => l.slice(Math.min(dedent, l.match(/^\s*/)?.[0].length ?? 0)))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');

  // Examples: URL-looking lines only.
  out.sourceUrls = buckets.examples
    .map((l) => URL_LINE.exec(l)?.[1])
    .filter((u): u is string => Boolean(u));

  return out;
}

/** Slugify a label into a recipe id, e.g. "How I went from X to Y" -> "how-i-went-from-x-to-y". */
export function slugifyRecipeId(label: string): string {
  return label
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
