/**
 * One-pass conversion of the "component reference stored in data" icon layer to
 * a serializable string-union + client-side registry.
 *
 * Why: MotherModeSalesPage is a Server Component; HeroSection / InsidePanel /
 * Sidebar are 'use client'. The offer object crosses that boundary carrying live
 * lucide forwardRef objects ({$$typeof, render, displayName}), which React
 * cannot serialize -> 500 on /.
 *
 * Strategy:
 *   - src/lib/mothermode/icons.ts        : IconName string union (no lucide import)
 *   - src/components/.../iconRegistry.tsx: name -> component map + iconFor()
 *   - catalogs store 'Sparkles' instead of Sparkles
 *   - consumers do iconFor(item.icon) instead of item.icon
 *
 * Atomic: every edit is staged in memory and all anchors asserted before a
 * single byte is written. Idempotent: re-running is a no-op.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const staged = new Map(); // absPath -> content
const report = [];
const problems = [];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const stage = (p, content) => staged.set(p, content);
const fail = (msg) => problems.push(msg);

/* ------------------------------------------------------------------ *
 * 1. The name union. Pure data, safe to import from a Server Component.
 * ------------------------------------------------------------------ */

// Every name currently assigned to an `icon:` field in the mothermode catalogs,
// plus the handful the funnel delivery cards resolve to. Each one is already
// imported from lucide-react somewhere in the tree, so all are known-good in
// the installed version.
const ICON_NAMES = [
  'Activity', 'Anchor', 'Backpack', 'BookOpen', 'Brain', 'Briefcase',
  'CalendarHeart', 'Check', 'Clock', 'Code2', 'Compass', 'DoorOpen',
  'Download', 'Eraser', 'Feather', 'Filter', 'Gift', 'Headphones', 'Heart',
  'HeartHandshake', 'InfinityIcon', 'Layers', 'LifeBuoy', 'ListChecks',
  'ListOrdered', 'Mail', 'Map', 'MessageCircle', 'MessagesSquare', 'Mic',
  'Moon', 'Play', 'RefreshCcw', 'Repeat', 'Route', 'Scissors', 'ShieldCheck',
  'Sparkles', 'SplitSquareVertical', 'Sun', 'Sunrise', 'Trash2', 'UserCheck',
  'Users', 'Utensils', 'UtensilsCrossed', 'Video', 'Zap',
];

const ICONS_TS = `/**
 * Icon names as data.
 *
 * Offer catalogs are read by Server Components and handed to 'use client'
 * children. A lucide component is a live forwardRef object, which cannot cross
 * that boundary, so catalogs store the *name* and the client registry resolves
 * it. Keep this file free of any lucide-react import.
 *
 * @see src/components/mothermode/parts/iconRegistry.tsx
 */

export const ICON_NAMES = [
${ICON_NAMES.map((n) => `  '${n}',`).join('\n')}
] as const;

/** A serializable reference to one lucide glyph. */
export type IconName = (typeof ICON_NAMES)[number];

/** Fallback used when a name is missing or unrecognized. */
export const DEFAULT_ICON: IconName = 'Sparkles';

/** Runtime guard for values arriving from the DB or an AI response. */
export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && (ICON_NAMES as readonly string[]).includes(value);
}

/** Coerce anything into a valid IconName. */
export function toIconName(value: unknown): IconName {
  return isIconName(value) ? value : DEFAULT_ICON;
}
`;

const REGISTRY_TSX = `/**
 * Name -> lucide component registry.
 *
 * The single place where an icon *name* becomes an icon *component*. Importable
 * from server and client files alike; what matters is that the component itself
 * never travels inside serialized props.
 *
 * @see src/lib/mothermode/icons.ts
 */
import {
${ICON_NAMES.filter((n) => n !== 'InfinityIcon').map((n) => `  ${n},`).join('\n')}
  Infinity as InfinityIcon,
  type LucideIcon,
} from 'lucide-react';
import { DEFAULT_ICON, type IconName } from '@/lib/mothermode/icons';

const REGISTRY: Record<IconName, LucideIcon> = {
${ICON_NAMES.map((n) => `  ${n},`).join('\n')}
};

/**
 * Resolve a stored name to a renderable component. Unknown or missing names
 * fall back to the default glyph rather than throwing, so a bad value from the
 * DB degrades to a placeholder instead of taking down the page.
 */
export function iconFor(name: string | undefined | null): LucideIcon {
  if (name && name in REGISTRY) return REGISTRY[name as IconName];
  return REGISTRY[DEFAULT_ICON];
}

/** Convenience wrapper: <Icon name={item.icon} className="h-5 w-5" /> */
export function Icon({
  name,
  className,
}: {
  name: string | undefined | null;
  className?: string;
}) {
  const Glyph = iconFor(name);
  return <Glyph className={className} />;
}
`;

stage('src/lib/mothermode/icons.ts', ICONS_TS);
stage('src/components/mothermode/parts/iconRegistry.tsx', REGISTRY_TSX);
report.push('created  src/lib/mothermode/icons.ts');
report.push('created  src/components/mothermode/parts/iconRegistry.tsx');

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Quote every `icon: Foo,` / `icon: Foo }` into `icon: 'Foo',`. */
function quoteIconValues(src) {
  return src.replace(/\bicon:\s*([A-Z][A-Za-z0-9_]*)(?=\s*[,}])/g, "icon: '$1'");
}

/**
 * Drop lucide-react value imports whose local binding is no longer referenced.
 * Runs only on files this codemod already rewrote.
 */
function pruneLucideImports(src, file) {
  const re = /import\s*\{([\s\S]*?)\}\s*from\s*'lucide-react';\n/g;
  return src.replace(re, (stmt, inner) => {
    const rest = src.replace(stmt, '');
    const kept = inner
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((spec) => {
        const local = spec.includes(' as ') ? spec.split(' as ')[1].trim() : spec;
        // `\b` alone would match the name inside its own string literal, so the
        // check runs against the file with the import statement removed.
        return new RegExp(`\\b${local}\\b`).test(rest);
      });
    if (kept.length === 0) {
      report.push(`  pruned  lucide-react import entirely in ${file}`);
      return '';
    }
    if (kept.length !== inner.split(',').map((s) => s.trim()).filter(Boolean).length) {
      report.push(`  pruned  ${file} lucide import -> { ${kept.join(', ')} }`);
    }
    return `import {\n${kept.map((k) => `  ${k},`).join('\n')}\n} from 'lucide-react';\n`;
  });
}

/** Insert an import line immediately before the first existing import. */
function addImport(src, line, file) {
  if (src.includes(line)) return src;
  const idx = src.search(/^import /m);
  if (idx === -1) {
    fail(`${file}: no import statement found to anchor "${line}"`);
    return src;
  }
  return src.slice(0, idx) + line + '\n' + src.slice(idx);
}

/** Replace `needle` exactly once; record a problem if it is missing. */
function replaceOnce(src, needle, replacement, file) {
  if (!src.includes(needle)) {
    if (src.includes(replacement)) return src; // already applied
    fail(`${file}: anchor not found -> ${needle.trim()}`);
    return src;
  }
  return src.replace(needle, replacement);
}

/* ------------------------------------------------------------------ *
 * 2. The type declarations.
 * ------------------------------------------------------------------ */

{
  const file = 'src/lib/mothermode/types.ts';
  let src = read(file);
  src = replaceOnce(
    src,
    "import type { LucideIcon } from 'lucide-react';",
    "import type { IconName } from './icons';",
    file
  );
  const before = (src.match(/icon: LucideIcon;/g) || []).length;
  src = src.replace(/icon: LucideIcon;/g, 'icon: IconName;');
  if (before !== 4) fail(`${file}: expected 4 LucideIcon fields, found ${before}`);
  report.push(`rewrote  ${file} (${before} icon fields -> IconName)`);
  stage(file, src);
}

{
  const file = 'src/lib/mothermode/ascension.ts';
  let src = read(file);
  src = replaceOnce(
    src,
    "import type { LucideIcon } from 'lucide-react';",
    "import type { IconName } from './icons';",
    file
  );
  src = src.replace(/icon: LucideIcon;/g, 'icon: IconName;');
  src = quoteIconValues(src);
  src = pruneLucideImports(src, file);
  report.push(`rewrote  ${file}`);
  stage(file, src);
}

/* ------------------------------------------------------------------ *
 * 3. The offer catalogs + the two sales mappers.
 * ------------------------------------------------------------------ */

const CATALOGS = [
  'src/lib/mothermode/offers/brain-dump.ts',
  'src/lib/mothermode/offers/draft.ts',
  'src/lib/mothermode/offers/five-pm-reset.ts',
  'src/lib/mothermode/offers/morning-without-yelling.ts',
  'src/lib/mothermode/offers/offload-map.ts',
  'src/lib/mothermode/offers/mental-load-drafts.ts',
  'src/lib/mothermode/offers/seasonal-drafts.ts',
  'src/lib/mothermode/sales/fromOffer.ts',
  'src/lib/mothermode/sales/fromAscension.ts',
];

for (const file of CATALOGS) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    report.push(`skipped  ${file} (not present)`);
    continue;
  }
  const original = read(file);
  let src = quoteIconValues(original);
  if (src === original) {
    report.push(`no-op    ${file} (no component icon values)`);
    continue;
  }
  src = pruneLucideImports(src, file);
  const count = (original.match(/\bicon:\s*[A-Z][A-Za-z0-9_]*\s*[,}]/g) || []).length;
  report.push(`rewrote  ${file} (${count} icon values quoted)`);
  stage(file, src);
}

/* ------------------------------------------------------------------ *
 * 4. The consumers.
 * ------------------------------------------------------------------ */

const IMPORT_LINE = "import { iconFor } from '@/components/mothermode/parts/iconRegistry';";

const CONSUMERS = [
  ['src/components/mothermode/parts/BonusSection.tsx', [['const Icon = bonus.icon;', 'const Icon = iconFor(bonus.icon);']]],
  ['src/components/mothermode/parts/InsideSection.tsx', [
    ['const LeadIcon = lead.icon;', 'const LeadIcon = iconFor(lead.icon);'],
    ['const Icon = item.icon;', 'const Icon = iconFor(item.icon);'],
  ]],
  ['src/components/mothermode/parts/NarrativeSections.tsx', [['const Icon = step.icon;', 'const Icon = iconFor(step.icon);']]],
  ['src/components/mothermode/upsell/MotherModeUpsellPage.tsx', [['const Icon = f.icon;', 'const Icon = iconFor(f.icon);']]],
];

for (const [file, edits] of CONSUMERS) {
  let src = read(file);
  let touched = false;
  for (const [needle, replacement] of edits) {
    const next = replaceOnce(src, needle, replacement, file);
    if (next !== src) touched = true;
    src = next;
  }
  if (touched) {
    src = addImport(src, IMPORT_LINE, file);
    report.push(`rewrote  ${file} (${edits.length} call site(s) -> iconFor)`);
    stage(file, src);
  } else {
    report.push(`no-op    ${file}`);
  }
}

/* CheckoutPage builds throwaway InsideItems and cast a component to satisfy the
 * old type. With IconName the cast is dead weight. */
{
  const file = 'src/components/mothermode/sales/CheckoutPage.tsx';
  let src = read(file);
  const needle = "icon: Check as MotherModeOffer['inside']['items'][number]['icon'],";
  const hits = src.split(needle).length - 1;
  if (hits > 0) {
    src = src.split(needle).join("icon: 'Check',");
    src = pruneLucideImports(src, file);
    report.push(`rewrote  ${file} (${hits} cast(s) -> 'Check')`);
    stage(file, src);
  } else {
    report.push(`no-op    ${file}`);
  }
}

/* ------------------------------------------------------------------ *
 * 5. Commit (only if every anchor was found).
 * ------------------------------------------------------------------ */

if (problems.length) {
  console.error('ABORTED - nothing written. Unmet anchors:\n');
  problems.forEach((p) => console.error('  ! ' + p));
  process.exit(1);
}

for (const [file, content] of staged) {
  const abs = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const prev = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (prev === content) {
    report.push(`unchanged ${file}`);
    continue;
  }
  fs.writeFileSync(abs, content);
}

console.log(report.join('\n'));
console.log(`\n${staged.size} files staged, written.`);
