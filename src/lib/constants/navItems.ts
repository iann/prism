import {
  Home,
  Calendar,
  CheckSquare,
  ListChecks,
  Trophy,
  ShoppingCart,
  UtensilsCrossed,
  ChefHat,
  MessageSquare,
  ImageIcon,
  Gift,
  Baby,
  Globe,
  Trees,
  Settings,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** All navigation items in canonical order. */
export const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Chores', href: '/chores', icon: ListChecks },
  { label: 'Goals', href: '/goals', icon: Trophy },
  { label: 'Shopping', href: '/shopping', icon: ShoppingCart },
  { label: 'Meals', href: '/meals', icon: UtensilsCrossed },
  { label: 'Recipes', href: '/recipes', icon: ChefHat },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Photos', href: '/photos', icon: ImageIcon },
  { label: 'Wishes', href: '/wishes', icon: Gift },
  { label: 'Babysitter', href: '/babysitter', icon: Baby },
  { label: 'Travel', href: '/travel', icon: Globe },
  { label: 'Weekend', href: '/weekend', icon: Trees },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/** Pages that can never be hidden. */
export const ALWAYS_VISIBLE_HREFS = new Set(['/', '/settings']);

/** Pages that are hideable (for the Features settings UI). */
export const HIDEABLE_NAV_ITEMS = ALL_NAV_ITEMS.filter(
  (item) => !ALWAYS_VISIBLE_HREFS.has(item.href)
);

/** Setting key used for the route subset shown in the portrait bottom bar. */
export const PORTRAIT_NAV_PAGES_SETTING_KEY = 'portraitNavPages';

/**
 * The compact default for portrait displays. Dashboard and Settings are
 * always included separately, so this keeps the first-run bar to eight
 * buttons including the account action.
 */
export const DEFAULT_PORTRAIT_NAV_HREFS = [
  '/calendar',
  '/tasks',
  '/chores',
  '/shopping',
  '/meals',
  '/messages',
] as const;

const HIDEABLE_NAV_HREFS = new Set(HIDEABLE_NAV_ITEMS.map((item) => item.href));

/** Normalize stored portrait-nav values and discard routes that are not selectable. */
export function normalizePortraitNavHrefs(value: unknown): string[] {
  const source = Array.isArray(value) ? value : DEFAULT_PORTRAIT_NAV_HREFS;

  return Array.from(
    new Set(
      source.filter(
        (href): href is string => typeof href === 'string' && HIDEABLE_NAV_HREFS.has(href)
      )
    )
  );
}

/**
 * Filter the canonical nav list for the portrait bottom bar. Always-visible
 * routes remain available, while the global hidden-page setting still wins
 * for selectable routes.
 */
export function filterPortraitNavItems(
  items: NavItem[],
  selectedHrefs: Iterable<string>,
  hiddenHrefs: Iterable<string> = []
): NavItem[] {
  const selected = new Set(selectedHrefs);
  const hidden = new Set(hiddenHrefs);

  return items.filter((item) => {
    const alwaysVisible = ALWAYS_VISIBLE_HREFS.has(item.href);
    return (alwaysVisible || selected.has(item.href)) && (alwaysVisible || !hidden.has(item.href));
  });
}
