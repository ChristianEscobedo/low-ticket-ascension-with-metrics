const fs = require('fs');

const p = 'src/components/mothermode/sales/UpsellPage.tsx';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('function Field(');
if (start < 0) throw new Error('no Field');

const head = s.slice(0, start);
const nl = s.includes('\r\n') ? '\r\n' : '\n';

const field = [
  'function Field({',
  '  edit,',
  '  field,',
  '  label,',
  '  value,',
  '  multiline,',
  '}: {',
  '  edit: ReturnType<typeof useSalesInlineEdit>;',
  '  field: string;',
  '  label: string;',
  '  value: string;',
  '  multiline?: boolean;',
  '}) {',
  '  return (',
  '    <label className="block space-y-1 text-xs">',
  '      <span className="font-medium text-ink/70">{label}</span>',
  '      <Editable edit={edit} field={field} multiline={multiline}>',
  "        {value || ''}",
  '      </Editable>',
  '    </label>',
  '  );',
  '}',
  '',
].join(nl);

fs.writeFileSync(p, head + field);
console.log('UpsellPage Field cleaned. total lines', (head + field).split(/\r?\n/).length);
console.log('--- tail ---');
console.log((head + field).slice(start));
