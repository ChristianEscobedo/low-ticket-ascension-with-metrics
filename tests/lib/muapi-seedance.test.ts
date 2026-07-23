import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitSeedanceRender } from '@/utils/integrations/muapi-seedance';

/**
 * Guards the MUAPI request-body contract for the omni-reference pipeline: the
 * reference-image array must only appear when usable URLs are supplied, must
 * ride under the env-configurable field name, and must be cleaned (http(s)
 * only, de-duplicated, order preserved) before it leaves the process.
 */
describe('submitSeedanceRender reference images', () => {
  const OLD_ENV = process.env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = { ...OLD_ENV, MUAPI_API_KEY: 'test-key' };
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ request_id: 'task_123' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllGlobals();
  });

  function lastBody(): Record<string, any> {
    const call = fetchMock.mock.calls.at(-1);
    return JSON.parse((call?.[1] as any).body);
  }

  it('omits the reference field entirely when no references are given', async () => {
    const res = await submitSeedanceRender({
      prompt: 'a hero shot',
      imageUrl: 'https://example.com/frame.png',
    });
    expect(res.ok).toBe(true);
    expect(lastBody()).not.toHaveProperty('reference_images');
  });

  it('sends cleaned references under the default field name', async () => {
    await submitSeedanceRender({
      prompt: 'address @image1 and @character',
      imageUrl: 'https://example.com/frame.png',
      referenceImages: [
        'https://cdn.example.com/char.png',
        'not-a-url',
        'https://cdn.example.com/char.png', // duplicate
        'https://cdn.example.com/prop.png',
      ],
    });
    expect(lastBody().reference_images).toEqual([
      'https://cdn.example.com/char.png',
      'https://cdn.example.com/prop.png',
    ]);
  });

  it('honors MUAPI_SEEDANCE_REF_FIELD for the body key', async () => {
    process.env.MUAPI_SEEDANCE_REF_FIELD = 'images';
    await submitSeedanceRender({
      prompt: 'p',
      imageUrl: 'https://example.com/frame.png',
      referenceImages: ['https://cdn.example.com/a.png'],
    });
    const body = lastBody();
    expect(body).not.toHaveProperty('reference_images');
    expect(body.images).toEqual(['https://cdn.example.com/a.png']);
  });
});
