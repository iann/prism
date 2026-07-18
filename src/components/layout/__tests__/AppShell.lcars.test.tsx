/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { AppShell } from '../AppShell';

const mockUseAutoHideUI = jest.fn();

jest.mock('@/lib/hooks/useAutoHideUI', () => ({
  useAutoHideUI: () => mockUseAutoHideUI(),
}));

jest.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({ colorTheme: 'lcars' }),
}));

jest.mock('@/lib/hooks/useOrientation', () => ({
  useOrientation: () => 'landscape',
}));

jest.mock('@/lib/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

jest.mock('@/lib/hooks/useInactivityRedirect', () => ({
  useInactivityRedirect: () => undefined,
}));

jest.mock('../SideNav', () => ({ SideNav: () => null }));
jest.mock('../MobileFab', () => ({ MobileFab: () => null }));
jest.mock('../PortraitNav', () => ({ PortraitNav: () => null }));
jest.mock('../WallpaperBackground', () => ({ WallpaperBackground: () => null }));

jest.mock('@/components/lcars', () => ({
  LCARSNavigation: ({ hidden }: { hidden?: boolean }) => (
    <div data-testid="lcars-navigation" data-hidden={hidden || undefined} />
  ),
  LCARSStatusBar: ({ hidden }: { hidden?: boolean }) => (
    <div data-testid="lcars-status-bar" data-hidden={hidden || undefined} />
  ),
  LCARSStatusFooter: ({ hidden }: { hidden?: boolean }) => (
    <div data-testid="lcars-status-footer" data-hidden={hidden || undefined} />
  ),
}));

describe('AppShell LCARS auto-hide', () => {
  it('publishes one authoritative hidden state for the full LCARS shell', () => {
    mockUseAutoHideUI.mockReturnValue({ uiHidden: true });

    const { container } = render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    expect(container.firstElementChild?.getAttribute('data-chrome-hidden')).toBe('true');
    expect(screen.getByTestId('lcars-navigation').getAttribute('data-hidden')).toBe('true');
    expect(screen.getByTestId('lcars-status-bar').getAttribute('data-hidden')).toBe('true');
    expect(screen.getByTestId('lcars-status-footer').getAttribute('data-hidden')).toBe('true');
  });

  it('leaves the shell chrome visible while the timer is active', () => {
    mockUseAutoHideUI.mockReturnValue({ uiHidden: false });

    const { container } = render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    expect(container.firstElementChild?.hasAttribute('data-chrome-hidden')).toBe(false);
    expect(screen.getByTestId('lcars-navigation').hasAttribute('data-hidden')).toBe(false);
  });
});
