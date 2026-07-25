const fs = require('fs');
const s = fs.readFileSync('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', 'utf8');

// Field helper
const i = s.indexOf('function Field');
console.log('--- Field helper ---');
console.log(s.slice(i, i + 600));

// Check join args are real newlines not literal backslash-n
const m = s.match(/originParagraphs \|\| \[\]\)\.join\(([^)]+)\)/);
console.log('\norigin join arg raw:', m && m[1]);
console.log('contains real newline escape in join:', m && m[1].includes("'\\n\\n'"));

// Count founder fields
const founders = [
  'founderEyebrow',
  'founderHeading',
  'founderGreeting',
  'founderParagraphs',
  'founderSignoff',
  'founderPs',
  'founderPhotoUrl',
];
for (const f of founders) {
  console.log(f, s.includes(`setSalesField('${f}'`));
}

// placeholder support
console.log('\nField uses placeholder prop:', /placeholder/.test(s.slice(i, i + 800)));
