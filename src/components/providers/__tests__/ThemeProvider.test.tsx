/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { applyAppTheme } from '@/lib/themes/appThemes';

jest.mock('@/lib/hooks/useSeasonalTheme', () => ({
  useSeasonalTheme: jest.fn(),
}));
jest.mock('@/lib/hooks/usePerformanceMode', () => ({
  usePerformanceMode: jest.fn(),
}));
jest.mock('@/lib/themes/appThemes', () => {
  const actual = jest.requireActual('@/lib/themes/appThemes');
  return {
    ...actual,
    applyAppTheme: jest.fn(actual.applyAppTheme),
  };
});

const mockApplyAppTheme = applyAppTheme as jest.MockedFunction<typeof applyAppTheme>;
const mediaQueryListeners = new Set<(event: MediaQueryListEvent) => void>();
let prefersDark = false;

function ThemeProbe() {
  const { theme, resolvedTheme, colorTheme, setColorTheme } = useTheme();

  return (
    <>
      <output data-testid="theme">{theme}</output>
      <output data-testid="resolved-theme">{resolvedTheme}</output>
      <output data-testid="color-theme">{colorTheme}</output>
      <button type="button" onClick={() => setColorTheme('lcars')}>
        Use LCARS
      </button>
      <button type="button" onClick={() => setColorTheme('kitchen-calm')}>
        Use Kitchen Calm
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>
  );
}

function dispatchSystemThemeChange(matches: boolean) {
  prefersDark = matches;
  const event = { matches } as MediaQueryListEvent;
  for (const listener of mediaQueryListeners) listener(event);
}

describe('ThemeProvider LCARS behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-color-theme');
    mediaQueryListeners.clear();
    prefersDark = false;
    mockApplyAppTheme.mockClear();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        get matches() {
          return prefersDark;
        },
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: (event: string, listener: (event: MediaQueryListEvent) => void) => {
          if (event === 'change') mediaQueryListeners.add(listener);
        },
        removeEventListener: (event: string, listener: (event: MediaQueryListEvent) => void) => {
          if (event === 'change') mediaQueryListeners.delete(listener);
        },
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('forces dark utilities and the dark variant without changing a saved light preference', async () => {
    localStorage.setItem('prism-theme', 'light');
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('theme').textContent).toBe('light'));
    fireEvent.click(screen.getByRole('button', { name: 'Use LCARS' }));

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(mockApplyAppTheme).toHaveBeenLastCalledWith('lcars', 'dark');
    });
    expect(localStorage.getItem('prism-theme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Use Kitchen Calm' }));

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(mockApplyAppTheme).toHaveBeenLastCalledWith('kitchen-calm', 'light');
    });
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(localStorage.getItem('prism-theme')).toBe('light');
  });

  it('stays dark through system preference changes and restores system behavior afterward', async () => {
    prefersDark = true;
    localStorage.setItem('prism-theme', 'system');
    localStorage.setItem('prism-color-theme', 'lcars');
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    act(() => dispatchSystemThemeChange(false));

    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(mockApplyAppTheme).toHaveBeenLastCalledWith('lcars', 'dark');

    fireEvent.click(screen.getByRole('button', { name: 'Use Kitchen Calm' }));

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(mockApplyAppTheme).toHaveBeenLastCalledWith('kitchen-calm', 'light');
    });
    expect(screen.getByTestId('theme').textContent).toBe('system');
    expect(localStorage.getItem('prism-theme')).toBe('system');
  });
});
