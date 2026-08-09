/**
 * Product ↔ funnel-step assignments.
 *
 * A row in product_funnel_assignments wires one Stripe product/price into one
 * funnel step (checkout, upsell1-4) with a role (main | bump | bonus) and a
 * delivery declaration. The funnel builder's product pickers read/write these;
 * the public success + access pages and the main-app webhook resolve them at
 * purchase time so "what the buyer gets" is data, not hand-copied links.
 *
 * Mappers are pure and defensive (JSONB at the DB boundary), same posture as
 * the sales funnel types module.
 */
import { createClient } from '@supabase/supabase-js';

const TABLE = 'product_funnel_assignments';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ASSIGNMENT_STEPS = ['checkout', 'upsell1', 'upsell2', 'upsell3', 'upsell4'] as const;
export type AssignmentStep = (typeof ASSIGNMENT_STEPS)[number];

export const ASSIGNMENT_ROLES = ['main', 'bump', 'bonus'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export const DELIVERY_TYPES = ['course', 'deliverable', 'url', 'main_app'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export interface DeliveryLink {
  label: string;
  href: string;
  description: string;
}

export interface DeliveryConfig {
  /** delivery_type = course */
  courseIds: string[];
  /** delivery_type = deliverable */
  deliverableSlug: string;
  deliverableKey: string;
  /** delivery_type = url */
  links: DeliveryLink[];
  /** delivery_type = main_app — key of the product in the main app's builder. */
  productKey: string;
  /** main_app: ask the main app to issue a license key for this buyer. */
  license: boolean;
  /** main_app: seat count for the license (default 1). */
  seats: number;
}

export interface ProductFunnelAssignment {
  id: string;
  productId: string;
  priceId: string | null;
  funnelSlug: string;
  step: AssignmentStep;
  role: AssignmentRole;
  deliveryType: DeliveryType;
  delivery: DeliveryConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFunnelAssignmentRow {
  id: string;
  product_id: string;
  price_id: string | null;
  funnel_slug: string;
  step: string;
  role: string;
  delivery_type: string;
  delivery_config: unknown;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Normalizers (pure, never throw)
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function toAssignmentStep(value: unknown): AssignmentStep {
  return (ASSIGNMENT_STEPS as readonly string[]).includes(String(value))
    ? (value as AssignmentStep)
    : 'checkout';
}

export function toAssignmentRole(value: unknown): AssignmentRole {
  return (ASSIGNMENT_ROLES as readonly string[]).includes(String(value))
    ? (value as AssignmentRole)
    : 'main';
}

export function toDeliveryType(value: unknown): DeliveryType {
  return (DELIVERY_TYPES as readonly string[]).includes(String(value))
    ? (value as DeliveryType)
    : 'url';
}

export function normalizeDeliveryConfig(raw: unknown): DeliveryConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const links = Array.isArray(o.links)
    ? o.links
        .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null)
        .map((l) => ({
          label: asString(l.label),
          href: asString(l.href),
          description: asString(l.description),
        }))
        .filter((l) => l.label || l.href)
    : [];
  return {
    courseIds: Array.isArray(o.courseIds)
      ? o.courseIds.filter((c): c is string => typeof c === 'string' && c.length > 0)
      : [],
    deliverableSlug: asString(o.deliverableSlug),
    deliverableKey: asString(o.deliverableKey),
    links,
    productKey: asString(o.productKey),
    license: asBool(o.license, false),
    seats: Math.max(1, asNumber(o.seats, 1)),
  };
}

export function rowToAssignment(row: ProductFunnelAssignmentRow): ProductFunnelAssignment {
  return {
    id: row.id,
    productId: row.product_id,
    priceId: row.price_id ?? null,
    funnelSlug: row.funnel_slug,
    step: toAssignmentStep(row.step),
    role: toAssignmentRole(row.role),
    deliveryType: toDeliveryType(row.delivery_type),
    delivery: normalizeDeliveryConfig(row.delivery_config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Flatten a set of assignments into thank-you-page delivery cards. Only rows
 * with something showable (url links, deliverable, course) produce cards;
 * main_app rows surface as "check your email / login" style cards so the
 * thank-you page can still acknowledge them.
 */
export function assignmentsToDeliveryCards(
  assignments: ProductFunnelAssignment[],
  productNames?: Map<string, string>,
): { title: string; description: string; href: string; icon: string }[] {
  const cards: { title: string; description: string; href: string; icon: string }[] = [];
  const nameOf = (a: ProductFunnelAssignment) =>
    productNames?.get(a.productId) || a.productId;
  for (const a of assignments) {
    if (a.deliveryType === 'url') {
      for (const link of a.delivery.links) {
        cards.push({
          title: link.label || nameOf(a),
          description: link.description,
          href: link.href,
          icon: a.role === 'bonus' ? 'gift' : 'check',
        });
      }
    } else if (a.deliveryType === 'deliverable' && a.delivery.deliverableSlug) {
      cards.push({
        title: nameOf(a),
        description: 'Your download is ready.',
        href: `/deliverables/${a.delivery.deliverableSlug}${a.delivery.deliverableKey ? `?key=${a.delivery.deliverableKey}` : ''}`,
        icon: a.role === 'bonus' ? 'gift' : 'check',
      });
    } else if (a.deliveryType === 'course' && a.delivery.courseIds.length > 0) {
      cards.push({
        title: nameOf(a),
        description: 'Added to your library. Open the members area to start.',
        href: '/dashboard',
        icon: a.role === 'bonus' ? 'gift' : 'check',
      });
    } else if (a.deliveryType === 'main_app') {
      cards.push({
        title: nameOf(a),
        description: a.delivery.license
          ? 'Your license key and login are on their way to your inbox.'
          : 'Access details are on their way to your inbox.',
        href: '',
        icon: a.role === 'bonus' ? 'gift' : 'mail',
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Store (service-role only)
// ---------------------------------------------------------------------------

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

export async function listAssignmentsForFunnel(
  funnelSlug: string,
): Promise<ProductFunnelAssignment[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select('*')
      .eq('funnel_slug', funnelSlug)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return (data as ProductFunnelAssignmentRow[]).map(rowToAssignment);
  } catch {
    return [];
  }
}

export async function listAssignmentsForProduct(
  productId: string,
): Promise<ProductFunnelAssignment[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return (data as ProductFunnelAssignmentRow[]).map(rowToAssignment);
  } catch {
    return [];
  }
}

export async function listAllAssignments(): Promise<ProductFunnelAssignment[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return (data as ProductFunnelAssignmentRow[]).map(rowToAssignment);
  } catch {
    return [];
  }
}

/** The `main` assignment for a funnel step, if one exists. */
export async function getMainAssignmentForStep(
  funnelSlug: string,
  step: AssignmentStep,
): Promise<ProductFunnelAssignment | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select('*')
      .eq('funnel_slug', funnelSlug)
      .eq('step', step)
      .eq('role', 'main')
      .maybeSingle();
    if (error || !data) return null;
    return rowToAssignment(data as ProductFunnelAssignmentRow);
  } catch {
    return null;
  }
}

export interface UpsertAssignmentInput {
  id?: string | null;
  productId: string;
  priceId?: string | null;
  funnelSlug: string;
  step: AssignmentStep;
  role: AssignmentRole;
  deliveryType: DeliveryType;
  delivery?: Partial<DeliveryConfig>;
}

export async function upsertAssignment(
  input: UpsertAssignmentInput,
): Promise<ProductFunnelAssignment> {
  const row: Record<string, unknown> = {
    product_id: input.productId,
    price_id: input.priceId || null,
    funnel_slug: input.funnelSlug,
    step: toAssignmentStep(input.step),
    role: toAssignmentRole(input.role),
    delivery_type: toDeliveryType(input.deliveryType),
    delivery_config: normalizeDeliveryConfig(input.delivery ?? {}),
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;

  if (!input.id) {
    // Upsert on the natural key so re-saving a step's main product replaces it.
    const existing = await (serviceClient() as any)
      .from(TABLE)
      .select('id')
      .eq('product_id', input.productId)
      .eq('funnel_slug', input.funnelSlug)
      .eq('step', row.step)
      .eq('role', row.role)
      .maybeSingle();
    if (existing.data) row.id = existing.data.id;
  }

  const { data, error } = await (serviceClient() as any)
    .from(TABLE)
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`upsertAssignment failed: ${error?.message ?? 'no row returned'}`);
  }
  return rowToAssignment(data as ProductFunnelAssignmentRow);
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await (serviceClient() as any).from(TABLE).delete().eq('id', id);
  if (error) throw new Error(`deleteAssignment failed: ${error.message}`);
}
