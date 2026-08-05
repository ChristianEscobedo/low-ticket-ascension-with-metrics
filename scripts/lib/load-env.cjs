'use strict';

/**
 * Zero-dependency .env.local loader for seed/ops scripts. The repo does
 * not carry the `dotenv` package, so scripts that required it silently
 * fell through their catch and ran with no env at all. This parses the
 * file directly: KEY=value lines, # comments, optional quotes, no
 * overwriting of vars that are already set in the environment.
 */
const fs = require('fs');
const path = require('path');

function loadEnv(file = '.env.local') {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return false;
  const text = fs.readFileSync(full, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

module.exports = { loadEnv };
