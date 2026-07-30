/**
 * Records that the per-post tracked-link UI now exists, so the handoff stops
 * listing it as remaining work.
 */
const fs = require('fs');

const file = 'docs/CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

if (src.includes('### (1) shipped — where to find it')) {
  console.log('already logged');
  process.exit(0);
}

const anchor = '> Remaining work, in this order:';
if (!src.includes(anchor)) {
  console.error('ANCHOR NOT FOUND — nothing written');
  process.exit(1);
}

const block = `> ### (1) shipped — where to find it
>
> **Content Hub → click any piece → the sheet's *Preview* tab → "Tracked link".**
> It shows \`utm_content = <pieceId>\` as read-only fact, the live \`/go/<code>\` link
> with a copy button once one exists, and a funnel/page picker (or a pasted URL)
> to mint one. \`src/components/mothermode/content/PieceLinkPanel.tsx\`, mounted by
> \`scripts/wire-piece-link-panel.cjs\`.
>
> Three decisions worth not re-litigating:
>
> - **\`utm_content\` is not editable.** It *is* the piece id, and that equality is
>   the whole join (link table ↔ captured lead UTMs ↔ export bridge). A text box
>   there would eventually get typed in, producing a link that looks right and
>   attributes nothing.
> - **No \`planId\` is sent.** The API takes it as optional, and a hub piece often
>   has no planner card; requiring one would mean you couldn't track a post until
>   you'd scheduled it.
> - **Minting calls \`refreshPieceLinks(offerSlug)\`**, so the export panel's map is
>   evicted and the next CSV carries the new link without a page reload. This is
>   the reason the cache invalidates explicitly rather than on a TTL.
>
> The funnel picker lists **sales funnels only** — \`mothermode_utm_links.funnel_id\`
> references \`mothermode_sales_funnels\`, so an optin funnel can't be a link target
> without a schema change. Use the custom-URL field for those.
>
> Preview tab was chosen over the schedule tab because that's where you decide a
> post is ready to go out, which is the moment you want its link.

${anchor}`;

src = src.replace(anchor, block);

// The export-wiring item is done; so is the per-post control. Only cards remain.
src = src.replace(
  '> 2. **Per-post link control** —',
  '> 2. ~~**Per-post link control**~~ — **DONE** (see "(1) shipped" above). Original plan, which put it on the schedule tab, kept for context:',
);

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log('logged (1) in', file);
