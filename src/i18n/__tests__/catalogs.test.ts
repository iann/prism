/**
 * Catalogue contract tests.
 *
 * The Jest `next-intl` mock always resolves against the English catalogue and
 * its provider is a pass-through (see src/test-utils/nextIntlMock.tsx), so no
 * rendering test can observe a German regression. What CAN be checked cheaply
 * is the contract between the code and the catalogues, which is where drift
 * actually happens: an orphaned German key, or a new provider bucket emitted
 * with no matching English entry. English is intentionally the fallback for
 * keys that have not been localized in German yet.
 */
import en from '@/i18n/messages/en.json';
import de from '@/i18n/messages/de.json';
import { wmoDescriptionKey } from '@/lib/integrations/openmeteo';
import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';

type Dict = Record<string, unknown>;

function flatten(obj: Dict, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value as Dict, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('i18n catalogues', () => {
  it('German has no orphan keys', () => {
    const enKeys = flatten(en as Dict).sort();
    const deKeys = flatten(de as Dict).sort();
    expect(deKeys.filter((k) => !enKeys.includes(k))).toEqual([]); // orphaned
    expect(deKeys).not.toContain('weather.summary.conditions.withBreezy');
    expect(deKeys).not.toContain('weather.summary.turningBreezy');
  });

  it('has no empty translations', () => {
    const empties: string[] = [];
    const walk = (obj: Dict, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object') walk(value as Dict, `${prefix}${key}.`);
        else if (typeof value !== 'string' || value.trim() === '') empties.push(`${prefix}${key}`);
      }
    };
    walk(de as Dict);
    expect(empties).toEqual([]);
  });
});

describe('weather condition keys', () => {
  // Every WMO code the provider can see, including the buckets' edges and the
  // gaps between them that fall through to the default.
  const codes = [0, 1, 2, 3, 45, 48, 51, 55, 61, 65, 71, 75, 80, 82, 85, 86, 95, 99, 56, 66, 77, 4];

  it('every key the provider emits exists in both catalogues', () => {
    const conditions = (locale: Dict) =>
      ((locale.weather as Dict | undefined)?.conditions ?? {}) as Dict;
    for (const code of codes) {
      const key = wmoDescriptionKey(code);
      expect(Object.keys(conditions(en as Dict))).toContain(key);
      expect(Object.keys(conditions(de as Dict))).toContain(key);
    }
  });
});

describe('weekday tokens', () => {
  // WeatherWidget.localizeDayName maps these provider tokens back to an index
  // before localising. If the shape changes, day labels silently stay English.
  it('are the seven short English names the providers emit', () => {
    expect([...DAYS_SHORT_ARRAY]).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});
