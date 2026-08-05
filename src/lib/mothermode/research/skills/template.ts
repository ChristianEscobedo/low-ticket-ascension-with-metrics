/**
 * The skill template engine (Phase 3): the ONLY code a declarative skill
 * ever runs. Three small, pure, auditable pieces:
 *
 *   renderSkillTemplate — `{{input.audience}}` interpolation against the
 *     declared input. Missing vars are COLLECTED, never silently emptied:
 *     a URL with a hole is a wrong request, so the runner refuses to fire
 *     when `missing` is non-empty.
 *   extractByPath — a dotted-path reader over parsed JSON
 *     (`data.items.0.title`): keys and numeric array segments only. No
 *     eval, no brackets, no proto tricks (each segment is checked against
 *     a plain-identifier-or-integer pattern, and __proto__/constructor/
 *     prototype segments are refused by that pattern).
 *   buildSkillRequest — assemble the final request: render the URL,
 *     headers, and body; resolve `{{secret:NAME}}` (headers only) through
 *     the injected secret lookup. Returns the missing/unknown problems
 *     instead of a request when anything is off.
 *
 * Pure: no fetch, no env — secrets arrive via the injected `secretFor`,
 * so the tests see the whole seam.
 */

/** A `{{path.to.thing}}` reference inside a template. */
export interface TemplateRef {
  /** The raw dotted path inside the braces, trimmed. */
  path: string;
}

const TEMPLATE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Deep-get a dotted path from a plain object (undefined when absent). */
function deepGet(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Render a template against the skill's input. Every `{{input.x}}`
 * resolves via deepGet; anything else (a bare `{{x}}`, or an input path
 * that resolves to undefined) lands in `missing` — the CALLER decides
 * that's a refusal (the runner does).
 */
export function renderSkillTemplate(
  template: string,
  input: Record<string, unknown>,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = template.replace(TEMPLATE_RE, (_m, rawPath: string) => {
    const path = rawPath.trim();
    if (!path.startsWith('input.')) {
      missing.push(path);
      return '';
    }
    const value = deepGet(input, path.slice('input.'.length));
    if (value === undefined || value === null) {
      missing.push(path);
      return '';
    }
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
  return { text, missing };
}

/**
 * Read a dotted path out of parsed JSON: `data.items.0.title`. Segments
 * are plain identifiers or non-negative integers (array indices);
 * anything else — empty segments, `__proto__`, brackets — fails the
 * segment pattern and the whole read returns undefined. Never throws.
 */
export function extractByPath(json: unknown, path: string): unknown {
  const segments = path.split('.');
  // An empty segment ('data..items', '.x', 'x.') REFUSES — a typo'd path
  // silently resolving to something plausible is a lie in both directions.
  if (segments.some((s) => s.length === 0)) return undefined;
  let cur: unknown = json;
  for (const seg of segments) {
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(seg) && !/^(0|[1-9]\d*)$/.test(seg)) {
      return undefined;
    }
    if (seg === '__proto__' || seg === 'constructor' || seg === 'prototype') {
      return undefined;
    }
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9]\d*)$/.test(seg)) return undefined;
      cur = cur[Number.parseInt(seg, 10)];
      continue;
    }
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** The assembled request, or the problems that prevented it. */
export type SkillRequestBuild =
  | {
      ok: true;
      request: {
        method: 'GET' | 'POST';
        url: string;
        headers: Record<string, string>;
        body?: string;
      };
    }
  | { ok: false; error: string };

/** What the runner asks the environment for a named secret. */
export type SecretLookup = (name: string) => string | null;

/**
 * Assemble the request from a validated executor. Secrets resolve through
 * `secretFor` (headers only — the validator already refused them in the
 * URL/body, and this re-checks defensively). An unresolved secret or a
 * missing input var fails the build with the reason named.
 */
export function buildSkillRequest(
  executor: {
    method: 'GET' | 'POST';
    urlTemplate: string;
    headers?: Record<string, string>;
    bodyTemplate?: string;
  },
  input: Record<string, unknown>,
  secretFor: SecretLookup,
): SkillRequestBuild {
  const url = renderSkillTemplate(executor.urlTemplate, input);
  if (url.missing.length > 0) {
    return {
      ok: false,
      error: `the URL is missing ${url.missing.join(', ')}`,
    };
  }
  // Defense in depth: the validator blocks {{secret:}} outside headers;
  // the builder re-refuses rather than trusting the row was validated.
  if (/\{\{\s*secret:/i.test(executor.urlTemplate)) {
    return { ok: false, error: 'a secret can never ride in the URL' };
  }

  const headers: Record<string, string> = {};
  for (const [key, raw] of Object.entries(executor.headers ?? {})) {
    let value = raw;
    const secretRefs = raw.match(/\{\{\s*secret:([a-zA-Z0-9_]+)\s*\}\}/g) ?? [];
    for (const ref of secretRefs) {
      const name = ref.replace(/\{\{\s*secret:/, '').replace(/\}\}/, '').trim();
      const resolved = secretFor(name);
      if (resolved === null) {
        return {
          ok: false,
          error: `secret "${name}" (header ${key}) is not configured — set SKILL_SECRET_${name.toUpperCase()}`,
        };
      }
      value = value.split(ref).join(resolved);
    }
    // Header values may also carry input vars.
    const rendered = renderSkillTemplate(value, input);
    if (rendered.missing.length > 0) {
      return {
        ok: false,
        error: `header ${key} is missing ${rendered.missing.join(', ')}`,
      };
    }
    headers[key] = rendered.text;
  }

  let body: string | undefined;
  if (executor.method === 'POST' && executor.bodyTemplate) {
    if (/\{\{\s*secret:/i.test(executor.bodyTemplate)) {
      return { ok: false, error: 'a secret can never ride in the body' };
    }
    const rendered = renderSkillTemplate(executor.bodyTemplate, input);
    if (rendered.missing.length > 0) {
      return {
        ok: false,
        error: `the body is missing ${rendered.missing.join(', ')}`,
      };
    }
    body = rendered.text;
  }

  return {
    ok: true,
    request: { method: executor.method, url: url.text, headers, body },
  };
}
