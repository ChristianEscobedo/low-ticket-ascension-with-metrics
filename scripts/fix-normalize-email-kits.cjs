const fs = require('fs');
const p = 'src/lib/mothermode/sales/types.ts';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('export function normalizeEmailKits');
if (start < 0) {
  console.error('normalizeEmailKits not found');
  process.exit(1);
}
const end = s.indexOf('export function normalizeSuccess', start);
if (end < 0) {
  console.error('normalizeSuccess not found after normalizeEmailKits');
  process.exit(1);
}

const fn = `export function normalizeEmailKits(raw: unknown): SalesEmailKitBinding[] {
  if (!Array.isArray(raw)) return [];
  const out: SalesEmailKitBinding[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const event = asString(o.event) as SalesEmailEvent;
    const emailKitId = asString(o.emailKitId) || asString(o.kitId);
    if (!emailKitId) continue;
    if (!(SALES_EMAIL_EVENTS as readonly string[]).includes(event)) continue;
    if (seen.has(event)) continue;
    seen.add(event);
    out.push({ event, emailKitId });
  }
  return out;
}


`;

s = s.slice(0, start) + fn + s.slice(end);

// Ensure binding interface uses emailKitId
if (!/export interface SalesEmailKitBinding \{[\s\S]*?emailKitId: string;/.test(s)) {
  s = s.replace(
    /export interface SalesEmailKitBinding \{[\s\S]*?\n\}/,
    `export interface SalesEmailKitBinding {
  event: SalesEmailEvent;
  emailKitId: string;
}`,
  );
}

// Drop leftover SALES_EMAIL_KIT_EVENTS if any
s = s.replace(
  /const SALES_EMAIL_KIT_EVENTS: readonly[\s\S]*?;\s*/m,
  '',
);

fs.writeFileSync(p, s);

const t = fs.readFileSync(p, 'utf8');
const ni = t.indexOf('export function normalizeEmailKits');
console.log(t.slice(ni, ni + 520));
console.log('---');
const bi = t.indexOf('export interface SalesEmailKitBinding');
console.log(t.slice(bi, bi + 120));
console.log('OK', t.includes('asString(o.emailKitId)') && t.includes('SALES_EMAIL_EVENTS'));
