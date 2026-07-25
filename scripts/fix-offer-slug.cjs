const fs = require('fs');
const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
let c = fs.readFileSync(p, 'utf8');
const before = (c.match(/setOfferSlug\([^)]*\)/g) || []).join(' | ');
c = c.replace(/setOfferSlug\(''\);/g, "setOfferSlug('brain-dump-system');");
c = c.replace(/setOfferSlug\(""\);/g, "setOfferSlug('brain-dump-system');");
// new funnel defaults
if (c.includes("useState<string | null>(null)") && !c.includes("useState('brain-dump-system')")) {
  c = c.replace(
    /const \[offerSlug, setOfferSlug\] = useState\([^)]*\);/,
    "const [offerSlug, setOfferSlug] = useState('brain-dump-system');",
  );
}
fs.writeFileSync(p, c);
const after = (c.match(/setOfferSlug\([^)]*\)/g) || []).join(' | ');
const init = (c.match(/const \[offerSlug, setOfferSlug\] = useState\([^)]*\);/) || [])[0];
console.log('init', init);
console.log('before', before);
console.log('after', after);
