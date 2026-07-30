import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  supportsUtmContent,
  utmContentFields,
  withUtmContentColumn,
  withUtmContentFallback,
} from '@/lib/mothermode/leadUtmContent';

/**
 * The shim's whole job is to keep lead capture alive in the window between
 * deploying the code and running the migration, so the tests are about failure
 * modes rather than the happy path: does a missing column degrade, and does an
 * unrelated error stay loud instead of being retried into a second failure.
 *
 * Each test uses a distinct table name because the "unsupported" flag is
 * module-level and one-way by design — sharing a name would leak state between
 * tests and make the order matter.
 */

const missingSelectError = {
  message: 'column mothermode_sales_funnel_leads.utm_content does not exist',
};
const missingInsertError = {
  message: "Could not find the 'utm_content' column of 'x' in the schema cache",
};

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe('withUtmContentColumn', () => {
  it('appends the column while it is presumed present', () => {
    expect(withUtmContentColumn('t_columns', 'id, email')).toBe('id, email, utm_content');
  });
});

describe('utmContentFields', () => {
  it('normalises empty string to null so blank UTMs are not stored as ""', () => {
    expect(utmContentFields('t_fields', '')).toEqual({ utm_content: null });
    expect(utmContentFields('t_fields', 'piece_7')).toEqual({ utm_content: 'piece_7' });
  });
});

describe('withUtmContentFallback', () => {
  it('passes a successful result straight through, with one call', async () => {
    const run = vi.fn().mockResolvedValue({ data: { id: '1' }, error: null });
    const res = await withUtmContentFallback('t_ok', run);
    expect(res.data).toEqual({ id: '1' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('retries without the column when the select says it does not exist', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: missingSelectError })
      .mockResolvedValueOnce({ data: { id: '1' }, error: null });

    const res = await withUtmContentFallback('t_select', run);

    expect(res.error).toBeNull();
    expect(run).toHaveBeenCalledTimes(2);
    // The flag is sticky: later calls must not pay for the failure again.
    expect(supportsUtmContent('t_select')).toBe(false);
    expect(withUtmContentColumn('t_select', 'id')).toBe('id');
    expect(utmContentFields('t_select', 'piece_7')).toEqual({});
  });

  it('recognises the PostgREST schema-cache wording used by inserts', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: missingInsertError })
      .mockResolvedValueOnce({ data: { id: '1' }, error: null });

    await withUtmContentFallback('t_insert', run);

    expect(run).toHaveBeenCalledTimes(2);
    expect(supportsUtmContent('t_insert')).toBe(false);
  });

  it('does not retry, or disable the column, for an unrelated error', async () => {
    const error = { message: 'duplicate key value violates unique constraint' };
    const run = vi.fn().mockResolvedValue({ data: null, error });

    const res = await withUtmContentFallback('t_other', run);

    expect(res.error).toBe(error);
    expect(run).toHaveBeenCalledTimes(1);
    expect(supportsUtmContent('t_other')).toBe(true);
  });

  it('does not retry a constraint error that merely names utm_content', async () => {
    // "utm_content" in the message is not enough — without "does not exist" this
    // is a real failure, and retrying would just fail again a second time.
    const error = { message: 'value too long for column utm_content' };
    const run = vi.fn().mockResolvedValue({ data: null, error });

    await withUtmContentFallback('t_constraint', run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(supportsUtmContent('t_constraint')).toBe(true);
  });

  it('only probes once: a later call skips straight to the fallback', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: missingSelectError })
      .mockResolvedValue({ data: { id: '1' }, error: null });

    await withUtmContentFallback('t_once', run);
    expect(run).toHaveBeenCalledTimes(2);

    await withUtmContentFallback('t_once', run);
    expect(run).toHaveBeenCalledTimes(3); // one more, not two
  });

  it('warns once, naming the migration to run', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: missingSelectError })
      .mockResolvedValue({ data: null, error: null });

    await withUtmContentFallback('t_warn', run);
    await withUtmContentFallback('t_warn', run);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      '20261005000000_planner_funnel_links_and_utm.sql',
    );
  });
});
