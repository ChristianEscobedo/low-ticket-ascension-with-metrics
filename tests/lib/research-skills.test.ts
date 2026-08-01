/**
 * Declarative skills (Phase 3 kickoff): the safety rails are the feature.
 * Pins the validator (every named hole), the template engine (missing
 * vars collected, never silently emptied), the path reader (proto
 * refused), the request builder (scoped secrets, secret-in-URL defense),
 * and the runner's policy (agent vs test purposes, the allowlist at RUN
 * time, the timeout) — all against a fake fetch, never the network.
 */
import { describe, expect, it } from 'vitest';
import {
  hostAllowed,
  rowToSkill,
  skillDraftErrors,
  templateHost,
  type ResearchSkill,
} from '@/lib/mothermode/research/skills/types';
import {
  buildSkillRequest,
  extractByPath,
  renderSkillTemplate,
} from '@/lib/mothermode/research/skills/template';
import { runHttpSkill } from '@/lib/mothermode/research/skills/run';

const VALID: ResearchSkill = {
  id: 'sk1',
  slug: 'amazon-lookup',
  name: 'Amazon Lookup',
  description: 'product search',
  inputKeys: ['query'],
  allowedHosts: ['api.example.com'],
  executor: {
    kind: 'http',
    method: 'GET',
    urlTemplate: 'https://api.example.com/search?q={{input.query}}',
    headers: { authorization: 'Bearer {{secret:example_key}}' },
    extract: [{ name: 'title', path: 'data.items.0.title' }],
  },
  costEstCents: 1,
  maxCallsPerDay: 3,
  status: 'active',
  consecutiveFailures: 0,
  lastCalledAt: null,
  createdAt: null,
  updatedAt: null,
};

const okFetch = (body: unknown) =>
  (async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;

describe('skillDraftErrors', () => {
  it('a clean skill passes', () => {
    expect(skillDraftErrors(VALID)).toEqual([]);
  });

  it('names every hole', () => {
    const errors = skillDraftErrors({
      slug: 'Bad Slug',
      name: '',
      inputKeys: [],
      allowedHosts: [],
      executor: {
        kind: 'http',
        method: 'GET',
        urlTemplate: 'http://nope.example.com/x?q={{input.query}}',
        headers: {},
        extract: [],
      },
      maxCallsPerDay: 0,
    });
    expect(errors.some((e) => e.startsWith('a slug'))).toBe(true);
    expect(errors).toContain('a name');
    expect(errors).toContain('at least one allowed host');
    expect(errors).toContain('an https URL template'); // http:// refused
    expect(errors).toContain('at least one extraction (name: dotted.path)');
    expect(errors).toContain('a daily call limit of at least 1');
    // `query` used in the URL but never declared:
    expect(errors).toContain('input.query used but not declared in input keys');
  });

  it('the host must be allowlisted (subdomains OK, lookalikes NOT)', () => {
    expect(templateHost(VALID.executor.urlTemplate)).toBe('api.example.com');
    expect(hostAllowed('api.example.com', ['example.com'])).toBe(true);
    expect(hostAllowed('example.com.evil.co', ['example.com'])).toBe(false);
    const errors = skillDraftErrors({
      ...VALID,
      allowedHosts: ['other.com'],
    });
    expect(errors).toContain("the URL's host (api.example.com) to be in the allowlist");
  });

  it('secrets are refused in the URL and the body', () => {
    const inUrl = skillDraftErrors({
      ...VALID,
      executor: { ...VALID.executor, urlTemplate: 'https://api.example.com/?k={{secret:x}}' },
    });
    expect(inUrl).toContain('secrets OUT of the URL (headers only)');
    const inBody = skillDraftErrors({
      ...VALID,
      executor: {
        ...VALID.executor,
        method: 'POST',
        bodyTemplate: '{"k":"{{secret:x}}"}',
      },
    });
    expect(inBody).toContain('secrets OUT of the body (headers only)');
  });
});

describe('the template engine', () => {
  it('renders nested vars and collects the missing (never silently empties)', () => {
    const r = renderSkillTemplate('/x/{{input.a.b}}/{{input.nope}}', {
      a: { b: 'yes' },
    });
    expect(r.text).toBe('/x/yes/');
    expect(r.missing).toEqual(['input.nope']);
  });

  it('non-input refs are missing by definition', () => {
    expect(renderSkillTemplate('{{system.secret}}', {}).missing).toEqual([
      'system.secret',
    ]);
  });

  it('extractByPath reads nested + array paths and refuses proto tricks', () => {
    const json = { data: { items: [{ title: 'first' }] } };
    expect(extractByPath(json, 'data.items.0.title')).toBe('first');
    expect(extractByPath(json, 'data.items.9.title')).toBeUndefined();
    expect(extractByPath(json, 'constructor')).toBeUndefined();
    expect(extractByPath(json, '__proto__.x')).toBeUndefined();
    expect(extractByPath(json, 'data..items')).toBeUndefined();
  });
});

describe('buildSkillRequest', () => {
  const secretFor = (name: string) => (name === 'example_key' ? 'tok_123' : null);

  it('assembles the request, secrets resolving in headers only', () => {
    const build = buildSkillRequest(
      VALID.executor,
      { query: 'standing desk' },
      secretFor,
    );
    expect(build.ok).toBe(true);
    if (build.ok) {
      expect(build.request.url).toBe('https://api.example.com/search?q=standing desk');
      expect(build.request.headers.authorization).toBe('Bearer tok_123');
    }
  });

  it('an unconfigured secret fails the build with the env var named', () => {
    const build = buildSkillRequest(VALID.executor, { query: 'x' }, () => null);
    expect(build.ok).toBe(false);
    if (!build.ok) {
      expect(build.error).toContain('SKILL_SECRET_EXAMPLE_KEY');
    }
  });

  it('a missing input var refuses BEFORE the wire', () => {
    const build = buildSkillRequest(VALID.executor, {}, secretFor);
    expect(build.ok).toBe(false);
    if (!build.ok) expect(build.error).toContain('input.query');
  });

  it('a secret in the URL template is refused even when validation was skipped', () => {
    const build = buildSkillRequest(
      { ...VALID.executor, urlTemplate: 'https://api.example.com/?k={{secret:x}}' },
      { query: 'x' },
      secretFor,
    );
    expect(build.ok).toBe(false);
    if (!build.ok) expect(build.error).toContain('never ride in the URL');
  });
});

describe('runHttpSkill', () => {
  const secretFor = () => 'tok';

  it('runs and extracts against the fake fetch', async () => {
    const res = await runHttpSkill(VALID, { query: 'desk' }, {
      purpose: 'test',
      fetchImpl: okFetch({ data: { items: [{ title: 'FlexiSpot' }] } }),
      secretFor,
    });
    expect(res.ok).toBe(true);
    expect(res.extracted).toEqual({ title: 'FlexiSpot' });
    expect(res.httpStatus).toBe(200);
  });

  it('the agent purpose enforces status + the daily limit; the bench does not', async () => {
    const fetchImpl = okFetch({ data: { items: [{ title: 'x' }] } });
    // A draft runs on the bench…
    const draft = { ...VALID, status: 'draft' as const };
    const benched = await runHttpSkill(draft, { query: 'x' }, { purpose: 'test', fetchImpl, secretFor });
    expect(benched.ok).toBe(true);
    // …but the agent is refused.
    const refused = await runHttpSkill(draft, { query: 'x' }, { purpose: 'agent', fetchImpl, secretFor });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain('not active');
    // And the day's limit is a hard stop.
    const capped = await runHttpSkill(VALID, { query: 'x' }, {
      purpose: 'agent',
      callsToday: 3, // the row's limit
      fetchImpl,
      secretFor,
    });
    expect(capped.ok).toBe(false);
    expect(capped.error).toContain('daily limit');
  });

  it('the allowlist holds at RUN time (a hand-edited row never fires)', async () => {
    const tampered = { ...VALID, allowedHosts: ['elsewhere.com'] };
    const res = await runHttpSkill(tampered, { query: 'x' }, {
      purpose: 'test',
      fetchImpl: okFetch({}),
      secretFor,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('not in the allowlist');
  });

  it('an HTTP error carries the status; a non-JSON body says so; a throw is honest', async () => {
    const secret = () => 'tok';
    const httpErr = await runHttpSkill(VALID, { query: 'x' }, {
      purpose: 'test',
      fetchImpl: (async () => ({ ok: false, status: 503, text: async () => 'down' })) as unknown as typeof fetch,
      secretFor: secret,
    });
    expect(httpErr.ok).toBe(false);
    expect(httpErr.error).toContain('HTTP 503');

    const notJson = await runHttpSkill(VALID, { query: 'x' }, {
      purpose: 'test',
      fetchImpl: (async () => ({ ok: true, status: 200, text: async () => '<html>nope</html>' })) as unknown as typeof fetch,
      secretFor: secret,
    });
    expect(notJson.ok).toBe(false);
    expect(notJson.error).toBe('the response was not JSON');

    const threw = await runHttpSkill(VALID, { query: 'x' }, {
      purpose: 'test',
      fetchImpl: (async () => { throw new Error('socket hangup'); }) as unknown as typeof fetch,
      secretFor: secret,
    });
    expect(threw.ok).toBe(false);
    expect(threw.error).toBe('socket hangup');
  });

  it('a hung endpoint dies on the timeout, not on the run', async () => {
    const hung = (( _url: string, init?: RequestInit ) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () =>
          rej(new DOMException('aborted', 'AbortError')),
        );
      })) as unknown as typeof fetch;
    const res = await runHttpSkill(VALID, { query: 'x' }, {
      purpose: 'test',
      fetchImpl: hung,
      secretFor: () => 'tok',
      timeoutMs: 1000, // the floor
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('timed out');
  }, 8000);
});

describe('rowToSkill', () => {
  it('defends the row: junk executor/status/numbers degrade safely', () => {
    const skill = rowToSkill({
      id: 'x',
      slug: 'a',
      name: null,
      description: null,
      input_keys: 'not-an-array',
      allowed_hosts: ['ok.com', 42],
      executor: 'garbage',
      cost_est_cents: -5,
      max_calls_per_day: 0,
      status: 'banana',
      consecutive_failures: NaN,
      last_called_at: null,
      created_at: null,
      updated_at: null,
    });
    expect(skill.status).toBe('draft');
    expect(skill.executor.method).toBe('GET');
    expect(skill.executor.extract).toEqual([]);
    expect(skill.inputKeys).toEqual([]);
    expect(skill.allowedHosts).toEqual(['ok.com']);
    expect(skill.costEstCents).toBe(1);
    expect(skill.maxCallsPerDay).toBe(100);
    expect(skill.consecutiveFailures).toBe(0);
  });
});
