'use client';

import { type SalesFooterContent } from '@/lib/mothermode/sales/types';
import { Area, Field, panelClass } from './ui';

/**
 * The `Chrome` group's only body: the funnel-wide footer.
 *
 * Despite the group name there is no header tab — `grep setHeader` over the
 * shell returns zero. Chrome is footer-only. If a header is ever wanted that is
 * a new feature, not part of this extraction.
 *
 * Stateless, like every other part: `footer` and `setField` both come from the
 * shell, so switching tabs (which unmounts this) cannot drop a half-typed edit.
 *
 * `SalesFooterContent` is imported for real rather than declared structurally.
 * The read-only parts (`LeadRow`, `LeadMagnetChoice`) can get away with a local
 * shape because a value that is only read cannot desync. `setField` is a write
 * path — its type has to be assignable in both directions — and a structural
 * stand-in there is unsound. That unresolved question is why this body sat
 * inline through five earlier refactor steps.
 */
export default function ChromeTab({
  footer,
  setField,
}: {
  footer: SalesFooterContent;
  setField: <K extends keyof SalesFooterContent>(key: K, value: SalesFooterContent[K]) => void;
}) {
  return (
    <section className={panelClass + ' space-y-4'}>
      <label className="flex items-center gap-2 text-sm text-bone/70">
        <input
          type="checkbox"
          checked={footer.enabled}
          onChange={(e) => setField('enabled', e.target.checked)}
        />{' '}
        Show footer on funnel pages
      </label>
      <Field
        label="Brand line"
        value={footer.brandLine}
        onChange={(v) => setField('brandLine', v)}
        placeholder="MotherMode"
      />
      <Area
        label="Disclaimer / advertising disclosure"
        value={footer.disclaimer}
        onChange={(v) => setField('disclaimer', v)}
        rows={4}
      />
      <Area
        label="Footer links (label|href, one per line)"
        value={footer.links.map((l) => l.label + '|' + l.href).join('\n')}
        onChange={(v) => setField('links', parseFooterLinks(v))}
        rows={5}
      />
      <Field label="Copyright" value={footer.copyright} onChange={(v) => setField('copyright', v)} />
    </section>
  );
}

/**
 * `label|href` per line -> link list, preserved verbatim from the inline body.
 *
 * Rows where both halves are blank are dropped, but a row with only one half is
 * kept: someone mid-typing a label has not yet written the href, and discarding
 * the row would delete the line out from under the cursor.
 */
function parseFooterLinks(text: string): SalesFooterContent['links'] {
  return text
    .split('\n')
    .map((line) => {
      const [label, href] = line.split('|').map((s) => s.trim());
      return { label: label || '', href: href || '' };
    })
    .filter((l) => l.label || l.href);
}
