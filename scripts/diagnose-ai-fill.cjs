/**
 * Diagnostic for the AI-fill failure. Read-only: makes GET requests only and
 * never prints a secret. Verifies, in order:
 *   1. Which Supabase project each key in .env / .env.local belongs to.
 *   2. Whether the service-role key actually authenticates against the REST API.
 *   3. Whether the `integrations` table can be read (runtime-config's source).
 *   4. Which AI provider keys are resolvable from env at all.
 *
 * Run: node scripts/diagnose-ai-fill.cjs
 */
const fs = require('fs');
const path = require('path');

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function jwtRef(token) {
  try {
    const body = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return { ref: body.ref, role: body.role };
  } catch {
    return { ref: '(unparseable)', role: '(unparseable)' };
  }
}

function urlRef(url) {
  const m = /^https?:\/\/([^.]+)\./.exec(url || '');
  return m ? m[1] : '(none)';
}

// Next.js precedence for `next dev`: .env.local overrides .env.
function effective(envFile, localFile) {
  return { ...envFile, ...localFile };
}

async function probe(label, url, key) {
  if (!url || !key) return console.log(`  ${label}: skipped (missing url or key)`);
  try {
    const res = await fetch(`${url}/rest/v1/integrations?select=provider,enabled`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const text = await res.text();
    console.log(`  ${label}: HTTP ${res.status} ${text.slice(0, 200)}`);
  } catch (err) {
    console.log(`  ${label}: request threw - ${err.message}`);
  }
}

(async () => {
  const root = process.cwd();
  const base = parseEnv(path.join(root, '.env'));
  const local = parseEnv(path.join(root, '.env.local'));
  const env = effective(base, local);

  console.log('=== 1. Key/project alignment ===');
  for (const [name, e] of [['.env', base], ['.env.local', local], ['EFFECTIVE (local wins)', env]]) {
    const url = e.NEXT_PUBLIC_SUPABASE_URL || '';
    console.log(`${name}`);
    console.log(`  url project : ${urlRef(url)}`);
    console.log(`  anon        : ${e.NEXT_PUBLIC_SUPABASE_ANON_KEY ? JSON.stringify(jwtRef(e.NEXT_PUBLIC_SUPABASE_ANON_KEY)) : '(absent)'}`);
    console.log(`  service_role: ${e.SUPABASE_SERVICE_ROLE_KEY ? JSON.stringify(jwtRef(e.SUPABASE_SERVICE_ROLE_KEY)) : '(absent)'}`);
    const svcRef = e.SUPABASE_SERVICE_ROLE_KEY ? jwtRef(e.SUPABASE_SERVICE_ROLE_KEY).ref : null;
    if (svcRef && urlRef(url) !== '(none)' && svcRef !== urlRef(url)) {
      console.log(`  >>> MISMATCH: service_role belongs to "${svcRef}" but URL points at "${urlRef(url)}"`);
    }
  }

  console.log('\n=== 2/3. Live REST probe against `integrations` ===');
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  await probe('.env service_role      ', url, base.SUPABASE_SERVICE_ROLE_KEY);
  await probe('.env.local service_role', url, local.SUPABASE_SERVICE_ROLE_KEY);

  console.log('\n=== 4. AI provider keys visible to the server ===');
  for (const k of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MOTHERMODE_AI_TEXT_PROVIDER', 'MOTHERMODE_AI_TEXT_MODEL']) {
    const v = env[k];
    console.log(`  ${k.padEnd(28)}: ${v ? `present (${v.length} chars)` : 'ABSENT/EMPTY'}`);
  }
})();
