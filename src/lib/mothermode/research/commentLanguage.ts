/**
 * Comment-language rollup: the deterministic half of Deep research mode.
 *
 * When a deep tool mines comments (a creator's top posts, a viral post's
 * thread), the MODEL gets the raw comments — but the "what does the audience
 * keep saying" answer is computed HERE, not by the model: repeated 2-3-word
 * phrases and the literal questions people ask, counted and ranked in plain
 * TypeScript. Deterministic, honest (counts are real), and unit-testable.
 *
 * Pure: no server imports, no service-role anything.
 */

export interface CommentLanguageSource {
  author: string;
  body: string;
  score: number | null;
}

export interface CommentPhrase {
  phrase: string;
  count: number;
}

export interface CommentLanguageRollup {
  /** How many comment bodies went into the counts. */
  commentCount: number;
  /** Repeated 2-3-word phrases, count >= 2, best first. */
  phrases: CommentPhrase[];
  /** Literal questions asked in the comments (contain '?'), best scored first. */
  questions: string[];
}

/** Social filler + standard English stopwords. Lowercase, apostrophes stripped. */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'doing', 'for', 'from', 'get', 'got', 'had',
  'has', 'have', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'just', 'like', 'me', 'my', 'no', 'not',
  'now', 'of', 'on', 'or', 'our', 'out', 'over', 'really', 'she', 'so',
  'some', 'such', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'to', 'too', 'up', 'us', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with',
  'would', 'you', 'your', 'yours',
  // contractions after apostrophe-stripping
  'im', 'ive', 'id', 'ill', 'dont', 'doesnt', 'didnt', 'cant', 'couldnt',
  'wont', 'wouldnt', 'shouldnt', 'isnt', 'arent', 'wasnt', 'werent', 'thats',
  'theres', 'whats', 'lets', 'youre', 'youve', 'youll', 'weve', 'theyre',
  'aint', 'gonna', 'wanna', 'gotta',
  // social filler
  'lol', 'lmao', 'omg', 'yes', 'yeah', 'yep', 'nope', 'ok', 'okay', 'pls',
  'please', 'thank', 'thanks', 'thankyou', 'love', 'omg', 'wow', 'girl',
  'girls', 'guys', 'people', 'one', 'also', 'much', 'many', 'every', 'way',
  'thing', 'things', 'something', 'anything', 'everything', 'nothing', 'lot',
  'lots', 'kind', 'kinda', 'sort', 'sorta', 'feel', 'feeling', 'felt',
]);

/** Safety valve: a runaway thread never blows up the n-gram counter. */
const MAX_COMMENTS_IN = 200;
const MAX_PHRASES = 8;
const MAX_QUESTIONS = 5;

/**
 * Tokenize one comment body: lowercase, links/mentions/hashtag-symbols out,
 * punctuation to spaces, stopwords dropped. Returns [] for unusable bodies.
 */
function tokens(body: string): string[] {
  const clean = body
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[@#]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  return clean
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Roll up the language across a set of mined comments. Phrases must repeat
 * (count >= 2) to surface — a single comment's wording is an anecdote, not a
 * pattern. When a short phrase is swallowed by a longer one with at least the
 * same count ("mental load" inside "carrying the mental load"), the longer,
 * more specific phrasing wins the slot.
 */
export function rollUpCommentLanguage(
  comments: CommentLanguageSource[],
): CommentLanguageRollup {
  const slice = comments.slice(0, MAX_COMMENTS_IN);
  const counts = new Map<string, number>();
  // Question dedupe keeps the FIRST phrasing seen and the BEST score it ever
  // earned — a repeated question's top score is the demand signal.
  const questionsByKey = new Map<string, { body: string; score: number }>();

  for (const c of slice) {
    const body = (c.body || '').replace(/\s+/g, ' ').trim();
    if (!body) continue;

    const toks = tokens(body);
    for (const n of [3, 2]) {
      for (let i = 0; i + n <= toks.length; i++) {
        const gram = toks.slice(i, i + n).join(' ');
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
      }
    }

    if (body.includes('?')) {
      const q = body.slice(0, 300);
      const key = q.toLowerCase();
      const existing = questionsByKey.get(key);
      if (existing) {
        existing.score = Math.max(existing.score, c.score ?? 0);
      } else {
        questionsByKey.set(key, { body: q, score: c.score ?? 0 });
      }
    }
  }
  const questions = Array.from(questionsByKey.values());

  const candidates = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.phrase.split(' ').length - a.phrase.split(' ').length ||
        a.phrase.localeCompare(b.phrase),
    );

  const phrases: CommentPhrase[] = [];
  for (const cand of candidates) {
    if (phrases.length >= MAX_PHRASES) break;
    const swallowed = phrases.some(
      (kept) =>
        kept.phrase.split(' ').length > cand.phrase.split(' ').length &&
        kept.phrase.includes(cand.phrase) &&
        kept.count >= cand.count,
    );
    if (!swallowed) phrases.push(cand);
  }

  questions.sort((a, b) => b.score - a.score);

  return {
    commentCount: slice.filter((c) => (c.body || '').trim()).length,
    phrases,
    questions: questions.slice(0, MAX_QUESTIONS).map((q) => q.body),
  };
}

/**
 * Render the rollup as the prompt-ready block the deep tools append to their
 * digests. Returns '' when there is nothing worth showing (the tool then
 * says comments were thin instead of printing an empty section).
 */
export function commentLanguageBlock(rollup: CommentLanguageRollup): string {
  if (rollup.phrases.length === 0 && rollup.questions.length === 0) return '';
  const lines: string[] = [
    `COMMENT LANGUAGE ROLLUP (${rollup.commentCount} comments mined, counted deterministically):`,
  ];
  if (rollup.phrases.length > 0) {
    lines.push(
      'Repeated phrases: ' +
        rollup.phrases.map((p) => `"${p.phrase}" x${p.count}`).join(', '),
    );
  }
  if (rollup.questions.length > 0) {
    lines.push('Questions the audience keeps asking:');
    for (const q of rollup.questions) lines.push(`  ? ${q}`);
  }
  return lines.join('\n');
}
