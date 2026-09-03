import {
  ALL_NAV_ITEMS,
  ALWAYS_VISIBLE_HREFS,
  DEFAULT_PORTRAIT_NAV_HREFS,
  filterPortraitNavItems,
  normalizePortraitNavHrefs,
} from '../navItems';

describe('portrait navigation preferences', () => {
  it('starts with a compact set of commonly used routes', () => {
    const selected = normalizePortraitNavHrefs(undefined);

    expect(selected).toEqual([...DEFAULT_PORTRAIT_NAV_HREFS]);
    expect(selected).toHaveLength(6);
    expect(ALWAYS_VISIBLE_HREFS.has('/')).toBe(true);
    expect(ALWAYS_VISIBLE_HREFS.has('/settings')).toBe(true);
  });

  it('normalizes saved selections to unique selectable routes', () => {
    expect(
      normalizePortraitNavHrefs(['/tasks', '/tasks', '/', '/settings', '/not-a-route', 42])
    ).toEqual(['/tasks']);
  });

  it('keeps Dashboard and Settings while applying both visibility settings', () => {
    const items = filterPortraitNavItems(
      ALL_NAV_ITEMS,
      ['/tasks', '/recipes'],
      ['/recipes', '/tasks']
    );

    expect(items.map((item) => item.href)).toEqual(['/', '/settings']);
  });
});
