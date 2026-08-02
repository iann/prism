/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';
import {
  WidgetBgOverrideProvider,
  WidgetContainer,
  type WidgetBgOverrideValue,
} from '../WidgetContainer';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

function renderWidget(override?: WidgetBgOverrideValue) {
  const widget = (
    <WidgetContainer title="Calendar">
      <span>Calendar body</span>
    </WidgetContainer>
  );
  const result = render(
    override ? (
      <WidgetBgOverrideProvider value={override}>{widget}</WidgetBgOverrideProvider>
    ) : (
      widget
    )
  );
  return result.container.querySelector<HTMLElement>('[data-widget="Calendar"]')!;
}

describe('WidgetContainer theme overrides', () => {
  it('keeps the shared preset card boundary, radius, and shadow', () => {
    const card = renderWidget();

    expect(card.dataset.themeSurface).toBe('preset');
    expect(card.classList.contains('border-border')).toBe(true);
    expect(card.classList.contains('rounded-xl')).toBe(true);
    expect(card.classList.contains('shadow-sm')).toBe(true);
    expect(card.classList.contains('border-transparent')).toBe(false);
  });

  it('strips duplicate Card chrome and derives soft boundaries for a solid shell', () => {
    const card = renderWidget({
      hasCustomBg: true,
      hasCustomShell: true,
      backgroundColor: '#F7F3E8',
      textColor: '#000000',
    });

    expect(card.dataset.themeSurface).toBe('custom');
    expect(card.classList.contains('border-transparent')).toBe(true);
    expect(card.classList.contains('shadow-none')).toBe(true);
    expect(card.style.backgroundColor).toBe('transparent');
    expect(card.style.color).toBe('rgb(0, 0, 0)');
    expect(card.style.getPropertyValue('--border')).toBe('45 3% 52%');
    expect(card.style.getPropertyValue('--input')).toBe('45 3% 47%');
    expect(card.style.getPropertyValue('--calendar-surface')).toBe('44 48% 94%');
    expect(card.style.getPropertyValue('--calendar-today')).toBe('46 15% 83%');
  });

  it('honors grid-line opacity without restoring full-strength text borders', () => {
    const card = renderWidget({
      hasCustomBg: true,
      hasCustomShell: true,
      backgroundColor: '#F7F3E8',
      textColor: '#000000',
      gridLineOpacity: 0.5,
    });

    expect(card.style.getPropertyValue('--border')).toBe('44 8% 73%');
    expect(card.style.getPropertyValue('--input')).toBe('44 7% 70%');
  });

  it.each(['transparent', 'frosted'])(
    'leaves theme boundary tokens intact for a %s override',
    (backgroundColor) => {
      const card = renderWidget({
        hasCustomBg: true,
        hasCustomShell: true,
        backgroundColor,
        textColor: '#FFFFFF',
      });

      expect(card.style.getPropertyValue('--border')).toBe('');
      expect(card.style.getPropertyValue('--input')).toBe('');
      expect(card.style.backgroundColor).toBe('transparent');
    }
  );

  it('leaves theme boundary tokens intact for a translucent solid color', () => {
    const card = renderWidget({
      hasCustomBg: true,
      hasCustomShell: true,
      backgroundColor: '#FFFFFF',
      backgroundOpacity: 0.5,
      textColor: '#FFFFFF',
    });

    expect(card.style.getPropertyValue('--border')).toBe('');
    expect(card.style.getPropertyValue('--input')).toBe('');
  });

  it('preserves the preset surface when only the outline is customized', () => {
    const card = renderWidget({ hasCustomBg: false, hasCustomShell: true });

    expect(card.dataset.themeSurface).toBe('preset');
    expect(card.classList.contains('border-transparent')).toBe(true);
    expect(card.classList.contains('shadow-none')).toBe(true);
    expect(card.style.backgroundColor).toBe('');
  });

  it('keeps a white text-only override off light preset and calendar surfaces', () => {
    const card = renderWidget({
      hasCustomBg: false,
      hasCustomShell: false,
      textColor: '#FFFFFF',
    });

    expect(card.dataset.themeSurface).toBe('custom');
    expect(card.style.backgroundColor).toBe('rgba(0, 0, 0, 0.55)');
    expect(card.style.getPropertyValue('--card')).toBe('0 0% 0%');
    expect(card.style.getPropertyValue('--calendar-surface')).toBe('0 0% 0% / 0.55');
    expect(card.style.getPropertyValue('--calendar-today')).toBe('0 0% 0% / 0.72');
  });
});
