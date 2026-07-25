const fs = require('fs');

// ---------------------------------------------------------------------------
// store.ts
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/mothermode/sales/store.ts';
  let s = fs.readFileSync(p, 'utf8');

  // 1) Import normalizeEmailKits as a value import
  if (!/import\s*\{[^}]*\bnormalizeEmailKits\b[^}]*\}\s*from\s*'\.\/types'/.test(s)) {
    // Find the type-only import from './types' and convert/add
    if (s.includes("} from './types';")) {
      // Insert a separate value import right before first types import
      const typeImportIdx = s.indexOf("from './types'");
      // walk back to import
      const importStart = s.lastIndexOf('import', typeImportIdx);
      const importEnd = s.indexOf(';', typeImportIdx) + 1;
      const block = s.slice(importStart, importEnd);
      if (block.includes('normalizeEmailKits')) {
        // already there somehow
      } else {
        s = s.slice(0, importStart) + `import { normalizeEmailKits } from './types';\n` + s.slice(importStart);
      }
    } else {
      s = `import { normalizeEmailKits } from './types';\n` + s;
    }
  }

  // 2) Add emailKits to UpsertSalesFunnelInput
  const upsertStart = s.indexOf('export interface UpsertSalesFunnelInput');
  if (upsertStart < 0) {
    console.error('UpsertSalesFunnelInput missing');
    process.exit(1);
  }
  const upsertEnd = s.indexOf('}', upsertStart);
  const upsertBlock = s.slice(upsertStart, upsertEnd + 1);
  if (!upsertBlock.includes('emailKits?:')) {
    s = s.slice(0, upsertStart) + upsertBlock.replace(
      'emailKitId?: string | null;\n  productId?: string | null;',
      'emailKitId?: string | null;\n  emailKits?: SalesEmailKitBinding[];\n  productId?: string | null;',
    ) + s.slice(upsertEnd + 1);
    console.log('added emailKits to UpsertSalesFunnelInput');
  } else {
    console.log('emailKits already on UpsertSalesFunnelInput');
  }

  // 3) Ensure SalesEmailKitBinding is type-imported
  if (!s.includes('SalesEmailKitBinding')) {
    s = s.replace(
      "type AccessContent,",
      "type AccessContent,\n  type SalesEmailKitBinding,",
    );
  }

  fs.writeFileSync(p, s);

  // verify
  const v = fs.readFileSync(p, 'utf8');
  const us = v.indexOf('export interface UpsertSalesFunnelInput');
  const ue = v.indexOf('}', us);
  console.log(v.slice(us, ue + 1));
  console.log('import line:', v.split('\n').find((l) => l.includes('normalizeEmailKits') && l.includes('import')));
}

// ---------------------------------------------------------------------------
// capture route — cast funnel as any for resolve
// ---------------------------------------------------------------------------
{
  const p = 'src/app/api/funnel/capture/route.ts';
  let s = fs.readFileSync(p, 'utf8');

  // Find resolveEmailKitIdForEvent calls and cast first arg
  s = s.replace(
    /resolveEmailKitIdForEvent\(\s*([^,\n]+)\s*,/g,
    (full, arg) => {
      if (arg.includes('as any') || arg.includes('as SalesFunnel')) return full;
      return `resolveEmailKitIdForEvent(${arg.trim()} as any,`;
    },
  );

  fs.writeFileSync(p, s);
  console.log('capture cast applied');
}

// ---------------------------------------------------------------------------
// UpsellPage.tsx
// ---------------------------------------------------------------------------
{
  const p = 'src/components/mothermode/sales/UpsellPage.tsx';
  let s = fs.readFileSync(p, 'utf8');

  // Cast recordOnAccept
  s = s.replace(
    'recordOnAccept={recordOnAccept}',
    'recordOnAccept={recordOnAccept as any}',
  );

  // Editable doesn't accept label — remove it from Field component usage
  // Field function passes label to Editable — fix Field to not pass label
  s = s.replace(
    `  return (
    <Editable
      edit={edit}
      field={field}
      label={label}
      value={value || ''}
      multiline={multiline}
    />
  );`,
    `  return (
    <label className="block space-y-1 text-xs">
      <span className="font-medium text-ink/70">{label}</span>
      <Editable
        edit={edit}
        field={field}
        value={value || ''}
        multiline={multiline}
      />
    </label>
  );`,
  );

  // If Editable is default import name different
  if (s.includes('label={label}') && s.includes('<Editable')) {
    s = s.replace(
      /(<Editable\s+edit=\{edit\}\s+field=\{field\})\s+label=\{label\}/,
      '$1',
    );
  }

  fs.writeFileSync(p, s);
  console.log('UpsellPage fixed');
}

console.log('DONE');
