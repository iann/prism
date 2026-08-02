/**
 * @jest-environment jsdom
 */

import { act, render, screen } from '@testing-library/react';
import { CssGridDisplay } from '../CssGridDisplay';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

jest.mock('../useSquareCells', () => ({
  useSquareCells: () => ({ containerRef: jest.fn(), cellSize: 20 }),
}));

function OverrideProbe() {
  const value = useWidgetBgOverride();
  return (
    <output
      data-testid="override-probe"
      data-background={value?.backgroundColor}
      data-text={value?.textColor}
      data-custom-shell={String(value?.hasCustomShell)}
    />
  );
}

describe('CssGridDisplay', () => {
  it('rerenders only the widget whose revision changed', () => {
    const layout: WidgetConfig[] = [
      { i: 'weather', x: 0, y: 0, w: 2, h: 2 },
      { i: 'tasks', x: 2, y: 0, w: 2, h: 2 },
    ];
    const renders = { weather: 0, tasks: 0 };
    const renderWidget = (widget: WidgetConfig) => {
      renders[widget.i as keyof typeof renders] += 1;
      return <span>{widget.i}</span>;
    };
    const weather = { temperature: 70 };
    const tasks = { count: 3 };
    const { rerender } = render(
      <CssGridDisplay
        layout={layout}
        renderWidget={renderWidget}
        widgetRevisions={{ weather, tasks }}
      />
    );

    rerender(
      <CssGridDisplay
        layout={layout}
        renderWidget={renderWidget}
        widgetRevisions={{ weather, tasks }}
      />
    );
    expect(renders).toEqual({ weather: 1, tasks: 1 });

    rerender(
      <CssGridDisplay
        layout={layout}
        renderWidget={renderWidget}
        widgetRevisions={{ weather: { temperature: 71 }, tasks }}
      />
    );
    expect(renders).toEqual({ weather: 2, tasks: 1 });
  });

  it('renders duplicate widget types as separate instances', () => {
    const layout: WidgetConfig[] = [
      { i: 'calendar', type: 'calendar', x: 0, y: 0, w: 24, h: 24 },
      { i: 'calendar-2', type: 'calendar', x: 24, y: 0, w: 24, h: 24 },
    ];
    const renders = { first: 0, second: 0 };
    const renderWidget = (widget: WidgetConfig) => {
      if (widget.i === 'calendar') renders.first += 1;
      if (widget.i === 'calendar-2') renders.second += 1;
      return <span>{widget.i}</span>;
    };

    const { rerender } = render(
      <CssGridDisplay
        layout={layout}
        renderWidget={renderWidget}
        widgetRevisions={{ calendar: { count: 1 } }}
      />
    );
    expect(renders).toEqual({ first: 1, second: 1 });

    rerender(
      <CssGridDisplay
        layout={layout}
        renderWidget={renderWidget}
        widgetRevisions={{ calendar: { count: 2 } }}
      />
    );
    expect(renders).toEqual({ first: 2, second: 2 });
  });

  it('defers mounting widgets outside the initial display viewport', () => {
    const originalHeight = window.innerHeight;
    const originalObserver = globalThis.IntersectionObserver;
    let intersectionCallback: IntersectionObserverCallback | undefined;

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: jest.fn((callback: IntersectionObserverCallback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
        } as unknown as IntersectionObserver;
      }),
    });

    const renders = { clock: 0, tasks: 0 };
    render(
      <CssGridDisplay
        layout={[
          { i: 'clock', x: 0, y: 0, w: 2, h: 2 },
          { i: 'tasks', x: 0, y: 100, w: 2, h: 2 },
        ]}
        renderWidget={(widget) => {
          renders[widget.i as keyof typeof renders] += 1;
          return <span>{widget.i}</span>;
        }}
      />
    );

    expect(renders).toEqual({ clock: 1, tasks: 0 });

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(renders).toEqual({ clock: 1, tasks: 1 });

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalHeight,
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: originalObserver,
    });
  });

  it('passes a contrast-safe resolved foreground to the widget context and shell', () => {
    const { container } = render(
      <CssGridDisplay
        layout={[
          {
            i: 'calendar',
            x: 0,
            y: 0,
            w: 12,
            h: 12,
            backgroundColor: '#F7F3E8',
            textColor: '#FFFFFF',
          },
        ]}
        renderWidget={() => <OverrideProbe />}
      />
    );

    const shell = container.querySelector<HTMLElement>('.widget-cell');
    expect(shell).not.toBeNull();
    expect(shell?.classList.contains('rounded-xl')).toBe(true);
    expect(shell?.classList.contains('border')).toBe(true);
    expect(shell?.classList.contains('border-border')).toBe(true);
    expect(shell?.classList.contains('shadow-sm')).toBe(true);
    expect(shell?.style.borderRadius).toBe('0.75rem');
    expect(shell?.style.borderWidth).toBe('1px');
    expect(shell?.style.color).toBe('rgb(0, 0, 0)');
    expect(screen.getByTestId('override-probe').getAttribute('data-text')).toBe('#000000');
    expect(screen.getByTestId('override-probe').getAttribute('data-background')).toBe('#F7F3E8');
    expect(screen.getByTestId('override-probe').getAttribute('data-custom-shell')).toBe('true');
  });

  it('leaves preset grid wrappers free of duplicate card chrome', () => {
    const { container } = render(
      <CssGridDisplay
        layout={[{ i: 'calendar', x: 0, y: 0, w: 12, h: 12 }]}
        renderWidget={() => <OverrideProbe />}
      />
    );

    const shell = container.querySelector<HTMLElement>('.widget-cell');
    expect(shell).not.toBeNull();
    expect(shell?.classList.contains('rounded-xl')).toBe(false);
    expect(shell?.classList.contains('border')).toBe(false);
    expect(shell?.classList.contains('shadow-sm')).toBe(false);
    expect(screen.getByTestId('override-probe').getAttribute('data-custom-shell')).toBe('false');
  });
});
