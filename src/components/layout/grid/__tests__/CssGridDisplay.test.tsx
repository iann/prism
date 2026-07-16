/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';
import { CssGridDisplay } from '../CssGridDisplay';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

jest.mock('../useSquareCells', () => ({
  useSquareCells: () => ({ containerRef: jest.fn(), cellSize: 20 }),
}));

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
});
