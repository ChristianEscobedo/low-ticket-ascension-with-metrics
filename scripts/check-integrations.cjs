/* What's actually in the integrations table? (config values masked) */
const fs = require('fs');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !srk) { console.log('missing supabase env'); process.exit(1); }

(async () => {
  const r = await fetch(`${url}/rest/v1/integrations?select=provider,enabled,config,updated_at`, {
    headers: { apikey: srk, authorization: `Bearer ${srk}` },
  });
  console.log('status', r.status);
  const rows = await r.json().catch(() => null);
  if (!Array.isArray(rows)) { console.log('NOT AN ARRAY:', JSON.stringify(rows).slice(0, 400)); return; }
  for (const row of rows) {
    const cfg = row.config || {};
    const masked = Object.fromEntries(
      Object.entries(cfg).map(([k, v]) => [
        k,
        typeof v === 'string' && v.length > 8 ? `…${v.slice(-4)} (len ${v.length})` : v,
      ]),
    );
    console.log(row.provider, '| enabled:', row.enabled, '| updated:', row.updated_at, '|', JSON.stringify(masked));
  }
  if (rows.length === 0) console.log('NO ROWS AT ALL');
})();
