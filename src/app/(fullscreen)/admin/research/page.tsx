import ResearchWorkspace from './ResearchWorkspace';
import { OFFERS } from '@/lib/mothermode/offers';

export const dynamic = 'force-dynamic';

/** Full-viewport Research Lab (no admin chrome; see (fullscreen)/layout.tsx).
 *
 *  Deep links (the recipes UI's "open in chat"):
 *    /admin/research?session=<id>            open that session on load
 *    &run=<runId>                            scroll to the run's turns
 *    &artifact=<artifactId>                  pop the artifact viewer
 */
export default function ResearchLabPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const offers = OFFERS.map((o) => ({ slug: o.slug, name: o.name }));
  const one = (v: string | string[] | undefined): string =>
    typeof v === 'string' ? v.trim() : '';
  return (
    <ResearchWorkspace
      offers={offers}
      initialSessionId={one(searchParams.session)}
      focusRunId={one(searchParams.run)}
      focusArtifactId={one(searchParams.artifact)}
    />
  );
}
