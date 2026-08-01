/**
 * @jest-environment jsdom
 */

import { act, render, screen } from '@testing-library/react';
import { getTimedEventContentVisibility } from '../timedEventDensity';
import { useMeasuredHourRowHeight } from '../useMeasuredHourRowHeight';

class TestResizeObserver implements ResizeObserver {
  static instances: TestResizeObserver[] = [];
  callback: ResizeObserverCallback;
  disconnected = false;
  observedNode?: Element;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TestResizeObserver.instances.push(this);
  }

  disconnect() {
    this.disconnected = true;
  }
  observe(node: Element) {
    this.observedNode = node;
  }
  unobserve() {}

  resizeTo(height: number) {
    this.callback([{ contentRect: { height } } as ResizeObserverEntry], this);
  }
}

function VisibilityProbe({ showGrid = true }: { showGrid?: boolean }) {
  const { gridRef, rowHeightPx } = useMeasuredHourRowHeight(6);
  const visibility = getTimedEventContentVisibility(60, rowHeightPx);

  return (
    <div>
      <span data-testid="row-height">{rowHeightPx}</span>
      <span data-testid="visibility">
        {visibility.showDetails
          ? 'title-time-details'
          : visibility.showTime
            ? 'title-time'
            : 'title-only'}
      </span>
      {showGrid && <div ref={gridRef} data-testid="measured-grid" />}
    </div>
  );
}

describe('useMeasuredHourRowHeight', () => {
  beforeEach(() => {
    TestResizeObserver.instances = [];
    global.ResizeObserver = TestResizeObserver;
  });

  afterEach(() => {
    delete (global as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  });

  function resizeTo(observer: TestResizeObserver, height: number) {
    act(() => {
      observer.resizeTo(height);
    });
  }

  it('changes event detail visibility with the measured rendered row height', () => {
    render(<VisibilityProbe />);

    expect(screen.getByTestId('row-height').textContent).toBe('20');
    expect(screen.getByTestId('visibility').textContent).toBe('title-only');
    const observer = TestResizeObserver.instances[0]!;

    resizeTo(observer, 240);
    expect(screen.getByTestId('row-height').textContent).toBe('40');
    expect(screen.getByTestId('visibility').textContent).toBe('title-time');

    resizeTo(observer, 360);
    expect(screen.getByTestId('row-height').textContent).toBe('60');
    expect(screen.getByTestId('visibility').textContent).toBe('title-time-details');

    resizeTo(observer, 90);
    expect(screen.getByTestId('row-height').textContent).toBe('15');
    expect(screen.getByTestId('visibility').textContent).toBe('title-only');
  });

  it('disconnects and rebinds when a conditional grid is replaced', () => {
    const { rerender } = render(<VisibilityProbe />);
    const firstObserver = TestResizeObserver.instances[0]!;
    const firstGrid = screen.getByTestId('measured-grid');

    expect(firstObserver.observedNode).toBe(firstGrid);
    resizeTo(firstObserver, 240);
    expect(screen.getByTestId('row-height').textContent).toBe('40');

    rerender(<VisibilityProbe showGrid={false} />);
    expect(firstObserver.disconnected).toBe(true);

    rerender(<VisibilityProbe />);
    const secondObserver = TestResizeObserver.instances[1]!;
    const secondGrid = screen.getByTestId('measured-grid');

    expect(secondObserver).not.toBe(firstObserver);
    expect(secondObserver.observedNode).toBe(secondGrid);
    resizeTo(secondObserver, 360);
    expect(screen.getByTestId('row-height').textContent).toBe('60');
    expect(screen.getByTestId('visibility').textContent).toBe('title-time-details');
  });
});
