/**
 * Adapters that turn a front-end MotherMode offer into a ContextPack: one for
 * the whole offer ('offer') and one for just its bonus stack ('offer-bonuses').
 *
 * Written defensively against the offer shape so a lean offer definition still
 * yields a usable pack. Pure: the resolver passes the offer object in.
 */
import type { ContextPack } from './types';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function get(obj: unknown, key: string): unknown {
  return obj && typeof obj === 'object'
    ? (obj as Record<string, unknown>)[key]
    : undefined;
}
function money(cents: unknown): string {
  const n = typeof cents === 'number' ? cents : Number(cents);
  if (!Number.isFinite(n) || n <= 0) return '';
  const dollars = n / 100;
  return `$${Number.isInteger(dollars) ? dollars.toString() : dollars.toFixed(2)}`;
}

/** Loose offer shape — only the fields the packs read. */
export interface Offerish {
  slug?: string;
  name?: string;
  tagline?: string;
  priceCents?: number;
  hero?: unknown;
  problem?: unknown;
  mechanism?: unknown;
  inside?: unknown;
  bonuses?: unknown;
}

/** Whole offer -> pack (audience, promise, mechanism, price, what's inside). */
export function fromOffer(offer: Offerish): ContextPack {
  const id = str(offer.slug);
  const name = str(offer.name) || 'Offer';
  const tagline = str(offer.tagline);
  const audience = str(get(offer.hero, 'audience'));
  const promise = str(get(offer.hero, 'promise'));
  const mechanism =
    str(get(offer.mechanism, 'label')) ||
    arr(get(offer.mechanism, 'paragraphs')).map(str).filter(Boolean)[0] ||
    '';
  const price = money(offer.priceCents);
  const insideItems = arr(get(offer.inside, 'items'))
    .map((it) => str(get(it, 'outcome')) || str(get(it, 'title')))
    .filter(Boolean)
    .slice(0, 6);

  const lines = [
    `A low-ticket offer named "${name}"${tagline ? `: ${tagline}` : ''}.`,
    audience ? `For: ${audience}.` : '',
    promise ? `Promise: ${promise}.` : '',
    mechanism ? `How it works: ${mechanism}.` : '',
    price ? `Price: ${price}.` : '',
    insideItems.length ? `Inside: ${insideItems.join('; ')}.` : '',
  ].filter(Boolean);

  return {
    kind: 'offer',
    id,
    title: `Offer: ${name}`,
    summary: promise || tagline || name,
    prompt: lines.join(' '),
  };
}

/** Just the bonus stack -> pack (useful when writing copy that stacks value). */
export function fromOfferBonuses(offer: Offerish): ContextPack {
  const id = str(offer.slug);
  const name = str(offer.name) || 'Offer';
  const items = arr(get(offer.bonuses, 'items'));
  const rendered = items
    .map((b) => {
      const title = str(get(b, 'title'));
      if (!title) return '';
      const value = money(get(b, 'value'));
      const desc = str(get(b, 'description'));
      return `${title}${value ? ` (${value})` : ''}${desc ? `: ${desc}` : ''}`;
    })
    .filter(Boolean)
    .slice(0, 8);
  const total = money(get(offer.bonuses, 'totalValue'));

  const lines = [
    `The bonus stack included with "${name}".`,
    rendered.length ? `Bonuses: ${rendered.join(' | ')}.` : 'No bonuses defined.',
    total ? `Total bonus value: ${total}.` : '',
  ].filter(Boolean);

  return {
    kind: 'offer-bonuses',
    id,
    title: `Bonuses: ${name}`,
    summary: rendered[0] || `${name} bonuses`,
    prompt: lines.join(' '),
  };
}
