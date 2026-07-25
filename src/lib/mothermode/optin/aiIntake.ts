/**
 * Client-safe AI intake types for the optin funnel builder.
 * Kept separate from openai-optin.ts so the admin editor can import without
 * pulling server-only provider keys into the browser bundle.
 */

export interface OptinAiIntake {
  niche: string;
  audience: string;
  magnetName: string;
  magnetPromise: string;
  offerName: string;
  offerPrice: string;
  toneNotes: string;
}

export function blankOptinAiIntake(): OptinAiIntake {
  return {
    niche: '',
    audience: '',
    magnetName: '',
    magnetPromise: '',
    offerName: '',
    offerPrice: '',
    toneNotes: '',
  };
}

export function normalizeOptinAiIntake(raw: unknown): OptinAiIntake {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
  return {
    niche: s('niche'),
    audience: s('audience'),
    magnetName: s('magnetName'),
    magnetPromise: s('magnetPromise'),
    offerName: s('offerName'),
    offerPrice: s('offerPrice'),
    toneNotes: s('toneNotes'),
  };
}
