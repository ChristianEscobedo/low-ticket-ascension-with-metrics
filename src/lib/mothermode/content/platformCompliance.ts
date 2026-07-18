/**
 * Platform ad/organic policy packs + local compliance scoring.
 * Combines brand-voice violations with platform heuristics so the Compliance
 * tab can score instantly, then hand the same packs to the AI agent.
 */
import {
  checkPiece,
  type FieldViolation,
  type PieceComplianceReport,
  type Severity,
} from './compliance';
import type { ContentKind, ContentPiece, ContentPlatform } from './types';

/** Where an issue came from. */
export type ComplianceSource =
  | 'brand'
  | 'meta'
  | 'tiktok'
  | 'google'
  | 'x'
  | 'email'
  | 'pinterest'
  | 'general';

export type ComplianceIssueSeverity = 'block' | 'warn' | 'note';

export type ComplianceGrade = 'pass' | 'review' | 'fail';

/** One scored issue (local heuristic or AI). */
export interface ComplianceIssue {
  id: string;
  severity: ComplianceIssueSeverity;
  source: ComplianceSource;
  field: string;
  message: string;
  match?: string;
  suggestion?: string;
  /** deterministic = Fix safe; ai = agent rewrite; manual = human only */
  fixable: 'deterministic' | 'ai' | 'manual';
}

/** Full local (or merged AI) compliance scorecard. */
export interface ComplianceScorecard {
  score: number;
  grade: ComplianceGrade;
  brandScore: number;
  platformScore: number;
  claimScore: number;
  blockCount: number;
  warnCount: number;
  noteCount: number;
  issues: ComplianceIssue[];
  /** Short human summary. */
  summary: string;
  /** Platform pack id used. */
  platformPack: ComplianceSource;
  isAd: boolean;
  /** ISO time when scored (set by AI or UI). */
  scoredAt?: string;
  model?: string;
}

interface HeuristicPattern {
  id: string;
  re: RegExp;
  severity: ComplianceIssueSeverity;
  message: string;
  suggestion?: string;
  /** Only apply when piece.kind === 'ad' */
  adsOnly?: boolean;
  fields?: 'all' | 'subject';
}

/** Map brand severity onto issue severity. */
function brandSeverity(s: Severity): ComplianceIssueSeverity {
  return s === 'error' ? 'block' : 'warn';
}

function brandFixable(v: FieldViolation): ComplianceIssue['fixable'] {
  if (v.fixable) return 'deterministic';
  if (v.rule === 'banned-word' || v.rule === 'all-caps') return 'ai';
  return 'manual';
}

/** Brand voice issues from the existing engine. */
export function brandIssuesFromReport(
  report: PieceComplianceReport,
): ComplianceIssue[] {
  return report.violations.map((v, i) => ({
    id: `brand-${v.rule}-${v.field}-${i}`,
    severity: brandSeverity(v.severity),
    source: 'brand' as const,
    field: v.field,
    message: v.message,
    match: v.match,
    suggestion: v.suggestion,
    fixable: brandFixable(v),
  }));
}

/** Shared claim / deception patterns (all platforms, heavier on ads). */
const GENERAL_CLAIM_PATTERNS: HeuristicPattern[] = [
  {
    id: 'guarantee',
    re: /\b(guaranteed?|promise[sd]? results?|risk[-\s]?free)\b/gi,
    severity: 'block',
    message: 'Absolute guarantee / risk-free claim. Soften or remove.',
    suggestion: 'Name what the system does without promising outcomes.',
    adsOnly: true,
  },
  {
    id: 'income',
    re: /\b(make\s+\$?\d|\d+k\s*\/\s*month|passive income|get rich|financial freedom)\b/gi,
    severity: 'block',
    message: 'Income or get-rich claim. High ad-review risk.',
    suggestion: 'Speak to capacity and systems, not earnings.',
    adsOnly: true,
  },
  {
    id: 'health-cure',
    re: /\b(cure[sd]?|heal(s|ed|ing)?\s+your|treat(s|ed|ing)?\s+(depression|anxiety|adhd)|diagnose)\b/gi,
    severity: 'block',
    message: 'Health / medical claim language. Not allowed in ads.',
    suggestion: 'Stay in mental-load and systems language, not clinical claims.',
  },
  {
    id: 'before-after',
    re: /\b(before\s*(and|&|\/)\s*after|from\s+\d+\s*(lbs|pounds|kg)|lost\s+\d+)\b/gi,
    severity: 'warn',
    message: 'Before/after transformation framing can trip ad policies.',
    suggestion: 'Show the system change without body or miracle outcomes.',
    adsOnly: true,
  },
  {
    id: 'superlative',
    re: /\b(best ever|#1|number one|world'?s best|miracle|life[-\s]?changing results?)\b/gi,
    severity: 'warn',
    message: 'Unsubstantiated superlative.',
    suggestion: 'Use a specific, defensible claim.',
  },
  {
    id: 'personal-attr',
    re: /\b(are you\s+(a |an )?(depressed|anxious|overweight|fat|ugly|poor|divorced|single mom struggling))\b/gi,
    severity: 'block',
    message: 'Personal-attribute call-out (Meta-sensitive).',
    suggestion: 'Speak to the situation without labeling the person.',
    adsOnly: true,
  },
];

const META_PATTERNS: HeuristicPattern[] = [
  ...GENERAL_CLAIM_PATTERNS,
  {
    id: 'meta-sensational',
    re: /\b(you won't believe|shocking|secret they|doctors hate)\b/gi,
    severity: 'warn',
    message: 'Sensational / engagement-bait phrasing (Meta).',
    suggestion: 'Lead with a calm, specific scene.',
  },
  {
    id: 'meta-clickbait-caps',
    re: /\b[A-Z]{5,}\b/g,
    severity: 'note',
    message: 'Long ALL CAPS token may look spammy in Meta ads.',
    suggestion: 'Sentence case only.',
    adsOnly: true,
  },
];

const TIKTOK_PATTERNS: HeuristicPattern[] = [
  ...GENERAL_CLAIM_PATTERNS,
  {
    id: 'tt-link-spam',
    re: /\b(link in bio|click the link|swipe up now)\b/gi,
    severity: 'note',
    message: 'Hard link CTA can read as spammy on TikTok.',
    suggestion: 'Softer CTA; let the creative carry the point.',
  },
  {
    id: 'tt-fear',
    re: /\b(if you don't|you'll fail|ruin your|destroy your)\b/gi,
    severity: 'warn',
    message: 'Fear-based hook; higher review friction on paid.',
    suggestion: 'Name the cost calmly without threat.',
    adsOnly: true,
  },
];

const GOOGLE_PATTERNS: HeuristicPattern[] = [
  ...GENERAL_CLAIM_PATTERNS,
  {
    id: 'google-clickbait-title',
    re: /\b(you won't believe|what happened next|gone wrong)\b/gi,
    severity: 'warn',
    message: 'Clickbait pattern in long-form / AEO surfaces.',
    suggestion: 'Clear, searchable title language.',
  },
];

const EMAIL_PATTERNS: HeuristicPattern[] = [
  {
    id: 'email-deceptive-subject',
    re: /^(re:|fwd:|fw:)/i,
    severity: 'block',
    message: 'Subject looks like a fake reply/forward (CAN-SPAM risk).',
    suggestion: 'Use an honest subject line.',
    fields: 'subject',
  },
  {
    id: 'email-urgent-spam',
    re: /\b(act now|limited time only|!!!|urgent!!!)\b/gi,
    severity: 'warn',
    message: 'Urgency spam patterns in email.',
    suggestion: 'One clear next step, no manufactured panic.',
  },
  ...GENERAL_CLAIM_PATTERNS.filter((p) => p.id !== 'meta-clickbait-caps'),
];

const X_PATTERNS: HeuristicPattern[] = [
  ...GENERAL_CLAIM_PATTERNS.filter((p) => p.severity === 'block'),
];

const PINTEREST_PATTERNS: HeuristicPattern[] = [...GENERAL_CLAIM_PATTERNS];

/** Which pack applies for a platform. */
export function platformPackFor(
  platform: ContentPlatform | string,
): ComplianceSource {
  switch (platform) {
    case 'facebook':
    case 'instagram':
      return 'meta';
    case 'tiktok':
      return 'tiktok';
    case 'blog':
    case 'aeo':
      return 'google';
    case 'x':
      return 'x';
    case 'email':
      return 'email';
    case 'pinterest':
      return 'pinterest';
    default:
      return 'general';
  }
}

function patternsFor(pack: ComplianceSource): HeuristicPattern[] {
  switch (pack) {
    case 'meta':
      return META_PATTERNS;
    case 'tiktok':
      return TIKTOK_PATTERNS;
    case 'google':
      return GOOGLE_PATTERNS;
    case 'email':
      return EMAIL_PATTERNS;
    case 'x':
      return X_PATTERNS;
    case 'pinterest':
      return PINTEREST_PATTERNS;
    default:
      return GENERAL_CLAIM_PATTERNS;
  }
}

/** Human-readable policy brief injected into the AI agent system prompt. */
export function platformPolicyBrief(
  platform: ContentPlatform | string,
  kind: ContentKind | string,
): string {
  const pack = platformPackFor(platform);
  const ad = kind === 'ad';
  const lines: string[] = [
    `Platform pack: ${pack}. Placement kind: ${ad ? 'PAID AD' : 'organic'}.`,
    'MotherMode is mental-load infrastructure for mothers — not medical, not income, not weight-loss.',
  ];
  if (pack === 'meta') {
    lines.push(
      'Meta (Facebook/Instagram): no personal-attribute targeting language in copy; no before/after miracle outcomes; no guaranteed results; avoid sensational engagement bait; health claims are high risk; keep social proof specific and non-deceptive.',
    );
  } else if (pack === 'tiktok') {
    lines.push(
      'TikTok: avoid fear-mongering hooks on paid; no unsubstantiated transformation claims; soft CTAs; no spammy link language.',
    );
  } else if (pack === 'google') {
    lines.push(
      'Google/AEO/blog: titles and meta must match content; no clickbait; claims must be defensible.',
    );
  } else if (pack === 'email') {
    lines.push(
      'Email: honest subjects (no fake Re:/Fwd:); avoid spam urgency; body matches subject.',
    );
  } else if (pack === 'x') {
    lines.push('X: still no deceptive claims or medical/income guarantees.');
  }
  if (ad) {
    lines.push(
      'PAID: weight platform policy higher. Prefer calm specificity over hype. Soft CTA only.',
    );
  }
  return lines.join(' ');
}

/** Collect field paths + text for heuristic scanning (includes ad/email). */
function scannableFields(
  p: ContentPiece,
): { field: string; value: string }[] {
  const out: { field: string; value: string }[] = [];
  const one = (field: string, v?: string) => {
    if (v && v.trim()) out.push({ field, value: v });
  };
  const many = (field: string, vs?: string[]) =>
    (vs ?? []).forEach((v, i) => one(`${field}[${i}]`, v));

  one('title', p.title);
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
  one('seo.metaTitle', p.seo?.metaTitle);
  one('seo.metaDescription', p.seo?.metaDescription);
  (p.slides ?? []).forEach((s, i) => {
    one(`slides[${i}].text`, s.text);
    one(`slides[${i}].sub`, s.sub);
  });
  return out;
}

/** Run platform heuristic patterns over piece fields. */
export function checkPlatformHeuristics(p: ContentPiece): ComplianceIssue[] {
  const pack = platformPackFor(p.platform);
  const patterns = patternsFor(pack);
  const isAd = p.kind === 'ad';
  const issues: ComplianceIssue[] = [];
  const seen = new Set<string>();

  for (const { field, value } of scannableFields(p)) {
    const isSubject = field === 'email.subject' || field === 'seo.metaTitle';
    for (const pat of patterns) {
      if (pat.adsOnly && !isAd) continue;
      if (pat.fields === 'subject' && !isSubject) continue;
      pat.re.lastIndex = 0;
      const hits = value.match(pat.re);
      if (!hits) continue;
      for (const hit of hits) {
        const key = `${pat.id}:${field}:${hit.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({
          id: `plat-${pat.id}-${field}-${issues.length}`,
          severity: pat.severity,
          source: pack === 'general' ? 'general' : pack,
          field,
          message: pat.message,
          match: hit,
          suggestion: pat.suggestion,
          fixable: 'ai',
        });
      }
    }
  }
  return issues;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function gradeFromScore(score: number, blocks: number): ComplianceGrade {
  if (blocks > 0 || score < 60) return 'fail';
  if (score < 85) return 'review';
  return 'pass';
}

/**
 * Score brand + platform + claim hygiene.
 * Ads weight platform higher; organic weights brand higher.
 */
export function scoreLocalCompliance(p: ContentPiece): ComplianceScorecard {
  const brandReport = checkPiece(p);
  const brand = brandIssuesFromReport(brandReport);
  const platform = checkPlatformHeuristics(p);
  const issues = [...brand, ...platform];

  const isAd = p.kind === 'ad';
  const pack = platformPackFor(p.platform);

  const brandBlocks = brand.filter((i) => i.severity === 'block').length;
  const brandWarns = brand.filter((i) => i.severity === 'warn').length;
  const platBlocks = platform.filter((i) => i.severity === 'block').length;
  const platWarns = platform.filter((i) => i.severity === 'warn').length;
  const platNotes = platform.filter((i) => i.severity === 'note').length;

  // Start at 100; subtract.
  let brandScore = 100 - brandBlocks * 18 - brandWarns * 6;
  let platformScore = 100 - platBlocks * 22 - platWarns * 8 - platNotes * 3;
  // Claim hygiene ≈ platform claim patterns already counted; slight extra if many blocks
  let claimScore = 100 - platBlocks * 15 - brandBlocks * 5;

  brandScore = clampScore(brandScore);
  platformScore = clampScore(platformScore);
  claimScore = clampScore(claimScore);

  const wBrand = isAd ? 0.3 : 0.5;
  const wPlat = isAd ? 0.5 : 0.4;
  const wClaim = isAd ? 0.2 : 0.1;
  const score = clampScore(
    brandScore * wBrand + platformScore * wPlat + claimScore * wClaim,
  );

  const blockCount = issues.filter((i) => i.severity === 'block').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const noteCount = issues.filter((i) => i.severity === 'note').length;
  const grade = gradeFromScore(score, blockCount);

  let summary: string;
  if (grade === 'pass') {
    summary = isAd
      ? 'Local pass. Brand voice and platform heuristics look clear for this ad.'
      : 'Local pass. Brand voice and platform heuristics look clear.';
  } else if (grade === 'review') {
    summary = `${warnCount + noteCount} item(s) to review before publish. Run the agent for a deeper pass.`;
  } else {
    summary = `${blockCount} blocking issue(s). Fix with the agent or rewrite before spend.`;
  }

  return {
    score,
    grade,
    brandScore,
    platformScore,
    claimScore,
    blockCount,
    warnCount,
    noteCount,
    issues,
    summary,
    platformPack: pack,
    isAd,
  };
}

/** Merge AI issues into a local card (AI issues win on same id; else append). */
export function mergeScorecards(
  local: ComplianceScorecard,
  ai: Partial<ComplianceScorecard> & { issues?: ComplianceIssue[] },
): ComplianceScorecard {
  const byId = new Map<string, ComplianceIssue>();
  for (const i of local.issues) byId.set(i.id, i);
  for (const i of ai.issues ?? []) byId.set(i.id, i);
  const issues = Array.from(byId.values());
  const blockCount = issues.filter((i) => i.severity === 'block').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const noteCount = issues.filter((i) => i.severity === 'note').length;
  const score =
    typeof ai.score === 'number' ? clampScore(ai.score) : local.score;
  const grade = ai.grade ?? gradeFromScore(score, blockCount);
  return {
    ...local,
    ...ai,
    score,
    grade,
    brandScore:
      typeof ai.brandScore === 'number'
        ? clampScore(ai.brandScore)
        : local.brandScore,
    platformScore:
      typeof ai.platformScore === 'number'
        ? clampScore(ai.platformScore)
        : local.platformScore,
    claimScore:
      typeof ai.claimScore === 'number'
        ? clampScore(ai.claimScore)
        : local.claimScore,
    blockCount,
    warnCount,
    noteCount,
    issues,
    summary: ai.summary?.trim() || local.summary,
    scoredAt: ai.scoredAt ?? local.scoredAt,
    model: ai.model ?? local.model,
  };
}
