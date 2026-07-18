import { getDeliverableOverride } from './store';
import { getDeliverableDefault, type DeliverableDoc } from './index';

/**
 * Resolves the document a buyer actually sees: the published DB override
 * when one exists, merged over the code default (falls back field by field
 * so a partial override, e.g. only new HTML, still shows the default title).
 * Returns undefined only when the key does not exist in the catalog at all.
 */
export async function resolveDeliverable(
  slug: string,
  key: string,
): Promise<DeliverableDoc | undefined> {
  const fallback = getDeliverableDefault(slug, key);
  const override = await getDeliverableOverride(slug, key);

  if (!override && !fallback) return undefined;
  if (!override) return fallback;

  return {
    slug,
    key,
    title: override.title || fallback?.title || key,
    subtitle: override.subtitle || fallback?.subtitle || '',
    html: override.html || fallback?.html || '',
  };
}
