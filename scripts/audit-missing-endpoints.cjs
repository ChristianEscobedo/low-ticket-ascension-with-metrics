#!/usr/bin/env node
/**
 * Audits the class of breakage a green `tsc` cannot see.
 *
 * API endpoints and internal page links are referenced as URL *strings*, never
 * imported, so if the file backing one is deleted the compiler stays silent and
 * the app only fails at runtime -- typically as
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`, because Next.js
 * answers the unknown path with its HTML 404 page and the caller runs
 * res.json() on that HTML.
 *
 * That is exactly how 8 Reel Studio routes went missing unnoticed. Run this
 * after any merge, restore, or large refactor.
 *
 * Usage: node scripts/audit-missing-endpoints.cjs
 * Exits 1 if anything is missing, so it can gate CI.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const APP = path.join(SRC, 'app');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);

// A concrete path segment we can verify. Dynamic segments (ids, slugs,
// template literals) are skipped rather than guessed at.
const isConcrete = (seg) => /^[a-zA-Z0-9._-]+$/.test(seg) && !/^\$/.test(seg);

const dirsIn = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
};

/**
 * Walk `segs` down from `dir`, returning every directory the route could land in.
 * Mirrors how Next.js actually resolves a URL:
 *   - an exact folder name
 *   - a dynamic folder ([id], [slug], [...all]) matching any single segment
 *   - a route group ((fullscreen), (marketing)) that consumes no segment
 */
function candidateDirs(dir, segs) {
  if (!segs.length) return [dir];
  const [head, ...rest] = segs;
  const out = [];
  for (const child of dirsIn(dir)) {
    const name = child.name;
    const next = path.join(dir, name);
    if (name === head || /^\[.+\]$/.test(name)) {
      out.push(...candidateDirs(next, rest));
    } else if (/^\(.*\)$/.test(name)) {
      out.push(...candidateDirs(next, segs)); // group consumes nothing
    }
  }
  return out;
}

/**
 * @param trailingSlash true when the reference was cut short by a dynamic
 *   expression, e.g. `/api/admin/customers/${id}`. The handler then lives one
 *   level deeper, in a dynamic folder, so accept that as resolved.
 */
function resolvesTo(routePath, leafNames, trailingSlash) {
  const segs = routePath.split('/').filter(Boolean);
  if (!segs.length || !segs.every(isConcrete)) return true; // unverifiable -> don't report
  for (const dir of candidateDirs(APP, segs)) {
    if (leafNames.some((leaf) => fs.existsSync(path.join(dir, leaf)))) return true;
    if (trailingSlash && dirsIn(dir).some((d) => /^\[.+\]$/.test(d.name))) return true;
  }
  return false;
}


const apiRefs = new Map(); // route -> Set of referencing files
const pageRefs = new Map();

const API_RE = /['"`](\/api\/[a-zA-Z0-9\-_/]+)/g;
const PAGE_RE = /(?:href=|router\.push\(|router\.replace\(|redirect\()\s*['"`](\/[a-zA-Z0-9\-_/]*)/g;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let m;
  while ((m = API_RE.exec(text))) {
    if (!apiRefs.has(m[1])) apiRefs.set(m[1], new Set());
    apiRefs.get(m[1]).add(rel);
  }
  while ((m = PAGE_RE.exec(text))) {
    const p = m[1];
    if (p === '/' || p.startsWith('/api/')) continue;
    if (!pageRefs.has(p)) pageRefs.set(p, new Set());
    pageRefs.get(p).add(rel);
  }
}

/**
 * Dead links that predate this audit and were never regressions: `git log
 * --diff-filter=D` shows no commit ever deleted them, so they have simply never
 * been built. They are boilerplate footer/nav links on the Mindshift sales page.
 * Listed here so the exit code stays meaningful as a CI gate; delete an entry
 * once the page is built and the audit will start enforcing it.
 */
const KNOWN_DEAD = new Set(['/auth', '/contact', '/privacy', '/terms']);

let missing = 0;

function report(label, refs, leafNames) {
  const bad = [];
  const known = [];
  for (const [route, callers] of refs) {
    // A ref ending in "/" was truncated by a dynamic expression, e.g. `/foo/${id}`.
    if (resolvesTo(route, leafNames, route.endsWith('/'))) continue;
    (KNOWN_DEAD.has(route) ? known : bad).push([route, [...callers]]);
  }
  console.log(`\n${label}: ${refs.size} referenced, ${bad.length} missing`);
  for (const [route, callers] of bad.sort()) {
    console.log(`  MISSING ${route}`);
    for (const c of callers.slice(0, 3)) console.log(`      <- ${c}`);
    if (callers.length > 3) console.log(`      <- (+${callers.length - 3} more)`);
  }
  for (const [route] of known.sort()) {
    console.log(`  known dead (pre-existing, not a regression) ${route}`);
  }
  missing += bad.length;
}

report('API routes', apiRefs, ['route.ts', 'route.tsx', 'route.js']);
report('Page links', pageRefs, ['page.tsx', 'page.ts', 'page.js', 'route.ts']);

console.log(
  missing === 0
    ? '\nOK - every referenced endpoint and page resolves to a file on disk.'
    : `\nFAIL - ${missing} reference(s) point at files that do not exist.`
);
process.exit(missing === 0 ? 0 : 1);
