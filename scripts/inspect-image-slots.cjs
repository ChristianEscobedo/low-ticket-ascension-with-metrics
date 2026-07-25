const fs = require('fs');
const e = fs.readFileSync('src/app/admin/sales-funnels/SalesFunnelEditor.tsx', 'utf8');
console.log('--- state/status hooks ---');
e.split(/\r?\n/).forEach((l, i) => {
  if (/useState<string>|setStatus|setMessage|setNotice|setError|setBusy\(/.test(l)) console.log(i + 1, l.trim().slice(0, 110));
});
console.log('--- aiGenerateImage signature ---');
const a = fs.readFileSync('src/components/mothermode/content/aiClient.ts', 'utf8');
console.log(a.split(/\r?\n/).slice(88, 110).join('\n'));
