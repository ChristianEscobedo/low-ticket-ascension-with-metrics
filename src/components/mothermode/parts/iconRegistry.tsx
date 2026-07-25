/**
 * Name -> lucide component registry.
 *
 * The single place where an icon *name* becomes an icon *component*. Importable
 * from server and client files alike; what matters is that the component itself
 * never travels inside serialized props.
 *
 * @see src/lib/mothermode/icons.ts
 */
import {
  Activity,
  Anchor,
  Backpack,
  BookOpen,
  Brain,
  Briefcase,
  CalendarHeart,
  Check,
  Clock,
  Code2,
  Compass,
  DoorOpen,
  Download,
  Eraser,
  Feather,
  Filter,
  Gift,
  Headphones,
  Heart,
  HeartHandshake,
  Layers,
  LifeBuoy,
  ListChecks,
  ListOrdered,
  Mail,
  Map,
  MessageCircle,
  MessagesSquare,
  Mic,
  Moon,
  Play,
  RefreshCcw,
  Repeat,
  Route,
  Scissors,
  ShieldCheck,
  Sparkles,
  SplitSquareVertical,
  Sun,
  Sunrise,
  Trash2,
  UserCheck,
  Users,
  Utensils,
  UtensilsCrossed,
  Video,
  Zap,
  Infinity as InfinityIcon,
  type LucideIcon,
} from 'lucide-react';
import { DEFAULT_ICON, type IconName } from '@/lib/mothermode/icons';

const REGISTRY: Record<IconName, LucideIcon> = {
  Activity,
  Anchor,
  Backpack,
  BookOpen,
  Brain,
  Briefcase,
  CalendarHeart,
  Check,
  Clock,
  Code2,
  Compass,
  DoorOpen,
  Download,
  Eraser,
  Feather,
  Filter,
  Gift,
  Headphones,
  Heart,
  HeartHandshake,
  InfinityIcon,
  Layers,
  LifeBuoy,
  ListChecks,
  ListOrdered,
  Mail,
  Map,
  MessageCircle,
  MessagesSquare,
  Mic,
  Moon,
  Play,
  RefreshCcw,
  Repeat,
  Route,
  Scissors,
  ShieldCheck,
  Sparkles,
  SplitSquareVertical,
  Sun,
  Sunrise,
  Trash2,
  UserCheck,
  Users,
  Utensils,
  UtensilsCrossed,
  Video,
  Zap,
};

/**
 * Resolve a stored name to a renderable component. Unknown or missing names
 * fall back to the default glyph rather than throwing, so a bad value from the
 * DB degrades to a placeholder instead of taking down the page.
 */
export function iconFor(name: string | undefined | null): LucideIcon {
  if (name && name in REGISTRY) return REGISTRY[name as IconName];
  return REGISTRY[DEFAULT_ICON];
}

/** Convenience wrapper: <Icon name={item.icon} className="h-5 w-5" /> */
export function Icon({
  name,
  className,
}: {
  name: string | undefined | null;
  className?: string;
}) {
  const Glyph = iconFor(name);
  return <Glyph className={className} />;
}
