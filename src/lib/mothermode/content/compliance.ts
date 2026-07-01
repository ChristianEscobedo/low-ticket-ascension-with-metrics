/**
 * The MotherMode compliance engine. One client-safe source of truth for the
 * brand voice rules from design-guide.txt, so the Amplify pools, the version
 * composer, and the server generator all judge copy the same way. Holds no
 * server-only code. The rules: no em or en dashes, none of the NO-list words,
 * periods over exclamation points, no ALL CAPS for emphasis.
 */
import type { ContentPiece } from './types';

/** The rules a piece of copy is checked against. */
export type ComplianceRuleId =
  | 'dash'
  | 'banned-word'
  | 'exclamation'
  | 'all-caps';

export type Severity = 'error' | 'warning';

/** One rule break found in a single string. */
export interface Violation {
  rule: ComplianceRuleId;
  severity: Severity;
  /** A short, human note on what is wrong and what to do. */
  message: string;
  /** The exact offending substring, for highlighting. */
  match: string;
  /** True when applyFixes can repair it deterministically, no rewrite needed. */
  fixable: boolean;
  /** A recommended replacement or rephrase, where one is safe to suggest. */
  suggestion?: string;
}

/** A violation tagged with where in a piece it was found. */
export interface FieldViolation extends Violation {
  /** Dotted/indexed path, e.g. 'hook', 'body[2]', 'seo.metaTitle'. */
  field: string;
}

/** The compliance verdict for a whole piece. */
export interface PieceComplianceReport {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  fixableCount: number;
  violations: FieldViolation[];
}

/** A NO-list term with how to match it and, where safe, what to suggest. */
interface BannedTerm {
  /** The word or phrase, lowercase. */
  term: string;
  /** Match common suffixes too (grind -> grinding). Default true for words. */
  stem?: boolean;
  /** A safe rephrase hint shown to the writer. */
  suggestion?: string;
}

/**
 * The NO-list and hard-forbidden words from the brand guide. Single words match
 * their stem (empower also catches empowering); phrases match the exact words.
 * A handful that are legitimate elsewhere (solution as in "solution aware") are
 * pinned to the banned spelling only.
 */
export const BANNED_TERMS: BannedTerm[] = [
  { term: 'thrive', suggestion: 'reclaim, redesign' },
  { term: 'flourish' },
  { term: 'glow' },
  { term: 'bloom' },
  { term: 'journey', suggestion: 'arc, the work, the redesign' },
  { term: 'glow-up' },
  { term: 'self-care', suggestion: 'name the cost, reclaim the time' },
  { term: 'me-time' },
  { term: 'mama', suggestion: 'mother' },
  { term: 'mommy' },
  { term: 'mompreneur' },
  { term: 'supermom' },
  { term: 'balance', suggestion: 'capacity, what is yours to carry' },
  { term: 'harmony' },
  { term: 'holistic' },
  { term: 'mindful' },
  { term: 'embrace' },
  { term: 'hustle', suggestion: 'the work' },
  { term: 'grind', suggestion: 'the work' },
  { term: 'girlboss' },
  { term: 'empower', suggestion: 'give permission, equip' },
  { term: 'elevate', suggestion: 'redesign' },
  { term: 'delight' },
  { term: 'unlock' },
  { term: 'leverage' },
  { term: 'optimize' },
  { term: 'solutions', stem: false },
  { term: 'innovative' },
  { term: 'cutting-edge' },
  { term: 'revolutionary' },
  { term: 'ecosystem' },
  { term: 'synergy' },
  { term: 'amazing', suggestion: 'a plain, specific claim' },
  { term: 'queen' },
  { term: 'warrior' },
  { term: 'tribe', suggestion: 'the room, the women' },
  { term: 'lean in', suggestion: 'phrase it plainly' },
  { term: 'boss babe' },
  { term: 'boss mom' },
  { term: 'mama bear' },
  { term: 'wine mom' },
  { term: 'hot mess' },
  { term: 'crushing it' },
  { term: 'killing it' },
  { term: "you've got this", suggestion: 'name the next concrete step' },
  { term: 'transformation journey', suggestion: 'the redesign' },
];

/** Escape a literal string for use inside a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build the case-insensitive matcher for one banned term. */
function termMatcher(t: BannedTerm): RegExp {
  if (t.term.includes(' ')) {
    const words = t.term.split(' ').map(escapeRe).join("\\s+");
    return new RegExp(`\\b${words.replace(/'/g, "['\\u2019]")}\\b`, 'gi');
  }
  const body = escapeRe(t.term);
  const tail = t.stem === false ? '' : '\\w*';
  return new RegExp(`\\b${body}${tail}\\b`, 'gi');
}

const TERM_MATCHERS = BANNED_TERMS.map((t) => ({ term: t, re: termMatcher(t) }));

const DASH_RE = /[\u2014\u2013]/;
const EXCLAIM_RE = /!/;
const ALLCAPS_RE = /\b[A-Z]{4,}\b/g;

/** Find every voice-rule break in one string, deduped per rule and match. */
export function checkText(text: string): Violation[] {
  const out: Violation[] = [];
  const seen = new Set<string>();
  const add = (v: Violation) => {
    const key = `${v.rule}:${v.match.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  const s = text ?? '';
  if (DASH_RE.test(s)) {
    const m = s.match(/[\u2014\u2013]/)?.[0] ?? '\u2014';
    add({
      rule: 'dash',
      severity: 'error',
      message: 'Em or en dash. Use a period or comma.',
      match: m,
      fixable: true,
    });
  }
  for (const { term, re } of TERM_MATCHERS) {
    re.lastIndex = 0;
    const hits = s.match(re);
    if (hits)
      for (const hit of hits)
        add({
          rule: 'banned-word',
          severity: 'error',
          message: `NO-list word "${hit}". Rewrite without it.`,
          match: hit,
          fixable: false,
          suggestion: term.suggestion,
        });
  }
  if (EXCLAIM_RE.test(s))
    add({
      rule: 'exclamation',
      severity: 'warning',
      message: 'Exclamation point. A period is more confident.',
      match: '!',
      fixable: true,
    });
  ALLCAPS_RE.lastIndex = 0;
  const caps = s.match(ALLCAPS_RE);
  if (caps)
    for (const c of caps)
      add({
        rule: 'all-caps',
        severity: 'warning',
        message: `ALL CAPS "${c}". Never use caps for emphasis.`,
        match: c,
        fixable: false,
      });
  return out;
}

/** True when a string breaks no rule at all. */
export function isCompliant(text: string): boolean {
  return checkText(text).length === 0;
}

/** True when a string has no error-level break (warnings allowed). */
export function passesHardRules(text: string): boolean {
  return !checkText(text).some((v) => v.severity === 'error');
}

/**
 * Replace any em or en dash with a comma, the brand-safe substitute. The one
 * dash rule both the client chips and the server generator share, so a dash can
 * never reach the store whatever a model does.
 */
export function stripDashes(s: string): string {
  return (s ?? '').replace(/\s*[\u2014\u2013]\s*/g, ', ').trim();
}

/**
 * Apply every deterministic fix: drop em/en dashes and exclamation points.
 * Banned words and ALL CAPS need a human or an AI rewrite, so they are left for
 * the caller to handle. Idempotent.
 */
export function applyFixes(text: string): string {
  return stripDashes((text ?? '').replace(/\s*!+/g, '.').replace(/[ \t]{2,}/g, ' '));
}

/** Collect every readable string field of a piece, each with its path label. */
function pieceFields(p: ContentPiece): { field: string; value: string }[] {
  const out: { field: string; value: string }[] = [];
  const one = (field: string, v?: string) => {
    if (v && v.trim()) out.push({ field, value: v });
  };
  const many = (field: string, vs?: string[]) =>
    (vs ?? []).forEach((v, i) => one(`${field}[${i}]`, v));
  one('title', p.title);
  one('theme', p.theme);
  one('hook', p.hook);
  one('caption', p.caption);
  one('cta', p.cta);
  many('hooks', p.hooks);
  many('body', p.body);
  many('tweets', p.tweets);
  one('email.subject', p.email?.subject);
  one('email.preheader', p.email?.preheader);
  one('ad.primaryText', p.ad?.primaryText);
  one('ad.headline', p.ad?.headline);
  one('ad.description', p.ad?.description);
  one('media.alt', p.media?.alt);
  one('seo.metaTitle', p.seo?.metaTitle);
  one('seo.metaDescription', p.seo?.metaDescription);
  (p.slides ?? []).forEach((s, i) => {
    one(`slides[${i}].text`, s.text);
    one(`slides[${i}].sub`, s.sub);
  });
  (p.seo?.questions ?? []).forEach((qa, i) => {
    one(`seo.questions[${i}].q`, qa.q);
    one(`seo.questions[${i}].a`, qa.a);
  });
  return out;
}

/** Run every rule over every text field of a piece and total the result. */
export function checkPiece(p: ContentPiece): PieceComplianceReport {
  const violations: FieldViolation[] = [];
  for (const { field, value } of pieceFields(p))
    for (const v of checkText(value)) violations.push({ ...v, field });
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.length - errorCount;
  const fixableCount = violations.filter((v) => v.fixable).length;
  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    fixableCount,
    violations,
  };
}
