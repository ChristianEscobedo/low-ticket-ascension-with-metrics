#!/usr/bin/env node
/**
 * Deliberate glyph repair for reel-studio/page.tsx.
 *
 * Two corruption classes live in this file:
 *
 *  1. RECOVERABLE - UTF-8 bytes decoded through cp437/cp850. A pure byte-for-byte
 *     mapping, zero risk:  "\u0393\u00c7\u00f6" -> em dash,  "\u252c\u2557" -> middot.
 *
 *  2. LOSSY - every byte of a multi-byte char became a literal '?'. Only the RUN
 *     LENGTH survives, which is still a strong constraint:
 *        '???'  = a 3-byte char  -> BMP symbol (arrow, dash, star, quote)
 *        '????' = a 4-byte char  -> astral-plane emoji
 *     Keyed by LINE NUMBER so nothing is repaired by loose pattern matching.
 *     If a line has drifted the edit is skipped and reported, never misapplied.
 *
 * Usage: node scripts/repair-reel-studio-glyphs.cjs [--check]
 */
const fs = require('fs');

const FILE = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
const CHECK = process.argv.includes('--check');

// [lineNumber, search, replace]
const EDITS = [
  // engagement rails - '????' is an emoji, '???' is a BMP symbol
  [911, "['\u2764\ufe0f', '24K'], ['\uD83D\uDCAC', ''], ['\uD83D\uDD16', '812'], ['\u21aa', 'Share']"],
  [923, "['\u2665', '128K'], ['\uD83D\uDCAC', '2,041'], ['\u21bb', '8,512'], ['\u21aa', 'Share']"],
  [931, "['\u2665', '45.2K'], ['\uD83D\uDCAC', '986'], ['\u21bb', ''], ['\u21aa', '']"],
];

let src = fs.readFileSync(FILE, 'utf8');
const before = src;

// ---- class 1: fully recoverable byte mappings -------------------------------
const RECOVERABLE = [
  ['\u0393\u00c7\u00f6', '\u2014'], // em dash
  ['\u0393\u00c7\u00ff', '\u2013'], // en dash
  ['\u0393\u00c7\u00f4', '\u2018'],
  ['\u0393\u00c7\u00f5', '\u2019'],
  ['\u0393\u00c7\u00fa', '\u201c'],
  ['\u0393\u00c7\u00fb', '\u201d'],
  ['\u252c\u2557', '\u00b7'], // middot
];
let recovered = 0;
for (const [bad, good] of RECOVERABLE) {
  const n = src.split(bad).length - 1;
  if (n > 0) {
    src = src.split(bad).join(good);
    recovered += n;
  }
}

// ---- class 2: line-keyed lossy repairs --------------------------------------
// Each entry: line number -> ordered list of [search, replace] on that line.
const M = {
  450: [['(???', '(\u2248']],
  495: [['???', '\u2014']],
  799: [['15???60s', '15\u201360s'], ['???60???90s', '\u224860\u201390s']],
  911: [["['????', '24K'], ['????', ''], ['????', '812'], ['???', 'Share']", EDITS[0][1]]],
  923: [["['???', '128K'], ['????', '2,041'], ['???', '8,512'], ['???', 'Share']", EDITS[1][1]]],
  931: [["['???', '45.2K'], ['????', '986'], ['???', ''], ['???', '']", EDITS[2][1]]],
  984: [['???', '\u2014']],
  1020: [['???', '\u2605']],
  1154: [["['????', '24K'], ['????', ''], ['????', '812'], ['???', 'Share'], ['???', '']", "['\u2764\ufe0f', '24K'], ['\uD83D\uDCAC', ''], ['\uD83D\uDD16', '812'], ['\u21aa', 'Share'], ['\u22ef', '']"]],
  1198: [['????', '\uD83D\uDD16']],
  1202: [["['????', '3.4K'], ['????', '210'], ['???', '96'], ['???', '']", "['\u2764\ufe0f', '3.4K'], ['\uD83D\uDCAC', '210'], ['\u21bb', '96'], ['\u21aa', '']"]],
  1230: [['???', '\u22ef']],
  1238: [['??????', '\uD83D\uDC4D\uD83D\uDC4F']],
  1239: [['????', '\uD83D\uDCAC']],
  1251: [['????', '\uD83C\uDF0D']],
  1253: [['???', '\u22ef']],
  1258: [['????', '\uD83D\uDC4D']],
  1259: [['????', '\uD83D\uDCAC']],
  1260: [['???', '\u21aa']],
  1265: [['comment???', 'comment\u2026']],
  1310: [['????', '\uD83D\uDC4D']],
  1311: [['???', '\u21aa']],
  1332: [["['???', '128K'], ['????', '2,041'], ['???', '8,512'], ['???', 'Share']", EDITS[1][1]]],
  1356: [["['???', '45.2K'], ['????', '986'], ['???', ''], ['???', '']", EDITS[2][1]]],
  1389: [['???', '\u22ef']],
  1398: [['????', '\uD83D\uDD01']],
  1399: [['????', '\u2764\ufe0f']],
  1400: [['???', '\u2665']],
  1401: [['???', '\u25b6']],
  1415: [['????', '\uD83C\uDF0D']],
  1424: [['????', '\uD83D\uDC4D']],
  1425: [['????', '\uD83D\uDCAC']],
  1426: [['????', '\uD83D\uDD01']],
  1427: [['???', '\u2709']],
  1678: [['???', '\u2014']],
  1875: [['planner???', 'planner\u2026']],
  2001: [['???', '\u2014']],
  2298: [['???', '\u2014']],
  2305: [['???', '\u2713']],
  2456: [["'???' : '???'", "'\u2713' : '\u2715'"]],
  2558: [['??? pick a funnel ???', '\u2014 pick a funnel \u2014']],
  2585: [['??? pick a lead magnet ???', '\u2014 pick a lead magnet \u2014']],
  2609: [['https://???', 'https://\u2026']],
  3212: [['head-cut)???', 'head-cut)\u2026']],
  3249: [['(word-accurate)???', '(word-accurate)\u2026']],
  3439: [['${a.name}???', '${a.name}\u2026']],
  3802: [['a minute)???', 'a minute)\u2026']],
  4135: [['(???25MB)', '(\u226425MB)']],
  4140: [['a minute)???', 'a minute)\u2026']],
  4150: [['`???${s.title}???`', '`\u201c${s.title}\u201d`']],
  4174: [['`??? hook gene:', '`\u2605 hook gene:']],
  4200: [['the cache)???', 'the cache)\u2026']],
  4360: [['???${json.winner.name}???', '\u201c${json.winner.name}\u201d']],
  4371: [['("??? (B)")', '("\u2026 (B)")']],
  4562: [['??? pick a reel ???', '\u2014 pick a reel \u2014']],
  4713: [['???or pick', '\u2026or pick']],
  4787: [['https://???', 'https://\u2026']],
  4831: [['Hub renders???', 'Hub renders\u2026']],
  4889: [['(???', '(\u2212']],
  5001: [['???', '\u2605']],
  5030: [['???', '\u2014']],
  5151: [['https://???', 'https://\u2026']],
  5249: [["'hide example ???' : 'see styles ???'", "'hide example \u2191' : 'see styles \u2193'"]],
  5302: [['de???)', 'de\u2026)']],
  5612: [['</strong> ???', '</strong> \u2014']],
  5627: [['Load variants???', 'Load variants\u2026']],
  5669: [['???', '\u2605']],
  5811: [['sync ???', 'sync \u2026']],
  5861: [['the Vault???', 'the Vault\u2026']],
  5888: [["'???'.repeat", "'\u2605'.repeat"]],
  6046: [['Schedule???', 'Schedule\u2026']],
  6155: [['Load variants???', 'Load variants\u2026']],
  6208: [['???', '\u2605']],
  6267: [['???{storyLine}???', '\u201c{storyLine}\u201d']],
  6291: [['???', '\u2014']],
  6298: [['???', '\u2014']],
  6318: [['https://???', 'https://\u2026']],
  6346: [['Assemble ???', 'Assemble \u2192']],
  6353: [['Hub renders???', 'Hub renders\u2026']],
  6406: [["'??? genes' : 'genes ???'", "'\u2191 genes' : 'genes \u2193'"]],
  6428: [['(postTarget)} ???', '(postTarget)} \u25be']],
  6529: [['???', '\u2605']],
  6826: [['adjust with ???/+', 'adjust with \u2212/+']],
  6828: [['???', '\u2212']],
  6834: [['???', '\u002b']],
  6850: [['???', '\u25be']],
  6907: [['???{k + 2}', '\u00d7{k + 2}']],
  6918: [['???{fmtSec(targetSec)}', '\u2248{fmtSec(targetSec)}']],
  7250: [['???', '\u22ef']],
  7260: [["['??? ???',", "['\u2190 \u2192',"]],
};

// '??' that are real middots / multiplication signs, not the nullish operator.
const TWO = {
  1391: [['@youraccount ?? 1m', '@youraccount \u00b7 1m']],
  1413: [['?? 1st', '\u00b7 1st']],
  1414: [['Founder ?? helping', 'Founder \u00b7 helping']],
  1415: [['1m ??', '1m \u00b7']],
  2294: [['{name} ?? {targetLabel}', '{name} \u00b7 {targetLabel}']],
  2708: [['Scheduled ?? platform', 'Scheduled \u00b7 platform']],
  2922: [['4?? fewer', '4\u00d7 fewer']],
  3371: [['hook ?? body shape ?? vault outro', 'hook \u00d7 body shape \u00d7 vault outro']],
  4594: [['clips ?? {fmtSec', 'clips \u00b7 {fmtSec']],
  4773: [['scenes ?? ${fmtSec', 'scenes \u00b7 ${fmtSec']],
  5019: [['.toFixed(2)}??`', '.toFixed(2)}\u00d7`']],
  5023: [['.toFixed(2)}??', '.toFixed(2)}\u00d7']],
  5229: [['Basic (1??) and Dynamic (2??)', 'Basic (1\u00d7) and Dynamic (2\u00d7)']],
  5241: [["'Basic ?? 1??' : 'Dynamic ?? 2??'", "'Basic \u00b7 1\u00d7' : 'Dynamic \u00b7 2\u00d7'"]],
  5277: [['multiplier ?? base rate', 'multiplier \u00d7 base rate']],
  5280: [['}?? base rate', '}\u00d7 base rate']],
  5292: [['4K is 2?? the', '4K is 2\u00d7 the']],
  5294: [['1080p ?? 1??', '1080p \u00b7 1\u00d7']],
  5295: [['4K ?? 2??', '4K \u00b7 2\u00d7']],
  5419: [['scenes ?? {fmtSec', 'scenes \u00b7 {fmtSec']],
  5500: [['variants ?? queue =', 'variants \u00b7 queue =']],
  5501: [['background ?? rollup', 'background \u00b7 rollup'], ['tracked links ??', 'tracked links \u00b7']],
  5673: [['imp ?? {r.clicks', 'imp \u00b7 {r.clicks']],
  5674: [['` ?? ${(ctr', '` \u00b7 ${(ctr']],
  5676: [['Scheduled ?? YouTube', 'Scheduled \u00b7 YouTube']],
  5682: [['` ?? ${platformFor', '` \u00b7 ${platformFor']],
  5689: [['linked ?? /go/abc ?? 42 clicks', 'linked \u00b7 /go/abc \u00b7 42 clicks']],
  5693: [['linked ?? /go/', 'linked \u00b7 /go/']],
  5695: [['` ?? ${loopStatuses', '` \u00b7 ${loopStatuses']],
  5893: [['{a.kind} ?? {fmtSec', '{a.kind} \u00b7 {fmtSec']],
  5894: [['` ?? ${a.tags', '` \u00b7 ${a.tags']],
  5895: [['` ?? ${(a.winRate', '` \u00b7 ${(a.winRate']],
  6054: [['HOOK ?? BODY ?? OUTRO', 'HOOK \u00d7 BODY \u00d7 OUTRO']],
  6133: [['hook ?? body ?? outro', 'hook \u00d7 body \u00d7 outro']],
  6809: [['} ?? cut frame', '} \u00b7 cut frame']],
  6826: [['` ?? hard max', '` \u00b7 hard max']],
  6861: [['reorder ?? drag an edge to trim ?? C cuts the tail at the playhead ??', 'reorder \u00b7 drag an edge to trim \u00b7 C cuts the tail at the playhead \u00b7']],
  6862: [['two ?? Space plays ??', 'two \u00b7 Space plays \u00b7'], ['step a frame ??', 'step a frame \u00b7']],
  7122: [['` ?? ${new Date', '` \u00b7 ${new Date']],
  7276: [['reorder ?? drag edges to trim ??', 'reorder \u00b7 drag edges to trim \u00b7']],
};

const lines = src.split(/\r?\n/);
let applied = 0;
const skipped = [];

for (const table of [M, TWO]) {
  for (const [numStr, pairs] of Object.entries(table)) {
    const idx = Number(numStr) - 1;
    if (idx < 0 || idx >= lines.length) {
      skipped.push(`${numStr}: out of range`);
      continue;
    }
    for (const [search, replace] of pairs) {
      if (!lines[idx].includes(search)) {
        skipped.push(`${numStr}: no match for ${JSON.stringify(search.slice(0, 40))}`);
        continue;
      }
      lines[idx] = lines[idx].replace(search, replace);
      applied += 1;
    }
  }
}

src = lines.join('\n');

const remaining = (src.match(/\?{2,}/g) || []).filter((r) => r.length > 2).length;
const nullish = (src.match(/\?{2}(?!\?)/g) || []).length;

console.log(`recoverable byte-mapped : ${recovered}`);
console.log(`line-keyed repairs      : ${applied} applied, ${skipped.length} skipped`);
for (const s of skipped) console.log(`  SKIP ${s}`);
console.log(`remaining '???' runs    : ${remaining}`);
console.log(`remaining '??' (nullish): ${nullish}`);

if (CHECK) {
  console.log('\n--check: nothing written.');
} else if (src !== before) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`\nwrote ${FILE}`);
} else {
  console.log('\nno changes.');
}
