#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');

function dump(label, idx, before, after) {
  console.log('\n====', label, idx);
  if (idx < 0) return;
  console.log(p.slice(Math.max(0, idx - before), idx + after));
}

dump('blobUrl', p.indexOf('blobUrl'), 200, 900);
dump('createObjectURL', p.indexOf('createObjectURL'), 400, 1400);
dump('setBusy', p.indexOf('setBusy('), 200, 400);

const keys = ['busy', 'uploadProgress', 'hostVideo', 'putFile', 'xhr', 'XMLHttpRequest', 'FormData', 'type="file"', 'onChange', 'inputRef'];
for (const k of keys) {
  console.log(k.padEnd(18), String(p.split(k).length - 1).padStart(3), p.indexOf(k));
}
