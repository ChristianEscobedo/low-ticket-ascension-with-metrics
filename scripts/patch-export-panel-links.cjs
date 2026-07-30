/**
 * Adds the tracked-link / planner-date line to the export panel's preview card.
 *
 * A script rather than a hand edit because the anchor sits deep in a 580-line
 * component. Idempotent, and refuses to write anything if the anchor moved.
 * Prettier normalises line endings afterwards, so this only matches on them.
 */
const fs = require('fs');

const file = 'src/components/mothermode/content/ExportPanel.tsx';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('data-testid="export-link-summary"')) {
  console.log('already patched — no changes');
  process.exit(0);
}

const anchorLines = [
  '              {preview.withImages} with media URLs',
  '              {preview.missingMedia > 0',
  '                ? ` · ${preview.missingMedia} missing absolute media`',
  "                : ''}",
  '            </p>',
];

// CRLF-tolerant: the repo has files in both endings (see fix-ts-crlf.cjs).
const anchorRe = new RegExp(
  anchorLines
    .map((line) => line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\r?\\n'),
);

const found = src.match(anchorRe);
if (!found) {
  console.error('ANCHOR NOT FOUND — nothing written');
  process.exit(1);
}

const addition = `${found[0]}
            {/*
              What the CSV will actually carry. Stated because the alternative is
              an admin finding out in Metricool that 40 posts went out pointing at
              the bare offer URL with nothing to attribute clicks to.

              The counts are over the whole library, not the export scope: scope is
              resolved inside the mapper, so a per-scope number here would be a
              guess presented as a fact.
            */}
            <p
              data-testid="export-link-summary"
              className="mt-1 text-xs text-ink/50"
            >
              {pieceLinks.error
                ? 'Tracked links unavailable — posts will use the plain offer URL.'
                : \`\${trackedInLibrary} of \${allPieces.length} library posts have a tracked link · \${
                    Object.keys(scheduleByPieceId).length
                  } planner dates\`}
            </p>`;

src = src.replace(anchorRe, addition);
fs.writeFileSync(file, src);
console.log('patched', file);
