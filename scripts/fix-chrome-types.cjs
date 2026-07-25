const fs = require('fs');

function nl(s) {
  return s.includes('\r\n') ? '\r\n' : '\n';
}

// ---- types.ts ----
{
  const path = 'src/lib/mothermode/sales/types.ts';
  let t = fs.readFileSync(path, 'utf8');
  const N = nl(t);

  if (!t.includes('soldSeparatelyLabel: string')) {
    const chrome = [
      '  // Pricing chrome labels (editable on-page)',
      '  soldSeparatelyLabel: string;',
      '  todayLabel: string;',
      '  pricingStackTotalLabel: string;',
      '  savingsLabel: string;',
      '  foundingPriceLabel: string;',
      '  timerNote: string;',
      '  resourcesInstantLabel: string;',
      '  secureCheckoutLabel: string;',
      '  guaranteeNote: string;',
      '  proofEyebrow: string;',
      '  brandLine: string;',
      '  conversionLine: string;',
      '  generationalLine: string;',
      '  categoryLine: string;',
      '  founderName: string;',
      '  founderRole: string;',
      '',
      '  // Bumps',
    ].join(N);

    const ifaceMarker =
      '  finalCtaBody: string;' + N + N + '  // Bumps' + N + '  bumps: {';
    const ifaceInsert =
      '  finalCtaBody: string;' + N + N + chrome + N + '  bumps: {';
    if (!t.includes(ifaceMarker)) throw new Error('iface marker miss');
    t = t.replace(ifaceMarker, ifaceInsert);
    console.log('types iface ok');
  } else {
    console.log('types iface already');
  }

  if (!t.includes("soldSeparatelyLabel: 'Sold separately'")) {
    const blankMarker = "    founderPs: ''," + N + N + "    faqHeading: '',";
    const blankInsert = [
      "    founderPs: '',",
      '',
      "    soldSeparatelyLabel: 'Sold separately',",
      "    todayLabel: 'Today',",
      "    pricingStackTotalLabel: '',",
      "    savingsLabel: 'You save {amount} today',",
      "    foundingPriceLabel: 'Founding price',",
      "    timerNote: 'Founding price holds while the timer runs.',",
      "    resourcesInstantLabel: '{count} resources. Yours instantly.',",
      "    secureCheckoutLabel: 'Secure checkout. Instant digital delivery.',",
      "    guaranteeNote: '14 days, no friction.',",
      "    proofEyebrow: 'In her words',",
      "    brandLine: 'Motherhood, Redesigned.',",
      "    conversionLine: 'Reclaim more.',",
      "    generationalLine: 'So our daughters will not have to.',",
      "    categoryLine: 'The OS for modern motherhood.',",
      "    founderName: 'Loni Brown',",
      "    founderRole: 'Founder of MotherMode',",
      '',
      "    faqHeading: '',",
    ].join(N);
    if (!t.includes(blankMarker)) throw new Error('blank marker miss');
    t = t.replace(blankMarker, blankInsert);
    console.log('types blank ok');
  } else {
    console.log('types blank already');
  }

  if (!t.includes("soldSeparatelyLabel: str('soldSeparatelyLabel'")) {
    const normMarker =
      "    finalCtaBody: str('finalCtaBody')," + N + N + '    bumps:';
    const normInsert = [
      "    finalCtaBody: str('finalCtaBody'),",
      '',
      "    soldSeparatelyLabel: str('soldSeparatelyLabel', 'Sold separately'),",
      "    todayLabel: str('todayLabel', 'Today'),",
      "    pricingStackTotalLabel: str('pricingStackTotalLabel'),",
      "    savingsLabel: str('savingsLabel', 'You save {amount} today'),",
      "    foundingPriceLabel: str('foundingPriceLabel', 'Founding price'),",
      "    timerNote: str('timerNote', 'Founding price holds while the timer runs.'),",
      '    resourcesInstantLabel: str(',
      "      'resourcesInstantLabel',",
      "      '{count} resources. Yours instantly.',",
      '    ),',
      '    secureCheckoutLabel: str(',
      "      'secureCheckoutLabel',",
      "      'Secure checkout. Instant digital delivery.',",
      '    ),',
      "    guaranteeNote: str('guaranteeNote', '14 days, no friction.'),",
      "    proofEyebrow: str('proofEyebrow', 'In her words'),",
      "    brandLine: str('brandLine', 'Motherhood, Redesigned.'),",
      "    conversionLine: str('conversionLine', 'Reclaim more.'),",
      '    generationalLine: str(',
      "      'generationalLine',",
      "      'So our daughters will not have to.',",
      '    ),',
      "    categoryLine: str('categoryLine', 'The OS for modern motherhood.'),",
      "    founderName: str('founderName', 'Loni Brown'),",
      "    founderRole: str('founderRole', 'Founder of MotherMode'),",
      '',
      '    bumps:',
    ].join(N);
    if (!t.includes(normMarker)) throw new Error('norm marker miss');
    t = t.replace(normMarker, normInsert);
    console.log('types norm ok');
  } else {
    console.log('types norm already');
  }

  fs.writeFileSync(path, t);
  console.log('types done', t.includes('soldSeparatelyLabel'));
}

// ---- inlineEdit.tsx ----
{
  const path = 'src/components/mothermode/sales/inlineEdit.tsx';
  let t = fs.readFileSync(path, 'utf8');
  const N = nl(t);

  if (!t.includes("field === 'priceLabel'")) {
    const a =
      '    } else {' +
      N +
      '      edit.setField(field, value);' +
      N +
      '    }' +
      N +
      '    edit.setInlineEdit(null);' +
      N +
      '  };';
    const b = [
      "    } else if (field === 'priceLabel' || field === 'originalPriceLabel') {",
      '      edit.setField(field, value);',
      "      const dollars = Number(String(value).replace(/[^0-9.]/g, ''));",
      '      if (Number.isFinite(dollars)) {',
      '        edit.setField(',
      "          field === 'priceLabel' ? 'priceCents' : 'originalPriceCents',",
      '          Math.round(dollars * 100),',
      '        );',
      '      }',
      '    } else {',
      '      edit.setField(field, value);',
      '    }',
      '    edit.setInlineEdit(null);',
      '  };',
    ].join(N);
    if (!t.includes(a)) {
      const i = t.indexOf('edit.setInlineEdit(null)');
      throw new Error(
        'inline marker miss: ' + JSON.stringify(t.slice(i - 80, i + 40)),
      );
    }
    t = t.replace(a, b);
    console.log('inline price sync ok');
  } else {
    console.log('inline price sync already');
  }

  if (!t.includes("'originalPriceCents'")) {
    const m1 = "'priceCents'," + N + "  'trialDays',";
    const r1 =
      "'priceCents'," + N + "  'originalPriceCents'," + N + "  'trialDays',";
    if (t.includes(m1)) {
      t = t.replace(m1, r1);
      console.log('inline num fields ok');
    } else {
      console.log('inline num fields marker miss');
    }
  }

  fs.writeFileSync(path, t);
  console.log('inline done', t.includes("field === 'priceLabel'"));
}

console.log('ALL FIXED');
