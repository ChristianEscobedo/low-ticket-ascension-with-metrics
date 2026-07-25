const fs = require('fs');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s); console.log('ok', p); }
function rep(s, a, b, label) {
  if (!s.includes(a)) { console.error('MISS', label, a.slice(0, 60)); process.exit(1); }
  return s.replace(a, b);
}

// NarrativeSections full rewrite of key sections via targeted replaces
{
  const p = 'src/components/mothermode/parts/NarrativeSections.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import type { MotherModeOffer } from '@/lib/mothermode/types';",
      "import type { MotherModeOffer } from '@/lib/mothermode/types';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }

  s = rep(s,
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
    <MmEditable field="problemPoints" multiline as="ul" className="mt-8 space-y-4" value={(offer.problem.points || []).join('\\n')}>
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
);`, 'problem');

  s = rep(s,
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
      <MmEditable field="originParagraphs" multiline as="div" className="mt-6 space-y-5" value={(offer.origin.paragraphs || []).join('\\n\\n')}>
        {offer.origin.paragraphs.map((p, i) => (
          <p key={i} className="text-xl leading-relaxed text-ink/70">
            {p}
          </p>
        ))}
      </MmEditable>`, 'origin');

  s = rep(s,
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
`      <MmEditable field="mechanismEyebrow" as="div" className="text-sm uppercase tracking-[0.2em] text-mode">{m.eyebrow}</MmEditable>
      <div className="mt-3">
        <MmEditable field="mechanismHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">{m.heading}</MmEditable>
      </div>
      <MmEditable field="mechanismLabel" as="p" className="mt-6 font-display text-2xl leading-relaxed text-ink">{m.label}</MmEditable>
      <MmEditable field="mechanismParagraphs" multiline as="div" className="mt-5 space-y-5" value={(m.paragraphs || []).join('\\n\\n')}>
        {m.paragraphs.map((p, i) => (
          <p key={i} className="text-xl leading-relaxed text-ink/70">
            {p}
          </p>
        ))}
      </MmEditable>`, 'mechanism');

  s = rep(s,
`export const WhatIsSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block className="rounded-2xl border border-ink/10 bg-white/55 p-7 sm:p-9">
    <Heading>{offer.whatIs.heading}</Heading>
    <div className="mt-6 space-y-5">
      {offer.whatIs.paragraphs.map((p, i) => (
        <p
          key={i}
          className={
            i === 0
              ? 'font-display text-2xl leading-relaxed text-ink'
              : 'text-xl leading-relaxed text-ink/70'
          }
        >
          {p}
        </p>
      ))}
    </div>
  </Block>
);`,
`export const WhatIsSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block className="rounded-2xl border border-ink/10 bg-white/55 p-7 sm:p-9">
    <MmEditable field="whatIsHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
      {offer.whatIs.heading}
    </MmEditable>
    <MmEditable field="whatIsParagraphs" multiline as="div" className="mt-6 space-y-5" value={(offer.whatIs.paragraphs || []).join('\\n\\n')}>
      {offer.whatIs.paragraphs.map((p, i) => (
        <p
          key={i}
          className={
            i === 0
              ? 'font-display text-2xl leading-relaxed text-ink'
              : 'text-xl leading-relaxed text-ink/70'
          }
        >
          {p}
        </p>
      ))}
    </MmEditable>
  </Block>
);`, 'whatis');

  write(p, s);
}

// BonusSection
{
  const p = 'src/components/mothermode/parts/BonusSection.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import type { MotherModeOffer } from '@/lib/mothermode/types';",
      "import type { MotherModeOffer } from '@/lib/mothermode/types';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }
  s = rep(s,
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
              <MmEditable field="bonusesEyebrow" as="span">{bonuses.eyebrow}</MmEditable>
            </div>
            <MmEditable field="bonusesHeading" as="h2" className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              {bonuses.heading}
            </MmEditable>
            {bonuses.intro && (
              <MmEditable field="bonusesIntro" multiline as="p" className="mt-5 text-xl leading-relaxed text-ink/65">
                {bonuses.intro}
              </MmEditable>
            )}`, 'bonus');
  write(p, s);
}

// SalesPage provider wrap
{
  const p = 'src/components/mothermode/sales/SalesPage.tsx';
  let s = read(p);
  if (!s.includes('SalesPageEditProvider')) {
    s = s.replace(
      `} from './FunnelMediaStudio';`,
      `} from './FunnelMediaStudio';\nimport { SalesPageEditProvider } from './SalesPageEditContext';`,
    );
    s = rep(s,
`  return (
    <div className="relative">
      <MotherModeSalesPage`,
`  return (
    <SalesPageEditProvider edit={edit}>
    <div className="relative">
      <MotherModeSalesPage`, 'sales open');
    s = rep(s,
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

function Field({`, 'sales close');
  }
  write(p, s);
}

// UpsellPage provider wrap
{
  const p = 'src/components/mothermode/sales/UpsellPage.tsx';
  let s = read(p);
  if (!s.includes('SalesPageEditProvider')) {
    s = s.replace(
      `} from './FunnelMediaStudio';`,
      `} from './FunnelMediaStudio';\nimport { SalesPageEditProvider } from './SalesPageEditContext';`,
    );
    s = rep(s,
`  return (
    <div className="relative">
      <MotherModeUpsellPage`,
`  return (
    <SalesPageEditProvider edit={edit}>
    <div className="relative">
      <MotherModeUpsellPage`, 'upsell open');
    s = rep(s,
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

function Field({`, 'upsell close');
  }
  write(p, s);
}

// MotherModeUpsellPage hover fields
{
  const p = 'src/components/mothermode/upsell/MotherModeUpsellPage.tsx';
  let s = read(p);
  if (!s.includes('MmEditable')) {
    s = s.replace(
      "import type { AscensionOffer } from '@/lib/mothermode/ascension';",
      "import type { AscensionOffer } from '@/lib/mothermode/ascension';\nimport { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';",
    );
  }
  s = rep(s,
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
`        <MmEditable field="eyebrow" as="p" className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass">
          {offer.eyebrow}
        </MmEditable>
        <h1 className="mt-5 text-center font-display text-4xl leading-[1.05] text-ink sm:text-5xl md:text-6xl">
          <MmEditable field="headline" as="span">{offer.headline}</MmEditable>{' '}
          <MmEditable field="headlineEmphasis" as="span" className="italic text-mode">{offer.headlineEmphasis}</MmEditable>
        </h1>
        {offer.headlineSuffix && (
          <MmEditable field="headlineSuffix" as="p" className="mt-4 text-center font-display text-xl text-ink/70 sm:text-2xl">
            {offer.headlineSuffix}
          </MmEditable>
        )}
        <MmEditable field="subheadline" multiline as="p" className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-ink/70">
          {offer.subheadline}
        </MmEditable>`, 'upsell hook');

  s = rep(s,
`        <div className="mx-auto mt-16 max-w-2xl space-y-5 text-lg leading-relaxed text-ink/80">
          {offer.letter.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>`,
`        <MmEditable field="letter" multiline as="div" className="mx-auto mt-16 max-w-2xl space-y-5 text-lg leading-relaxed text-ink/80" value={(offer.letter || []).join('\\n')}>
          {offer.letter.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </MmEditable>`, 'letter');

  s = rep(s,
`          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass">
            {offer.stackEyebrow}
          </p>
          <h2 className="mt-3 text-center font-display text-3xl text-ink sm:text-4xl">
            {offer.stackHeading}
          </h2>`,
`          <MmEditable field="stackEyebrow" as="p" className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-brass">
            {offer.stackEyebrow}
          </MmEditable>
          <MmEditable field="stackHeading" as="h2" className="mt-3 text-center font-display text-3xl text-ink sm:text-4xl">
            {offer.stackHeading}
          </MmEditable>`, 'stack');

  write(p, s);
}

console.log('all done');
