/**
 * The distiller (roadmap 4.4): one cheap model call over a session's
 * newest research brief and pinned evidence → 3-5 one-line learnings,
 * upserted per offer. Runs on demand (the route action) and after a
 * recipe run completes (the tick worker, best-effort).
 *
 * Server-only: pulls the store and the model layer.
 */
import { callAgentModel } from '@/utils/integrations/research-agent';
import {
  getSession,
  listArtifacts,
  listEvidence,
} from './store';
import { parseLearnings, upsertLearnings } from './learnings';

const DISTILL_PROMPT = `You distill a research session into CROSS-SESSION MEMORY: 3-5 one-line learnings a future research session should start knowing.

Rules:
- Each line is ONE fact or pattern the evidence proved (a pain phrase the audience repeats, an objection that kills a concept, a number that matters, a voice that performs).
- Quote the audience's exact words where they carry the point.
- No fluff, no headers, no intro — just the lines, one per line, no numbering needed.
- If the material is thin, say fewer (2-3 honest lines beat 5 padded ones).`;

/** Distill a session's newest brief + evidence into upserted learnings. */
export async function distillSessionLearnings(
  sessionId: string,
): Promise<string[]> {
  const session = await getSession(sessionId);
  if (!session) return [];
  const [artifacts, evidence] = await Promise.all([
    listArtifacts(sessionId),
    listEvidence(sessionId),
  ]);
  const brief = artifacts.find((a) => a.type === 'research-brief');
  const material: string[] = [];
  if (brief) {
    material.push(`NEWEST RESEARCH BRIEF (${brief.title}):\n${brief.markdown.slice(0, 4000)}`);
  }
  if (evidence.length > 0) {
    material.push(
      `PINNED EVIDENCE:\n${evidence
        .slice(0, 12)
        .map((e) => `- [${e.kind}] ${e.body}`)
        .join('\n')}`,
    );
  }
  if (material.length === 0) return [];

  const result = await callAgentModel({
    system: DISTILL_PROMPT,
    messages: [{ role: 'user', content: material.join('\n\n') }],
    tools: [],
    maxTokens: 600,
  });
  if (!result.ok) return [];
  const bodies = parseLearnings(result.data.text);
  if (bodies.length === 0) return [];
  await upsertLearnings({
    offerSlug: session.offerSlug,
    sourceSessionId: sessionId,
    bodies,
  });
  return bodies;
}
