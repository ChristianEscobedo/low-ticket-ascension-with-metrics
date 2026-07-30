import ResearchWorkspace from './ResearchWorkspace';
import { OFFERS } from '@/lib/mothermode/offers';

export const dynamic = 'force-dynamic';

/** Full-viewport Research Lab (no admin chrome; see (fullscreen)/layout.tsx). */
export default function ResearchLabPage() {
  const offers = OFFERS.map((o) => ({ slug: o.slug, name: o.name }));
  return <ResearchWorkspace offers={offers} />;
}
