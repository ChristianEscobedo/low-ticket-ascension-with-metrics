/**
 * One-off: sweep the light-theme Tailwind tokens out of the named admin pages
 * and onto the dark house palette (bone text / ink inputs / brass accents).
 * Order matters (longest tokens first). A brass button's white text goes ink.
 * Prints per-file replacement counts. Idempotent (re-runs find nothing).
 */
const fs = require('fs');

const FILES = [
  'src/app/admin/personalization/page.tsx',
  'src/app/admin/experts/page.tsx',
  'src/app/admin/experts/ExpertBuilder.tsx',
  'src/app/admin/recipes/page.tsx',
  'src/app/admin/recipes/RecipeDraftEditor.tsx',
  'src/app/admin/recipes/[runId]/page.tsx',
  'src/app/admin/skills/page.tsx',
  'src/app/admin/media-library/page.tsx',
  'src/app/admin/ai-twins/page.tsx',
];

// Burgundy cards (the /admin house card = border-mode/25 bg-mode/[0.07]).
// These run FIRST on a re-run: the earlier pass made cards bone-tinted; the
// house card is burgundy-tinted.
const MODE_MAP = [
  ['border-bone/10 bg-bone/[0.04]', 'border-mode/25 bg-mode/[0.07]'],
  ['border-bone/15 bg-bone/[0.03]', 'border-mode/30 bg-mode/[0.07]'],
  ['bg-bone/[0.05]', 'bg-mode/[0.10]'],
];

// [search, replace] — longest/most-specific first.
const MAP = [
  ['bg-white/60', 'bg-bone/[0.03]'],
  ['bg-white/90', 'bg-ink/80'],
  ['bg-white', 'bg-bone/[0.04]'],
  ['placeholder:text-ink/30', 'placeholder:text-bone/25'],
  ['placeholder:text-ink/25', 'placeholder:text-bone/25'],
  ['text-ink/70', 'text-bone/75'],
  ['text-ink/65', 'text-bone/65'],
  ['text-ink/60', 'text-bone/60'],
  ['text-ink/55', 'text-bone/55'],
  ['text-ink/50', 'text-bone/50'],
  ['text-ink/45', 'text-bone/45'],
  ['text-ink/40', 'text-bone/40'],
  ['text-ink/35', 'text-bone/30'],
  ['text-ink/30', 'text-bone/25'],
  ['text-ink/25', 'text-bone/25'],
  ['text-ink/20', 'text-bone/20'],
  ['text-ink/15', 'text-bone/15'],
  ['text-ink/10', 'text-bone/10'],
  ['text-ink', 'text-bone'],
  ['border-ink/25', 'border-bone/25'],
  ['border-ink/20', 'border-bone/20'],
  ['border-ink/15', 'border-bone/15'],
  ['border-ink/10', 'border-bone/10'],
  ['hover:bg-ink/5', 'hover:bg-bone/10'],
  ['hover:bg-ink/10', 'hover:bg-bone/10'],
  ['bg-red-50', 'bg-red-500/10'],
  ['border-red-200', 'border-red-500/25'],
  ['text-red-700', 'text-red-200'],
  ['text-red-600', 'text-red-300'],
  ['text-red-500', 'text-red-300'],
  ['text-red-400', 'text-red-300/70'],
  ['bg-emerald-100', 'bg-emerald-400/15'],
  ['text-emerald-700', 'text-emerald-300'],
  ['text-emerald-600', 'text-emerald-300'],
  ['bg-amber-100', 'bg-amber-400/15'],
  ['text-amber-700', 'text-amber-300'],
  ['text-amber-600', 'text-amber-300'],
  ['bg-green-100', 'bg-emerald-400/15'],
  ['text-green-700', 'text-emerald-300'],
  ['divide-ink', 'divide-bone'],
  ['ring-ink', 'ring-bone'],
];
for (const [from, to] of MODE_MAP) MAP.unshift([from, to]);

let grand = 0;
for (const file of FILES) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP (missing) ${file}`);
    continue;
  }
  let s = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const [from, to] of MAP) {
    const parts = s.split(from);
    if (parts.length > 1) {
      count += parts.length - 1;
      s = parts.join(to);
    }
  }
  // A brass button's white text reads ink on the dark theme (line-scoped).
  s = s
    .split('\n')
    .map((line) =>
      line.includes('bg-brass') && line.includes('text-white')
        ? line.replaceAll('text-white', 'text-ink')
        : line,
    )
    .join('\n');
  const brassLines = s.split('\n').filter((l) => l.includes('bg-brass') && l.includes('text-ink')).length;
  if (count > 0 || brassLines > 0) fs.writeFileSync(file, s);
  console.log(`${file}: ${count} token swaps`);
  grand += count;
}
console.log(`TOTAL ${grand}`);
