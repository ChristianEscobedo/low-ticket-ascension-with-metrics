#!/usr/bin/env node
/*
 * One-shot repair of docs/PLANNER_LINK_TRACKING_SYSTEM_PORT.md.
 *
 * A failed-then-succeeded replace_in_file pair left the "second, shorter path"
 * paragraph in the doc twice. Index-based splicing rather than another
 * search/replace because the inserted block has mixed line endings, which is
 * exactly why the textual match kept missing.
 *
 * Also fixes two older blemishes while the file is open:
 *  - a stray blank line splitting the "The seam." paragraph mid-sentence
 *  - the Preview row of the surface table, which undersold what the panel shows
 *    (PieceLinkPanel imports PeopleLine, so it renders people too)
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'docs', 'PLANNER_LINK_TRACKING_SYSTEM_PORT.md');
let text = fs.readFileSync(file, 'utf8');
const before = text;
const notes = [];

// 1. Drop the FIRST copy of the duplicated paragraph (the one wedged between
//    the numbered steps and "Reading the tab"). The second copy is the keeper:
//    it sits after the bot paragraph and mentions people in the metric list.
const dupeStart = text.indexOf('**There is a second, shorter path**');
const readingTab = text.indexOf('**Reading the tab.**');
if (dupeStart !== -1 && readingTab > dupeStart) {
  text = text.slice(0, dupeStart) + text.slice(readingTab);
  notes.push('removed duplicated "second, shorter path" paragraph');
} else {
  notes.push('no duplicate found (already clean)');
}

// 2. Rejoin the sentence broken by a blank line inside "The seam."
const split = 'were about to grow two\n\nindependent try/catches';
if (text.includes(split)) {
  text = text.replace(split, 'were about to grow two\nindependent try/catches');
  notes.push('rejoined split sentence in "The seam."');
} else if (text.includes('were about to grow two\r\n\r\nindependent')) {
  text = text.replace(
    'were about to grow two\r\n\r\nindependent',
    'were about to grow two\r\nindependent'
  );
  notes.push('rejoined split sentence in "The seam." (crlf)');
} else {
  notes.push('seam paragraph already joined');
}

// 3. The panel shows people too; the table said otherwise.
const oldRow = '| piece id | clicks / opt-ins / purchases for that post |';
if (text.includes(oldRow)) {
  text = text.replace(oldRow, '| piece id | clicks / people / opt-ins / purchases for that post |');
  notes.push('Preview row now lists people');
} else {
  notes.push('Preview row already accurate');
}

// 4. "same three" no longer parses now that Preview lists four things.
const oldMetrics = '| piece id | same three, plus people and clicks-per-purchase |';
if (text.includes(oldMetrics)) {
  text = text.replace(oldMetrics, '| piece id | the same four, plus clicks-per-purchase |');
  notes.push('Metrics row reworded to match');
}

// Collapse any 3+ blank runs left behind by the splice.
text = text.replace(/\n{4,}/g, '\n\n\n');

if (text === before) {
  console.log('No changes needed.');
} else {
  fs.writeFileSync(file, text, 'utf8');
  console.log('Updated PLANNER_LINK_TRACKING_SYSTEM_PORT.md');
}
notes.forEach((n) => console.log(' -', n));

// Guard: the paragraph must appear exactly once when we are done.
const occurrences = (text.match(/second, shorter path/g) || []).length;
console.log(`"second, shorter path" occurrences: ${occurrences}`);
if (occurrences !== 1) {
  console.error('EXPECTED exactly 1 occurrence — check the file by hand.');
  process.exit(1);
}
