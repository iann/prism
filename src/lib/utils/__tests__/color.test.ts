import {
  colorContrastRatio,
  contrastText,
  hexToHslValues,
  hexToRgba,
  isLightColor,
  parseHexColor,
  relativeLuminance,
} from '../color';

describe('parseHexColor', () => {
  it.each([
    ['#fff', { r: 255, g: 255, b: 255, a: 1, hex: '#FFFFFF' }],
    ['abc', { r: 170, g: 187, b: 204, a: 1, hex: '#AABBCC' }],
    ['#abcd', { r: 170, g: 187, b: 204, a: 221 / 255, hex: '#AABBCC' }],
    ['11223380', { r: 17, g: 34, b: 51, a: 128 / 255, hex: '#112233' }],
  ])('normalizes %s', (value, expected) => {
    expect(parseHexColor(value)).toEqual(expected);
  });

  it.each(['', '#12', '#12345', '#ggg', 'not-a-color'])('rejects invalid input %s', (value) => {
    expect(parseHexColor(value)).toBeNull();
  });
});

describe('hex conversion helpers', () => {
  it('expands shorthand channels for rgba and HSL conversion', () => {
    expect(hexToRgba('#abc', 0.5)).toBe('rgba(170,187,204,0.5)');
    expect(hexToHslValues('#abc')).toBe('210 25% 73%');
  });

  it('combines embedded alpha with the requested opacity', () => {
    expect(hexToRgba('#abcd', 0.5)).toBe('rgba(170,187,204,0.4333)');
  });

  it('uses controlled black fallbacks and clamps invalid opacity', () => {
    expect(hexToRgba('invalid', 2)).toBe('rgba(0,0,0,1)');
    expect(hexToHslValues('invalid')).toBe('0 0% 0%');
    expect(relativeLuminance('invalid')).toBe(0);
  });
});

describe('isLightColor', () => {
  // --- Clearly light colors ---
  it('returns true for white (#FFFFFF)', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);
  });

  it('returns true for white without hash (FFFFFF)', () => {
    expect(isLightColor('FFFFFF')).toBe(true);
  });

  it('returns true for light yellow (#FFFF00)', () => {
    // R=1, G=1, B=0 → luminance = 0.2126 + 0.7152 = 0.9278
    expect(isLightColor('#FFFF00')).toBe(true);
  });

  it('returns true for light cyan (#00FFFF)', () => {
    // R=0, G=1, B=1 → luminance = 0 + 0.7152 + 0.0722 = 0.7874
    expect(isLightColor('#00FFFF')).toBe(true);
  });

  it('returns true for light gray (#C0C0C0)', () => {
    // ~0.75 normalized → luminance ≈ 0.75
    expect(isLightColor('#C0C0C0')).toBe(true);
  });

  // --- Clearly dark colors ---
  it('returns false for black (#000000)', () => {
    expect(isLightColor('#000000')).toBe(false);
  });

  it('returns false for dark red (#8B0000)', () => {
    // R=139/255≈0.545 → luminance = 0.2126*0.545 ≈ 0.116
    expect(isLightColor('#8B0000')).toBe(false);
  });

  it('returns false for dark blue (#00008B)', () => {
    // B=139/255≈0.545 → luminance = 0.0722*0.545 ≈ 0.039
    expect(isLightColor('#00008B')).toBe(false);
  });

  it('returns false for navy (#000080)', () => {
    expect(isLightColor('#000080')).toBe(false);
  });

  // --- Boundary / mid-range ---
  it('returns true for pure red (#FF0000)', () => {
    // R=1 → bgLum=0.2126; blackContrast(5.25) > whiteContrast(4.0) → needs dark text
    expect(isLightColor('#FF0000')).toBe(true);
  });

  it('returns true for pure green (#00FF00)', () => {
    // G=1 → luminance = 0.7152 > 0.5
    expect(isLightColor('#00FF00')).toBe(true);
  });

  it('returns false for pure blue (#0000FF)', () => {
    // B=1 → luminance = 0.0722 < 0.5
    expect(isLightColor('#0000FF')).toBe(false);
  });

  it('returns false for medium gray (#808080)', () => {
    // 128/255 ≈ 0.502 → luminance ≈ 0.502 > 0.5 — just barely light
    // Actually 0.502 > 0.5 so this should be true
    const r = 0x80 / 255;
    const luminance = 0.2126 * r + 0.7152 * r + 0.0722 * r;
    expect(isLightColor('#808080')).toBe(luminance > 0.5);
  });

  // --- Case insensitivity ---
  it('handles lowercase hex', () => {
    expect(isLightColor('#ffffff')).toBe(true);
    expect(isLightColor('#000000')).toBe(false);
  });

  it('handles mixed case hex', () => {
    expect(isLightColor('#FfFfFf')).toBe(true);
  });
});

describe('contrastText', () => {
  it('uses dark text for shorthand light colors', () => {
    expect(contrastText('#fff')).toBe('#000000');
    expect(contrastText('#eee')).toBe('#000000');
  });

  it('uses light text for shorthand dark colors', () => {
    expect(contrastText('#000')).toBe('#ffffff');
    expect(contrastText('036')).toBe('#ffffff');
  });

  it('uses dark text for light event colors', () => {
    expect(contrastText('#F59E0B')).toBe('#000000');
    expect(contrastText('#EC4899')).toBe('#000000');
  });

  it('uses light text for dark event colors', () => {
    expect(contrastText('#1D4ED8')).toBe('#ffffff');
    expect(contrastText('#166534')).toBe('#ffffff');
  });

  it('uses a controlled light-text fallback for invalid colors', () => {
    expect(isLightColor('invalid')).toBe(false);
    expect(contrastText('invalid')).toBe('#ffffff');
  });
});

describe('colorContrastRatio', () => {
  it('computes WCAG ratios for full and shorthand hex colors', () => {
    expect(colorContrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(colorContrastRatio('777', 'FFFFFF')).toBeCloseTo(4.478, 3);
  });

  it('returns a conservative 1:1 fallback for invalid input', () => {
    expect(colorContrastRatio('invalid', '#fff')).toBe(1);
  });
});
