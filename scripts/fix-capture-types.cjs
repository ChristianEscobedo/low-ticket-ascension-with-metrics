const fs = require('fs');
const p = 'src/app/api/funnel/capture/route.ts';
let c = fs.readFileSync(p, 'utf8');

const old = `try {
      await markLeadUpsell(leadId, upsellKey, accepted);
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (slug) {
        const funnel = await getFunnelBySlug(slug);
        if (funnel) {
          const n =
            upsellKey === 'upsell1'
              ? 1
              : upsellKey === 'upsell2'
                ? 2
                : upsellKey === 'upsell3'
                  ? 3
                  : 4;
          void incrementUpsellCount(funnel.id, n, accepted);
          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: accepted ? 'upsell_yes' : 'upsell_no',
            leadId,
            step: upsellKey,
          });
        }
      }
      return NextResponse.json({ success: true });
    }`;

const neu = `try {
      const key =
        upsellKey === 'upsell1' ||
        upsellKey === 'upsell2' ||
        upsellKey === 'upsell3' ||
        upsellKey === 'upsell4'
          ? upsellKey
          : 'upsell1';
      await markLeadUpsell(leadId, key, accepted);
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (slug) {
        const funnel = await getFunnelBySlug(slug);
        if (funnel) {
          const n: 1 | 2 | 3 | 4 =
            key === 'upsell1' ? 1 : key === 'upsell2' ? 2 : key === 'upsell3' ? 3 : 4;
          void incrementUpsellCount(funnel.id, n, accepted);
          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: accepted ? 'upsell_yes' : 'upsell_no',
            leadId,
            step: key,
          });
        }
      }
      return NextResponse.json({ success: true });
    }`;

if (!c.includes(old)) {
  console.log('OLD BLOCK NOT FOUND');
  process.exit(1);
}
c = c.replace(old, neu);
fs.writeFileSync(p, c);
console.log('fixed capture types');
