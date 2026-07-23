import { describe, it, expect } from 'vitest';
import {
  normalizeContextRefs,
  isContextSourceKind,
  type ContextPack,
} from '@/lib/mothermode/context/types';
import {
  clampPack,
  clampPacks,
  contextPacksToPromptBlock,
  tidy,
  PACK_CHAR_CAP,
  TOTAL_CHAR_CAP,
} from '@/lib/mothermode/context/prompt';
import { fromOffer, fromOfferBonuses } from '@/lib/mothermode/context/fromOffer';
import {
  fromCommunityKit,
  fromHighTicketKit,
  fromLeadGenKit,
} from '@/lib/mothermode/context/fromKits';

function pack(over: Partial<ContextPack> = {}): ContextPack {
  return {
    kind: 'offer',
    id: 'x',
    title: 'T',
    summary: 'S',
    prompt: 'body',
    ...over,
  };
}

describe('normalizeContextRefs', () => {
  it('keeps valid refs and drops malformed ones', () => {
    const refs = normalizeContextRefs([
      { kind: 'offer', id: 'brain-dump', label: 'Brain Dump' },
      { kind: 'nope', id: 'x' }, // bad kind
      { kind: 'community-kit' }, // missing id
      { kind: 'community-kit', id: '   ' }, // blank id
      'garbage',
      { kind: 'lead-gen-kit', id: 'abc' },
    ]);
    expect(refs).toEqual([
      { kind: 'offer', id: 'brain-dump', label: 'Brain Dump' },
      { kind: 'lead-gen-kit', id: 'abc' },
    ]);
  });

  it('returns [] for non-arrays', () => {
    expect(normalizeContextRefs(null)).toEqual([]);
    expect(normalizeContextRefs({})).toEqual([]);
    expect(normalizeContextRefs('x')).toEqual([]);
  });
});

describe('isContextSourceKind', () => {
  it('recognizes the five kinds', () => {
    expect(isContextSourceKind('offer')).toBe(true);
    expect(isContextSourceKind('offer-bonuses')).toBe(true);
    expect(isContextSourceKind('high-ticket-kit')).toBe(true);
    expect(isContextSourceKind('other')).toBe(false);
  });
});

describe('tidy', () => {
  it('strips en/em dashes and collapses whitespace', () => {
    expect(tidy('a — b – c')).toBe('a , b , c');
    expect(tidy('a   b\n\n\n\nc')).toBe('a b\n\nc');
  });
});

describe('clampPack / clampPacks', () => {
  it('caps a single pack at PACK_CHAR_CAP', () => {
    const long = 'word '.repeat(1000); // 5000 chars
    const out = clampPack(pack({ prompt: long }));
    expect(out.prompt.length).toBeLessThanOrEqual(PACK_CHAR_CAP + 1); // +1 for ellipsis
    expect(out.prompt.endsWith('…')).toBe(true);
  });

  it('enforces the total cap across packs', () => {
    const big = pack({ prompt: 'z'.repeat(PACK_CHAR_CAP) });
    const packs = clampPacks([big, big, big, big, big, big]); // 6 * 1500 = 9000 > 6000
    const total = packs.reduce((n, p) => n + p.prompt.length, 0);
    expect(total).toBeLessThanOrEqual(TOTAL_CHAR_CAP + 1);
  });

  it('preserves order and short packs pass through untouched', () => {
    const a = pack({ id: 'a', prompt: 'aaa' });
    const b = pack({ id: 'b', prompt: 'bbb' });
    const out = clampPacks([a, b]);
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
    expect(out[0].prompt).toBe('aaa');
  });
});

describe('contextPacksToPromptBlock', () => {
  it('returns empty string for no packs', () => {
    expect(contextPacksToPromptBlock([], 'kit')).toBe('');
  });

  it('frames kit vs content differently and numbers the packs', () => {
    const block = contextPacksToPromptBlock(
      [pack({ title: 'Offer: BD', prompt: 'x' })],
      'content',
    );
    expect(block).toContain('PROMOTED RESOURCES');
    expect(block).toContain('### Context 1: Offer: BD');

    const kitBlock = contextPacksToPromptBlock([pack()], 'kit');
    expect(kitBlock).toContain('OWNER CONTEXT');
  });
});

describe('offer adapters', () => {
  const offer = {
    slug: 'brain-dump',
    name: 'The Brain Dump',
    tagline: 'Empty your head',
    priceCents: 2700,
    hero: { audience: 'overwhelmed moms', promise: 'a clear head in 20 minutes' },
    mechanism: { label: 'the sorting pass' },
    inside: { items: [{ outcome: 'a sorted list' }, { title: 'weekly reset' }] },
    bonuses: {
      items: [
        { title: 'Delegate Scripts', value: 1900, description: 'hand off tasks' },
        { title: 'Load Map' },
      ],
      totalValue: 4900,
    },
  };

  it('fromOffer includes audience, promise, price, and inside', () => {
    const p = fromOffer(offer);
    expect(p.kind).toBe('offer');
    expect(p.id).toBe('brain-dump');
    expect(p.prompt).toContain('overwhelmed moms');
    expect(p.prompt).toContain('a clear head in 20 minutes');
    expect(p.prompt).toContain('$27');
    expect(p.prompt).toContain('a sorted list');
  });

  it('fromOfferBonuses renders the stack with values and total', () => {
    const p = fromOfferBonuses(offer);
    expect(p.kind).toBe('offer-bonuses');
    expect(p.prompt).toContain('Delegate Scripts');
    expect(p.prompt).toContain('$19');
    expect(p.prompt).toContain('$49');
  });

  it('degrades gracefully on an empty offer', () => {
    const p = fromOffer({});
    expect(p.title).toContain('Offer');
    expect(typeof p.prompt).toBe('string');
  });
});

describe('kit adapters', () => {
  it('fromCommunityKit pulls chosen name and promise', () => {
    const p = fromCommunityKit({
      id: 'c1',
      name: 'Fallback',
      intake: { promise: 'ship weekly', audience: 'founders', goal: 'a call' },
      kit: { chosenName: 'The Ship Room', description: 'a builder community' },
    });
    expect(p.kind).toBe('community-kit');
    expect(p.title).toContain('The Ship Room');
    expect(p.prompt).toContain('ship weekly');
    expect(p.prompt).toContain('a builder community');
  });

  it('fromHighTicketKit pulls offer name, iHelp, and price', () => {
    const p = fromHighTicketKit({
      id: 'h1',
      intake: { transformation: 'scale to 20k months' },
      kit: {
        offer: {
          chosenName: 'The Scale Method',
          iHelpStatement: 'I help coaches scale.',
          price: '5000',
        },
      },
    });
    expect(p.title).toContain('The Scale Method');
    expect(p.prompt).toContain('I help coaches scale.');
    expect(p.prompt).toContain('5000');
  });

  it('fromLeadGenKit pulls title, hook, and section headings', () => {
    const p = fromLeadGenKit({
      id: 'l1',
      format: 'ebook',
      intake: { audience: 'new coaches', cta: 'Book a call' },
      doc: {
        title: 'The First Client Playbook',
        subtitle: 'Land client #1',
        hook: 'Most coaches wait too long.',
        sections: [{ heading: 'Pick a niche' }, { heading: 'Write the offer' }],
      },
    });
    expect(p.kind).toBe('lead-gen-kit');
    expect(p.title).toContain('The First Client Playbook');
    expect(p.prompt).toContain('Pick a niche');
    expect(p.prompt).toContain('Book a call');
  });
});
