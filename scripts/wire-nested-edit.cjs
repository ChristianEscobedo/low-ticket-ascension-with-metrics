/**
 * Wire MmEditable path fields onto nested list items in MotherMode sections.
 */
const fs = require('fs');

function write(p, s) {
  fs.writeFileSync(p, s);
  console.log('ok', p);
}

// ---------------------------------------------------------------------------
// NarrativeSections — method steps + mechanism points + old/new heading
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/NarrativeSections.tsx';
  let s = fs.readFileSync(p, 'utf8');

  // Hardcoded OldVsNew heading
  s = s.replace(
    `<Heading>There is the way it has been. And there is this.</Heading>`,
    `<MmEditable field="oldWayHeading" as="h2" className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl" value="There is the way it has been. And there is this.">
      There is the way it has been. And there is this.
    </MmEditable>`,
  );

  // Mechanism points
  s = s.replace(
    `{m.points.map((pt) => (
            <div
              key={pt.title}
              className="rounded-xl border border-mode/15 bg-bone/70 p-5"
            >
              <div className="font-display text-lg text-mode">{pt.title}</div>
              <p className="mt-1.5 text-base leading-relaxed text-ink/70">
                {pt.description}
              </p>
            </div>
          ))}`,
    `{m.points.map((pt, pi) => (
            <div
              key={pt.title + pi}
              className="rounded-xl border border-mode/15 bg-bone/70 p-5"
            >
              <MmEditable field={\`mechanismPoints.\${pi}.title\`} as="div" className="font-display text-lg text-mode">
                {pt.title}
              </MmEditable>
              <MmEditable field={\`mechanismPoints.\${pi}.description\`} multiline as="p" className="mt-1.5 text-base leading-relaxed text-ink/70">
                {pt.description}
              </MmEditable>
            </div>
          ))}`,
  );

  // Method steps
  s = s.replace(
    `<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="font-display text-2xl text-ink">{step.title}</h3>
                  {step.meta && (
                    <span className="inline-flex items-center rounded-full border border-brass/30 bg-brass/[0.07] px-3 py-0.5 text-sm font-medium text-brass">
                      {step.meta}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 text-lg leading-relaxed text-ink/65">
                  {step.description}
                </p>
                {step.shift && (
                  <p className="mt-3 border-l-2 border-mode/40 pl-4 text-lg italic leading-relaxed text-mode">
                    {step.shift}
                  </p>
                )}`,
    `<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <MmEditable field={\`methodSteps.\${i}.title\`} as="h3" className="font-display text-2xl text-ink">
                    {step.title}
                  </MmEditable>
                  {step.meta && (
                    <MmEditable field={\`methodSteps.\${i}.meta\`} as="span" className="inline-flex items-center rounded-full border border-brass/30 bg-brass/[0.07] px-3 py-0.5 text-sm font-medium text-brass">
                      {step.meta}
                    </MmEditable>
                  )}
                </div>
                <MmEditable field={\`methodSteps.\${i}.description\`} multiline as="p" className="mt-2.5 text-lg leading-relaxed text-ink/65">
                  {step.description}
                </MmEditable>
                {step.shift && (
                  <MmEditable field={\`methodSteps.\${i}.shift\`} multiline as="p" className="mt-3 border-l-2 border-mode/40 pl-4 text-lg italic leading-relaxed text-mode">
                    {step.shift}
                  </MmEditable>
                )}`,
  );

  write(p, s);
}

// ---------------------------------------------------------------------------
// InsideSection — each resource card
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/InsideSection.tsx';
  let s = fs.readFileSync(p, 'utf8');

  s = s.replace(
    `<div className="text-sm uppercase tracking-[0.2em] text-mode">
              Everything in the pack
            </div>`,
    `<MmEditable field="insideHeading" as="div" className="text-sm uppercase tracking-[0.2em] text-mode" value="Everything in the pack">
              Everything in the pack
            </MmEditable>`,
  );
  // Wait - insideHeading is already used for the h2. Use a dedicated eyebrow or keep hardcoded with a new field.
  // Better: use featuresHeading as eyebrow or just leave a static label and edit the real heading.
  // Revert eyebrow to static - the h2 is already editable as insideHeading.
  s = s.replace(
    `<MmEditable field="insideHeading" as="div" className="text-sm uppercase tracking-[0.2em] text-mode" value="Everything in the pack">
              Everything in the pack
            </MmEditable>`,
    `<div className="text-sm uppercase tracking-[0.2em] text-mode">
              Everything in the pack
            </div>`,
  );

  // Lead item (index 0)
  s = s.replace(
    `{lead.tag && (
                <div className="text-xs uppercase tracking-[0.18em] text-brass">
                  {lead.tag}
                </div>
              )}
              <h3 className="mt-1.5 font-display text-3xl text-ink">{lead.title}</h3>
              <p className="mt-3 text-xl leading-relaxed text-ink/70">
                {lead.description}
              </p>
              {lead.outcome && (
                <p className="mt-4 flex items-start gap-2.5 text-lg leading-relaxed text-mode">
                  <Check className="mt-1.5 h-4 w-4 flex-shrink-0" />
                  <span>{lead.outcome}</span>
                </p>
              )}
              <div className="mt-6">
                <ValueTag value={lead.value} />
              </div>`,
    `{lead.tag && (
                <MmEditable field="insideItems.0.tag" as="div" className="text-xs uppercase tracking-[0.18em] text-brass">
                  {lead.tag}
                </MmEditable>
              )}
              <MmEditable field="insideItems.0.title" as="h3" className="mt-1.5 font-display text-3xl text-ink">
                {lead.title}
              </MmEditable>
              <MmEditable field="insideItems.0.description" multiline as="p" className="mt-3 text-xl leading-relaxed text-ink/70">
                {lead.description}
              </MmEditable>
              {lead.outcome && (
                <p className="mt-4 flex items-start gap-2.5 text-lg leading-relaxed text-mode">
                  <Check className="mt-1.5 h-4 w-4 flex-shrink-0" />
                  <MmEditable field="insideItems.0.outcome" multiline as="span">
                    {lead.outcome}
                  </MmEditable>
                </p>
              )}
              <div className="mt-6">
                <MmEditable field="insideItems.0.value" as="span">
                  <ValueTag value={lead.value} />
                </MmEditable>
              </div>`,
  );

  // Rest items — rest is items.slice(1), so real index is i+1
  s = s.replace(
    `{item.tag && (
                  <div className="relative mt-6 text-xs uppercase tracking-[0.18em] text-brass">
                    {item.tag}
                  </div>
                )}
                <h3 className="relative mt-1.5 font-display text-2xl text-ink">
                  {item.title}
                </h3>
                <p className="relative mt-2.5 text-lg leading-relaxed text-ink/65">
                  {item.description}
                </p>
                {item.outcome && (
                  <p className="relative mt-4 flex flex-1 items-start gap-2.5 border-t border-ink/10 pt-4 text-base leading-relaxed text-mode">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0" />
                    <span>{item.outcome}</span>
                  </p>
                )}`,
    `{item.tag && (
                  <MmEditable field={\`insideItems.\${i + 1}.tag\`} as="div" className="relative mt-6 text-xs uppercase tracking-[0.18em] text-brass">
                    {item.tag}
                  </MmEditable>
                )}
                <MmEditable field={\`insideItems.\${i + 1}.title\`} as="h3" className="relative mt-1.5 font-display text-2xl text-ink">
                  {item.title}
                </MmEditable>
                <MmEditable field={\`insideItems.\${i + 1}.description\`} multiline as="p" className="relative mt-2.5 text-lg leading-relaxed text-ink/65">
                  {item.description}
                </MmEditable>
                {item.outcome && (
                  <p className="relative mt-4 flex flex-1 items-start gap-2.5 border-t border-ink/10 pt-4 text-base leading-relaxed text-mode">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0" />
                    <MmEditable field={\`insideItems.\${i + 1}.outcome\`} multiline as="span">
                      {item.outcome}
                    </MmEditable>
                  </p>
                )}
                <div className="relative mt-3">
                  <MmEditable field={\`insideItems.\${i + 1}.value\`} as="span">
                    <ValueTag value={item.value} />
                  </MmEditable>
                </div>`,
  );

  // Remove duplicate ValueTag at top of rest cards if we added bottom one - keep top one too for layout
  // Actually rest cards already have ValueTag at top - the bottom one is extra. Remove bottom value edit and wire top instead.
  s = s.replace(
    `<div className="relative flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-mode/20 bg-bone">
                    <Icon className="h-5 w-5 text-mode" />
                  </span>
                  <ValueTag value={item.value} />
                </div>`,
    `<div className="relative flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-mode/20 bg-bone">
                    <Icon className="h-5 w-5 text-mode" />
                  </span>
                  <MmEditable field={\`insideItems.\${i + 1}.value\`} as="span">
                    <ValueTag value={item.value} />
                  </MmEditable>
                </div>`,
  );
  // Remove the extra bottom value we added
  s = s.replace(
    `{item.outcome && (
                  <p className="relative mt-4 flex flex-1 items-start gap-2.5 border-t border-ink/10 pt-4 text-base leading-relaxed text-mode">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0" />
                    <MmEditable field={\`insideItems.\${i + 1}.outcome\`} multiline as="span">
                      {item.outcome}
                    </MmEditable>
                  </p>
                )}
                <div className="relative mt-3">
                  <MmEditable field={\`insideItems.\${i + 1}.value\`} as="span">
                    <ValueTag value={item.value} />
                  </MmEditable>
                </div>`,
    `{item.outcome && (
                  <p className="relative mt-4 flex flex-1 items-start gap-2.5 border-t border-ink/10 pt-4 text-base leading-relaxed text-mode">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0" />
                    <MmEditable field={\`insideItems.\${i + 1}.outcome\`} multiline as="span">
                      {item.outcome}
                    </MmEditable>
                  </p>
                )}`,
  );

  write(p, s);
}

// ---------------------------------------------------------------------------
// ProofSection
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ProofSection.tsx';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    `{offer.proof.map((p) => (
            <figure
              key={p.name}
              className="flex flex-col rounded-2xl border border-ink/10 bg-bone p-6"
            >
              <blockquote className="flex-1 text-ink/75">
                <p className="text-lg leading-relaxed">{p.quote}</p>
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-ink/10 pt-4">
                <Avatar name={p.name} src={p.avatar} />
                <div>
                  <div className="font-medium text-ink">{p.name}</div>
                  <div className="text-sm text-ink/45">{p.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}`,
    `{offer.proof.map((p, pi) => (
            <figure
              key={p.name + pi}
              className="flex flex-col rounded-2xl border border-ink/10 bg-bone p-6"
            >
              <blockquote className="flex-1 text-ink/75">
                <MmEditable field={\`proof.\${pi}.quote\`} multiline as="p" className="text-lg leading-relaxed">
                  {p.quote}
                </MmEditable>
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-ink/10 pt-4">
                <Avatar name={p.name} src={p.avatar} />
                <div>
                  <MmEditable field={\`proof.\${pi}.name\`} as="div" className="font-medium text-ink">
                    {p.name}
                  </MmEditable>
                  <MmEditable field={\`proof.\${pi}.role\`} as="div" className="text-sm text-ink/45">
                    {p.role}
                  </MmEditable>
                </div>
              </figcaption>
            </figure>
          ))}`,
  );
  write(p, s);
}

// ---------------------------------------------------------------------------
// ClosingSections — FAQ items + pricing stack rows
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ClosingSections.tsx';
  let s = fs.readFileSync(p, 'utf8');

  // FAQ items
  s = s.replace(
    `{offer.faqs.map((faq) => (
          <details key={faq.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-ink">
              {faq.q}
              <span className="text-mode transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-lg leading-relaxed text-ink/65">{faq.a}</p>
          </details>
        ))}`,
    `{offer.faqs.map((faq, fi) => (
          <details key={faq.q + fi} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-ink">
              <MmEditable field={\`faqs.\${fi}.question\`} as="span">
                {faq.q}
              </MmEditable>
              <span className="text-mode transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <MmEditable field={\`faqs.\${fi}.answer\`} multiline as="p" className="mt-3 text-lg leading-relaxed text-ink/65">
              {faq.a}
            </MmEditable>
          </details>
        ))}`,
  );

  // Pricing stack rows
  s = s.replace(
    `{offer.inside.items.map((item) => (
              <li
                key={item.title}
                className="flex items-baseline justify-between gap-4 text-base"
              >
                <span className="text-ink/70">{item.title}</span>
                <span className="text-ink/45">{item.value ?? ''}</span>
              </li>
            ))}`,
    `{offer.inside.items.map((item, ii) => (
              <li
                key={item.title + ii}
                className="flex items-baseline justify-between gap-4 text-base"
              >
                <MmEditable field={\`insideItems.\${ii}.title\`} as="span" className="text-ink/70">
                  {item.title}
                </MmEditable>
                <MmEditable field={\`insideItems.\${ii}.value\`} as="span" className="text-ink/45">
                  {item.value ?? ''}
                </MmEditable>
              </li>
            ))}`,
  );

  write(p, s);
}

// ---------------------------------------------------------------------------
// HeroSection — inside checklist items
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/HeroSection.tsx';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    `{inside.items.map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mode/10">
                      <Check className="h-3 w-3 text-mode" />
                    </span>
                    <div className="text-lg leading-relaxed">
                      <span className="font-medium text-ink">{item.title}</span>
                      <span className="text-ink/55"> {item.description}</span>
                    </div>
                  </li>
                ))}`,
    `{inside.items.map((item, ii) => (
                  <li key={item.title + ii} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mode/10">
                      <Check className="h-3 w-3 text-mode" />
                    </span>
                    <div className="text-lg leading-relaxed">
                      <MmEditable field={\`insideItems.\${ii}.title\`} as="span" className="font-medium text-ink">
                        {item.title}
                      </MmEditable>
                      {' '}
                      <MmEditable field={\`insideItems.\${ii}.description\`} as="span" className="text-ink/55">
                        {item.description}
                      </MmEditable>
                    </div>
                  </li>
                ))}`,
  );
  write(p, s);
}

// ---------------------------------------------------------------------------
// Sidebar — category, name, CTA already via CheckoutButton
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/Sidebar.tsx';
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('MmEditable')) {
    s = s.replace(
      `import { CheckoutButton } from './CheckoutButton';`,
      `import { CheckoutButton } from './CheckoutButton';
import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';`,
    );
  }
  s = s.replace(
    `<div className="text-xs uppercase tracking-[0.2em] text-mode">{category}</div>
        <div className="mt-1 font-display text-2xl leading-snug text-ink">{name}</div>
        <div className="mt-1 text-sm text-ink/50">{insideCount} resources. Yours instantly.</div>`,
    `<MmEditable field="category" as="div" className="text-xs uppercase tracking-[0.2em] text-mode">
          {category}
        </MmEditable>
        <MmEditable field="name" as="div" className="mt-1 font-display text-2xl leading-snug text-ink">
          {name}
        </MmEditable>
        <div className="mt-1 text-sm text-ink/50">{insideCount} resources. Yours instantly.</div>`,
  );
  write(p, s);
}

// ---------------------------------------------------------------------------
// ContentSidebar if it has proof quote
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ContentSidebar.tsx';
  if (fs.existsSync(p)) {
    let s = fs.readFileSync(p, 'utf8');
    if (!s.includes('MmEditable') && s.includes('firstProof')) {
      if (!s.includes("from '@/components/mothermode/sales/SalesPageEditContext'")) {
        s = s.replace(
          /^import /m,
          `import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';\nimport `,
        );
      }
      // wire first proof quote if plain
      s = s.replace(
        /\{firstProof\.quote\}/g,
        `<MmEditable field="proof.0.quote" multiline as="span">{firstProof.quote}</MmEditable>`,
      );
      s = s.replace(
        /\{firstProof\.name\}/g,
        `<MmEditable field="proof.0.name" as="span">{firstProof.name}</MmEditable>`,
      );
      write(p, s);
    } else {
      console.log('skip ContentSidebar or already wired');
    }
  }
}

console.log('nested edit wiring done');
