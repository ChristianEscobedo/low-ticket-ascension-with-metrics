const fs = require('fs');
const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/setOfferSlug\('brain-dump'\);/g, "setOfferSlug('brain-dump-system');");
c = c.replace(/setOfferSlug\("brain-dump"\);/g, "setOfferSlug('brain-dump-system');");
fs.writeFileSync(p, c);
console.log((c.match(/setOfferSlug\([^)]*\)/g) || []).join('\n'));
