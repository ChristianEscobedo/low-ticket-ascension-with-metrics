/**
 * Mounts <PieceLinkPanel> in the ContentSheet's Preview tab.
 *
 * Inserted as its own `tab === 'preview'` sibling rather than nested inside the
 * existing preview block: the block's closing tags are not uniquely anchorable in
 * a file this size, and a mis-anchored insert would either render the panel on
 * every tab or break the JSX. A sibling conditional is unambiguous.
 */
const fs = require('fs');

const file = 'src/components/mothermode/content/ContentSheet.tsx';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

if (src.includes('<PieceLinkPanel')) {
  console.log('already wired — no changes');
  process.exit(0);
}

const importAnchor = "import { AmplifyCard } from './AmplifyCard';";
const mountAnchor = "          {tab === 'edit' && (";

if (!src.includes(importAnchor) || !src.includes(mountAnchor)) {
  console.error('ANCHOR NOT FOUND — nothing written');
  process.exit(1);
}

src = src.replace(
  importAnchor,
  `${importAnchor}\nimport { PieceLinkPanel } from './PieceLinkPanel';`,
);

src = src.replace(
  mountAnchor,
  `          {/*
            Tracked link lives on the Preview tab because that's where you decide
            the post is ready to go out — the moment you need its link. Minting
            here refreshes the shared piece→link cache, so the next export carries
            it without a page reload.
          */}
          {tab === 'preview' && (
            <div className="pb-2">
              <PieceLinkPanel
                piece={piece}
                offerSlug={offerSlug}
                offerUrl={offerUrl}
              />
            </div>
          )}

${mountAnchor}`,
);

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log('wired PieceLinkPanel into', file);
