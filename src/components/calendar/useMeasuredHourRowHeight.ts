'use client';

import * as React from 'react';

export function getHourRowHeight(
  containerHeightPx: number,
  rowCount: number,
  fallbackHeightPx = 20
): number {
  if (containerHeightPx <= 0 || rowCount <= 0) return fallbackHeightPx;
  return containerHeightPx / rowCount;
}

export function useMeasuredHourRowHeight(rowCount: number, fallbackHeightPx = 20) {
  const [gridNode, setGridNode] = React.useState<HTMLDivElement | null>(null);
  const [rowHeightPx, setRowHeightPx] = React.useState(fallbackHeightPx);
  const gridRef = React.useCallback((node: HTMLDivElement | null) => {
    setGridNode(node);
  }, []);

  React.useEffect(() => {
    if (!gridNode) return;

    const update = (height: number) => {
      setRowHeightPx(getHourRowHeight(height, rowCount, fallbackHeightPx));
    };

    update(gridNode.getBoundingClientRect().height);
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.height);
    });
    observer.observe(gridNode);
    return () => observer.disconnect();
  }, [fallbackHeightPx, gridNode, rowCount]);

  return { gridRef, rowHeightPx };
}
