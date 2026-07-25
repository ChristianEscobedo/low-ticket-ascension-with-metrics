const fs = require('fs');

const files = [
  'src/components/mothermode/parts/HeroSection.tsx',
  'src/components/mothermode/parts/ProofSection.tsx',
  'src/components/mothermode/parts/ClosingSections.tsx',
  'src/components/mothermode/parts/NarrativeSections.tsx',
  'src/components/mothermode/parts/BonusSection.tsx',
];

for (const p of files) {
  let s = fs.readFileSync(p, 'utf8');
  if (!s.startsWith("'use client'") && !s.startsWith('"use client"')) {
    s = "'use client';\n\n" + s;
    fs.writeFileSync(p, s);
    console.log('added use client', p);
  } else {
    console.log('already client', p);
  }
}

const checks = [
  'src/components/mothermode/sales/SalesPage.tsx',
  'src/components/mothermode/sales/UpsellPage.tsx',
  'src/components/mothermode/parts/HeroSection.tsx',
  'src/components/mothermode/parts/ProofSection.tsx',
  'src/components/mothermode/parts/ClosingSections.tsx',
  'src/components/mothermode/parts/NarrativeSections.tsx',
  'src/components/mothermode/parts/BonusSection.tsx',
  'src/components/mothermode/upsell/MotherModeUpsellPage.tsx',
];

for (const p of checks) {
  const s = fs.readFileSync(p, 'utf8');
  console.log(
    p.split('/').pop(),
    'Provider=' + s.includes('SalesPageEditProvider'),
    'Mm=' + ((s.match(/MmEditable/g) || []).length),
    'client=' + (s.startsWith("'use client'") || s.startsWith('"use client"')),
  );
}
