/**
 * Declarative skills (Phase 3): the ROW shape + the validator. A skill is
 * data — a validated HTTP template with an allowlisted host, declared
 * input vars, scoped-secret headers, and dotted-path extraction. Never
 * eval'd code, on either side: the validator decides what can even BE a
 * row, and the template engine (./template.ts) is the only thing that
 * ever "runs" it.
 *
 * Pure: no server imports.
 */

export const SKILL_STATUSES = ['draft', 'active', 'paused'] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

/** A skill auto-pauses after this many consecutive failures (the breaker). */
export const SKILL_BREAKER_FAILURES = 5;

/** The declarative executor. v1 is HTTP only — a "prompt skill" is an
 *  expert, and adding kinds is a considered change, not an accident. */
export interface SkillExecutor {
  kind: 'http';
  method: 'GET' | 'POST';
  /** https:// URL, may carry {{input.*}} vars. NEVER a secret. */
  urlTemplate: string;
  /** Values may carry {{secret:NAME}} (resolved only from
   *  SKILL_SECRET_<NAME> env) and/or {{input.*}} vars. */
  headers: Record<string, string>;
  /** POST only. Input vars allowed; secrets refused. */
  bodyTemplate?: string;
  /** Fields to read out of the JSON response: dotted paths. */
  extract: Array<{ name: string; path: string }>;
}

export interface ResearchSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** The declared {{input.*}} vars (dotted identifiers). */
  inputKeys: string[];
  /** Bare hostnames the urlTemplate may point at (subdomains allowed). */
  allowedHosts: string[];
  executor: SkillExecutor;
  costEstCents: number;
  maxCallsPerDay: number;
  status: SkillStatus;
  consecutiveFailures: number;
  lastCalledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SkillRow {
  id: string;
  slug: string | null;
  name: string | null;
  description: string | null;
  input_keys: unknown;
  allowed_hosts: unknown;
  executor: unknown;
  cost_est_cents: number | null;
  max_calls_per_day: number | null;
  status: string | null;
  consecutive_failures: number | null;
  last_called_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x.length > 0);
}

/** Defensive executor normalize; invalid pieces fall back to safe
 *  defaults (an empty executor validates as broken, never runs). */
export function normalizeSkillExecutor(value: unknown): SkillExecutor {
  const rec =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const headers: Record<string, string> = {};
  if (rec.headers && typeof rec.headers === 'object' && !Array.isArray(rec.headers)) {
    for (const [k, v] of Object.entries(rec.headers as Record<string, unknown>)) {
      if (typeof v === 'string') headers[k] = v;
    }
  }
  const extract: Array<{ name: string; path: string }> = [];
  if (Array.isArray(rec.extract)) {
    for (const raw of rec.extract) {
      if (!raw || typeof raw !== 'object') continue;
      const name = str((raw as Record<string, unknown>).name);
      const path = str((raw as Record<string, unknown>).path);
      if (name && path) extract.push({ name, path });
    }
  }
  return {
    kind: 'http',
    method: rec.method === 'POST' ? 'POST' : 'GET',
    urlTemplate: str(rec.urlTemplate),
    headers,
    bodyTemplate:
      typeof rec.bodyTemplate === 'string' && rec.bodyTemplate
        ? rec.bodyTemplate
        : undefined,
    extract,
  };
}

/** Defensive row -> skill. */
export function rowToSkill(row: SkillRow): ResearchSkill {
  return {
    id: row.id,
    slug: str(row.slug),
    name: str(row.name) || str(row.slug),
    description: str(row.description),
    inputKeys: strList(row.input_keys),
    allowedHosts: strList(row.allowed_hosts),
    executor: normalizeSkillExecutor(row.executor),
    costEstCents:
      typeof row.cost_est_cents === 'number' &&
      Number.isFinite(row.cost_est_cents) &&
      row.cost_est_cents >= 0
        ? Math.floor(row.cost_est_cents)
        : 1,
    maxCallsPerDay:
      typeof row.max_calls_per_day === 'number' &&
      Number.isFinite(row.max_calls_per_day) &&
      row.max_calls_per_day > 0
        ? Math.floor(row.max_calls_per_day)
        : 100,
    status:
      row.status === 'active' || row.status === 'paused'
        ? row.status
        : 'draft',
    consecutiveFailures:
      typeof row.consecutive_failures === 'number' &&
      Number.isFinite(row.consecutive_failures)
        ? Math.max(0, Math.floor(row.consecutive_failures))
        : 0,
    lastCalledAt: row.last_called_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// The validator: what a skill still needs before it can be ACTIVE
// ---------------------------------------------------------------------------

const IDENT = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/;
/** A bare hostname (no scheme, no port, no path): `api.example.com`. */
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** The hostname a template points at (null when it isn't https+parseable). */
export function templateHost(urlTemplate: string): string | null {
  const stripped = urlTemplate.replace(/\{\{[^}]*\}\}/g, 'x');
  if (!stripped.startsWith('https://')) return null;
  try {
    return new URL(stripped).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** host ∈ allowlist, subdomains allowed (api.example.com ⊂ example.com). */
export function hostAllowed(host: string, allowedHosts: string[]): boolean {
  const h = host.toLowerCase();
  return allowedHosts.some(
    (a) => h === a.toLowerCase() || h.endsWith(`.${a.toLowerCase()}`),
  );
}

/**
 * What a skill still needs — one phrase per problem. Only 'http'
 * executors, https URLs on allowlisted hosts, declared input vars, no
 * secrets outside headers, and at least the shell of an extraction.
 * A draft may be saved imperfect (status 'draft'); ACTIVATION requires
 * zero errors — the route enforces it, this function decides it.
 */
export function skillDraftErrors(skill: {
  slug?: string;
  name?: string;
  inputKeys?: unknown;
  allowedHosts?: unknown;
  executor?: unknown;
  costEstCents?: unknown;
  maxCallsPerDay?: unknown;
}): string[] {
  const errors: string[] = [];
  const slug = str(skill.slug);
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) {
    errors.push('a slug (lowercase letters, numbers, dashes, 2–60 chars)');
  }
  if (!str(skill.name)) errors.push('a name');

  const inputKeys = Array.isArray(skill.inputKeys)
    ? skill.inputKeys.map((k) => (typeof k === 'string' ? k.trim() : ''))
    : [];
  inputKeys.forEach((k) => {
    if (!IDENT.test(k)) errors.push(`input "${k || '?'}" isn't a valid var name`);
  });
  const inputKeySet = new Set(inputKeys.filter(Boolean));

  const hosts = strList(skill.allowedHosts);
  if (hosts.length === 0) errors.push('at least one allowed host');
  hosts.forEach((h) => {
    if (!HOST_RE.test(h.toLowerCase())) {
      errors.push(`allowed host "${h}" must be a bare hostname (no scheme, no path)`);
    }
  });

  const ex = normalizeSkillExecutor(skill.executor);
  if (!ex.urlTemplate) {
    errors.push('a URL template');
  } else {
    const host = templateHost(ex.urlTemplate);
    if (!host) {
      errors.push('an https URL template');
    } else if (!hostAllowed(host, hosts)) {
      errors.push(`the URL's host (${host}) to be in the allowlist`);
    }
    if (/\{\{\s*secret:/i.test(ex.urlTemplate)) {
      errors.push('secrets OUT of the URL (headers only)');
    }
  }

  // Every {{input.*}} referenced anywhere must be DECLARED.
  const referenced = new Set<string>();
  const collect = (template: string) => {
    const re = /\{\{\s*input\.([a-zA-Z0-9_.]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    // exec loop, not matchAll: the ES5 target forbids iterator protocol.
    while ((m = re.exec(template)) !== null) referenced.add(m[1]);
  };
  collect(ex.urlTemplate);
  if (ex.bodyTemplate) collect(ex.bodyTemplate);
  Object.values(ex.headers).forEach(collect);
  referenced.forEach((key) => {
    if (!inputKeySet.has(key)) {
      errors.push(`input.${key} used but not declared in input keys`);
    }
  });

  if (ex.method === 'POST' && ex.bodyTemplate && /\{\{\s*secret:/i.test(ex.bodyTemplate)) {
    errors.push('secrets OUT of the body (headers only)');
  }
  if (ex.extract.length === 0) {
    errors.push('at least one extraction (name: dotted.path)');
  }

  const cost = skill.costEstCents;
  if (cost !== undefined && (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0)) {
    errors.push('a non-negative cost estimate');
  }
  const limit = skill.maxCallsPerDay;
  if (limit !== undefined && (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1)) {
    errors.push('a daily call limit of at least 1');
  }
  return errors;
}
