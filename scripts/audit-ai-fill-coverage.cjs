/**
 * Read-only field-level AI fill coverage audit (Task A).
 *
 * Turns "the AI must fill all the fields" into a checkable number.
 *
 * For every funnel page shape it walks the declared interface in
 * sales/types.ts and classifies each field by how it actually gets a value:
 *
 *   MEDIA    image/video URL slot. Prompts deliberately leave these empty;
 *            they are Task C's job, not a copy gap.
 *   SCHEMA   the AI response schema in openai-sales.ts names the field, so
 *            the model is asked for it.
 *   DERIVED  code assigns it deterministically after the call (offer-stack
 *            and intake fallbacks).
 *   DEFAULT  the normalizer supplies a non-empty literal default, so the page
 *            renders even when the model omits it.
 *   ALIAS    falls back to a sibling field (str('a') || str('b')).
 *   GAP      none of the above. Model never asked, no default: renders blank.
 *
 * GAP is the acceptance criterion. Closing Task B means driving GAP to 0.
 *
 * Also reports prompt drift: fields the full-funnel prompt asks for but the
 * per-page regenerate prompt does not (and the reverse). Drift means "Regenerate
 * page" silently produces a thinner page than "Generate funnel".
 *
 * Writes scripts/ai-fill-coverage.txt. Changes no source file.
 */
const fs = require('fs');
const path = require('path');

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

const TYPES = 'src/lib/mothermode/sales/types.ts';
const DEFAULTS = 'src/lib/mothermode/sales/defaults.ts';
const INTAKE = 'src/lib/mothermode/sales/aiIntake.ts';
const OPENAI = 'src/utils/integrations/openai-sales.ts';
const OUT = 'scripts/ai-fill-coverage.txt';

const types = read(TYPES);
const defaults = read(DEFAULTS);
const intake = read(INTAKE);
const openai = read(OPENAI);

const lines = [];
const say = (s = '') => {
  lines.push(s);
  console.log(s);
};

if (!types || !openai) {
  console.error('Cannot audit: missing ' + (!types ? TYPES : OPENAI));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Page shape registry (page key -> interface name)
// ---------------------------------------------------------------------------

const PAGES = [
  ['optin', 'SalesOptinContent'],
  ['sales', 'SalesPageContent'],
  ['vsl', 'VslPageContent'],
  ['checkout', 'CheckoutContent'],
  ['upsell1', 'UpsellContent'],
  ['upsell2', 'UpsellContent'],
  ['upsell3', 'UpsellContent'],
  ['upsell4', 'UpsellContent'],
  ['success', 'SuccessContent'],
  ['access', 'AccessContent'],
  ['footer', 'SalesFooterContent'],
];
const PAGE_KEYS = PAGES.map(([k]) => k);
const UPSELL_KEYS = ['upsell1', 'upsell2', 'upsell3', 'upsell4'];

// ---------------------------------------------------------------------------
// 1. Parse interfaces out of types.ts
// ---------------------------------------------------------------------------

/** Balanced-brace body of the object starting at index i (i points past '{'). */
function braceBody(src, i) {
  let depth = 1;
  const start = i;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i);
    }
    i++;
  }
  return src.slice(start);
}

/** Top-level (2-space) members of an interface body. */
function parseFields(body) {
  const out = [];
  let depth = 0;
  let deprecated = false;
  for (const line of body.split(/\r?\n/)) {
    if (/@deprecated/.test(line)) deprecated = true;
    const m = depth === 0 ? line.match(/^ {2}(\w+)(\?)?:\s*(.*?);?\s*$/) : null;
    if (m) {
      out.push({ name: m[1], optional: Boolean(m[2]), type: m[3], deprecated });
      deprecated = false;
    }
    depth += (line.match(/[{[]/g) || []).length;
    depth -= (line.match(/[}\]]/g) || []).length;
    if (depth < 0) depth = 0;
  }
  return out;
}

const interfaces = {};
{
  const re = /export interface (\w+)\s*\{/g;
  let m;
  while ((m = re.exec(types))) {
    interfaces[m[1]] = parseFields(braceBody(types, re.lastIndex));
  }
}

// ---------------------------------------------------------------------------
// 2. Parse normalizer defaults (what renders even if the model says nothing)
// ---------------------------------------------------------------------------

const EMPTYISH = new Set(["''", '""', '0', 'false', '[]', '{}']);


function literalDefault(expr) {
  const pats = [
    /as(?:String|Bool|Number)\(\s*[^,()]+,\s*([\s\S]+?)\s*,?\s*\)/,
    /\bstr\(\s*'[^']*'\s*,\s*([\s\S]+?)\s*,?\s*\)/,
    /\bnum\(\s*'[^']*'\s*,\s*([\s\S]+?)\s*,?\s*\)/,
  ];
  for (const re of pats) {
    const m = expr.match(re);
    if (m) {
      const lit = m[1].trim().replace(/,$/, '').trim();
      if (lit && !EMPTYISH.has(lit)) return lit;
    }
  }
  return null;
}

function isAlias(expr) {
  return /\|\|/.test(expr) && /(?:str|asString)\s*\(/.test(expr);
}

/** interface name -> { fn, body } */
const normalizers = {};
{
  const re = /export function (normalize\w+)\(raw: unknown\):\s*(\w+)\s*\{/g;
  let m;
  while ((m = re.exec(types))) {
    normalizers[m[2]] = { fn: m[1], body: braceBody(types, re.lastIndex) };
  }
}

/**
 * How one field is resolved inside its normalizer.
 *
 * Looked up by name rather than by walking the return object line by line: an
 * earlier version tracked bracket depth to find entries, silently matched
 * nothing, and reported DEFAULT=0 for every page. That was a parser bug being
 * published as a finding, so this reads each field directly instead.
 */
function fieldResolution(iface, field) {
  const n = normalizers[iface];
  if (!n) return null;
  const m = n.body.match(new RegExp('(?:^|[\\s{,(])' + field + ':\\s*([\\s\\S]{0,200})'));
  if (!m) return null;
  const expr = m[1].split(/\n\s{2,}\w+:\s/)[0];
  return { default: literalDefault(expr), alias: isAlias(expr) };
}


// ---------------------------------------------------------------------------
// 3. Parse the AI response schemas out of openai-sales.ts
// ---------------------------------------------------------------------------

/** Drop inline nested object groups so their keys are not read as top level. */
const stripNested = (s) =>
  s.replace(/\[\s*\{[^\]]*\}\s*\]/g, '[]').replace(/:\s*\{[^{}]*\}/g, ': {}');

const keysOn = (line) => [...stripNested(line).matchAll(/"(\w+)"\s*:/g)].map((m) => m[1]);

// -- 3a. full-funnel bundle schema (aiGenerateSalesFunnel) ------------------
const bundleKeys = {};
const byReference = {};
{
  const a = openai.indexOf('Return a single JSON object with this exact shape:');
  const b = openai.indexOf('Upsell block shape:');
  const block = a >= 0 ? openai.slice(a, b > a ? b : undefined) : '';
  let current = null;
  for (const line of block.split(/\r?\n/)) {
    const head = line.match(/^ {2}"(\w+)"\s*:\s*\{(.*)$/);
    if (head) {
      current = head[1];
      bundleKeys[current] = bundleKeys[current] || new Set();
      if (/\.\.\./.test(head[2])) byReference[current] = head[2].trim();
      continue;
    }
    if (/^ {2}\}/.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;
    if (!/^ {4}"/.test(line)) continue;
    for (const k of keysOn(line)) bundleKeys[current].add(k);
  }
}

// -- 3b. shared upsell block shape -----------------------------------------
const upsellBlockKeys = new Set();
{
  const a = openai.indexOf('Upsell block shape:');
  const b = openai.indexOf('Rules for structure:');
  if (a >= 0 && b > a) {
    for (const line of openai.slice(a, b).split(/\r?\n/)) {
      for (const k of keysOn(line)) upsellBlockKeys.add(k);
    }
  }
}
for (const u of UPSELL_KEYS) {
  bundleKeys[u] = bundleKeys[u] || new Set();
  for (const k of upsellBlockKeys) bundleKeys[u].add(k);
}

// -- 3c. per-page regenerate schemas (aiGenerateSalesPage) -----------------
const pageKeys = {};
const pageByReference = {};
{
  const fnStart = openai.indexOf('export async function aiGenerateSalesPage');
  const fnSrc = fnStart >= 0 ? openai.slice(fnStart) : '';
  const branchRe = /(?:\}\s*else\s+if|if)\s*\(\s*page(?:\s*===\s*'(\w+)'|\.startsWith\('(upsell)'\))\s*\)/g;
  const marks = [];
  let m;
  while ((m = branchRe.exec(fnSrc))) {
    marks.push({ page: m[1] || m[2], at: m.index, end: branchRe.lastIndex });
  }
  marks.forEach((mark, i) => {
    const seg = fnSrc.slice(mark.end, i + 1 < marks.length ? marks[i + 1].at : fnSrc.length);
    const targets = mark.page === 'upsell' ? UPSELL_KEYS : [mark.page];
    for (const t of targets) {
      pageKeys[t] = pageKeys[t] || new Set();
      for (const line of seg.split(/\r?\n/)) {
        for (const k of keysOn(line)) pageKeys[t].add(k);
      }
      if (/full-funnel schema/i.test(seg)) {
        pageByReference[t] = 'prose reference to the full-funnel schema (no enumerated keys)';
      }
    }
  });
}

// -- 3d. deterministic post-call assignments -------------------------------
const derivedKeys = {};
{
  const varToPages = (v) =>
    v === 'upsell' || v === 'block' ? UPSELL_KEYS : PAGE_KEYS.includes(v) ? [v] : [];
  const re =
    /\b(optin|sales|vsl|checkout|upsell1|upsell2|upsell3|upsell4|success|access|upsell|block)\.(\w+)\s*=(?!=)/g;
  let m;
  while ((m = re.exec(openai))) {
    for (const p of varToPages(m[1])) {
      derivedKeys[p] = derivedKeys[p] || new Set();
      derivedKeys[p].add(m[2]);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Classify every field of every page
// ---------------------------------------------------------------------------

const MEDIA_RE = /(?:imageurl|videourl|photourl|poster|coverimage|^src$|^gallery$)/i;
const isMedia = (f) => MEDIA_RE.test(f.name) || /Url$/.test(f.name) && /image|video|photo/i.test(f.name);

const report = [];
for (const [page, iface] of PAGES) {
  const fields = interfaces[iface];
  if (!fields) {
    report.push({ page, iface, missingInterface: true });
    continue;
  }
  const schemaFull = bundleKeys[page] || new Set();

  const schemaPage = pageKeys[page] || new Set();
  const derived = derivedKeys[page] || new Set();

  const buckets = { MEDIA: [], SCHEMA: [], DERIVED: [], DEFAULT: [], ALIAS: [], GAP: [] };
  const defaultLiterals = {};
  for (const f of fields) {
    const res = fieldResolution(iface, f.name);
    let status;
    if (isMedia(f)) status = 'MEDIA';
    else if (schemaFull.has(f.name) || schemaPage.has(f.name)) status = 'SCHEMA';
    else if (derived.has(f.name)) status = 'DERIVED';
    else if (res && res.default) status = 'DEFAULT';
    else if (res && res.alias) status = 'ALIAS';
    else status = 'GAP';
    if (status === 'DEFAULT') {
      const lit = res.default.replace(/\s+/g, ' ');
      defaultLiterals[f.name] = lit.length > 46 ? lit.slice(0, 46) + '…' : lit;
    }
    buckets[status].push(f.deprecated ? f.name + ' (deprecated)' : f.name);
  }


  const onlyFull = [...schemaFull].filter(
    (k) => !schemaPage.has(k) && fields.some((f) => f.name === k),
  );
  const onlyPage = [...schemaPage].filter(
    (k) => !schemaFull.has(k) && fields.some((f) => f.name === k),
  );

  report.push({
    page,
    iface,
    total: fields.length,
    buckets,
    defaultLiterals,

    normalizer: normalizers[iface] ? normalizers[iface].fn : null,
    byReference: byReference[page] || null,
    pageByReference: pageByReference[page] || null,
    hasPagePrompt: schemaPage.size > 0 || Boolean(pageByReference[page]),
    hasBundlePrompt: schemaFull.size > 0 || Boolean(byReference[page]),
    onlyFull,
    onlyPage,
  });
}

// ---------------------------------------------------------------------------
// 5. Emit
// ---------------------------------------------------------------------------

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

say('=== SALES FUNNEL AI FILL COVERAGE (field level) ===');
say('generated by: node scripts/audit-ai-fill-coverage.cjs   (read-only)');
say('sources: ' + [TYPES, OPENAI].join(', '));
say('');
say('Legend  MEDIA=image/video slot (Task C)  SCHEMA=prompt asks for it');
say('        DERIVED=code fills from offer stack  DEFAULT=normalizer literal');
say('        ALIAS=falls back to sibling field  GAP=renders blank');
say('');
say(
  pad('page', 10) +
    pad('interface', 20) +
    lpad('total', 6) +
    lpad('MEDIA', 7) +
    lpad('SCHEMA', 7) +
    lpad('DERIV', 7) +
    lpad('DEFLT', 7) +
    lpad('ALIAS', 7) +
    lpad('GAP', 6),
);
say('-'.repeat(77));

const totals = { total: 0, MEDIA: 0, SCHEMA: 0, DERIVED: 0, DEFAULT: 0, ALIAS: 0, GAP: 0 };
for (const r of report) {
  if (r.missingInterface) {
    say(pad(r.page, 10) + pad(r.iface, 20) + '  INTERFACE NOT FOUND');
    continue;
  }
  const b = r.buckets;
  totals.total += r.total;
  for (const k of ['MEDIA', 'SCHEMA', 'DERIVED', 'DEFAULT', 'ALIAS', 'GAP']) {
    totals[k] += b[k].length;
  }
  say(
    pad(r.page, 10) +
      pad(r.iface, 20) +
      lpad(r.total, 6) +
      lpad(b.MEDIA.length, 7) +
      lpad(b.SCHEMA.length, 7) +
      lpad(b.DERIVED.length, 7) +
      lpad(b.DEFAULT.length, 7) +
      lpad(b.ALIAS.length, 7) +
      lpad(b.GAP.length, 6),
  );
}
say('-'.repeat(77));
say(
  pad('TOTAL', 30) +
    lpad(totals.total, 6) +
    lpad(totals.MEDIA, 7) +
    lpad(totals.SCHEMA, 7) +
    lpad(totals.DERIVED, 7) +
    lpad(totals.DEFAULT, 7) +
    lpad(totals.ALIAS, 7) +
    lpad(totals.GAP, 6),
);

const copyTotal = totals.total - totals.MEDIA;
const copyFilled = totals.SCHEMA + totals.DERIVED;
say('');
say(
  'HEADLINE NUMBER: the AI schema or post-fill covers ' +
    copyFilled +
    ' of ' +
    copyTotal +
    ' non-media fields (' +
    Math.round((copyFilled / copyTotal) * 100) +
    '%). ' +
    totals.GAP +
    ' fields render blank; ' +
    totals.DEFAULT +
    ' render a hardcoded default.',
);

say('');
say('--- GAP: never requested, no default (fix these in Task B) ---');
for (const r of report) {
  if (r.missingInterface || !r.buckets.GAP.length) continue;
  say(r.page + ' (' + r.buckets.GAP.length + '): ' + r.buckets.GAP.join(', '));
}
if (!report.some((r) => !r.missingInterface && r.buckets.GAP.length)) say('(none)');

say('');
say('--- DEFAULT: renders a hardcoded literal if the model stays silent ---');
say('(not blank, but not written for this funnel either: brand-voice risk)');
for (const r of report) {
  if (r.missingInterface || !r.buckets.DEFAULT.length) continue;
  say(r.page + ' (' + r.buckets.DEFAULT.length + '):');
  for (const f of r.buckets.DEFAULT) {
    say('    ' + pad(f, 26) + (r.defaultLiterals[f] || ''));
  }
}


say('');
say('--- PROMPT DRIFT: full-funnel vs per-page regenerate ---');
let drift = false;
for (const r of report) {
  if (r.missingInterface) continue;
  if (!r.hasBundlePrompt && !r.hasPagePrompt) {
    drift = true;
    say(r.page + ': NO AI SCHEMA AT ALL (neither generator can produce this block)');
    continue;
  }
  if (!r.hasPagePrompt) {
    drift = true;
    say(r.page + ': no per-page regenerate schema (full-funnel only)');
  }
  if (!r.hasBundlePrompt) {
    drift = true;
    say(r.page + ': no full-funnel schema (per-page only)');
  }
  // A side that defines its schema by reference ("...same as the optin block...")
  // enumerates no keys, so every key looks one-sided. That is a limitation of
  // reading prompts as text, not evidence the field is unasked: label it.
  const refNote = (side) =>
    side === 'page' && r.pageByReference
      ? '  [NOT REAL DRIFT: per-page schema is by reference, keys not enumerated]'
      : side === 'full' && r.byReference
        ? '  [NOT REAL DRIFT: full-funnel schema is by reference, keys not enumerated]'
        : '';
  if (r.onlyFull.length) {
    const note = refNote('page');
    if (!note) drift = true;
    say(
      r.page +
        ': asked by full-funnel but NOT per-page (' +
        r.onlyFull.length +
        ')' +
        note +
        ': ' +
        r.onlyFull.join(', '),
    );
  }
  if (r.onlyPage.length) {
    const note = refNote('full');
    if (!note) drift = true;
    say(
      r.page +
        ': asked by per-page but NOT full-funnel (' +
        r.onlyPage.length +
        ')' +
        note +
        ': ' +
        r.onlyPage.join(', '),
    );
  }

}
if (!drift) say('(no drift)');

say('');
say('--- SCHEMA BY REFERENCE (prompt points elsewhere instead of listing keys) ---');
let refs = false;
for (const r of report) {
  if (r.missingInterface) continue;
  if (r.byReference) {
    refs = true;
    say(r.page + ' [full-funnel]: ' + r.byReference);
  }
  if (r.pageByReference) {
    refs = true;
    say(r.page + ' [per-page]: ' + r.pageByReference);
  }
}
if (!refs) say('(none)');

say('');
say('--- MEDIA slots (Task C: image-prompt derivation, not a copy gap) ---');
for (const r of report) {
  if (r.missingInterface || !r.buckets.MEDIA.length) continue;
  say(r.page + ' (' + r.buckets.MEDIA.length + '): ' + r.buckets.MEDIA.join(', '));
}

// --- capability probes (corrected) ----------------------------------------
say('');
say('--- capability probes ---');
const haystacks = { types, defaults, aiIntake: intake, openaiSales: openai };
const probes = [
  ['image prompt derivation (sales)', /imagePrompt|image_prompt|promptForImage/],
  ['video script (sales)', /videoScript|vslScript|scriptFor/],
  ['bump / OTO copy', /bump|oto\b/i],
  // Corrected: the thank-you page ships as success + access. The old probe
  // searched for "thankYou" and wrongly reported ABSENT. Do not rebuild these.
  ['thank-you equivalent (success/access)', /SuccessContent|normalizeSuccess|AccessContent/],
  ['onboarding / intake questions', /onboard|intakeQuestion|questionnaire/i],
  ['shared funnel brief (congruence substrate)', /funnelBrief|FunnelBrief/],
];
for (const [label, re] of probes) {
  const hits = Object.entries(haystacks)
    .filter(([, s]) => s && re.test(s))
    .map(([k]) => k);
  say(pad(label, 44) + (hits.length ? 'FOUND in ' + hits.join(', ') : 'ABSENT'));
}

say('');
say('--- reuse targets (present: wrap, do not rebuild) ---');
for (const c of [
  'src/lib/mothermode/content/scriptStoryboard.ts',
  'src/lib/mothermode/content/filmBible.ts',
  'src/lib/mothermode/sales/emailPlan.ts',
  'src/lib/mothermode/sales/emailAutobuild.ts',
  'src/lib/mothermode/sales/fromOffer.ts',
  'src/components/mothermode/sales/VslPage.tsx',
]) {
  const s = read(c);
  say(pad(s ? 'present' : 'MISSING', 9) + c + (s ? '  (' + s.split(/\r?\n/).length + ' lines)' : ''));
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log('\nwrote ' + OUT);
