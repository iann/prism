/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { useLayoutEditorState } from '../useLayoutEditorState';

describe('useLayoutEditorState duplicate widget exports', () => {
  it('exports unique instance IDs with their shared canonical type', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const widgets: WidgetConfig[] = [
      { i: 'calendar', type: 'calendar', x: 0, y: 0, w: 24, h: 24, visible: true },
      { i: 'calendar-2', type: 'calendar', x: 24, y: 0, w: 24, h: 24, visible: true },
    ];
    const setActivePopover = jest.fn();
    const { result } = renderHook(() =>
      useLayoutEditorState({
        editingScreensaver: false,
        layoutName: 'Kitchen',
        currentWidgets: widgets,
        visibleWidgets: widgets,
        onWidgetsChange: jest.fn(),
        onSave: jest.fn(),
        onSaveAs: jest.fn(),
        allDashboards: [],
        confirmDelete: jest.fn().mockResolvedValue(true),
        setActivePopover,
      })
    );

    await act(async () => {
      result.current.handleExport();
      await Promise.resolve();
    });

    const exported = JSON.parse(writeText.mock.calls[0]![0] as string) as {
      version: number;
      widgets: Array<{ i: string; type?: string }>;
    };
    expect(exported.version).toBe(3);
    expect(exported.widgets).toEqual([
      expect.objectContaining({ i: 'calendar', type: 'calendar' }),
      expect.objectContaining({ i: 'calendar-2', type: 'calendar' }),
    ]);
    expect(setActivePopover).toHaveBeenCalledWith(null);
  });
});
