// Tiny grep: node scripts/_grep.cjs <file> <pattern> [context]
const fs = require('fs');
const [, , file, pattern, ctx] = process.argv;
const re = new RegExp(pattern);
const lines = fs.readFileSync(file, 'utf8').split('\n');
const c = ctx ? parseInt(ctx, 10) : 0;
for (let i = 0; i < lines.length; i++) {
  if (re.test(lines[i])) {
    for (let j = Math.max(0, i - c); j <= Math.min(lines.length - 1, i + c); j++) {
      console.log((j + 1) + '|' + lines[j]);
    }
    if (c) console.log('---');
  }
}
