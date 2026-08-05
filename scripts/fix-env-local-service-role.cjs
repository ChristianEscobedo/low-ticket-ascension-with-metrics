/**
 * Neutralises the stale SUPABASE_SERVICE_ROLE_KEY override in .env.local.
 *
 * Why: Next.js loads .env.local with higher precedence than .env. The
 * service_role key in .env.local is issued for project "fljnvfwyymrivsypnpea"
 * while NEXT_PUBLIC_SUPABASE_URL points at "vxnikdhgwmcmvanqjeug", so PostgREST
 * rejects it with 401 "Invalid API key". That breaks every server-side path
 * that uses the service-role client (media reads, integrations lookup, sales
 * funnel load/save) - which is what the AI-fill button hits.
 *
 * The line is commented out rather than deleted so the old value stays
 * recoverable, and .env's correct same-project key becomes the effective one.
 *
 * Idempotent. Prints no secrets. Writes a .bak once.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(file)) {
  console.error('.env.local not found - nothing to do.');
  process.exit(1);
}

const original = fs.readFileSync(file, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
const lines = original.split(/\r?\n/);

let changed = 0;
let alreadyDone = false;

const out = lines.map((line) => {
  if (/^\s*#/.test(line)) {
    if (/SUPABASE_SERVICE_ROLE_KEY/.test(line) && /disabled: wrong project/.test(line)) {
      alreadyDone = true;
    }
    return line;
  }
  if (/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=/.test(line)) {
    changed += 1;
    return (
      '# disabled: wrong project (ref fljnvfwyymrivsypnpea) - URL is vxnikdhgwmcmvanqjeug.' +
      eol +
      '# Caused 401 "Invalid API key" on every service-role query. Falls back to .env.' +
      eol +
      '# ' +
      line
    );
  }
  return line;
});

if (changed === 0) {
  console.log(
    alreadyDone
      ? 'Already fixed: SUPABASE_SERVICE_ROLE_KEY in .env.local is commented out.'
      : 'No active SUPABASE_SERVICE_ROLE_KEY line found in .env.local.'
  );
  process.exit(0);
}

const backup = `${file}.bak`;
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, 'utf8');
fs.writeFileSync(file, out.join(eol), 'utf8');

console.log(`Commented out ${changed} SUPABASE_SERVICE_ROLE_KEY line(s) in .env.local.`);
console.log(`Backup written to .env.local.bak (first run only).`);
console.log('Restart the dev server - env files are only read at boot.');
