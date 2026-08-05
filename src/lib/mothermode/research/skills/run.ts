/**
 * The skill runner (Phase 3): the ONE path a declarative skill ever
 * executes through, used by the agent bridge and the test bench alike.
 *
 * Policy, enforced here so the two callers can never disagree:
 *   purpose 'agent' — the skill must be ACTIVE and inside its daily call
 *     limit (the count arrives as an input; the route reads it).
 *   purpose 'test'  — drafts run too (that is the bench's point) and the
 *     limit is skipped; the outcome is NOT recorded by the caller.
 * Mechanics, always: the host allowlist is re-checked at run time (rows
 * can be hand-edited), the request builds through the audited template
 * engine (missing vars / unscoped secrets refuse BEFORE the wire), and
 * the fetch carries a hard timeout.
 *
 * Server-only (env secrets resolve here). Deps injectable for the tests.
 */
import {
  hostAllowed,
  templateHost,
  type ResearchSkill,
} from './types';
import {
  buildSkillRequest,
  extractByPath,
  type SecretLookup,
} from './template';

/** Scoped secrets: ONLY SKILL_SECRET_<NAME> env vars ever resolve. */
export const defaultSecretFor: SecretLookup = (name) =>
  process.env[`SKILL_SECRET_${name.toUpperCase()}`] ?? null;

/** The response body cap: 20k chars is evidence, not a download. */
const RAW_CAP = 20000;

export interface SkillRunResult {
  ok: boolean;
  /** The refusal/failure reason when !ok — always a plain sentence. */
  error?: string;
  /** The declared extractions, keyed by name (null = the path missed). */
  extracted?: Record<string, unknown>;
  /** Raw response text, capped — the test bench shows it. */
  raw?: string;
  ms: number;
  httpStatus?: number;
  /** True once the request actually FIRED (any outcome after the wire).
   *  The breaker counts only attempted calls — a pre-wire refusal (over
   *  the limit, missing input, allowlist) is not the endpoint failing. */
  attempted?: boolean;
}

export async function runHttpSkill(
  skill: ResearchSkill,
  input: Record<string, unknown>,
  opts: {
    purpose: 'agent' | 'test';
    /** Today's calls so far (agent calls only; the route reads the log). */
    callsToday?: number;
    fetchImpl?: typeof fetch;
    secretFor?: SecretLookup;
    timeoutMs?: number;
  },
): Promise<SkillRunResult> {
  const started = Date.now();

  if (opts.purpose === 'agent') {
    if (skill.status !== 'active') {
      return {
        ok: false,
        error: `skill is ${skill.status}, not active`,
        ms: 0,
      };
    }
    if ((opts.callsToday ?? 0) >= skill.maxCallsPerDay) {
      return {
        ok: false,
        error: `daily limit reached (${skill.maxCallsPerDay} calls)`,
        ms: 0,
      };
    }
  }

  // The allowlist holds at RUN time, not just at save time.
  const host = templateHost(skill.executor.urlTemplate);
  if (!host || !hostAllowed(host, skill.allowedHosts)) {
    return {
      ok: false,
      error: `the URL host (${host ?? 'unparseable'}) is not in the allowlist`,
      ms: 0,
    };
  }

  const build = buildSkillRequest(
    skill.executor,
    input,
    opts.secretFor ?? defaultSecretFor,
  );
  if (!build.ok) return { ok: false, error: build.error, ms: 0 };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = Math.max(1000, Math.floor(opts.timeoutMs ?? 15000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(build.request.url, {
      method: build.request.method,
      headers: build.request.headers,
      body: build.request.body,
      signal: controller.signal,
    } as RequestInit);
    clearTimeout(timer);
    const rawText = (await res.text()).slice(0, RAW_CAP);
    const ms = Date.now() - started;
    if (!res.ok) {
      return {
        ok: false,
        error: `HTTP ${res.status} from ${host}`,
        ms,
        httpStatus: res.status,
        raw: rawText.slice(0, 500),
        attempted: true,
      };
    }
    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      return {
        ok: false,
        error: 'the response was not JSON',
        ms,
        httpStatus: res.status,
        raw: rawText.slice(0, 500),
        attempted: true,
      };
    }
    const extracted: Record<string, unknown> = {};
    for (const e of skill.executor.extract) {
      extracted[e.name] = extractByPath(json, e.path) ?? null;
    }
    return {
      ok: true,
      extracted,
      raw: rawText,
      ms,
      httpStatus: res.status,
      attempted: true,
    };
  } catch (err) {
    clearTimeout(timer);
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      error: aborted
        ? `timed out after ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : 'request failed',
      ms: Date.now() - started,
      attempted: true,
    };
  }
}
