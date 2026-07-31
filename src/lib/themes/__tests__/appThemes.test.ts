/** @jest-environment jsdom */

import { APP_THEME_IDS, appThemes, applyAppTheme, isAppThemeId } from '../appThemes';
import { BUS_STATUS_COLORS, getBusStatusColorClass } from '@/components/widgets/busStatusColors';

const STANDARD_THEME_IDS = APP_THEME_IDS.filter((id) => id !== 'lcars');
const SURFACES = [
  '--background',
  '--card',
  '--widget-calendar',
  '--widget-planning',
  '--widget-family',
  '--widget-info',
] as const;
const BOUNDED_SURFACES = SURFACES.filter((surface) => surface !== '--background');
let contrastViolations: string[] = [];

describe('app themes', () => {
  beforeEach(() => {
    contrastViolations = [];
  });

  afterEach(() => {
    if (contrastViolations.length > 0) {
      throw new Error(contrastViolations.join('\n'));
    }
  });

  it('defines the same complete token contract for every variant', () => {
    const expected = Object.keys(appThemes.prism.light).sort();

    for (const id of APP_THEME_IDS) {
      expect(Object.keys(appThemes[id].light).sort()).toEqual(expected);
      expect(Object.keys(appThemes[id].dark).sort()).toEqual(expected);
      expect(Object.keys(appThemes[id].light).sort()).toEqual(
        Object.keys(appThemes[id].dark).sort()
      );
    }
  });

  it('keeps LCARS brightness-independent', () => {
    expect(appThemes.lcars.light).toEqual(appThemes.lcars.dark);
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

  it('gives every standard light card and widget an opaque visible surface', () => {
    for (const id of STANDARD_THEME_IDS) {
      const tokens = appThemes[id].light;
      const background = opaqueSurface(tokens, '--background');

      for (const surface of BOUNDED_SURFACES) {
        assertContrast(
          `${id}/light ${surface} against background`,
          opaqueSurface(tokens, surface),
          background,
          1.2
        );
      }
    }
  });

  it('keeps boundaries and text legible on every actual opaque surface', () => {
    const variants = [
      ...STANDARD_THEME_IDS.map((id) => ({ id, variant: 'light' as const })),
      { id: 'lcars' as const, variant: 'light' as const },
      { id: 'lcars' as const, variant: 'dark' as const },
    ];

    for (const { id, variant } of variants) {
      const tokens = appThemes[id][variant];
      const background = opaqueSurface(tokens, '--background');

      for (const surface of SURFACES) {
        const actualSurface = composite(parseHsl(token(tokens, surface)), background, 1);
        assertContrast(
          `${id}/${variant} foreground on ${surface}`,
          parseHsl(token(tokens, '--foreground')),
          actualSurface,
          4.5
        );
        assertContrast(
          `${id}/${variant} muted on ${surface}`,
          parseHsl(token(tokens, '--muted-foreground')),
          actualSurface,
          4.5
        );
        assertContrast(
          `${id}/${variant} destructive on ${surface}`,
          parseHsl(token(tokens, '--destructive')),
          actualSurface,
          4.5
        );
        assertContrast(
          `${id}/${variant} input on ${surface}`,
          parseHsl(token(tokens, '--input')),
          actualSurface,
          3
        );
        assertContrast(
          `${id}/${variant} ring on ${surface}`,
          parseHsl(token(tokens, '--ring')),
          actualSurface,
          3
        );
      }

      for (const surface of BOUNDED_SURFACES) {
        assertContrast(
          `${id}/${variant} border on ${surface}`,
          parseHsl(token(tokens, '--border')),
          opaqueSurface(tokens, surface),
          3
        );
      }
    }
  });

  it('keeps bus status dots visible on every standard light widget surface', () => {
    for (const id of STANDARD_THEME_IDS) {
      const tokens = appThemes[id].light;

      for (const [status, color] of Object.entries(BUS_STATUS_COLORS)) {
        assertContrast(
          `${id}/light ${status} bus status on widget info`,
          parseHex(color.lightHex),
          opaqueSurface(tokens, '--widget-info'),
          3
        );
      }
    }

    expect(getBusStatusColorClass('at_stop')).toBe(BUS_STATUS_COLORS.arrived.className);
    expect(getBusStatusColorClass('in_transit')).toBe(BUS_STATUS_COLORS.inTransit.className);
    expect(getBusStatusColorClass('overdue')).toBe(BUS_STATUS_COLORS.overdue.className);
  });

  it('keeps every semantic text pair above WCAG AA in both variants', () => {
    for (const id of APP_THEME_IDS) {
      for (const variant of ['light', 'dark'] as const) {
        const tokens = appThemes[id][variant];
        assertTokenPair(tokens, id, variant, '--foreground', '--background', 4.5);
        assertTokenPair(tokens, id, variant, '--card-foreground', '--card', 4.5);
        assertTokenPair(tokens, id, variant, '--primary-foreground', '--primary', 4.5);
        assertTokenPair(tokens, id, variant, '--secondary-foreground', '--secondary', 4.5);
        assertTokenPair(tokens, id, variant, '--accent-foreground', '--accent', 4.5);
        assertTokenPair(tokens, id, variant, '--destructive-foreground', '--destructive', 4.5);
      }
    }
  });
});

function token(tokens: Record<`--${string}`, string>, name: `--${string}`): string {
  const value = tokens[name];
  if (!value) throw new Error(`Missing theme token: ${name}`);
  return value;
}

function opaqueSurface(tokens: Record<`--${string}`, string>, name: `--${string}`): Rgb {
  return composite(parseHsl(token(tokens, name)), [0, 0, 0], 1);
}

function assertTokenPair(
  tokens: Record<`--${string}`, string>,
  id: string,
  variant: string,
  foreground: `--${string}`,
  background: `--${string}`,
  minimum: number
) {
  assertContrast(
    `${id}/${variant} ${foreground} on ${background}`,
    parseHsl(token(tokens, foreground)),
    parseHsl(token(tokens, background)),
    minimum
  );
}

function assertContrast(label: string, foreground: Rgb, background: Rgb, minimum: number) {
  const measured = contrast(foreground, background);
  if (measured < minimum) {
    contrastViolations.push(`${label}: ${measured.toFixed(2)} is below ${minimum}:1`);
  }
}

type Rgb = [number, number, number];

function contrast(foreground: Rgb, background: Rgb) {
  const [foregroundLuminance, backgroundLuminance] = [foreground, background]
    .map(relativeLuminance)
    .sort((a, b) => b - a);
  return (foregroundLuminance! + 0.05) / (backgroundLuminance! + 0.05);
}

function parseHsl(value: string): Rgb {
  const [hue, saturationPercent, lightnessPercent] = value.split(/\s+/).map(parseFloat);
  const saturation = saturationPercent! / 100;
  const lightness = lightnessPercent! / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue! / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] =
    segment < 1
      ? [chroma, secondary, 0]
      : segment < 2
        ? [secondary, chroma, 0]
        : segment < 3
          ? [0, chroma, secondary]
          : segment < 4
            ? [0, secondary, chroma]
            : segment < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const match = lightness - chroma / 2;
  return [red + match, green + match, blue + match];
}

function parseHex(value: string): Rgb {
  const channels = value
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) {
    throw new Error(`Invalid hex color: ${value}`);
  }
  return channels as Rgb;
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map(
    (channel, index) => channel * alpha + background[index]! * (1 - alpha)
  ) as Rgb;
}

function relativeLuminance([red, green, blue]: Rgb) {
  const linearize = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}
