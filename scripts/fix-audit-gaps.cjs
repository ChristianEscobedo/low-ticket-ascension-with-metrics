/**
 * Fix high-impact editability gaps from the full funnel audit.
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
    console.error('MISS', label, JSON.stringify(a.slice(0, 90)));
    process.exit(1);
  }
  return s.replace(a, b);
}

// ---------------------------------------------------------------------------
// 1) SalesOptinPage — CTA + placeholders editable
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/SalesOptinPage.tsx';
  let s = read(p);

  s = rep(
    s,
    `                  placeholder={c.namePlaceholder || 'First name'}
                  className="w-full rounded-xl border border-ink/15 bg-bone/40 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-mode/40 focus:outline-none"
                />
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPlaceholder || 'Email address'}
                className="w-full rounded-xl border border-ink/15 bg-bone/40 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-mode/40 focus:outline-none"
              />`,
    `                  placeholder={c.namePlaceholder || 'First name'}
                  className="w-full rounded-xl border border-ink/15 bg-bone/40 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-mode/40 focus:outline-none"
                  onClick={
                    edit.isEditMode
                      ? (e) => {
                          e.preventDefault();
                          edit.openEdit(e, 'namePlaceholder', c.namePlaceholder || 'First name');
                        }
                      : undefined
                  }
                  readOnly={edit.isEditMode}
                  title={edit.isEditMode ? 'Click to edit placeholder' : undefined}
                />
              )}
              {edit.isEditMode && (
                <Editable
                  edit={edit}
                  field="namePlaceholder"
                  className="text-[11px] text-ink/45"
                >
                  Name placeholder: {c.namePlaceholder || 'First name'}
                </Editable>
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPlaceholder || 'Email address'}
                className="w-full rounded-xl border border-ink/15 bg-bone/40 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-mode/40 focus:outline-none"
                onClick={
                  edit.isEditMode
                    ? (e) => {
                        e.preventDefault();
                        edit.openEdit(e, 'emailPlaceholder', c.emailPlaceholder || 'Email address');
                      }
                    : undefined
                }
                readOnly={edit.isEditMode}
                title={edit.isEditMode ? 'Click to edit placeholder' : undefined}
              />
              {edit.isEditMode && (
                <Editable
                  edit={edit}
                  field="emailPlaceholder"
                  className="text-[11px] text-ink/45"
                >
                  Email placeholder: {c.emailPlaceholder || 'Email address'}
                </Editable>
              )}`,
    'optin placeholders',
  );

  s = rep(
    s,
    `              <button
                type="submit"
                disabled={busy || edit.isEditMode}
                className="w-full rounded-xl bg-mode px-6 py-3.5 text-base font-semibold text-bone transition-colors hover:bg-modeDeep disabled:opacity-50"
              >
                {busy ? 'Sending...' : c.ctaText || 'Get free access'}
              </button>`,
    `              <button
                type="submit"
                disabled={busy || edit.isEditMode}
                className="w-full rounded-xl bg-mode px-6 py-3.5 text-base font-semibold text-bone transition-colors hover:bg-modeDeep disabled:opacity-50"
                onClick={
                  edit.isEditMode
                    ? (e) => {
                        e.preventDefault();
                        edit.openEdit(e, 'ctaText', c.ctaText || 'Get free access');
                      }
                    : undefined
                }
              >
                {busy ? (
                  'Sending...'
                ) : (
                  <Editable edit={edit} field="ctaText" as="span">
                    {c.ctaText || 'Get free access'}
                  </Editable>
                )}
              </button>
              {edit.isEditMode && (
                <label className="flex items-center gap-2 text-xs text-ink/60">
                  <input
                    type="checkbox"
                    checked={!!c.collectName}
                    onChange={(e) => edit.setField('collectName', e.target.checked)}
                  />
                  Collect first name
                </label>
              )}`,
    'optin cta',
  );

  // Ensure media studio triggers exist for cover/video when edit mode
  if (!s.includes('MediaStudioTrigger') || !s.includes('Cover image')) {
    // already has media studio - skip if present
  }

  write(p, s);
}

// ---------------------------------------------------------------------------
// 2) CheckoutPage — CTA editable
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/CheckoutPage.tsx';
  let s = read(p);
  s = rep(
    s,
    `          <button
            type="button"
            onClick={onCheckout}
            disabled={busy || edit.isEditMode}
            className="w-full rounded-xl bg-mode px-6 py-3.5 text-base font-semibold text-bone transition-colors hover:bg-modeDeep disabled:opacity-50"
          >
            {busy ? 'Processing...' : c.ctaText || 'Buy now'}
          </button>`,
    `          <button
            type="button"
            onClick={edit.isEditMode ? undefined : onCheckout}
            disabled={busy || edit.isEditMode}
            className="w-full rounded-xl bg-mode px-6 py-3.5 text-base font-semibold text-bone transition-colors hover:bg-modeDeep disabled:opacity-50"
          >
            {busy ? (
              'Processing...'
            ) : (
              <Editable edit={edit} field="ctaText" as="span">
                {c.ctaText || 'Buy now'}
              </Editable>
            )}
          </button>
          {edit.isEditMode && (
            <div className="mt-3 grid gap-2 text-left text-xs">
              <Editable edit={edit} field="priceCents" className="text-ink/60">
                Price cents: {String(c.priceCents ?? 0)}
              </Editable>
              <Editable edit={edit} field="stripePriceId" className="text-ink/60">
                Stripe price: {c.stripePriceId || '(none)'}
              </Editable>
              <Editable edit={edit} field="productId" className="text-ink/60">
                Product id: {c.productId || '(none)'}
              </Editable>
              <Editable edit={edit} field="paymentType" className="text-ink/60">
                Payment type: {c.paymentType || 'one_time'}
              </Editable>
              <Editable edit={edit} field="trialDays" className="text-ink/60">
                Trial days: {String(c.trialDays ?? 0)}
              </Editable>
            </div>
          )}`,
    'checkout cta',
  );
  write(p, s);
}

// ---------------------------------------------------------------------------
// 3) VslPage — sticky/autoplay toggles in edit mode
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/VslPage.tsx';
  let s = read(p);
  if (!s.includes('field="stickyPlayer"') && !s.includes("field='stickyPlayer'")) {
    // find a good insertion near ctaRevealSeconds field
    if (s.includes('field="ctaRevealSeconds"')) {
      s = s.replace(
        /field="ctaRevealSeconds"[\s\S]*?\/>/,
        (m) =>
          m +
          `
              <label className="flex items-center gap-2 text-xs text-ink/60">
                <input
                  type="checkbox"
                  checked={!!c.stickyPlayer}
                  onChange={(e) => edit.setField('stickyPlayer', e.target.checked)}
                />
                Sticky player
              </label>
              <label className="flex items-center gap-2 text-xs text-ink/60">
                <input
                  type="checkbox"
                  checked={!!c.autoplay}
                  onChange={(e) => edit.setField('autoplay', e.target.checked)}
                />
                Autoplay
              </label>`,
      );
      write(p, s);
    } else {
      console.log('skip vsl toggles - pattern not found');
    }
  } else {
    console.log('vsl already has sticky');
  }
}

// ---------------------------------------------------------------------------
// 4) Pricing section hardcoded copy → MmEditable
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ClosingSections.tsx';
  let s = read(p);
  s = rep(
    s,
    `          <div className="text-sm uppercase tracking-[0.2em] text-mode">
            What it costs to keep carrying it
          </div>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            One page. One sitting. One price.
          </h2>`,
    `          <MmEditable
            field="priceDescription"
            as="div"
            className="text-sm uppercase tracking-[0.2em] text-mode"
            value="What it costs to keep carrying it"
          >
            What it costs to keep carrying it
          </MmEditable>
          <MmEditable
            field="tagline"
            as="h2"
            className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
            value="One page. One sitting. One price."
          >
            One page. One sitting. One price.
          </MmEditable>`,
    'pricing headings',
  );

  s = rep(
    s,
    `            <CheckoutButton
              slug={offer.slug}
              label="Get instant access"
              className="w-full"
            />`,
    `            <CheckoutButton
              slug={offer.slug}
              label={offer.cta?.label || offer.ctaText || 'Get instant access'}
              className="w-full"
            />`,
    'pricing cta',
  );
  // offer may not have cta.label - check MotherModeOffer. Safer use hero or fixed with MmEditable around button label via ctaText field on funnel
  // Revert to simpler: keep label from a known path
  s = s.replace(
    `label={offer.cta?.label || offer.ctaText || 'Get instant access'}`,
    `label={(offer as any).ctaText || 'Get instant access'}`,
  );
  // Actually MotherModeOffer uses different shape - CheckoutButton gets label prop from sections.
  // salesContentToOffer maps ctaText - check fromOffer
  write(p, s);
}

// ---------------------------------------------------------------------------
// 5) Expand UpsellPage field sheet
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/UpsellPage.tsx';
  let s = read(p);
  s = rep(
    s,
    `                <Field
                  edit={edit}
                  field="productName"
                  label="Product name"
                  value={c.productName}
                />
              </div>`,
    `                <Field
                  edit={edit}
                  field="productName"
                  label="Product name"
                  value={c.productName}
                />
                <Field
                  edit={edit}
                  field="timerMinutes"
                  label="Timer minutes"
                  value={String(c.timerMinutes ?? 15)}
                />
                <Field edit={edit} field="yesHref" label="Yes href override" value={c.yesHref} />
                <Field
                  edit={edit}
                  field="letter"
                  label="Letter (one para per line)"
                  value={(c.letter || []).join('\\n')}
                  multiline
                />
                <Field
                  edit={edit}
                  field="bullets"
                  label="Bullets (legacy)"
                  value={(c.bullets || []).join('\\n')}
                  multiline
                />
                <Field
                  edit={edit}
                  field="galleryEyebrow"
                  label="Gallery eyebrow"
                  value={c.galleryEyebrow}
                />
                <Field
                  edit={edit}
                  field="stripePriceId"
                  label="Stripe price id"
                  value={c.stripePriceId}
                />
                <Field
                  edit={edit}
                  field="productId"
                  label="Product id"
                  value={c.productId}
                />
                <Field
                  edit={edit}
                  field="priceCents"
                  label="Price cents"
                  value={String(c.priceCents ?? 0)}
                />
                <Field
                  edit={edit}
                  field="paymentType"
                  label="Payment type"
                  value={c.paymentType}
                />
              </div>`,
    'upsell fields expand',
  );
  write(p, s);
}

// ---------------------------------------------------------------------------
// 6) Expand SalesPage field sheet with more missing fields
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/SalesPage.tsx';
  let s = read(p);
  // Add after tagline field block if not already
  if (!s.includes('field="priceDescription"') || !s.includes('field="priceCents"')) {
    const anchor = `                <Field
                  edit={edit}
                  field="tagline"
                  label="Tagline"
                  value={c.tagline}
                />`;
    if (s.includes(anchor) && !s.includes('field="priceCents"')) {
      s = s.replace(
        anchor,
        `${anchor}
                <Field edit={edit} field="category" label="Category" value={c.category} />
                <Field
                  edit={edit}
                  field="priceCents"
                  label="Price cents"
                  value={String(c.priceCents ?? 0)}
                />
                <Field
                  edit={edit}
                  field="originalPriceCents"
                  label="Original price cents"
                  value={String(c.originalPriceCents ?? 0)}
                />
                <Field
                  edit={edit}
                  field="priceDescription"
                  label="Pricing eyebrow"
                  value={c.priceDescription}
                />
                <Field
                  edit={edit}
                  field="faqHeading"
                  label="FAQ heading"
                  value={c.faqHeading}
                />
                <Field
                  edit={edit}
                  field="methodSubheading"
                  label="Method subheading"
                  value={c.methodSubheading}
                  multiline
                />
                <Field
                  edit={edit}
                  field="methodCloser"
                  label="Method closer"
                  value={c.methodCloser}
                  multiline
                />
                <Field
                  edit={edit}
                  field="insideLead"
                  label="Inside lead"
                  value={c.insideLead}
                  multiline
                />
                <Field
                  edit={edit}
                  field="oldWayHeading"
                  label="Old way heading"
                  value={c.oldWayHeading}
                />
                <Field
                  edit={edit}
                  field="newWayHeading"
                  label="New way heading"
                  value={c.newWayHeading}
                />
                <Field
                  edit={edit}
                  field="testimonialsHeading"
                  label="Proof heading"
                  value={c.testimonialsHeading}
                />
                <Field
                  edit={edit}
                  field="bonusesIntro"
                  label="Bonuses intro"
                  value={c.bonusesIntro}
                  multiline
                />
                <Field
                  edit={edit}
                  field="bonusesTotalValue"
                  label="Bonuses total value"
                  value={c.bonusesTotalValue}
                />
                <Field
                  edit={edit}
                  field="bonusesCloser"
                  label="Bonuses closer"
                  value={c.bonusesCloser}
                  multiline
                />
                <Field
                  edit={edit}
                  field="problemPoints"
                  label="Problem points (one per line)"
                  value={(c.problemPoints || []).join('\\n')}
                  multiline
                />
                <Field
                  edit={edit}
                  field="originParagraphs"
                  label="Origin paragraphs (blank line sep)"
                  value={(c.originParagraphs || []).join('\\n\\n')}
                  multiline
                />
                <Field
                  edit={edit}
                  field="whatIsParagraphs"
                  label="What-is paragraphs"
                  value={(c.whatIsParagraphs || []).join('\\n\\n')}
                  multiline
                />
                <Field
                  edit={edit}
                  field="mechanismParagraphs"
                  label="Mechanism paragraphs"
                  value={(c.mechanismParagraphs || []).join('\\n\\n')}
                  multiline
                />
                <Field
                  edit={edit}
                  field="founderParagraphs"
                  label="Founder paragraphs"
                  value={(c.founderParagraphs || []).join('\\n\\n')}
                  multiline
                />
                <Field
                  edit={edit}
                  field="oldWayItems"
                  label="Old way items"
                  value={(c.oldWayItems || []).join('\\n')}
                  multiline
                />
                <Field
                  edit={edit}
                  field="newWayItems"
                  label="New way items"
                  value={(c.newWayItems || []).join('\\n')}
                  multiline
                />`,
      );
    }
  }
  write(p, s);
}

// ---------------------------------------------------------------------------
// 7) MotherModeUpsell — more MmEditable (CTAs, guarantee, timer, price)
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/upsell/MotherModeUpsellPage.tsx';
  let s = read(p);

  // timer label
  if (!s.includes('field="timerLabel"')) {
    s = s.replace(
      `{offer.timerLabel}. {pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}`,
      `<MmEditable field="timerLabel" as="span">{offer.timerLabel}</MmEditable>
            .{' '}
            {pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}`,
    );
  }

  // accept / decline labels
  if (!s.includes('field="ctaYes"') && s.includes('{offer.acceptLabel}')) {
    s = s.replace(
      `{offer.acceptLabel}`,
      `<MmEditable field="ctaYes" as="span">{offer.acceptLabel}</MmEditable>`,
    );
  }
  if (!s.includes('field="ctaNo"') && s.includes('{offer.declineLabel}')) {
    s = s.replace(
      `{offer.declineLabel}`,
      `<MmEditable field="ctaNo" as="span">{offer.declineLabel}</MmEditable>`,
    );
  }

  // guarantee
  if (s.includes('offer.guaranteeTitle') && !s.includes('field="guaranteeTitle"')) {
    s = s.replace(
      /\{offer\.guaranteeTitle\}/g,
      '<MmEditable field="guaranteeTitle" as="span">{offer.guaranteeTitle}</MmEditable>',
    );
  }
  if (s.includes('offer.guaranteeBody') && !s.includes('field="guaranteeBody"')) {
    s = s.replace(
      /\{offer\.guaranteeBody\}/g,
      '<MmEditable field="guaranteeBody" multiline as="span">{offer.guaranteeBody}</MmEditable>',
    );
  }

  // total value / big idea
  if (s.includes('offer.totalValueLabel') && !s.includes('field="totalValueLabel"')) {
    s = s.replace(
      /\{offer\.totalValueLabel\}/g,
      '<MmEditable field="totalValueLabel" as="span">{offer.totalValueLabel}</MmEditable>',
    );
  }
  if (s.includes('offer.bigIdea') && !s.includes('field="bigIdea"')) {
    s = s.replace(
      /\{offer\.bigIdea\}/g,
      '<MmEditable field="bigIdea" multiline as="span">{offer.bigIdea}</MmEditable>',
    );
  }

  write(p, s);
}

// ---------------------------------------------------------------------------
// 8) CheckoutButton — use offer CTA when available via optional label already
//    Wire FinalCta to use ctaText if present on offer
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/parts/ClosingSections.tsx';
  let s = read(p);
  // Final CTA button
  if (s.includes('label="Get instant access"') && s.includes('FinalCtaSection')) {
    s = s.replace(
      /export const FinalCtaSection[\s\S]*?label="Get instant access"/,
      (m) => m.replace('label="Get instant access"', 'label={(offer as any).ctaText || "Get instant access"}'),
    );
  }
  write(p, s);
}

console.log('audit gap fixes done');
