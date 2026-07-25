/**
 * Wire MmEditable hover-edit into MotherMode sections + funnel page wrappers.
 */
const fs = require('fs');
const path = require('path');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.writeFileSync(p, s);
  console.log('wrote', p);
}
function mustReplace(s, search, repl, label) {
  if (!s.includes(search)) {
    console.error('MISSING in', label, ':', search.slice(0, 80));
    process.exit(1);
  }
  return s.replace(search, repl);
}

// ---------------------------------------------------------------------------
// ProofSection — FounderLetter
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ProofSection.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import { MediaFrame } from './MediaFrame';",
      "import { MediaFrame } from './MediaFrame';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }
  // Founder letter body
  s = mustReplace(
    s,
    `            <div className="flex items-center gap-2.5 text-sm uppercase tracking-[0.2em] text-mode">
              <PenLine className="h-4 w-4" />
              {eyebrow}
            </div>
            {heading && (
              <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                {heading}
              </h2>
            )}
            {letter?.greeting && (
              <p className="mt-6 font-display text-2xl leading-relaxed text-mode">
                {letter.greeting}
              </p>
            )}
            <div className="mt-6 space-y-5">
              {paragraphs.map((para, i) => (
                <p key={i} className="text-xl leading-relaxed text-ink/75">
                  {para}
                </p>
              ))}
            </div>

            <div className="mt-9">
              <p className="text-xl text-ink/70">{signoff}</p>`,
    `            <div className="flex items-center gap-2.5 text-sm uppercase tracking-[0.2em] text-mode">
              <PenLine className="h-4 w-4" />
              <MmEditable field="founderEyebrow" as="span">
                {eyebrow}
              </MmEditable>
            </div>
            {heading && (
              <MmEditable
                field="founderHeading"
                as="h2"
                className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
              >
                {heading}
              </MmEditable>
            )}
            {letter?.greeting && (
              <MmEditable
                field="founderGreeting"
                as="p"
                className="mt-6 font-display text-2xl leading-relaxed text-mode"
              >
                {letter.greeting}
              </MmEditable>
            )}
            <MmEditable
              field="founderParagraphs"
              multiline
              as="div"
              className="mt-6 space-y-5"
              value={paragraphs.join('\\n\\n')}
            >
              {paragraphs.map((para, i) => (
                <p key={i} className="text-xl leading-relaxed text-ink/75">
                  {para}
                </p>
              ))}
            </MmEditable>

            <div className="mt-9">
              <MmEditable field="founderSignoff" as="p" className="text-xl text-ink/70">
                {signoff}
              </MmEditable>`,
    'ProofSection founder',
  );
  s = mustReplace(
    s,
    `            {letter?.ps && (
              <p className="mt-9 border-l-2 border-brass/50 bg-brass/[0.05] py-4 pl-5 pr-4 text-lg leading-relaxed text-ink/80">
                {letter.ps}
              </p>
            )}`,
    `            {letter?.ps && (
              <MmEditable
                field="founderPs"
                multiline
                as="p"
                className="mt-9 border-l-2 border-brass/50 bg-brass/[0.05] py-4 pl-5 pr-4 text-lg leading-relaxed text-ink/80"
              >
                {letter.ps}
              </MmEditable>
            )}`,
    'ProofSection ps',
  );
  write(p, s);
}

// ---------------------------------------------------------------------------
// ClosingSections — Guarantee + Final CTA
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ClosingSections.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import { CheckoutButton } from './CheckoutButton';",
      "import { CheckoutButton } from './CheckoutButton';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }
  s = mustReplace(
    s,
    `        <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {offer.guarantee.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-xl leading-relaxed text-ink/70">
          {offer.guarantee.body}
        </p>`,
    `        <MmEditable
          field="guaranteeTitle"
          as="h2"
          className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
        >
          {offer.guarantee.title}
        </MmEditable>
        <MmEditable
          field="guaranteeText"
          multiline
          as="p"
          className="mx-auto mt-5 max-w-xl text-xl leading-relaxed text-ink/70"
        >
          {offer.guarantee.body}
        </MmEditable>`,
    'Guarantee',
  );
  // Final CTA
  if (s.includes('offer.finalCta.heading')) {
    s = mustReplace(
      s,
      `{offer.finalCta.heading}`,
      `{/* editable via MmEditable below */}{offer.finalCta.heading}`,
      'final cta marker skip',
    );
    // undo bad replace - do proper one
    s = s.replace(
      `{/* editable via MmEditable below */}{offer.finalCta.heading}`,
      `{offer.finalCta.heading}`,
    );
  }
  // Find FinalCtaSection heading/body patterns more carefully
  const finalHeading =
    /(<h2[^>]*>\s*)\{offer\.finalCta\.heading\}(\s*<\/h2>)/;
  if (finalHeading.test(s)) {
    s = s.replace(
      finalHeading,
      `<MmEditable field="finalCtaHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          {offer.finalCta.heading}
        </MmEditable>`,
    );
  }
  const finalBody =
    /(<p[^>]*className="[^"]*text-xl[^"]*"[^>]*>\s*)\{offer\.finalCta\.body\}(\s*<\/p>)/;
  if (finalBody.test(s)) {
    s = s.replace(
      finalBody,
      `<MmEditable field="finalCtaBody" multiline as="p" className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-ink/70">
          {offer.finalCta.body}
        </MmEditable>`,
    );
  }
  write(p, s);
}

// ---------------------------------------------------------------------------
// NarrativeSections — Problem / Origin / WhatIs / Mechanism headings
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/NarrativeSections.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import type { MotherModeOffer } from '@/lib/mothermode/types';",
      "import type { MotherModeOffer } from '@/lib/mothermode/types';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }
  s = mustReplace(
    s,
    `export const ProblemSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block>
    <Heading>{offer.problem.heading}</Heading>
    <p className="mt-6 text-xl leading-relaxed text-ink/70">{offer.problem.intro}</p>
    {offer.problem.scene && (
      <p className="mt-8 border-l-2 border-mode/40 pl-5 font-display text-2xl leading-relaxed text-ink">
        {offer.problem.scene}
      </p>
    )}
    <ul className="mt-8 space-y-4">
      {offer.problem.points.map((point) => (
        <li key={point} className="flex items-start gap-3 text-ink/80">
          <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mode" />
          <span className="text-xl leading-relaxed">{point}</span>
        </li>
      ))}
    </ul>
    {offer.problem.cost && (
      <p className="mt-8 text-xl leading-relaxed text-ink/80">{offer.problem.cost}</p>
    )}
  </Block>
);`,
    `export const ProblemSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block>
    <MmEditable field="problemHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
      {offer.problem.heading}
    </MmEditable>
    <MmEditable field="problemIntro" multiline as="p" className="mt-6 text-xl leading-relaxed text-ink/70">
      {offer.problem.intro}
    </MmEditable>
    {offer.problem.scene && (
      <MmEditable field="problemScene" multiline as="p" className="mt-8 border-l-2 border-mode/40 pl-5 font-display text-2xl leading-relaxed text-ink">
        {offer.problem.scene}
      </MmEditable>
    )}
    <MmEditable
      field="problemPoints"
      multiline
      as="ul"
      className="mt-8 space-y-4"
      value={(offer.problem.points || []).join('\\n')}
    >
      {offer.problem.points.map((point) => (
        <li key={point} className="flex items-start gap-3 text-ink/80">
          <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mode" />
          <span className="text-xl leading-relaxed">{point}</span>
        </li>
      ))}
    </MmEditable>
    {offer.problem.cost && (
      <MmEditable field="problemCost" multiline as="p" className="mt-8 text-xl leading-relaxed text-ink/80">
        {offer.problem.cost}
      </MmEditable>
    )}
  </Block>
);`,
    'ProblemSection',
  );

  s = mustReplace(
    s,
    `      <div className="text-sm uppercase tracking-[0.2em] text-mode">
        {offer.origin.eyebrow}
      </div>
      <div className="mt-3">
        <Heading>{offer.origin.heading}</Heading>
      </div>
      <div className="mt-6 space-y-5">
        {offer.origin.paragraphs.map((p, i) => (
          <p key={i} className="text-xl leading-relaxed text-ink/70">
            {p}
          </p>
        ))}
      </div>`,
    `      <MmEditable field="originEyebrow" as="div" className="text-sm uppercase tracking-[0.2em] text-mode">
        {offer.origin.eyebrow}
      </MmEditable>
      <div className="mt-3">
        <MmEditable field="originHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          {offer.origin.heading}
        </MmEditable>
      </div>
      <MmEditable
        field="originParagraphs"
        multiline
        as="div"
        className="mt-6 space-y-5"
        value={(offer.origin.paragraphs || []).join('\\n\\n')}
      >
        {offer.origin.paragraphs.map((p, i) => (
          <p key={i} className="text-xl leading-relaxed text-ink/70">
            {p}
          </p>
        ))}
      </MmEditable>`,
    'OriginSection',
  );

  // WhatIs
  s = mustReplace(
    s,
    `export const WhatIsSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block>
    <Heading>{offer.whatIs.heading}</Heading>
    <div className="mt-6 space-y-5">
      {offer.whatIs.paragraphs.map((p, i) => (
        <p key={i} className="text-xl leading-relaxed text-ink/70">
          {p}
        </p>
      ))}
    </div>
  </Block>
);`,
    `export const WhatIsSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block>
    <MmEditable field="whatIsHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
      {offer.whatIs.heading}
    </MmEditable>
    <MmEditable
      field="whatIsParagraphs"
      multiline
      as="div"
      className="mt-6 space-y-5"
      value={(offer.whatIs.paragraphs || []).join('\\n\\n')}
    >
      {offer.whatIs.paragraphs.map((p, i) => (
        <p key={i} className="text-xl leading-relaxed text-ink/70">
          {p}
        </p>
      ))}
    </MmEditable>
  </Block>
);`,
    'WhatIsSection',
  );

  // Mechanism eyebrow/heading/label
  s = mustReplace(
    s,
    `      <div className="text-sm uppercase tracking-[0.2em] text-mode">{m.eyebrow}</div>
      <div className="mt-3">
        <Heading>{m.heading}</Heading>
      </div>
      <p className="mt-6 font-display text-2xl leading-relaxed text-ink">{m.label}</p>
      <div className="mt-5 space-y-5">
        {m.paragraphs.map((p, i) => (
          <p key={i} className="text-xl leading-relaxed text-ink/70">
            {p}
          </p>
        ))}
      </div>`,
    `      <MmEditable field="mechanismEyebrow" as="div" className="text-sm uppercase tracking-[0.2em] text-mode">
        {m.eyebrow}
      </MmEditable>
      <div className="mt-3">
        <MmEditable field="mechanismHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          {m.heading}
        </MmEditable>
      </div>
      <MmEditable field="mechanismLabel" as="p" className="mt-6 font-display text-2xl leading-relaxed text-ink">
        {m.label}
      </MmEditable>
      <MmEditable
        field="mechanismParagraphs"
        multiline
        as="div"
        className="mt-5 space-y-5"
        value={(m.paragraphs || []).join('\\n\\n')}
      >
        {m.paragraphs.map((p, i) => (
          <p key={i} className="text-xl leading-relaxed text-ink/70">
            {p}
          </p>
        ))}
      </MmEditable>`,
    'MechanismSection',
  );

  write(p, s);
}

// ---------------------------------------------------------------------------
// BonusSection
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/BonusSection.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import type { MotherModeOffer } from '@/lib/mothermode/types';",
      "import type { MotherModeOffer } from '@/lib/mothermode/types';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }
  s = mustReplace(
    s,
    `            <div className="flex items-center gap-2.5 text-sm uppercase tracking-[0.2em] text-mode">
              <Gift className="h-4 w-4" />
              {bonuses.eyebrow}
            </div>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              {bonuses.heading}
            </h2>
            {bonuses.intro && (
              <p className="mt-5 text-xl leading-relaxed text-ink/65">
                {bonuses.intro}
              </p>
            )}`,
    `            <div className="flex items-center gap-2.5 text-sm uppercase tracking-[0.2em] text-mode">
              <Gift className="h-4 w-4" />
              <MmEditable field="bonusesEyebrow" as="span">
                {bonuses.eyebrow}
              </MmEditable>
            </div>
            <MmEditable
              field="bonusesHeading"
              as="h2"
              className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
            >
              {bonuses.heading}
            </MmEditable>
            {bonuses.intro && (
              <MmEditable
                field="bonusesIntro"
                multiline
                as="p"
                className="mt-5 text-xl leading-relaxed text-ink/65"
              >
                {bonuses.intro}
              </MmEditable>
            )}`,
    'BonusSection',
  );
  write(p, s);
}

// ---------------------------------------------------------------------------
// SalesPage — wrap with provider
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/SalesPage.tsx';
  let s = read(p);
  if (!s.includes('SalesPageEditProvider')) {
    s = s.replace(
      `import {
  FunnelMediaStudio,
  MediaStudioTrigger,
  type FunnelMediaKind,
} from './FunnelMediaStudio';`,
      `import {
  FunnelMediaStudio,
  MediaStudioTrigger,
  type FunnelMediaKind,
} from './FunnelMediaStudio';
import { SalesPageEditProvider } from './SalesPageEditContext';`,
    );
    s = mustReplace(
      s,
      `  return (
    <div className="relative">
      <MotherModeSalesPage
        offer={offer}
        checkoutHref={\`/funnel/\${funnel.slug}/checkout\`}
      />

      {isAdmin && (
        <>
          <SalesEditToolbar edit={edit} />
          <InlineEditPopup edit={edit} />`,
      `  return (
    <SalesPageEditProvider edit={edit}>
    <div className="relative">
      <MotherModeSalesPage
        offer={offer}
        checkoutHref={\`/funnel/\${funnel.slug}/checkout\`}
      />

      {isAdmin && (
        <>
          <SalesEditToolbar edit={edit} />
          <InlineEditPopup edit={edit} />`,
      'SalesPage open',
    );
    // close provider before final closing of component
    s = mustReplace(
      s,
      `      )}
    </div>
  );
}

function Field({`,
      `      )}
    </div>
    </SalesPageEditProvider>
  );
}

function Field({`,
      'SalesPage close',
    );
  }
  write(p, s);
}

// ---------------------------------------------------------------------------
// UpsellPage — wrap with provider + MmEditable on key fields in MotherModeUpsell
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/UpsellPage.tsx';
  let s = read(p);
  if (!s.includes('SalesPageEditProvider')) {
    s = s.replace(
      `import {
  FunnelMediaStudio,
  MediaStudioTrigger,
  type FunnelMediaKind,
} from './FunnelMediaStudio';`,
      `import {
  FunnelMediaStudio,
  MediaStudioTrigger,
  type FunnelMediaKind,
} from './FunnelMediaStudio';
import { SalesPageEditProvider } from './SalesPageEditContext';`,
    );
    s = mustReplace(
      s,
      `  return (
    <div className="relative">
      <MotherModeUpsellPage
        offer={offer}
        recordOnAccept={recordOnAccept as any}
        acceptRedirect={acceptRedirect}
        declineRedirect={declineRedirect}
        finalizeFrontEnd={upsellKey === 'upsell1'}
      />

      {isAdmin && (
        <>
          <SalesEditToolbar edit={edit} />
          <InlineEditPopup edit={edit} />`,
      `  return (
    <SalesPageEditProvider edit={edit}>
    <div className="relative">
      <MotherModeUpsellPage
        offer={offer}
        recordOnAccept={recordOnAccept as any}
        acceptRedirect={acceptRedirect}
        declineRedirect={declineRedirect}
        finalizeFrontEnd={upsellKey === 'upsell1'}
      />

      {isAdmin && (
        <>
          <SalesEditToolbar edit={edit} />
          <InlineEditPopup edit={edit} />`,
      'UpsellPage open',
    );
    s = mustReplace(
      s,
      `      )}
    </div>
  );
}

function Field({`,
      `      )}
    </div>
    </SalesPageEditProvider>
  );
}

function Field({`,
      'UpsellPage close',
    );
  }
  write(p, s);
}

// ---------------------------------------------------------------------------
// MotherModeUpsellPage — hover edit on headline fields
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/upsell/MotherModeUpsellPage.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import type { AscensionOffer } from '@/lib/mothermode/ascension';",
      "import type { AscensionOffer } from '@/lib/mothermode/ascension';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }
  s = mustReplace(
    s,
    `        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass">
          {offer.eyebrow}
        </p>
        <h1 className="mt-5 text-center font-display text-4xl leading-[1.05] text-ink sm:text-5xl md:text-6xl">
          {offer.headline}{' '}
          <span className="italic text-mode">{offer.headlineEmphasis}</span>
        </h1>
        {offer.headlineSuffix && (
          <p className="mt-4 text-center font-display text-xl text-ink/70 sm:text-2xl">
            {offer.headlineSuffix}
          </p>
        )}
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-ink/70">
          {offer.subheadline}
        </p>`,
    `        <MmEditable
          field="eyebrow"
          as="p"
          className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass"
        >
          {offer.eyebrow}
        </MmEditable>
        <h1 className="mt-5 text-center font-display text-4xl leading-[1.05] text-ink sm:text-5xl md:text-6xl">
          <MmEditable field="headline" as="span">
            {offer.headline}
          </MmEditable>{' '}
          <MmEditable field="headlineEmphasis" as="span" className="italic text-mode">
            {offer.headlineEmphasis}
          </MmEditable>
        </h1>
        {offer.headlineSuffix && (
          <MmEditable
            field="headlineSuffix"
            as="p"
            className="mt-4 text-center font-display text-xl text-ink/70 sm:text-2xl"
          >
            {offer.headlineSuffix}
          </MmEditable>
        )}
        <MmEditable
          field="subheadline"
          multiline
          as="p"
          className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-ink/70"
        >
          {offer.subheadline}
        </MmEditable>`,
    'Upsell hook',
  );

  // letter
  s = mustReplace(
    s,
    `        <div className="mx-auto mt-16 max-w-2xl space-y-5 text-lg leading-relaxed text-ink/80">
          {offer.letter.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>`,
    `        <MmEditable
          field="letter"
          multiline
          as="div"
          className="mx-auto mt-16 max-w-2xl space-y-5 text-lg leading-relaxed text-ink/80"
          value={(offer.letter || []).join('\\n')}
        >
          {offer.letter.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </MmEditable>`,
    'Upsell letter',
  );

  // stack
  s = mustReplace(
    s,
    `          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass">
            {offer.stackEyebrow}
          </p>
          <h2 className="mt-3 text-center font-display text-3xl text-ink sm:text-4xl">
            {offer.stackHeading}
          </h2>`,
    `          <MmEditable
            field="stackEyebrow"
            as="p"
            className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass"
          >
            {offer.stackEyebrow}
          </MmEditable>
          <MmEditable
            field="stackHeading"
            as="h2"
            className="mt-3 text-center font-display text-3xl text-ink sm:text-4xl"
          >
            {offer.stackHeading}
          </MmEditable>`,
    'Upsell stack',
  );

  write(p, s);
}

console.log('done');
