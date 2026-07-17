/** @jest-environment jsdom */

import { APP_THEME_IDS, appThemes, applyAppTheme, isAppThemeId } from '../appThemes';

describe('app themes', () => {
  it('defines the same complete token contract for every variant', () => {
    const expected = Object.keys(appThemes.prism.light).sort();

    for (const id of APP_THEME_IDS) {
      expect(Object.keys(appThemes[id].light).sort()).toEqual(expected);
      expect(Object.keys(appThemes[id].dark).sort()).toEqual(expected);
    }
  });

  it('recognizes only registered theme identifiers', () => {
    expect(isAppThemeId('kitchen-calm')).toBe(true);
    expect(isAppThemeId('unknown')).toBe(false);
    expect(isAppThemeId(null)).toBe(false);
  });

  it('applies a preset to the document root', () => {
    applyAppTheme('kitchen-calm', 'light');

    expect(document.documentElement.dataset.colorTheme).toBe('kitchen-calm');
    expect(document.documentElement.style.getPropertyValue('--background')).toBe(
      appThemes['kitchen-calm'].light['--background']
    );
    expect(document.documentElement.style.getPropertyValue('--widget-calendar')).toBe(
      appThemes['kitchen-calm'].light['--widget-calendar']
    );
  });

  it('keeps core text and surface pairs above WCAG AA contrast', () => {
    for (const id of APP_THEME_IDS) {
      for (const variant of ['light', 'dark'] as const) {
        const tokens = appThemes[id][variant];
        expect(contrast(token(tokens, '--foreground'), token(tokens, '--background'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token(tokens, '--card-foreground'), token(tokens, '--card'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token(tokens, '--primary-foreground'), token(tokens, '--primary'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token(tokens, '--secondary-foreground'), token(tokens, '--secondary'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token(tokens, '--accent-foreground'), token(tokens, '--accent'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token(tokens, '--destructive-foreground'), token(tokens, '--destructive'))).toBeGreaterThanOrEqual(4.5);

        for (const surface of [
          '--background',
          '--card',
          '--widget-calendar',
          '--widget-planning',
          '--widget-family',
          '--widget-info',
        ] as const) {
          assertContrast(`${id}/${variant} muted on ${surface}`, token(tokens, '--muted-foreground'), token(tokens, surface), 4.5);
          assertContrast(`${id}/${variant} destructive on ${surface}`, token(tokens, '--destructive'), token(tokens, surface), 4.5);
        }

        for (const surface of ['--background', '--card'] as const) {
          assertContrast(`${id}/${variant} input on ${surface}`, token(tokens, '--input'), token(tokens, surface), 3);
          assertContrast(`${id}/${variant} ring on ${surface}`, token(tokens, '--ring'), token(tokens, surface), 3);
        }
      }
    }
  });
});

function token(tokens: Record<`--${string}`, string>, name: `--${string}`): string {
  const value = tokens[name];
  if (!value) throw new Error(`Missing theme token: ${name}`);
  return value;
}

function assertContrast(label: string, foreground: string, background: string, minimum: number) {
  const measured = contrast(foreground, background);
  if (measured < minimum) throw new Error(`${label}: ${measured.toFixed(2)} is below ${minimum}:1`);
}

function contrast(foreground: string, background: string) {
  const [foregroundLuminance, backgroundLuminance] = [foreground, background]
    .map(hslToRgb)
    .map(relativeLuminance)
    .sort((a, b) => b - a);
  return (foregroundLuminance! + 0.05) / (backgroundLuminance! + 0.05);
}

function hslToRgb(value: string): [number, number, number] {
  const [hue, saturationPercent, lightnessPercent] = value.split(/\s+/).map(parseFloat);
  const saturation = saturationPercent! / 100;
  const lightness = lightnessPercent! / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue! / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] =
    segment < 1 ? [chroma, secondary, 0] :
    segment < 2 ? [secondary, chroma, 0] :
    segment < 3 ? [0, chroma, secondary] :
    segment < 4 ? [0, secondary, chroma] :
    segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  const match = lightness - chroma / 2;
  return [red + match, green + match, blue + match];
}

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const linearize = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}
