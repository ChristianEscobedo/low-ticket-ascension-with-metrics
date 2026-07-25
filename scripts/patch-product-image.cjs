const fs = require('fs');
const p = 'src/lib/mothermode/sales/defaults.ts';
let t = fs.readFileSync(p, 'utf8');
if (t.includes('productImageUrl')) {
  console.log('already has productImageUrl');
  process.exit(0);
}
const needle = "productId: 'mm_brain_dump_system',";
const idx = t.indexOf(needle);
if (idx < 0) {
  console.error('needle not found');
  process.exit(1);
}
t = t.slice(0, idx + needle.length) + "\n    productImageUrl: ''," + t.slice(idx + needle.length);
fs.writeFileSync(p, t);
console.log('patched defaults.ts');
