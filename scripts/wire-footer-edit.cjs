const fs = require('fs');

// 1) MotherModeSalesPage: optional hideFooter
{
  const f = 'src/components/mothermode/MotherModeSalesPage.tsx';
  let t = fs.readFileSync(f, 'utf8');
  const before = t;
  t = t.replace(
    `export const MotherModeSalesPage: React.FC<{
  offer: MotherModeOffer;
  checkoutHref?: string;
}> = ({ offer, checkoutHref }) => (`,
    `export const MotherModeSalesPage: React.FC<{
  offer: MotherModeOffer;
  checkoutHref?: string;
  /** When true, omit the slim catalog SalesFooter (funnel pages render OptinFooter). */
  hideFooter?: boolean;
}> = ({ offer, checkoutHref, hideFooter = false }) => (`
  );
  t = t.replace(
    `      <FinalCtaSection offer={offer} />
      <SalesFooter offer={offer} />
    </div>`,
    `      <FinalCtaSection offer={offer} />
      {!hideFooter && <SalesFooter offer={offer} />}
    </div>`
  );
  if (t === before) {
    console.log('WARN MotherModeSalesPage no change');
  } else {
    fs.writeFileSync(f, t);
    console.log('patched MotherModeSalesPage');
  }
}

// 2) SalesPage: hideFooter + OptinFooter
{
  const f = 'src/components/mothermode/sales/SalesPage.tsx';
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes("from '@/components/mothermode/optin/OptinFooter'")) {
    t = t.replace(
      `import { SalesPageEditProvider } from './SalesPageEditContext';`,
      `import { SalesPageEditProvider } from './SalesPageEditContext';\nimport { OptinFooter } from '@/components/mothermode/optin/OptinFooter';`
    );
  }
  if (!t.includes('hideFooter')) {
    t = t.replace(
      `      <MotherModeSalesPage
        offer={offer}
        checkoutHref={\`/funnel/\${funnel.slug}/checkout\`}
      />`,
      `      <MotherModeSalesPage
        offer={offer}
        checkoutHref={\`/funnel/\${funnel.slug}/checkout\`}
        hideFooter
      />
      <OptinFooter footer={edit.draft.footer as any} edit={edit as any} />`
    );
  }
  fs.writeFileSync(f, t);
  console.log('patched SalesPage', t.includes('<OptinFooter'), t.includes('hideFooter'));
}

// 3) CheckoutPage
{
  const f = 'src/components/mothermode/sales/CheckoutPage.tsx';
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes("from '@/components/mothermode/optin/OptinFooter'")) {
    t = t.replace(
      `import { SalesPageEditProvider } from './SalesPageEditContext';`,
      `import { SalesPageEditProvider } from './SalesPageEditContext';\nimport { OptinFooter } from '@/components/mothermode/optin/OptinFooter';`
    );
  }
  if (!t.includes('<OptinFooter')) {
    const re = /(<MotherModeCheckout[\s\S]*?\/>)/;
    if (re.test(t)) {
      t = t.replace(
        re,
        `$1\n        <OptinFooter footer={edit.draft.footer as any} edit={edit as any} />`
      );
    } else {
      console.log('WARN: could not find MotherModeCheckout self-close in CheckoutPage');
    }
  }
  fs.writeFileSync(f, t);
  console.log('patched CheckoutPage', t.includes('<OptinFooter'));
}

// 4) UpsellPage
{
  const f = 'src/components/mothermode/sales/UpsellPage.tsx';
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes("from '@/components/mothermode/optin/OptinFooter'")) {
    t = t.replace(
      `import { SalesPageEditProvider } from './SalesPageEditContext';`,
      `import { SalesPageEditProvider } from './SalesPageEditContext';\nimport { OptinFooter } from '@/components/mothermode/optin/OptinFooter';`
    );
  }
  if (!t.includes('<OptinFooter')) {
    const re = /(<MotherModeUpsellPage[\s\S]*?\/>)/;
    if (re.test(t)) {
      t = t.replace(
        re,
        `$1\n      <OptinFooter footer={edit.draft.footer as any} edit={edit as any} />`
      );
    } else {
      const re2 = /(<MotherModeUpsellPage[\s\S]*?<\/MotherModeUpsellPage>)/;
      if (re2.test(t)) {
        t = t.replace(
          re2,
          `$1\n      <OptinFooter footer={edit.draft.footer as any} edit={edit as any} />`
        );
      } else {
        console.log('WARN: could not find MotherModeUpsellPage in UpsellPage');
      }
    }
  }
  fs.writeFileSync(f, t);
  console.log('patched UpsellPage', t.includes('<OptinFooter'));
}

// Verify
const files = [
  'src/components/mothermode/sales/AccessPage.tsx',
  'src/components/mothermode/sales/SalesOptinPage.tsx',
  'src/components/mothermode/sales/SuccessPage.tsx',
  'src/components/mothermode/sales/VslPage.tsx',
  'src/components/mothermode/sales/SalesPage.tsx',
  'src/components/mothermode/sales/CheckoutPage.tsx',
  'src/components/mothermode/sales/UpsellPage.tsx',
  'src/components/mothermode/optin/OptinPage.tsx',
  'src/components/mothermode/optin/OptinOtoPage.tsx',
  'src/components/mothermode/optin/OptinThankYouPage.tsx',
  'src/components/mothermode/MotherModeSalesPage.tsx',
];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const hits = [...t.matchAll(/OptinFooter[^\n]*|hideFooter[^\n]*/g)].map((m) => m[0]);
  console.log('---', f);
  console.log(hits.join('\n') || '(none)');
}
