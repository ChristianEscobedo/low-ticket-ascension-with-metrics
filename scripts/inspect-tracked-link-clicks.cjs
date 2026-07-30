/**
 * inspect-tracked-link-clicks.cjs — read-only.
 *
 * Answers three questions that look identical from the admin UI but have
 * completely different fixes:
 *
 *   1. Is the click being WRITTEN at all? (mothermode_link_clicks rows)
 *   2. Is click_count on the link keeping up with those rows?
 *   3. Can each link's utm_content actually JOIN to a post? utm_content is a
 *      convention, not a foreign key, so a hand-typed value like "fb-reel-1"
 *      mints and redirects perfectly while being invisible to per-post metrics
 *      forever. Nothing in the UI complains.
 *
 *   node scripts/inspect-tracked-link-clicks.cjs
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[m[1]] && v) process.env[m[1]] = v;
    }
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Need NEXT_PUBLIC_SUPABASE_URL + a service role key.');
    process.exit(1);
  }

  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const links = await db
    .from('mothermode_utm_links')
    .select(
      'id, short_code, piece_id, utm_content, label, full_url, click_count, last_clicked_at',
    )
    .limit(500);
  if (links.error) {
    console.error('links read failed:', links.error.message);
    process.exit(1);
  }

  const clicks = await db
    .from('mothermode_link_clicks')
    .select('link_id, clicked_at, ua_family, referrer')
    .order('clicked_at', { ascending: false })
    .limit(500);
  if (clicks.error) {
    console.error('clicks read failed:', clicks.error.message);
    process.exit(1);
  }

  const plan = await db
    .from('mothermode_content_plan')
    .select('piece_id, title, stage')
    .limit(2000);

  const planIds = new Set(
    plan.error ? [] : (plan.data || []).map((r) => r.piece_id).filter(Boolean),
  );

  const byLink = new Map();
  for (const c of clicks.data || []) {
    if (!byLink.has(c.link_id)) byLink.set(c.link_id, []);
    byLink.get(c.link_id).push(c);
  }

  console.log(`LINKS: ${(links.data || []).length}`);
  console.log(`CLICK ROWS (latest 500): ${(clicks.data || []).length}`);
  console.log(
    `PLAN CARDS: ${plan.error ? 'read failed — ' + plan.error.message : (plan.data || []).length}`,
  );
  console.log('');

  let orphanUtm = 0;
  for (const l of links.data || []) {
    const rows = byLink.get(l.id) || [];
    const joins = l.utm_content && planIds.has(l.utm_content);
    if (!joins) orphanUtm += 1;
    console.log(
      `/go/${l.short_code || '(none)'}  ${l.label || '(no label)'}\n` +
        `  utm_content : ${l.utm_content || '(empty)'}  ${
          joins
            ? '-> matches a plan card'
            : '-> NO MATCHING PLAN CARD (per-post metrics will read zero)'
        }\n` +
        `  piece_id    : ${l.piece_id || '(empty)'}\n` +
        `  click_count : ${l.click_count ?? 0}   click rows: ${rows.length}` +
        `${rows.length !== (l.click_count ?? 0) ? '   <-- MISMATCH' : ''}\n` +
        `  last click  : ${l.last_clicked_at || 'never'}\n` +
        `  dest        : ${l.full_url}`,
    );
    if (rows.length) {
      for (const r of rows.slice(0, 3)) {
        console.log(
          `      ${r.clicked_at}  ${r.ua_family || '?'}  ref=${r.referrer || '-'}`,
        );
      }
    }
    console.log('');
  }

  if (orphanUtm) {
    console.log(
      `${orphanUtm} link(s) carry a utm_content that matches no plan card.\n` +
        'Those clicks ARE recorded against the link, but nothing can attribute\n' +
        'them to a post, because the post→lead join is utm_content = piece_id.\n' +
        'Fix by re-minting from the piece (which defaults utm_content to its id),\n' +
        'or by creating a plan card whose pieceId equals the value above.',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
