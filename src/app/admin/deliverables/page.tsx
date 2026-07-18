import { getOffer } from '@/lib/mothermode/offers';
import {
  DELIVERABLE_CATALOG,
  listDeliverableDefaults,
} from '@/lib/mothermode/deliverables/index';
import { listDeliverableOverrides } from '@/lib/mothermode/deliverables/store';
import DeliverablesScopePicker from './DeliverablesScopePicker';
import DeliverablesEditor, { type DeliverableItem } from './DeliverablesEditor';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { slug?: string };
}

/** Every offer slug that has at least one registered resource document. */
function offersWithDeliverables() {
  const slugs = Array.from(new Set(DELIVERABLE_CATALOG.map((d) => d.slug)));
  return slugs
    .map((slug) => ({ slug, name: getOffer(slug)?.name ?? slug }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default async function DeliverablesPage({ searchParams }: PageProps) {
  const offers = offersWithDeliverables();
  const requested = searchParams?.slug;
  const slug = offers.some((o) => o.slug === requested) ? requested! : offers[0]?.slug ?? '';

  const defaults = listDeliverableDefaults(slug);
  const overrides = slug ? await listDeliverableOverrides(slug) : [];
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

  const items: DeliverableItem[] = defaults.map((doc) => {
    const override = overrideByKey.get(doc.key);
    return {
      key: doc.key,
      defaultTitle: doc.title,
      defaultSubtitle: doc.subtitle,
      defaultHtml: doc.html,
      title: override?.title || doc.title,
      subtitle: override?.subtitle || doc.subtitle,
      html: override?.html || doc.html,
      customized: Boolean(override),
      updatedAt: override?.updated_at ?? null,
      updatedBy: override?.updated_by ?? null,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Deliverables
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Resource documents
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Every long-form resource a buyer receives after checkout, the 5 core
          items plus the 3 order bumps. Edit any document here to publish an
          override without a deploy; leave it alone and the shipped default
          keeps serving.
        </p>
      </div>

      <DeliverablesScopePicker offers={offers} currentSlug={slug} />

      {slug ? (
        <DeliverablesEditor key={slug} slug={slug} items={items} />
      ) : (
        <p className="text-sm text-bone/50">
          No resource documents are registered yet.
        </p>
      )}
    </div>
  );
}
