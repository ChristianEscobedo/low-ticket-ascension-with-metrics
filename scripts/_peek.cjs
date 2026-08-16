// Throwaway: print a line range of a file. node scripts/_peek.cjs <file> <from> <to>
const fs = require('fs');
const [, , file, from, to] = process.argv;
const lines = fs.readFileSync(file, 'utf8').split('\n');
const a = Math.max(1, parseInt(from, 10));
const b = Math.min(lines.length, parseInt(to, 10));
for (let i = a; i <= b; i += 1) console.log(i + ' | ' + lines[i - 1]);
