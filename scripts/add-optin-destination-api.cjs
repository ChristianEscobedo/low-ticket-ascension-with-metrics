/**
 * Lets /api/admin/mothermode-links mint and serve lead-magnet destinations.
 *
 * Also deletes a comment that is now false ("an optin funnel cannot be the
 * target of a tracked link without a schema change"). The schema change landed
 * in 20261006000000; leaving the note would send the next reader to build the
 * thing that already exists.
 */
const fs = require('fs');

const file = 'src/app/api/admin/mothermode-links/route.ts';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

if (src.includes('listOptinFunnelsForAdmin')) {
  console.log('already applied — no changes');
  process.exit(0);
}

const edits = [
  // 1. Imports. The optin store exports listFunnelsForAdmin TOO, so it must be
  //    aliased -- an unaliased second import would shadow the sales one and
  //    every sales-funnel link would silently resolve against optin funnels.
  {
    from: `import { funnelPageUrl } from '@/lib/mothermode/planner/utm';`,
    to: `import { funnelPageUrl, optinPageUrl } from '@/lib/mothermode/planner/utm';`,
  },
  {
    from: `import { listFunnelsForAdmin } from '@/lib/mothermode/sales/store';`,
    to: `import { listFunnelsForAdmin } from '@/lib/mothermode/sales/store';
import { listFunnelsForAdmin as listOptinFunnelsForAdmin } from '@/lib/mothermode/optin/store';`,
  },

  // 2. byPiece: serve lead magnets alongside sales funnels, so the hub's picker
  //    can offer both from the one request it already makes.
  {
    from: `      const [linkByPieceId, scheduleByPieceId, funnels] = await Promise.all([
        getLinkUrlByPieceId({ origin }),
        getScheduleByPieceId(offerSlug),
        listFunnelsForAdmin()
      ]);`,
    to: `      const [linkByPieceId, scheduleByPieceId, funnels, optinFunnels] =
        await Promise.all([
          getLinkUrlByPieceId({ origin }),
          getScheduleByPieceId(offerSlug),
          listFunnelsForAdmin(),
          listOptinFunnelsForAdmin()
        ]);`,
  },
  {
    from: `        funnels: funnels.map((f) => ({
          id: f.id,
          slug: f.slug,
          name: f.name,
          status: f.status
        }))
      });`,
    to: `        funnels: funnels.map((f) => ({
          id: f.id,
          slug: f.slug,
          name: f.name,
          status: f.status
        })),
        // Lead magnets are a SEPARATE list, not merged into \`funnels\`: their step
        // vocabulary differs ('oto' / 'thank-you' vs 'checkout' / 'upsell1'), so a
        // merged list would let the UI offer a step the destination doesn't have.
        optinFunnels: optinFunnels.map((f) => ({
          id: f.id,
          slug: f.slug,
          name: f.name,
          status: f.status
        }))
      });`,
  },

  // 3. The stale claim in the full GET payload.
  {
    from: `      // Only sales funnels: mothermode_utm_links.funnel_id references
      // mothermode_sales_funnels, so an optin funnel cannot be the target of a
      // tracked link without a schema change.`,
    to: `      // Sales funnels only in THIS payload. Lead magnets are linkable now
      // (mothermode_utm_links.optin_funnel_id, added 20261006000000) and the
      // ?format=byPiece branch returns them; the planner's link table just
      // hasn't grown a picker for them yet.`,
  },

  // 4. createLink: resolve an optin step server-side, same as a sales step.
  {
    from: `        const funnelId = text('funnelId') || null;
        const funnelPage = text('funnelPage');
        const pasted = text('destinationUrl').trim();`,
    to: `        const funnelId = text('funnelId') || null;
        const optinFunnelId = text('optinFunnelId') || null;
        const funnelPage = text('funnelPage');
        const pasted = text('destinationUrl').trim();

        // One destination per link. The DB enforces it too, but a 400 naming the
        // problem beats a CHECK violation surfacing as a 500.
        if (funnelId && optinFunnelId) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Pick one destination: a sales funnel or a lead magnet, not both'
            },
            { status: 400 }
          );
        }`,
  },
  {
    from: `          baseUrl = funnelPageUrl(`,
    to: `          baseUrl = funnelPageUrl(`,
  },
];

for (const { from } of edits) {
  if (!src.includes(from)) {
    console.error('ANCHOR MISS — nothing written:', JSON.stringify(from.slice(0, 64)));
    process.exit(1);
  }
}
for (const { from, to } of edits) src = src.replace(from, to);

// 5. The optin resolution branch goes right after the sales funnel branch. It is
//    inserted by locating the end of that branch rather than by a big anchor, so
//    the sales resolution logic stays untouched.
const salesBranchTail = `        if (!baseUrl) {`;
if (!src.includes(salesBranchTail)) {
  console.error('ANCHOR MISS on baseUrl guard — partial write, review the file');
  process.exit(1);
}
src = src.replace(
  salesBranchTail,
  `        // Lead-magnet steps go through optinPageUrl for the same reason sales
        // steps go through funnelPageUrl: step 1 IS the funnel index
        // (/optin/<slug>), and a client-built path gets that wrong eventually.
        if (optinFunnelId) {
          const optins = await listOptinFunnelsForAdmin();
          const optin = optins.find((f) => f.id === optinFunnelId);
          if (!optin) {
            return NextResponse.json(
              { success: false, error: 'Lead magnet not found' },
              { status: 400 }
            );
          }
          baseUrl = optinPageUrl(
            siteOrigin(request),
            optin.slug,
            funnelPage || 'optin'
          );
        }

${salesBranchTail}`,
);

// 6. Persist the new destination.
const createCall = `          funnelId,
          funnelPage,`;
if (!src.includes(createCall)) {
  console.error('ANCHOR MISS on createUtmLink call — review the file');
  process.exit(1);
}
src = src.replace(
  createCall,
  `          funnelId,
          optinFunnelId,
          funnelPage,`,
);

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log('patched', file);
