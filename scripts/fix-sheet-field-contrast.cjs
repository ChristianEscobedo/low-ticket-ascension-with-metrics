/**
 * Fix Field sheet contrast on funnel edit pages.
 * Broken: Field used bare <Editable> (inherits light page text, no input chrome).
 * Fixed: real <input>/<textarea> with bg-white text-ink (same as SalesPage).
 */
const fs = require('fs');

const goodFieldMultiline = `function Field({
  edit,
  field,
  label,
  value,
  multiline,
}: {
  edit: ReturnType<typeof useSalesInlineEdit>;
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <label className="block text-xs text-ink">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-ink/60">
        {label}
      </span>
      {multiline ? (
        <textarea
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode focus:ring-2 focus:ring-mode/15"
          rows={3}
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode focus:ring-2 focus:ring-mode/15"
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      )}
    </label>
  );
}`;

const goodFieldSimple = `function Field({
  edit,
  field,
  label,
  value,
}: {
  edit: ReturnType<typeof useSalesInlineEdit>;
  field: string;
  label: string;
  value: string;
}) {
  return (
    <label className="block text-xs text-ink">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-ink/60">
        {label}
      </span>
      <input
        className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode focus:ring-2 focus:ring-mode/15"
        value={value || ''}
        onChange={(e) => edit.setField(field as any, e.target.value)}
      />
    </label>
  );
}`;

const reMultiline =
  /function Field\(\{[\s\S]*?<Editable edit=\{edit\} field=\{field\} multiline=\{multiline\}>[\s\S]*?<\/Editable>[\s\S]*?<\/label>\s*\);\s*\}/;

const reSimple =
  /function Field\(\{[\s\S]*?<Editable edit=\{edit\} field=\{field\}>[\s\S]*?<\/Editable>[\s\S]*?<\/label>\s*\);\s*\}/;

const paths = [
  'src/components/mothermode/sales/UpsellPage.tsx',
  'src/components/mothermode/sales/CheckoutPage.tsx',
  'src/components/mothermode/sales/VslPage.tsx',
  'src/components/mothermode/sales/SalesPage.tsx',
];

for (const path of paths) {
  let t = fs.readFileSync(path, 'utf8');
  if (!t.includes('function Field')) {
    // still may need sheet text-ink
  } else {
    const alreadyInput =
      /function Field[\s\S]{0,800}<input/.test(t) &&
      !/function Field[\s\S]{0,800}<Editable/.test(t);
    if (alreadyInput) {
      console.log('Field already ok', path);
    } else if (reMultiline.test(t)) {
      t = t.replace(reMultiline, goodFieldMultiline);
      console.log('replaced multiline Field', path);
    } else if (reSimple.test(t)) {
      t = t.replace(reSimple, goodFieldSimple);
      console.log('replaced simple Field', path);
    } else {
      console.log('WARN no Field match', path);
      const i = t.lastIndexOf('function Field');
      console.log(t.slice(i, i + 350));
    }
  }

  // Force sheet container text-ink so labels never wash out from parent color
  if (t.includes('bg-bone/95') && !t.includes('bg-bone/95 text-ink')) {
    t = t.replace(
      /bg-bone\/95 shadow-2xl backdrop-blur/g,
      'bg-bone/95 text-ink shadow-2xl backdrop-blur',
    );
    console.log('added sheet text-ink', path);
  }

  fs.writeFileSync(path, t);
  const fieldOk =
    !t.includes('function Field') ||
    (/function Field[\s\S]{0,800}<input/.test(t) &&
      !/function Field[\s\S]{0,800}<Editable/.test(t));
  console.log(
    'OK',
    path,
    'fieldOk',
    fieldOk,
    'sheet text-ink',
    !t.includes('bg-bone/95') || t.includes('bg-bone/95 text-ink'),
  );
}
