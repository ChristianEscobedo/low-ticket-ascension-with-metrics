/**
 * Server-only builder for the context-source PICKER options. Reads the offer
 * catalog and each kit store so the editor can show real names (e.g. "The Brain
 * Dump System", "Lead Magnet: 5-Minute Reset") in a dropdown instead of asking
 * the admin to remember and type a raw slug or id.
 *
 * Inline kinds (link / text) are intentionally NOT listed here — they carry
 * their content on the ref and need no lookup.
 *
 * Never import this from a browser bundle: it pulls in the service-role kit
 * stores.
 */
import type { ContextSourceOption } from './types';
import { OFFERS } from '@/lib/mothermode/offers';
import { listKitsForAdmin as listCommunityKits } from '@/lib/mothermode/community/store';
import { listKitsForAdmin as listHighTicketKits } from '@/lib/mothermode/highticket/store';
import { listKitsForAdmin as listLeadGenKits } from '@/lib/mothermode/leadgen/store';
import { listKitsForAdmin as listEmailKits } from '@/lib/mothermode/email/store';
import { listBiblesForAdmin } from '@/lib/mothermode/brandbible/store';


function money(cents: unknown): string {
  return typeof cents === 'number' && cents > 0
    ? `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
    : '';
}

/**
 * Assemble every selectable source across the catalog + kit stores. Failures in
 * any single store are swallowed so the picker still renders what it can.
 */
export async function buildContextSourceOptions(): Promise<
  ContextSourceOption[]
> {
  const out: ContextSourceOption[] = [];

  // Front-end offers (whole offer + just the bonus stack).
  for (const offer of OFFERS) {
    const hint = money(offer.priceCents);
    out.push({
      kind: 'offer',
      id: offer.slug,
      label: offer.name,
      hint: hint || undefined,
    });
    out.push({
      kind: 'offer-bonuses',
      id: offer.slug,
      label: `${offer.name} — bonuses`,
      hint: hint || undefined,
    });
  }

  // Admin kits. Each store read is isolated so one failure can't blank the rest.
  try {
    const kits = await listCommunityKits();
    for (const k of kits) {
      out.push({
        kind: 'community-kit',
        id: k.id,
        label: k.name || k.slug || k.id,
        hint: k.status,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const kits = await listHighTicketKits();
    for (const k of kits) {
      out.push({
        kind: 'high-ticket-kit',
        id: k.id,
        label: k.name || k.slug || k.id,
        hint: k.status,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const kits = await listLeadGenKits();
    for (const k of kits) {
      out.push({
        kind: 'lead-gen-kit',
        id: k.id,
        label: k.name || k.slug || k.id,
        hint: k.status,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const kits = await listEmailKits();
    for (const k of kits) {
      out.push({
        kind: 'email-kit',
        id: k.id,
        label: k.name || k.slug || k.id,
        hint: k.status,
      });
    }
  } catch {
    /* ignore */
  }

  // Brand Bibles reskin the Reel Director / Seedance pipeline. No status/slug —
  // scope (when set) is the only meaningful hint.
  try {
    const bibles = await listBiblesForAdmin();
    for (const b of bibles) {
      out.push({
        kind: 'brand-bible',
        id: b.id,
        label: b.name || b.id,
        hint: b.scope || undefined,
      });
    }
  } catch {
    /* ignore */
  }

  return out;

}
