import { describe, it, expect } from 'vitest';

import {
  rowToAgentJob,
  AGENT_JOB_STATUSES,
  type AgentJobRow,
} from '@/lib/mothermode/research/recipes/jobs';

/**
 * The background job lane (roadmap 4.1), pinned: the defensive row mapper
 * (junk statuses and progress shapes degrade safely) and the status union
 * the tick worker writes.
 */

function row(over: Partial<AgentJobRow> = {}): AgentJobRow {
  return {
    id: 'j1',
    kind: 'recipe-run',
    ref_id: 'r1',
    status: 'queued',
    progress: { step: 1, total: 3, note: 'running' },
    error: '',
    created_at: '2026-07-30T00:00:00Z',
    started_at: null,
    finished_at: null,
    ...over,
  };
}

describe('rowToAgentJob', () => {
  it('maps a full row', () => {
    const job = rowToAgentJob(row());
    expect(job.status).toBe('queued');
    expect(job.progress).toEqual({ step: 1, total: 3, note: 'running' });
    expect(job.kind).toBe('recipe-run');
  });

  it('junk statuses degrade to queued', () => {
    expect(rowToAgentJob(row({ status: 'weird' })).status).toBe('queued');
    expect(rowToAgentJob(row({ status: null })).status).toBe('queued');
    for (const s of AGENT_JOB_STATUSES) {
      expect(rowToAgentJob(row({ status: s })).status).toBe(s);
    }
  });

  it('junk progress degrades to zeros, never a crash', () => {
    expect(rowToAgentJob(row({ progress: 'junk' })).progress).toEqual({
      step: 0,
      total: 0,
      note: '',
    });
    expect(
      rowToAgentJob(row({ progress: { step: 'x', total: null } })).progress,
    ).toEqual({ step: 0, total: 0, note: '' });
  });

  it('missing kind defaults to recipe-run, error trims', () => {
    const job = rowToAgentJob(row({ kind: null, error: '  boom  ' }));
    expect(job.kind).toBe('recipe-run');
    expect(job.error).toBe('boom');
  });
});
