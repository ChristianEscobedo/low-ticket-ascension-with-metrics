import { describe, it, expect } from 'vitest';
import {
  TEXT_MODELS,
  getTextModel,
  AUTO_MODEL,
} from '@/lib/mothermode/content/models';

/**
 * The text-model registry is the single source of truth for every model
 * selector in the suite (content hub panels, variation lab, batch, amplify,
 * compliance) and for the server-side provider resolvers. These pins keep the
 * catalog honest: every option resolves, carries a real provider, and the
 * round-7 additions (Claude Opus 5, Claude Fable 5, Kimi K3) stay selectable.
 */
describe('text model registry', () => {
  it('ships Claude Opus 5, Claude Fable 5, and Kimi K3 as selectable options', () => {
    const ids = TEXT_MODELS.map((m) => m.id);
    expect(ids).toContain('claude-opus-5');
    expect(ids).toContain('claude-fable-5');
    expect(ids).toContain('kimi-k3');
  });

  it('maps every model to the provider that serves it', () => {
    expect(getTextModel('claude-opus-5')?.provider).toBe('anthropic');
    expect(getTextModel('claude-fable-5')?.provider).toBe('anthropic');
    expect(getTextModel('claude-opus-4-8')?.provider).toBe('anthropic');
    expect(getTextModel('gpt-5.5')?.provider).toBe('openai');
    expect(getTextModel('kimi-k3')?.provider).toBe('moonshot');
  });

  it('every option has a non-empty label and a known provider', () => {
    const providers = new Set(['openai', 'anthropic', 'moonshot']);
    for (const model of TEXT_MODELS) {
      expect(model.id.trim().length, model.id).toBeGreaterThan(0);
      expect(model.label.trim().length, model.id).toBeGreaterThan(0);
      expect(providers.has(model.provider), model.id).toBe(true);
    }
    // Ids are unique — a duplicate would silently shadow in the selectors.
    const ids = TEXT_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Auto and unknown ids resolve to undefined (server falls back)', () => {
    expect(getTextModel(AUTO_MODEL)).toBeUndefined();
    expect(getTextModel(undefined)).toBeUndefined();
    expect(getTextModel('not-a-model')).toBeUndefined();
  });
});
