/**
 * Icon names as data.
 *
 * Offer catalogs are read by Server Components and handed to 'use client'
 * children. A lucide component is a live forwardRef object, which cannot cross
 * that boundary, so catalogs store the *name* and the client registry resolves
 * it. Keep this file free of any lucide-react import.
 *
 * @see src/components/mothermode/parts/iconRegistry.tsx
 */

export const ICON_NAMES = [
  'Activity',
  'Anchor',
  'Backpack',
  'BookOpen',
  'Brain',
  'Briefcase',
  'CalendarHeart',
  'Check',
  'Clock',
  'Code2',
  'Compass',
  'DoorOpen',
  'Download',
  'Eraser',
  'Feather',
  'Filter',
  'Gift',
  'Headphones',
  'Heart',
  'HeartHandshake',
  'InfinityIcon',
  'Layers',
  'LifeBuoy',
  'ListChecks',
  'ListOrdered',
  'Mail',
  'Map',
  'MessageCircle',
  'MessagesSquare',
  'Mic',
  'Moon',
  'Play',
  'RefreshCcw',
  'Repeat',
  'Route',
  'Scissors',
  'ShieldCheck',
  'Sparkles',
  'SplitSquareVertical',
  'Sun',
  'Sunrise',
  'Trash2',
  'UserCheck',
  'Users',
  'Utensils',
  'UtensilsCrossed',
  'Video',
  'Zap',
] as const;

/** A serializable reference to one lucide glyph. */
export type IconName = (typeof ICON_NAMES)[number];

/** Fallback used when a name is missing or unrecognized. */
export const DEFAULT_ICON: IconName = 'Sparkles';

/** Runtime guard for values arriving from the DB or an AI response. */
export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && (ICON_NAMES as readonly string[]).includes(value);
}

/** Coerce anything into a valid IconName. */
export function toIconName(value: unknown): IconName {
  return isIconName(value) ? value : DEFAULT_ICON;
}
