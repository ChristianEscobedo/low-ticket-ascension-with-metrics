import type { Metadata } from 'next';
import SharedRunClient from './SharedRunClient';

export const dynamic = 'force-dynamic';

/**
 * /share/run/<token> — the public, read-only run recap (roadmap Phase 3).
 * Unlisted by design: the link spreads by being pasted, never by being
 * indexed, and revocation kills it on the next load.
 */
export const metadata: Metadata = {
  title: 'Shared run recap · MotherMode',
  description:
    'A read-only recap of one AI crew run: the transcript, the build map, and what it brought back.',
  robots: { index: false, follow: false },
};

export default function SharedRunPage({
  params,
}: {
  params: { token: string };
}) {
  return <SharedRunClient token={params.token || ''} />;
}
