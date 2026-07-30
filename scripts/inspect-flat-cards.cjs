/**
 * The planner / courses / course-access pages have no inline card classes,
 * so their shell must come from a shared component. Print their imports and
 * any className strings so we can find the real owner of the treatment.
 *
 * Usage: node scripts/inspect-flat-cards.cjs
 */
const fs = require('fs');
const path = require('path');

const DIRS = [
  'src/app/admin/planner',
  'src/app/admin/courses',
  'src/app/admin/course-access'
];

const OUT = path.join('scripts', 'flat-cards-report.txt');

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const lines = [];
for (const dir of DIRS) {
  for (const file of walk(dir)) {
    const src = fs.readFileSync(file, 'utf8');
    lines.push(`=== ${file}  (${src.split('\n').length} lines)`);

    lines.push('  -- imports:');
    (src.match(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?$/gm) || []).forEach((i) =>
      lines.push('     ' + i.trim().replace(/\s+/g, ' '))
    );

    lines.push('  -- className strings:');
    const cls = [
      ...new Set(
        (src.match(/className=(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g) || []).map((c) =>
          c.replace(/\s+/g, ' ')
        )
      )
    ];
    if (!cls.length) lines.push('     (none)');
    cls.slice(0, 40).forEach((c) => lines.push('     ' + c));
    if (cls.length > 40) lines.push(`     ...and ${cls.length - 40} more`);
    lines.push('');
  }
}

fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\nreport -> ${OUT}`);
