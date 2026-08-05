/* Diagnostic: what does the Monid gateway actually accept for instagram/tiktok/reddit? */
const fs = require('fs');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
let K = process.env.MONID_API_KEY;
const B = (process.env.MONID_BASE_URL || 'https://api.monid.ai').replace(/\/+$/, '');

async function resolveKey() {
  if (K) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && srk) {
    const r = await fetch(`${url}/rest/v1/integrations?provider=eq.monid&select=config`, {
      headers: { apikey: srk, authorization: `Bearer ${srk}` },
    });
    const rows = await r.json().catch(() => []);
    K = rows?.[0]?.config?.api_key;
  }
}

const post = async (p, b) => {
  const r = await fetch(B + p, {
    method: 'POST',
    headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json' },
    body: JSON.stringify(b),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
};

(async () => {
  await resolveKey();
  if (!K) { console.log('NO MONID KEY (env or integrations table)'); process.exit(1); }
  console.log('key found, len', K.length);
  const d = await post('/v1/discover', { query: 'instagram hashtag posts search' });
  const eps = d.j.endpoints || d.j.results || d.j.data || [];
  console.log('discover:', d.status, JSON.stringify(eps).slice(0, 300));
  const ep = Array.isArray(eps) && eps[0];
  if (!ep) return;
  const id = ep.id || ep.endpoint;
  const prov = ep.provider || 'apify';
  console.log('endpoint:', id, prov);

  const insp = await post('/v1/inspect', { endpoint: id, provider: prov });
  console.log('inspect:', insp.status, JSON.stringify(insp.j).slice(0, 800));

  for (const input of [
    { hashtags: ['momlife'], limit: 5 },
    { hashtags: ['momlife'], maxItems: 5 },
  ]) {
    const run = await post('/v1/run', { endpoint: id, provider: prov, input });
    console.log('run', JSON.stringify(input), '->', run.status, JSON.stringify(run.j).slice(0, 250));
  }
})().catch((e) => console.log('ERR', e.message));
