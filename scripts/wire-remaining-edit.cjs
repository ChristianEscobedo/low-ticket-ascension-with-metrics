/**
 * 1) Wire remaining MotherMode sections with MmEditable
 * 2) Make SalesPage + UpsellPage bottom field sheets collapsible
 */
const fs = require('fs');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.writeFileSync(p, s);
  console.log('ok', p);
}
function rep(s, a, b, label) {
  if (!s.includes(a)) {
    console.error('MISS', label, JSON.stringify(a.slice(0, 80)));
    process.exit(1);
  }
  return s.replace(a, b);
}

// ---------------------------------------------------------------------------
// OldVsNew + Method
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/NarrativeSections.tsx';
  let s = read(p);

  s = rep(
    s,
    `export const OldVsNewSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block>
    <Heading>There is the way it has been. And there is this.</Heading>
    <div className="mt-10 grid gap-6 sm:grid-cols-2">
      <div className="rounded-2xl border border-ink/10 bg-bone p-6">
        <div className="text-sm uppercase tracking-[0.2em] text-ink/40">
          {offer.oldWay.heading}
        </div>
        <ul className="mt-5 space-y-3.5">
          {offer.oldWay.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-lg text-ink/55">
              <X className="mt-1 h-5 w-5 flex-shrink-0 text-mushroom" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-mode/25 bg-mode/[0.04] p-6">
        <div className="text-sm uppercase tracking-[0.2em] text-mode">
          {offer.newWay.heading}
        </div>
        <ul className="mt-5 space-y-3.5">
          {offer.newWay.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-lg text-ink/80">
              <Check className="mt-1 h-5 w-5 flex-shrink-0 text-mode" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </Block>
);`,
    `export const OldVsNewSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block>
    <Heading>There is the way it has been. And there is this.</Heading>
    <div className="mt-10 grid gap-6 sm:grid-cols-2">
      <div className="rounded-2xl border border-ink/10 bg-bone p-6">
        <MmEditable field="oldWayHeading" as="div" className="text-sm uppercase tracking-[0.2em] text-ink/40">
          {offer.oldWay.heading}
        </MmEditable>
        <MmEditable
          field="oldWayItems"
          multiline
          as="ul"
          className="mt-5 space-y-3.5"
          value={(offer.oldWay.items || []).join('\\n')}
        >
          {offer.oldWay.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-lg text-ink/55">
              <X className="mt-1 h-5 w-5 flex-shrink-0 text-mushroom" />
              <span>{item}</span>
            </li>
          ))}
        </MmEditable>
      </div>
      <div className="rounded-2xl border border-mode/25 bg-mode/[0.04] p-6">
        <MmEditable field="newWayHeading" as="div" className="text-sm uppercase tracking-[0.2em] text-mode">
          {offer.newWay.heading}
        </MmEditable>
        <MmEditable
          field="newWayItems"
          multiline
          as="ul"
          className="mt-5 space-y-3.5"
          value={(offer.newWay.items || []).join('\\n')}
        >
          {offer.newWay.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-lg text-ink/80">
              <Check className="mt-1 h-5 w-5 flex-shrink-0 text-mode" />
              <span>{item}</span>
            </li>
          ))}
        </MmEditable>
      </div>
    </div>
  </Block>
);`,
    'oldvsnew',
  );

  s = rep(
    s,
    `    <Block className="rounded-2xl border border-ink/10 bg-white/55 p-7 sm:p-9">
      <Heading>{offer.method.heading}</Heading>
      {offer.method.subheading && (
        <p className="mt-6 text-xl leading-relaxed text-ink/70">
          {offer.method.subheading}
        </p>
      )}`,
    `    <Block className="rounded-2xl border border-ink/10 bg-white/55 p-7 sm:p-9">
      <MmEditable field="methodHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
        {offer.method.heading}
      </MmEditable>
      {offer.method.subheading && (
        <MmEditable field="methodSubheading" multiline as="p" className="mt-6 text-xl leading-relaxed text-ink/70">
          {offer.method.subheading}
        </MmEditable>
      )}`,
    'method head',
  );

  // method closer if present
  if (s.includes('offer.method.closer') && !s.includes('field="methodCloser"')) {
    s = s.replace(
      /\{offer\.method\.closer && \([\s\S]*?\{offer\.method\.closer\}[\s\S]*?\)\}/,
      (m) => {
        // leave structure, wrap closer text if simple
        return m
          .replace(
            '{offer.method.closer}',
            '<MmEditable field="methodCloser" multiline as="span">{offer.method.closer}</MmEditable>',
          )
          .replace(
            '<MmEditable field="methodCloser" multiline as="span"><MmEditable field="methodCloser" multiline as="span">{offer.method.closer}</MmEditable></MmEditable>',
            '<MmEditable field="methodCloser" multiline as="span">{offer.method.closer}</MmEditable>',
          );
      },
    );
  }

  write(p, s);
}

// ---------------------------------------------------------------------------
// InsideSection
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/InsideSection.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import type { MotherModeOffer } from '@/lib/mothermode/types';",
      "import type { MotherModeOffer } from '@/lib/mothermode/types';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }
  if (!s.startsWith("'use client'") && !s.startsWith('"use client"')) {
    s = "'use client';\n\n" + s;
  }

  s = rep(
    s,
    `            <div className="text-sm uppercase tracking-[0.2em] text-mode">
              Everything in the pack
            </div>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              {offer.inside.heading}
            </h2>
            <p className="mt-5 text-xl leading-relaxed text-ink/65">
              {offer.inside.subheading}
            </p>`,
    `            <div className="text-sm uppercase tracking-[0.2em] text-mode">
              Everything in the pack
            </div>
            <MmEditable field="insideHeading" as="h2" className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              {offer.inside.heading}
            </MmEditable>
            <MmEditable field="insideSubheading" multiline as="p" className="mt-5 text-xl leading-relaxed text-ink/65">
              {offer.inside.subheading}
            </MmEditable>`,
    'inside head',
  );

  s = rep(
    s,
    `        {offer.inside.lead && (
          <p className="mt-10 max-w-3xl border-l-2 border-mode/40 pl-5 font-display text-2xl leading-relaxed text-ink">
            {offer.inside.lead}
          </p>
        )}`,
    `        {offer.inside.lead && (
          <MmEditable field="insideLead" multiline as="p" className="mt-10 max-w-3xl border-l-2 border-mode/40 pl-5 font-display text-2xl leading-relaxed text-ink">
            {offer.inside.lead}
          </MmEditable>
        )}`,
    'inside lead',
  );

  write(p, s);
}

// ---------------------------------------------------------------------------
// ProofSection testimonials heading
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ProofSection.tsx';
  let s = read(p);
  s = rep(
    s,
    `        <h2 className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          Mothers who put some of it down.
        </h2>`,
    `        <MmEditable
          field="testimonialsHeading"
          as="h2"
          className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
          value="Mothers who put some of it down."
        >
          Mothers who put some of it down.
        </MmEditable>`,
    'proof heading',
  );
  write(p, s);
}

// ---------------------------------------------------------------------------
// PricingSection + FaqSection
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ClosingSections.tsx';
  let s = read(p);

  s = rep(
    s,
    `            <p className="mt-3 text-sm text-ink/50">{offer.hero.promise}</p>`,
    `            <MmEditable field="promise" as="p" className="mt-3 text-sm text-ink/50">
              {offer.hero.promise}
            </MmEditable>`,
    'pricing promise',
  );

  s = rep(
    s,
    `      <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
        The questions mothers ask first.
      </h2>`,
    `      <MmEditable
        field="faqHeading"
        as="h2"
        className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
        value="The questions mothers ask first."
      >
        The questions mothers ask first.
      </MmEditable>`,
    'faq heading',
  );

  write(p, s);
}

// ---------------------------------------------------------------------------
// Bonus closer + total value
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/BonusSection.tsx';
  let s = read(p);
  if (s.includes('bonuses.totalValue') && !s.includes('field="bonusesTotalValue"')) {
    s = s.replace(
      `{bonuses.totalValue}`,
      `<MmEditable field="bonusesTotalValue" as="span">{bonuses.totalValue}</MmEditable>`,
    );
  }
  if (s.includes('bonuses.closer') && !s.includes('field="bonusesCloser"')) {
    // wrap closer paragraph content
    s = s.replace(
      /\{bonuses\.closer && \(([\s\S]*?)\{bonuses\.closer\}([\s\S]*?)\)\}/,
      (full, a, b) => {
        return `{bonuses.closer && (${a}<MmEditable field="bonusesCloser" multiline as="span">{bonuses.closer}</MmEditable>${b})}`;
      },
    );
  }
  write(p, s);
}

// ---------------------------------------------------------------------------
// UrgencyBar - make category editable when context present
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/UrgencyBar.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    if (!s.startsWith("'use client'") && !s.startsWith('"use client"')) {
      s = "'use client';\n\n" + s;
    }
    // add import after first import block line
    s = s.replace(
      /^(import .+\n)/m,
      `$1import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';\n`,
    );
    // wrap category display if simple
    if (s.includes('{category}') && !s.includes('field="category"')) {
      s = s.replace(
        '{category}',
        '<MmEditable field="category" as="span">{category}</MmEditable>',
      );
    }
  }
  write(p, s);
}

// ---------------------------------------------------------------------------
// SalesPage: collapsible bottom sheet
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/SalesPage.tsx';
  let s = read(p);

  // ensure useState already imported
  if (!s.includes('const [sheetOpen')) {
    s = rep(
      s,
      `  const [mediaStudio, setMediaStudio] = useState<null | {
    kind: FunnelMediaKind;
    field: SalesMediaField;
    label: string;
  }>(null);`,
      `  const [mediaStudio, setMediaStudio] = useState<null | {
    kind: FunnelMediaKind;
    field: SalesMediaField;
    label: string;
  }>(null);
  const [sheetOpen, setSheetOpen] = useState(true);`,
      'sheet state',
    );
  }

  s = rep(
    s,
    `          {edit.isEditMode && (
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[45vh] overflow-y-auto border-t border-ink/10 bg-bone/95 p-4 shadow-2xl backdrop-blur">
              <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Media
                </span>`,
    `          {edit.isEditMode && (
            <div className={\`fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-bone/95 shadow-2xl backdrop-blur \${sheetOpen ? 'max-h-[45vh] overflow-y-auto p-4' : 'p-2'}\`}>
              <div className="mx-auto mb-2 flex max-w-6xl items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Field sheet {sheetOpen ? '' : '· minimized — hover page text to edit'}
                </span>
                <button
                  type="button"
                  onClick={() => setSheetOpen((v) => !v)}
                  className="rounded-full border border-ink/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/70 hover:border-mode/40 hover:text-mode"
                >
                  {sheetOpen ? 'Minimize' : 'Expand fields'}
                </button>
              </div>
              {sheetOpen && (
              <>
              <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Media
                </span>`,
    'sales sheet open',
  );

  // close the conditional before the mediaStudio block ends of edit mode sheet
  // Find the note paragraph end and close fragment
  if (!s.includes('{sheetOpen && (')) {
    console.error('sheet open wrapper missing after replace');
    process.exit(1);
  }

  // Close fragment + conditional before the closing of edit.isEditMode sheet div
  // Look for the help text paragraph then closing divs
  const help = `                <p className="sm:col-span-2 lg:col-span-3 text-xs text-ink/50">
                  Full founder letter paragraphs, origin/mechanism/inside/method lists, proof,
                  FAQs, bonuses items, and bumps edit in Admin → Sales Funnels → Sales tab (full
                  MotherMode field set), or via AI generate / Load MotherMode defaults. Media
                  studio above sets hero image, hero video, and founder photo. Saving here writes
                  the full sales JSON block.
                </p>
              </div>
            </div>
          )}`;

  const help2 = `                <p className="sm:col-span-2 lg:col-span-3 text-xs text-ink/50">
                  Full founder letter paragraphs, origin/mechanism/inside/method lists, proof,
                  FAQs, bonuses items, and bumps edit in Admin → Sales Funnels → Sales tab (full
                  MotherMode field set), or via AI generate / Load MotherMode defaults. Media
                  studio above sets hero image, hero video, and founder photo. Saving here writes
                  the full sales JSON block.
                </p>
              </div>
              </>
              )}
            </div>
          )}`;

  if (s.includes(help)) {
    s = s.replace(help, help2);
  } else if (!s.includes('Expand fields')) {
    console.error('could not close sheet fragment');
    process.exit(1);
  } else {
    // maybe already partially done - try alternate close
    console.log('sales sheet help block pattern not exact; checking...');
  }

  write(p, s);
}

// ---------------------------------------------------------------------------
// UpsellPage collapsible sheet
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/UpsellPage.tsx';
  let s = read(p);

  if (!s.includes('const [sheetOpen')) {
    s = rep(
      s,
      `  const [mediaStudio, setMediaStudio] = useState<null | {
    kind: FunnelMediaKind;
    field: UpsellMediaField;
    label: string;
  }>(null);`,
      `  const [mediaStudio, setMediaStudio] = useState<null | {
    kind: FunnelMediaKind;
    field: UpsellMediaField;
    label: string;
  }>(null);
  const [sheetOpen, setSheetOpen] = useState(true);`,
      'upsell sheet state',
    );
  }

  s = rep(
    s,
    `          {edit.isEditMode && (
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[45vh] overflow-y-auto border-t border-ink/10 bg-bone/95 p-4 shadow-2xl backdrop-blur">
              <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Media
                </span>`,
    `          {edit.isEditMode && (
            <div className={\`fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-bone/95 shadow-2xl backdrop-blur \${sheetOpen ? 'max-h-[45vh] overflow-y-auto p-4' : 'p-2'}\`}>
              <div className="mx-auto mb-2 flex max-w-6xl items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Field sheet {sheetOpen ? '' : '· minimized — hover page text to edit'}
                </span>
                <button
                  type="button"
                  onClick={() => setSheetOpen((v) => !v)}
                  className="rounded-full border border-ink/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/70 hover:border-mode/40 hover:text-mode"
                >
                  {sheetOpen ? 'Minimize' : 'Expand fields'}
                </button>
              </div>
              {sheetOpen && (
              <>
              <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Media
                </span>`,
    'upsell sheet open',
  );

  const upsellCloseFrom = `              <p className="mx-auto mt-3 max-w-6xl text-xs text-ink/50">
                Production OTO layout (MotherModeUpsellPage). Use Media studio for image/video,
                then Save. Letter paragraphs, features, and gallery shots edit best from the
                admin form tabs.
              </p>
            </div>
          )}`;

  const upsellCloseTo = `              <p className="mx-auto mt-3 max-w-6xl text-xs text-ink/50">
                Production OTO layout (MotherModeUpsellPage). Use Media studio for image/video,
                then Save. Letter paragraphs, features, and gallery shots edit best from the
                admin form tabs. Hover page text while Editing to edit in place.
              </p>
              </>
              )}
            </div>
          )}`;

  if (s.includes(upsellCloseFrom)) {
    s = s.replace(upsellCloseFrom, upsellCloseTo);
  } else {
    console.error('upsell close pattern miss');
    process.exit(1);
  }

  write(p, s);
}

console.log('done');
