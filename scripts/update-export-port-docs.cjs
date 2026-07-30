/**
 * Brings the port docs in line with what actually shipped.
 *
 * Two of them still say planner dates cannot reach a CSV and prescribe loading
 * the map inside `/api/mothermode/content/export` — that route converts an
 * already-built CSV, so following it would produce code wired to nothing. Left
 * as-is, the next session would implement the wrong thing from the doc that
 * looks most authoritative.
 */
const fs = require('fs');

const edits = [
  {
    file: 'docs/PLANNER_ADMIN_UI_PORT.md',
    from: `3. Thread \`getScheduleByPieceId\` into \`/api/mothermode/content/export\` — add the optional field to \`RunExportInput\` and forward through \`runExport\`/\`previewExport\`. The bridge is built and tested; the export route just isn't passing it yet, so planner dates don't reach a real CSV download.`,
    to: `3. ~~Thread \`getScheduleByPieceId\` into \`/api/mothermode/content/export\`~~ — **DONE, but not where this said.** \`RunExportInput\` now takes \`scheduleByPieceId\` **and** \`linkByPieceId\` and forwards both through \`runExport\`/\`previewExport\`, and \`ExportPanel\` supplies them, so planner dates and tracked links both reach a real CSV. The instruction to put it in the export *route* was wrong: that route converts an already-built CSV rather than building one, so \`runExport\` executes client-side and there is no server seam there to fill. The maps are fetched in the browser from \`GET /api/admin/mothermode-links?format=byPiece\` via \`src/components/mothermode/content/pieceLinks.ts\`. See \`CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md\`.`,
  },
  {
    file: 'docs/PLANNER_ADMIN_API_PORT.md',
    from: `3. **Export wiring** — \`/api/mothermode/content/export\` should call
   \`getScheduleByPieceId(offerSlug)\` and thread the map into
   \`buildExportRows\` as \`scheduleByPieceId\`. \`RunExportInput\` needs the
   optional field added and forwarded in both \`runExport\` and \`previewExport\`;
   \`ExportPanel\` fetches the map so preview and download agree. The bridge and
   its precedence rules are already built and tested — this is plumbing only,
   and until it lands the planner's \`scheduled_at\` is invisible to exports.`,
    to: `3. ~~**Export wiring**~~ — **DONE.** \`RunExportInput\` takes
   \`scheduleByPieceId\` and \`linkByPieceId\` and forwards both through
   \`runExport\` and \`previewExport\`; \`ExportPanel\` supplies them to the
   preview, the CSV download and the Sheets push, so all three agree.
   **Correction to the instruction above:** this does *not* belong in
   \`/api/mothermode/content/export\`. That route converts a CSV it is handed —
   \`runExport\` runs client-side — so a \`getScheduleByPieceId\` call there would
   sit in a function that never reaches \`buildExportRows\`. The map is fetched in
   the browser (\`GET /api/admin/mothermode-links?format=byPiece\`, cached in
   \`src/components/mothermode/content/pieceLinks.ts\`).`,
  },
  {
    file: 'docs/CONTENT_EXPORT_SYSTEM.md',
    from: `| Sheets client | \`src/utils/integrations/google-sheets.ts\` |`,
    to: `| Sheets client | \`src/utils/integrations/google-sheets.ts\` |
| Piece→link / piece→date maps (client cache) | \`src/components/mothermode/content/pieceLinks.ts\` |`,
  },
  {
    file: 'docs/CONTENT_EXPORT_SYSTEM.md',
    from: `## Google Sheets`,
    to: `## Tracked links and planner dates

\`runExport\` / \`previewExport\` accept two optional maps, both keyed by piece id:

| Input | Effect |
|-------|--------|
| \`linkByPieceId\` | Overrides the CTA link for that piece (applied in \`buildExportRows\`), so the CSV carries the \`/go/<code>\` tracked link instead of the bare offer URL. |
| \`scheduleByPieceId\` | Overrides the computed date with the planner's \`scheduled_at\` for that piece. |

Both are optional and absence is normal — with neither map the export behaves
exactly as it did before, which is why no caller was broken by adding them.

**These are supplied by the browser, not by a route.** The export endpoint
(\`/api/mothermode/content/export\`) only turns an already-built CSV into a
spreadsheet; \`runExport\` itself runs client-side in \`ExportPanel\`. So the panel
fetches \`GET /api/admin/mothermode-links?format=byPiece&offerSlug=…\` through
\`usePieceLinks\` and passes the maps into **all three** call sites — preview,
download, and the Sheets build. Passing them to only some produces a preview that
disagrees with the file, which is the one failure mode worth guarding here.

A failed fetch degrades to empty maps plus an error note, never a blocked export:
a CSV with untracked links is still usable, a refused export is not.

## Google Sheets`,
  },
];

let applied = 0;
for (const { file, from, to } of edits) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const src = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  if (!src.includes(from)) {
    if (src.includes(to.split('\n')[0])) {
      console.log('already applied:', file);
    } else {
      console.error('MISS in', file, '→', JSON.stringify(from.slice(0, 55)));
    }
    continue;
  }
  const out = src.replace(from, to);
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
  applied += 1;
  console.log('updated', file);
}
console.log(`applied ${applied}/${edits.length}`);
