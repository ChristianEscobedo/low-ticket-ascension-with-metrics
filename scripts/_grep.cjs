// Throwaway: grep a literal string in a file, print matching lines with numbers.
// node scripts/_grep.cjs <file> <needle> [maxResults]
const fs = require('fs');
const [, , file, needle, max] = process.argv;
const lines = fs.readFileSync(file, 'utf8').split('\n');
let n = 0;
const cap = parseInt(max || '40', 10);
for (let i = 0; i < lines.length && n < cap; i += 1) {
  if (lines[i].includes(needle)) {
    console.log((i + 1) + ' | ' + lines[i].trim().slice(0, 140));
    n += 1;
  }
}
