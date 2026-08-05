/**
 * Post-publish learning (roadmap 4.6): the analyst's outcome-digest
 * instruction, built from the session. The digest reads our own numbers
 * for the session's scope and lands as a research-brief artifact lineage-
 * stamped to the research that produced the work — "this brief made $X"
 * becomes a real sentence.
 *
 * Pure: no imports.
 */
import type { ResearchSession } from './types';

/**
 * The analyst turn instruction. Names the scope honestly: the offer slug
 * when scoped, the whole account when not.
 */
export function outcomeDigestInstruction(session: ResearchSession): string {
  const scope = session.offerSlug
    ? `the offer "${session.offerSlug}" (filter internal_metrics to it: its planner pieces, tracked links, opt-ins, purchases, and attributed revenue)`
    : 'the whole account (internal_metrics unfiltered)';
  return [
    `Write the OUTCOME DIGEST for ${scope}.`,
    'Read internal_metrics FIRST and quote the numbers exactly (clicks, opt-ins, purchases, attributed revenue, the paid/organic split). Attributed revenue is a floor, never summed with Stripe totals.',
    'Then answer: what did the handed-off pieces actually DO, what should we double down on, and what did the research that produced them get right or wrong?',
    'Save it as a research-brief artifact titled "Outcome digest" with the numbers in a table and the verdict in plain lines. If the numbers are thin, SAY they are thin instead of inventing a verdict.',
  ].join('\n');
}
