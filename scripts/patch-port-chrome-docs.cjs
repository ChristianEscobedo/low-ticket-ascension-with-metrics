/**
 * Patch docs/SALES_FUNNEL_SYSTEM_PORT.md with chrome editability updates.
 * Run: node scripts/patch-port-chrome-docs.cjs
 *
 * Handles CRLF + markdown trailing-two-spaces line breaks.
 */
const fs = require('fs');
const path = 'docs/SALES_FUNNEL_SYSTEM_PORT.md';

// Normalize: CRLF → LF, strip trailing spaces on each line
let t = fs
  .readFileSync(path, 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((line) => line.replace(/[ \t]+$/g, ''))
  .join('\n');

let n = 0;

function rep(label, from, to) {
  if (!t.includes(from)) {
    // already applied?
    if (to && t.includes(to.trim().slice(0, 80))) {
      console.log('SKIP (already)', label);
      return;
    }
    console.error('FAIL:', label);
    console.error('--- looked for (first 200) ---\n' + from.slice(0, 200));
    const key = from.split('\n')[0].slice(0, 50);
    const i = t.indexOf(key);
    if (i >= 0) console.error('--- nearby ---\n' + JSON.stringify(t.slice(i, i + 200)));
    process.exit(1);
  }
  t = t.replace(from, to);
  n++;
  console.log('OK', label);
}

// 1) Companions
rep(
  'companions',
  [
    'Companion audit: `docs/FUNNEL_EDITABILITY_AUDIT.md`',
    'Re-run field audit: `node scripts/audit-funnel-editability.cjs`',
  ].join('\n'),
  [
    'Companion audit: `docs/FUNNEL_EDITABILITY_AUDIT.md`',
    'Chrome edit handoff (complete): `docs/SALES_FUNNEL_CHROME_EDIT_HANDOFF.md`',
    'Re-run field audit: `node scripts/audit-funnel-editability.cjs`',
    'Chrome structural verify: `node scripts/verify-chrome-final.cjs`',
  ].join('\n'),
);

// 2) Files block
rep(
  'files',
  [
    'src/components/mothermode/sales/',
    '  inlineEdit.tsx              # toolbar, popup, Editable, EditableList, save',
    '  SalesPageEditContext.tsx    # SalesPageEditProvider + MmEditable (hover edit)',
    '  FunnelMediaStudio.tsx',
    '  SalesOptinPage.tsx',
    '  SalesPage.tsx               # MotherModeSalesPage + provider + minimizable sheet',
    '  VslPage.tsx',
    '  CheckoutPage.tsx',
    '  UpsellPage.tsx              # MotherModeUpsellPage + provider + minimizable sheet',
    '  SuccessPage.tsx',
    '  AccessPage.tsx',
    '',
    '# MotherMode layout sections (optional MmEditable; no-op on catalog pages)',
    'src/components/mothermode/parts/',
    '  HeroSection.tsx, NarrativeSections.tsx, InsideSection.tsx,',
    '  ProofSection.tsx, BonusSection.tsx, ClosingSections.tsx,',
    '  CheckoutButton.tsx, UrgencyBar.tsx, ...',
    'src/components/mothermode/upsell/MotherModeUpsellPage.tsx',
    'src/components/mothermode/MotherModeSalesPage.tsx',
  ].join('\n'),
  [
    'src/components/mothermode/sales/',
    '  inlineEdit.tsx              # toolbar, popup, Editable, EditableList, save',
    '                              # footer.* root path get/set + save payload',
    '  SalesPageEditContext.tsx    # SalesPageEditProvider + MmEditable (+ onDark)',
    '  FunnelMediaStudio.tsx',
    '  SalesOptinPage.tsx',
    '  SalesPage.tsx               # MotherModeSalesPage + provider + minimizable sheet',
    '  VslPage.tsx',
    '  CheckoutPage.tsx            # provider + timer/brand props + OptinFooter',
    '  UpsellPage.tsx              # MotherModeUpsellPage + provider + minimizable sheet',
    '  SuccessPage.tsx',
    '  AccessPage.tsx',
    '',
    'src/components/mothermode/checkout/MotherModeCheckout.tsx',
    '                              # timerLabel + brandLabel MmEditable chrome',
    '',
    'src/components/mothermode/optin/',
    '  Wordmark.tsx                # shared OptinWordmark → footer.brandLine (sales edit)',
    '  OptinFooter.tsx             # footer.* hover-edit (brand/disclaimer/links/copyright)',
    '',
    '# MotherMode layout sections (optional MmEditable; no-op on catalog pages)',
    'src/components/mothermode/parts/',
    '  HeroSection.tsx             # uses shared OptinWordmark (no local Wordmark)',
    '  NarrativeSections.tsx, InsideSection.tsx,',
    '  ProofSection.tsx, BonusSection.tsx, ClosingSections.tsx,',
    '  CheckoutButton.tsx, UrgencyBar.tsx, ...',
    'src/components/mothermode/upsell/MotherModeUpsellPage.tsx',
    'src/components/mothermode/MotherModeSalesPage.tsx',
    '',
    '# Verify chrome wiring',
    'scripts/verify-chrome-final.cjs',
  ].join('\n'),
);

// 3) Funnel steps
rep(
  'step-checkout',
  '| Checkout | `/funnel/[slug]/checkout` | Checkout card + product image | Admin + on-page CTA/commerce fields + product image |',
  '| Checkout | `/funnel/[slug]/checkout` | `MotherModeCheckout` + product image | Admin + hover (`MmEditable`) + timer/brand chrome + field sheet + product image |',
);
rep(
  'step-footer',
  '| Footer | (shared chrome) | OptinFooter | Admin Footer tab |',
  '| Footer | (shared chrome) | OptinFooter + OptinWordmark | Admin Footer tab + on-page hover (`footer.*`) |',
);

// 4) How hover works
rep(
  'how-hover',
  [
    '- `SalesPageEditProvider` wraps funnel **Sales** + **Upsell** pages only',
    '- Section components use optional `MmEditable`',
    '- Catalog `/mothermode/*` never provides the context → `MmEditable` is a no-op',
    '- Simple pages (optin, VSL, checkout, success, access) use `Editable` /',
    '  `EditableList` directly from `inlineEdit.tsx`',
  ].join('\n'),
  [
    '- `SalesPageEditProvider` wraps funnel **Sales**, **Upsell**, and **Checkout**',
    '  (checkout needs it for chrome `MmEditable` on timer/brand)',
    '- Section components use optional `MmEditable` (`onDark` for dark urgency bar)',
    '- Catalog `/mothermode/*` never provides the context → `MmEditable` / wordmark edit are no-ops',
    '- Simple pages (optin, VSL, success, access) use `Editable` /',
    '  `EditableList` directly from `inlineEdit.tsx`',
    '- Shared chrome:',
    '  - **Wordmark** (`OptinWordmark`) edits root `footer.brandLine` (short label ≤ 24 chars)',
    '  - **Footer** (`OptinFooter`) edits `footer.brandLine|disclaimer|links.N.*|copyright`',
    '  - `inlineEdit` get/set special-case `footer` / `footer.*`; Save always posts `footer`',
  ].join('\n'),
);

// 5) Coverage rows
rep(
  'cov-sales',
  '| **Sales** | Hero, problem, origin, what-is, mechanism, old/new, method headings, inside headings/lead, founder letter, guarantee, final CTA, bonuses intro/total/closer, pricing eyebrow + tagline, **CTA buttons** (`ctaText`) | Hero image, hero video, founder photo | insideItems, methodSteps, FAQs, proof, bumps, bonusesItems → **Admin** |',
  '| **Sales** | Hero (**wordmark** → `footer.brandLine`), problem, origin, what-is, mechanism, old/new, method headings, inside headings/lead, founder letter, guarantee, final CTA, bonuses intro/total/closer, pricing eyebrow + tagline, **CTA buttons** (`ctaText`) | Hero image, hero video, founder photo | insideItems, methodSteps, FAQs, proof, bumps, bonusesItems → **Admin** |',
);
rep(
  'cov-checkout',
  '| **Checkout** | Eyebrow, headline, sub, product name, price label, bullets, **CTA**, priceCents / stripe / productId / paymentType / trialDays | Product image | — |',
  '| **Checkout** | Eyebrow, headline, sub, product name, price label, bullets, **CTA**, **timerLabel** (urgency bar), **brandLabel** (header), priceCents / stripe / productId / paymentType / trialDays | Product image | — |',
);
rep(
  'cov-footer',
  '| **Footer** | Admin Footer tab | — | links[] |',
  '| **Footer** | **brandLine**, disclaimer, link labels/hrefs, copyright (hover) + Admin Footer tab | — | links[] (add/remove in Admin) |',
);

// 6) Congruence checklist
rep(
  'checklist',
  '- [x] Full editability audit documented (`FUNNEL_EDITABILITY_AUDIT.md`)\n',
  [
    '- [x] Full editability audit documented (`FUNNEL_EDITABILITY_AUDIT.md`)',
    '- [x] **Checkout chrome** — `timerLabel` + `brandLabel` (types/defaults/normalize + MmEditable + admin Checkout tab)',
    '- [x] **Shared wordmark** — `OptinWordmark` → `footer.brandLine`; Hero uses shared component',
    '- [x] **On-page footer edit** — OptinFooter hover paths + admin Footer seed (`defaultMotherModeSalesFooter`)',
    '- [x] Store upsert/duplicate preserve `footer`; chrome verify script `verify-chrome-final.cjs`',
    '',
  ].join('\n'),
);

// 7) Editability model table row
rep(
  'model-row',
  '| **AI / Load defaults** | Seed or regenerate whole blocks |\n\n### Nested path hover-edit (Sales page)\n',
  [
    '| **AI / Load defaults** | Seed or regenerate whole blocks |',
    '| **Chrome (root footer + checkout labels)** | Wordmark, footer legal, checkout timer/brand |',
    '',
    '### Nested path hover-edit (Sales page)',
    '',
  ].join('\n'),
);

// 8) Chrome section after nested paths
rep(
  'chrome-section',
  [
    'Catalog `/mothermode/*` still no-ops (`MmEditable` without provider).',
    '',
    'Still admin-primary (add/remove rows, reorder): bumps, upsell features/gallery,',
    'success delivery cards, access onboarding lists.',
    '',
    '---',
    '',
    '## Still optional next',
  ].join('\n'),
  [
    'Catalog `/mothermode/*` still no-ops (`MmEditable` without provider).',
    '',
    'Still admin-primary (add/remove rows, reorder): bumps, upsell features/gallery,',
    'success delivery cards, access onboarding lists.',
    '',
    '### Chrome editability (complete)',
    '',
    'Funnel chrome is fully editable without touching the MotherMode catalog.',
    '',
    '| Surface | Field path | UI |',
    '|---------|------------|-----|',
    '| Checkout urgency bar | block field `timerLabel` | `MmEditable` + `onDark` on dark bar |',
    '| Checkout header brand | block field `brandLabel` | `MmEditable` in sticky header |',
    '| Hero / page wordmark | `footer.brandLine` | Shared `OptinWordmark` (client); short brand |',
    '| Footer brand line | `footer.brandLine` | `OptinFooter` hover |',
    '| Footer disclaimer | `footer.disclaimer` | multiline hover |',
    '| Footer links | `footer.links.{i}.label\\|href` | hover; add/remove in Admin |',
    '| Footer copyright | `footer.copyright` | hover |',
    '',
    '**Data model**',
    '',
    '- `CheckoutContent.timerLabel` / `brandLabel` — types, `normalizeCheckout`, `defaultMotherModeCheckout`',
    '- `SalesFooterContent` (same shape as optin footer) — `defaultMotherModeSalesFooter()`, `normalizeSalesFooter`',
    '- Admin **Checkout** tab: Timer label + Brand label inputs',
    '- Admin **Footer** tab: seeded on new funnel via `useState(defaultMotherModeSalesFooter())`',
    '- Store: upsert normalizes footer; duplicate copies `footer: src.footer`',
    '',
    '**Wiring**',
    '',
    '- `CheckoutPage` → `SalesPageEditProvider` + passes `timerLabel` / `brandLabel` into `MotherModeCheckout`',
    '- Checkout field sheet includes timer/brand scalars',
    '- `HeroSection` imports `OptinWordmark` (local Wordmark removed)',
    '- Save payload always includes `footer: draft.footer`',
    '',
    'Verify: `node scripts/verify-chrome-final.cjs` → ALL PASS.',
    'Detail: `docs/SALES_FUNNEL_CHROME_EDIT_HANDOFF.md`',
    '',
    '---',
    '',
    '## Still optional next',
  ].join('\n'),
);

// 9) Remove footer from optional next
rep(
  'optional-footer',
  [
    '- Success/access event enrollment triggers from page view (types ready; wire if needed)',
    '- On-page footer edit (footer currently Admin Footer tab; rendered via OptinFooter)',
    '',
  ].join('\n'),
  [
    '- Success/access event enrollment triggers from page view (types ready; wire if needed)',
    '',
  ].join('\n'),
);

// 10) Reference table
rep(
  'ref-table',
  '| On-page edit | `Editable` + toolbar | Same + `MmEditable` on MotherMode sections + minimizable sheet |',
  '| On-page edit | `Editable` + toolbar | Same + `MmEditable` on MotherMode sections + minimizable sheet + **chrome** (wordmark / footer / checkout timer+brand) |',
);

// Preserve CRLF for this Windows-checked-in doc
fs.writeFileSync(path, t.replace(/\n/g, '\r\n'));
console.log('\nPatched', n, 'sections →', path, 'len', t.length);

const must = [
  'SALES_FUNNEL_CHROME_EDIT_HANDOFF',
  'verify-chrome-final',
  'timerLabel',
  'brandLabel',
  'OptinWordmark',
  'Chrome editability (complete)',
  'footer.brandLine',
  'onDark',
  'defaultMotherModeSalesFooter',
];
let miss = 0;
for (const m of must) {
  const ok = t.includes(m);
  console.log(ok ? 'has' : 'MISSING', m);
  if (!ok) miss++;
}
if (miss) process.exitCode = 1;
else console.log('\nALL DOC CHECKS PASS');
