'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';
import { ALWAYS_VISIBLE_HREFS, HIDEABLE_NAV_ITEMS } from '@/lib/constants/navItems';
import { DEFAULT_DOCK_HREFS, DOCK_SIZE } from '@/lib/constants/dock';

export function FeaturesSection() {
  const {
    hiddenPages,
    portraitNavPages,
    loaded,
    setHiddenPages,
    setPortraitNavPages,
    dockPages,
    setDockPages,
  } = useHiddenPages();

  // The dock's pages (#925): Home is always on it; up to five more. A page
  // that is switched off stays in the list, so it comes back when switched on,
  // but it does not take one of the places (#1173).
  const onDock = dockPages ?? [...DEFAULT_DOCK_HREFS];
  const placesTaken = onDock.filter((h) => h === '/' || !hiddenPages.includes(h)).length;
  const dockFull = placesTaken >= DOCK_SIZE;
  const toggleDock = (href: string) => {
    if (onDock.includes(href)) setDockPages(onDock.filter((h) => h !== href));
    else if (!dockFull) setDockPages([...onDock, href]);
  };

  const togglePage = (href: string) => {
    const isCurrentlyHidden = hiddenPages.includes(href);
    if (isCurrentlyHidden) {
      setHiddenPages(hiddenPages.filter((h) => h !== href));
      // Its place was given away while it was off; it comes back in More.
      if (dockFull && onDock.includes(href)) setDockPages(onDock.filter((h) => h !== href));
    } else {
      setHiddenPages([...hiddenPages, href]);
    }
  };

  const togglePortraitPage = (href: string) => {
    const isCurrentlySelected = portraitNavPages.includes(href);
    if (isCurrentlySelected) {
      setPortraitNavPages(portraitNavPages.filter((page) => page !== href));
    } else {
      setPortraitNavPages([...portraitNavPages, href]);
    }
  };

  const portraitVisibleCount =
    portraitNavPages.filter((href) => !hiddenPages.includes(href)).length +
    ALWAYS_VISIBLE_HREFS.size;

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Features</h2>
        <p className="text-muted-foreground">
          Choose which pages appear in the navigation. Hidden pages are removed
          from all menus but can still be reached by URL.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Navigation Pages</CardTitle>
          <CardDescription>
            Toggle pages on or off. Dashboard and Settings are always visible.
            The dock holds Home and up to five pages you tick; the rest are one
            tap away in More.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {HIDEABLE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isEnabled = !hiddenPages.includes(item.href);
            return (
              <div key={item.href} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  {item.href !== '/settings' && (
                    <label className="flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={isEnabled && onDock.includes(item.href)}
                        disabled={!isEnabled || (!onDock.includes(item.href) && dockFull)}
                        onChange={() => toggleDock(item.href)}
                        data-dock-choice={item.href}
                      />
                      On the dock
                    </label>
                  )}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => togglePage(item.href)}
                    className="data-[state=checked]:bg-blue-500"
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portrait bottom navigation</CardTitle>
          <CardDescription>
            Choose which routes appear in the bottom bar on portrait displays.
            Dashboard and Settings are always included; this does not change the
            landscape side navigation. Routes hidden above are omitted here too.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Showing {portraitVisibleCount} routes plus the account button.
          </p>
          {HIDEABLE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isGloballyHidden = hiddenPages.includes(item.href);
            const isEnabled = portraitNavPages.includes(item.href) && !isGloballyHidden;
            return (
              <div key={item.href} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => togglePortraitPage(item.href)}
                  disabled={isGloballyHidden}
                  aria-label={`${item.label} in portrait bottom navigation`}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
