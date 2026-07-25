/**
 * Residual fixes after scripts/icon-registry-refactor.cjs, plus the port-doc
 * entry. Two type errors remained, both from array literals whose element type
 * widened to `string` once the values became literals:
 *
 *   1. offers/draft.ts  - defaultIcons was still an array of lucide components.
 *   2. sales/CheckoutPage.tsx - `icon: 'Check'` widened to string inside a
 *      plain array literal, so it no longer satisfied InsideItem['icon'].
 *
 * Append-only for the doc, idempotent for the code.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const problems = [];
const done = [];

const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const wr = (p, c) => fs.writeFileSync(path.join(ROOT, p), c);

/* --- 1. draft.ts: the default icon rotation becomes names --------------- */
{
  const file = 'src/lib/mothermode/offers/draft.ts';
  let src = rd(file);
  const old = 'const defaultIcons = [ListChecks, SplitSquareVertical, MessagesSquare, RefreshCcw, Map];';
  const next =
    "const defaultIcons: IconName[] = ['ListChecks', 'SplitSquareVertical', 'MessagesSquare', 'RefreshCcw', 'Map'];";

  if (src.includes(old)) {
    src = src.replace(old, next);

    // IconName type import, placed before the first existing import.
    const typeImport = "import type { IconName } from '../icons';";
    if (!src.includes(typeImport)) {
      const idx = src.search(/^import /m);
      if (idx === -1) problems.push(`${file}: no import to anchor IconName`);
      else src = src.slice(0, idx) + typeImport + '\n' + src.slice(idx);
    }

    // Drop lucide bindings that are now unreferenced.
    src = src.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'lucide-react';\n/g, (stmt, inner) => {
      const rest = src.replace(stmt, '');
      const kept = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((spec) => {
          const local = spec.includes(' as ') ? spec.split(' as ')[1].trim() : spec;
          return new RegExp(`\\b${local}\\b`).test(rest);
        });
      if (kept.length === 0) return '';
      return `import {\n${kept.map((k) => `  ${k},`).join('\n')}\n} from 'lucide-react';\n`;
    });

    wr(file, src);
    done.push(`fixed  ${file} (defaultIcons -> IconName[])`);
  } else if (src.includes(next)) {
    done.push(`ok     ${file} (already converted)`);
  } else {
    problems.push(`${file}: defaultIcons anchor not found`);
  }
}

/* --- 2. CheckoutPage.tsx: keep the literal from widening ---------------- */
{
  const file = 'src/components/mothermode/sales/CheckoutPage.tsx';
  let src = rd(file);
  const hits = src.split("icon: 'Check',").length - 1;
  if (hits > 0) {
    src = src.split("icon: 'Check',").join("icon: 'Check' as const,");
    wr(file, src);
    done.push(`fixed  ${file} (${hits} literal(s) pinned with as const)`);
  } else if (src.includes("icon: 'Check' as const,")) {
    done.push(`ok     ${file} (already pinned)`);
  } else {
    problems.push(`${file}: no icon: 'Check' literal found`);
  }
}

/* --- 3. Port doc (append-only, skips if the entry already exists) ------- */
{
  const file = 'docs/ICON_REGISTRY_SYSTEM_PORT.md';
  const marker = '## Step 1 - Icons become data';
  const entry = `# Icon Registry System Port

Append-only log. Each step records what shipped and how it was verified.

${marker}

**Problem.** \`GET /\` returned 500 with a React serialization error naming
\`{$$typeof, render, displayName}\`. \`MotherModeSalesPage\` is a Server
Component; \`HeroSection\`, \`InsidePanel\` and \`Sidebar\` are \`'use client'\`.
Four interfaces in \`src/lib/mothermode/types.ts\` typed \`icon: LucideIcon\`, and
the offer catalogs filled that field with real lucide component references. The
offer object crossed the server/client boundary carrying live \`forwardRef\`
objects, which React Server Components cannot serialize.

**Fix.** Icons are stored as names and resolved to components on the render
side only.

- \`src/lib/mothermode/icons.ts\` - \`ICON_NAMES\` / \`IconName\` string union,
  \`DEFAULT_ICON\`, \`isIconName\`, \`toIconName\`. No lucide import, so it is safe
  to pull into a Server Component.
- \`src/components/mothermode/parts/iconRegistry.tsx\` - the name to component
  map, \`iconFor(name)\` and an \`<Icon name=... />\` wrapper. Unknown names fall
  back to the default glyph instead of throwing, so a bad value out of the DB
  degrades to a placeholder rather than a 500.

**Producers converted** (\`icon: Sparkles\` to \`icon: 'Sparkles'\`):
\`types.ts\` (4 interfaces), \`ascension.ts\`, \`offers/brain-dump.ts\` (12),
\`offers/draft.ts\` (4 plus the \`defaultIcons\` rotation),
\`offers/five-pm-reset.ts\` (12), \`offers/morning-without-yelling.ts\` (12),
\`offers/offload-map.ts\` (12), \`sales/fromOffer.ts\` (4),
\`sales/fromAscension.ts\` (2). Newly unused lucide imports were pruned.

**Consumers converted** (\`const Icon = x.icon\` to \`const Icon = iconFor(x.icon)\`):
\`parts/BonusSection.tsx\`, \`parts/InsideSection.tsx\` (2 sites),
\`parts/NarrativeSections.tsx\`, \`upsell/MotherModeUpsellPage.tsx\`,
\`sales/CheckoutPage.tsx\` (the \`Check as ...['icon']\` casts are gone).

**Considered and rejected.** Mapping \`icon: Foo\` to \`iconNode: <Foo />\` on the
server also fixes the error, since React *elements* serialize even though
component references do not. It is a shorter diff but it changes the prop
contract at every call site, so it needs the identical consumer audit. Shorter,
not cheaper, and it leaves components in the data model.

**Out of scope, still using the old pattern.**
\`src/components/sales-page/mindshift-sections/constants.ts\` declares its own
\`icon: LucideIcon\` fields. That subtree imports its constants directly rather
than receiving them as props across a boundary, so it is not currently failing.
Convert it if those sections ever start taking data from a Server Component.
Unrelated and untouched: the lowercase \`deliveryCards\` icon strings resolved by
\`SuccessPage\`'s own \`ICON_MAP\`, and the \`{ icon: Icon }\` prop destructuring in
the rich-text toolbars.

**Verified.** \`pnpm exec tsc --noEmit\` exits 0. Enumeration came from
\`scripts/icon-audit.cjs\` (writes \`scripts/icon-audit.txt\`); the conversion is
\`scripts/icon-registry-refactor.cjs\` (atomic: stages every edit and asserts
every anchor before writing) plus \`scripts/icon-registry-finish.cjs\`.

**Not verified in this session.** No browser load of \`/\`. Run the dev server
and confirm the route returns 200 before treating the incident as closed.
`;

  const abs = path.join(ROOT, file);
  if (fs.existsSync(abs) && rd(file).includes(marker)) {
    done.push(`skip   ${file} (entry already present)`);
  } else {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, entry);
    done.push(`wrote  ${file}`);
  }
}

console.log(done.join('\n'));
if (problems.length) {
  console.error('\nProblems:');
  problems.forEach((p) => console.error('  ! ' + p));
  process.exit(1);
}
