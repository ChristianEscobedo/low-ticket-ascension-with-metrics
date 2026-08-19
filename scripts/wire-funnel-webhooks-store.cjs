// Wire the funnel's outbound webhooks into the sales store: the FUNNEL_COLUMNS
// select, the upsert input, and the row write.
const fs = require('fs');
const p = 'src/lib/mothermode/sales/store.ts';
let s = fs.readFileSync(p, 'utf8');
const before = s;

// 1. The FUNNEL_COLUMNS select carries the webhooks column.
s = s.replace(
  'revenue_cents, test_mode, created_at, updated_at, updated_by',
  'revenue_cents, test_mode, webhooks, created_at, updated_at, updated_by'
);

// 2. The upsert input carries the webhooks.
s = s.replace(
  "  /** Per-funnel test mode. Omitted = leave the existing value alone. */\n  testMode?: boolean;\n  updatedBy?: string | null;",
  "  /** Per-funnel test mode. Omitted = leave the existing value alone. */\n  testMode?: boolean;\n  /** Outbound webhooks. Omitted = leave the existing value alone. */\n  webhooks?: string[];\n  updatedBy?: string | null;"
);

// 3. The row write: preserve the existing webhooks unless the input carries them.
s = s.replace(
  '  if (input.testMode !== undefined) row.test_mode = input.testMode;\n  if (input.id) row.id = input.id;',
  '  if (input.testMode !== undefined) row.test_mode = input.testMode;\n  if (input.webhooks !== undefined) row.webhooks = input.webhooks;\n  if (input.id) row.id = input.id;'
);

if (s === before) {
  console.error('NO CHANGE — an anchor missed');
  process.exit(1);
}
fs.writeFileSync(p, s);
console.log('wired: FUNNEL_COLUMNS + the upsert input + the row write');
