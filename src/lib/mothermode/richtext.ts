/**
 * Rich-text sanitization for kit fields that are edited with TipTap (rich HTML)
 * but must be safe to inject into prompts and exports as clean plain text.
 *
 * Kit editors store HTML (bold/italic/lists/links). Anywhere that HTML would
 * leak into a model prompt (`contextPacksToPromptBlock`) or a flat export
 * (CSV/GHL/text), run `htmlToPromptText()` first so the markup becomes readable
 * plain text instead of raw tags.
 *
 * This is intentionally dependency-free and DOM-free so it runs the same on the
 * server, in route handlers, and in unit tests. It is NOT a security sanitizer
 * for rendering untrusted HTML — for that, sanitize before `dangerouslySetInnerHTML`
 * separately. Its job is HTML -> readable text.
 */

/** Named HTML entities we care about, plus numeric decoding below. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  hellip: '…',
  mdash: '—',
  ndash: '–',
};

/** Decode the handful of HTML entities TipTap/StarterKit can emit. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

/**
 * Convert rich HTML into clean plain text suitable for prompts and flat exports.
 * - Block/line elements (`p`, `div`, `br`, `li`, headings) become newlines.
 * - List items get a "- " bullet prefix.
 * - `<a href>` becomes "text (href)" when the href adds information.
 * - All other tags are stripped; entities are decoded; whitespace is collapsed.
 * Plain-text input (no tags) passes through essentially unchanged.
 */
export function htmlToPromptText(input: string): string {
  if (!input) return '';
  let html = input;

  // Drop script/style wholesale (defensive; StarterKit never emits these).
  html = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');

  // Anchors: keep the link target when it is not already in the text.
  html = html.replace(
    /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_all, href: string, text: string) => {
      const label = text.trim();
      if (!href || label.includes(href)) return label;
      return `${label} (${href})`;
    },
  );

  // Images: collapse to a readable text marker so prompts/flat exports never
  // carry raw <img> tags or long URLs. Prefer alt text, fall back to a generic
  // "[image]" marker. (ESP HTML export keeps the real <img> — it does NOT run
  // through this function.)
  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const alt = /\balt=["']([^"']*)["']/i.exec(tag)?.[1]?.trim();
    return alt ? ` [image: ${alt}] ` : ' [image] ';
  });


  // List items -> bulleted lines.
  html = html.replace(/<li\b[^>]*>/gi, '\n- ');
  html = html.replace(/<\/li>/gi, '');

  // Block boundaries -> newlines. Paragraphs/divs/headings become blank-line
  // separated blocks; <br> is a single newline.
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, '\n\n');
  html = html.replace(/<(p|div|h[1-6]|ul|ol|blockquote)\b[^>]*>/gi, '');

  // Strip any remaining tags (b, strong, i, em, span, etc.).
  html = html.replace(/<\/?[a-z][^>]*>/gi, '');

  // Decode entities, normalize whitespace.
  let text = decodeEntities(html);
  text = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return text;
}

/** True when the string contains at least one HTML tag. */
export function looksLikeHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

/**
 * Normalize a kit field for storage/injection. If it looks like HTML, convert
 * it; otherwise return the trimmed text unchanged. Safe to call on any field.
 */
export function kitTextForPrompt(input: string | null | undefined): string {
  if (!input) return '';
  return looksLikeHtml(input) ? htmlToPromptText(input) : input.trim();
}
