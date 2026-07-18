import type { DeliverableDoc } from './types';
import { brainDumpTemplate } from './brain-dump/brain-dump-template';
import { sortingPass } from './brain-dump/sorting-pass';
import { delegateScripts } from './brain-dump/delegate-scripts';
import { weeklyReset } from './brain-dump/weekly-reset';
import { loadMap } from './brain-dump/load-map';
import { printableEditable } from './brain-dump/printable-editable';
import { partnerScriptsPlus } from './brain-dump/partner-scripts-plus';
import { domainMinipacks } from './brain-dump/domain-minipacks';

export type { DeliverableDoc } from './types';

/**
 * Every deliverable document that ships in code, keyed by `${slug}::${key}`.
 * This is the full catalog: the admin editor lists from here, and the
 * delivery page falls back to here whenever no DB override is published.
 *
 * Adding a new resource is a two-step process: author a DeliverableDoc in its
 * offer folder, then register it below.
 */
export const DELIVERABLE_CATALOG: DeliverableDoc[] = [
  brainDumpTemplate,
  sortingPass,
  delegateScripts,
  weeklyReset,
  loadMap,
  printableEditable,
  partnerScriptsPlus,
  domainMinipacks,
];

const catalogKey = (slug: string, key: string) => `${slug}::${key}`;

const CATALOG_BY_KEY = new Map<string, DeliverableDoc>(
  DELIVERABLE_CATALOG.map((doc) => [catalogKey(doc.slug, doc.key), doc]),
);

/** The code-default document for one resource, or undefined if it does not exist. */
export function getDeliverableDefault(
  slug: string,
  key: string,
): DeliverableDoc | undefined {
  return CATALOG_BY_KEY.get(catalogKey(slug, key));
}

/** Every registered resource for one offer, in catalog order. */
export function listDeliverableDefaults(slug: string): DeliverableDoc[] {
  return DELIVERABLE_CATALOG.filter((doc) => doc.slug === slug);
}
