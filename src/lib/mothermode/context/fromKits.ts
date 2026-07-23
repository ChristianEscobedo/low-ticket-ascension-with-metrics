/**
 * Adapters that turn the three admin kits into a normalized ContextPack.
 *
 * Written defensively against the kit record shapes (community/highticket/
 * leadgen) so a partially-filled or legacy kit still yields a usable pack
 * instead of throwing. Pure: no network, no store, no server imports — the
 * resolver fetches the record and hands it here.
 */
import type { ContextPack } from './types';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}
function get(obj: unknown, key: string): unknown {
  return obj && typeof obj === 'object'
    ? (obj as Record<string, unknown>)[key]
    : undefined;
}

/** Shared record shape: every kit store returns { id, slug, name, intake, ... }. */
interface KitRecordish {
  id?: string;
  slug?: string;
  name?: string;
  intake?: unknown;
  kit?: unknown;
  doc?: unknown;
  format?: unknown;
  campaignType?: unknown;
  sequence?: unknown;
}

/** Community launch kit -> pack. */
export function fromCommunityKit(record: KitRecordish): ContextPack {
  const id = str(record.id) || str(record.slug);
  const intake = record.intake;
  const kit = record.kit;
  const name = str(get(kit, 'chosenName')) || str(record.name) || 'Community';
  const promise = str(get(intake, 'promise'));
  const audience = str(get(intake, 'audience'));
  const goal = str(get(intake, 'goal'));
  const price = str(get(intake, 'price'));
  const freebie = str(get(intake, 'freebie'));

  const lines = [
    `A community launch kit named "${name}".`,
    str(get(kit, 'description')),
    audience ? `For: ${audience}.` : '',
    promise ? `Core promise: ${promise}.` : '',
    goal ? `It drives: ${goal}.` : '',
    price ? `Price: ${price}.` : '',
    freebie ? `Welcome asset / freebie: ${freebie}.` : '',
  ].filter(Boolean);

  return {
    kind: 'community-kit',
    id,
    title: `Community: ${name}`,
    summary: promise || str(get(kit, 'description')) || name,
    prompt: lines.join(' '),
  };
}

/** High-ticket offer kit -> pack. */
export function fromHighTicketKit(record: KitRecordish): ContextPack {
  const id = str(record.id) || str(record.slug);
  const intake = record.intake;
  const offer = get(record.kit, 'offer');
  const name = str(get(offer, 'chosenName')) || str(record.name) || 'High-Ticket Offer';
  const iHelp = str(get(offer, 'iHelpStatement'));
  const price = str(get(offer, 'price'));
  const transformation = str(get(intake, 'transformation'));
  const mechanism = str(get(intake, 'mechanism'));
  const audience = str(get(intake, 'audience'));

  const lines = [
    `A high-ticket offer named "${name}".`,
    iHelp,
    audience ? `For: ${audience}.` : '',
    transformation ? `Transformation: ${transformation}.` : '',
    mechanism ? `Mechanism: ${mechanism}.` : '',
    price ? `Price: ${price}.` : '',
  ].filter(Boolean);

  return {
    kind: 'high-ticket-kit',
    id,
    title: `High-Ticket: ${name}`,
    summary: iHelp || transformation || name,
    prompt: lines.join(' '),
  };
}

/** Lead-gen (lead magnet) kit -> pack. */
export function fromLeadGenKit(record: KitRecordish): ContextPack {
  const id = str(record.id) || str(record.slug);
  const intake = record.intake;
  const doc = record.doc;
  const title = str(get(doc, 'title')) || str(record.name) || 'Lead Magnet';
  const subtitle = str(get(doc, 'subtitle'));
  const hook = str(get(doc, 'hook'));
  const format = str(record.format);
  const audience = str(get(intake, 'audience'));
  const transformation = str(get(intake, 'transformation'));
  const cta = str(get(intake, 'cta'));
  const headings = list(
    (Array.isArray(get(doc, 'sections'))
      ? (get(doc, 'sections') as unknown[])
      : []
    ).map((s) => get(s, 'heading')),
  ).slice(0, 6);

  const lines = [
    `A free lead magnet${format ? ` (${format})` : ''} titled "${title}".`,
    subtitle,
    hook,
    audience ? `For: ${audience}.` : '',
    transformation ? `Reader gets: ${transformation}.` : '',
    headings.length ? `It covers: ${headings.join('; ')}.` : '',
    cta ? `Call to action: ${cta}.` : '',
  ].filter(Boolean);

  return {
    kind: 'lead-gen-kit',
    id,
    title: `Lead Magnet: ${title}`,
    summary: subtitle || hook || title,
    prompt: lines.join(' '),
  };
}

/** Email marketing kit (a saved sequence) -> pack. */
export function fromEmailKit(record: KitRecordish): ContextPack {
  const id = str(record.id) || str(record.slug);
  const intake = record.intake;
  const sequence = record.sequence;
  const name =
    str(get(sequence, 'name')) || str(record.name) || 'Email Sequence';
  const campaignType = str(record.campaignType);
  const audience = str(get(intake, 'audience'));
  const goal = str(get(sequence, 'goal')) || str(get(intake, 'goal'));
  const senderName = str(get(intake, 'senderName'));

  const emails = Array.isArray(get(sequence, 'emails'))
    ? (get(sequence, 'emails') as unknown[])
    : [];
  const beats = emails
    .map((e) => {
      const subject = str(get(e, 'subject'));
      const summary = str(get(e, 'summary'));
      return subject || summary;
    })
    .filter(Boolean)
    .slice(0, 8);

  const lines = [
    `An email marketing sequence named "${name}"${
      campaignType ? ` (${campaignType} campaign)` : ''
    }.`,
    audience ? `For: ${audience}.` : '',
    goal ? `It drives: ${goal}.` : '',
    senderName ? `Sender: ${senderName}.` : '',
    emails.length ? `${emails.length} emails in the arc.` : '',
    beats.length ? `Beats: ${beats.join('; ')}.` : '',
  ].filter(Boolean);

  return {
    kind: 'email-kit',
    id,
    title: `Email Sequence: ${name}`,
    summary: goal || audience || name,
    prompt: lines.join(' '),
  };
}
