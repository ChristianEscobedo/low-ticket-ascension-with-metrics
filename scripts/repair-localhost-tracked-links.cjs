/**
 * repair-localhost-tracked-links.cjs
 *
 * Rewrites tracked links whose stored destination points at localhost.
 *
 * Why this is needed at all: `mothermode_utm_links.base_url` and `full_url` are
 * persisted, and `/go/<code>` redirects to the stored `full_url`. Fixing
 * NEXT_PUBLIC_SITE_URL does NOT repair rows minted while it was localhost --
 * those keep redirecting to 127.0.0.1 for everyone on the internet. The short
 * code stays valid, so nothing looks broken from the admin side.
 *
 * Dry run by default. It rewrites live redirect targets, so it makes you ask:
 *
 *   node scripts/repair-localhost-tracked-links.cjs            # report only
 *   node scripts/repair-localhost-tracked-links.cjs --apply    # write
 *
 * The replacement origin is NEXT_PUBLIC_SITE_URL. If that is still a loopback
 * host the script refuses outright rather than rewriting localhost to localhost
 * and reporting success.
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

function isLoopback(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h === '::1' ||
      h.endsWith('.localhost') ||
      h.endsWith('.local')
    );
  } catch {
    return false;
  }
}

/** Swap only the origin, preserving path + query (the UTMs live in the query). */
function reorigin(stored, origin) {
  try {
    const u = new URL(stored);
    const target = new URL(origin);
    u.protocol = target.protocol;
    u.host = target.host;
    return u.toString();
  } catch {
    return null;
  }
}

async function main() {
  loadEnv();

  const apply = process.argv.includes('--apply');
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();

  if (!origin) {
    console.error('NEXT_PUBLIC_SITE_URL is not set. Nothing to repair toward.');
    process.exit(1);
  }
  if (isLoopback(origin)) {
    console.error(
      `NEXT_PUBLIC_SITE_URL is still "${origin}".\n` +
        'Set it to the real public domain first — otherwise this would rewrite\n' +
        'localhost to localhost and report success.',
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error(
      'Need NEXT_PUBLIC_SUPABASE_URL and a service role key in .env.local.',
    );
    process.exit(1);
  }

  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await db
    .from('mothermode_utm_links')
    .select('id, short_code, base_url, full_url, piece_id')
    .limit(2000);

  if (error) {
    console.error('Read failed:', error.message);
    process.exit(1);
  }

  const broken = (data || []).filter(
    (r) => isLoopback(r.base_url || '') || isLoopback(r.full_url || ''),
  );

  console.log(`Scanned ${(data || []).length} link(s).`);
  console.log(`Pointing at a loopback host: ${broken.length}`);
  console.log(`Replacement origin: ${origin}`);

  if (!broken.length) {
    console.log('\nNothing to repair.');
    return;
  }

  for (const r of broken) {
    const nextFull = reorigin(r.full_url || '', origin);
    console.log(
      `\n  /go/${r.short_code || '(no code)'}  piece=${r.piece_id || '-'}\n` +
        `    was: ${r.full_url}\n` +
        `    now: ${nextFull || '(unparseable — will be skipped)'}`,
    );
  }

  if (!apply) {
    console.log(
      `\nDRY RUN — nothing written. Re-run with --apply to rewrite ${broken.length} row(s).`,
    );
    return;
  }

  let fixed = 0;
  let skipped = 0;
  for (const r of broken) {
    const nextBase = isLoopback(r.base_url || '')
      ? reorigin(r.base_url, origin)
      : r.base_url;
    const nextFull = isLoopback(r.full_url || '')
      ? reorigin(r.full_url, origin)
      : r.full_url;

    // An unparseable URL is left alone deliberately: guessing at a malformed
    // destination is how you turn a dead link into a wrong one.
    if (!nextBase || !nextFull) {
      skipped += 1;
      continue;
    }

    const { error: upErr } = await db
      .from('mothermode_utm_links')
      .update({ base_url: nextBase, full_url: nextFull })
      .eq('id', r.id);

    if (upErr) {
      console.error(`  FAILED ${r.short_code}: ${upErr.message}`);
      skipped += 1;
    } else {
      fixed += 1;
    }
  }

  console.log(`\nRepaired ${fixed} row(s). Skipped ${skipped}.`);
  console.log(
    'Click history is untouched — mothermode_link_clicks references link_id, not the URL.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
