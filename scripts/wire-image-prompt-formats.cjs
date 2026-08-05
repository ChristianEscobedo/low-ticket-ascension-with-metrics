/*
 * Carry the per-slot aspect ratio from buildSalesImagePrompts into the editor.
 *
 * The bulk image pass previously hardcoded 'feed' for every slot, so a wide
 * sales hero and a square checkout thumbnail were generated at the same aspect
 * ratio and then letterboxed by CSS. Each prompt now names its own format;
 * this wires `slot.format` through so the request matches the slot.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const editorPath = path.join(root, 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx');
const promptsPath = path.join(root, 'src/lib/mothermode/sales/imagePrompts.ts');

// Confirm the source of truth actually exposes `format` before wiring to it.
const promptsSrc = fs.readFileSync(promptsPath, 'utf8');
if (!/\bformat\s*:/.test(promptsSrc)) {
  console.error('ABORT: imagePrompts.ts has no `format` field to read. Nothing wired.');
  process.exit(1);
}

let src = fs.readFileSync(editorPath, 'utf8');
const before = src;

src = src.replace(
  'type ImageSlot = { label: string; current: string; prompt: string; apply: (url: string) => void };',
  "type ImageSlot = { label: string; current: string; prompt: string; format: SalesImageFormat; apply: (url: string) => void };",
);

// Every slot literal already reads `prompts.<key>.imagePrompt`; append the
// matching format line right after so the two can never drift apart.
let added = 0;
src = src.replace(/(\n        prompt: prompts\.(\w+)\.imagePrompt,)/g, (m, line, key) => {
  added += 1;
  return line + '\n        format: prompts.' + key + '.format,';
});

src = src.replace(
  "await aiGenerateImage(slot.prompt, 'feed')",
  'await aiGenerateImage(slot.prompt, slot.format)',
);

src = src.replace(
  "import { buildSalesImagePrompts } from '@/lib/mothermode/sales/imagePrompts';",
  "import { buildSalesImagePrompts, type SalesImageFormat } from '@/lib/mothermode/sales/imagePrompts';",
);

if (src === before) {
  console.error('ABORT: no anchors matched. Editor left untouched.');
  process.exit(1);
}

fs.writeFileSync(editorPath, src);
console.log('Wired formats into ' + added + ' image slots.');
console.log("aiGenerateImage now called with slot.format instead of the hardcoded 'feed'.");
