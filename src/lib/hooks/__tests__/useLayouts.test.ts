/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useLayouts } from '../useLayouts';

describe('useLayouts widget instance normalization', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        layouts: [
          {
            id: 'kitchen',
            name: 'Kitchen',
            widgets: [
              { type: 'calendar', position: { x: 0, y: 0, w: 24, h: 24 } },
              { type: 'calendar', position: { x: 24, y: 0, w: 24, h: 24 } },
              { i: 'weather', type: 'weather', x: 0, y: 24, w: 12, h: 24 },
            ],
          },
        ],
      }),
    });
  });

  it('infers legacy types and repairs duplicate legacy instance IDs', async () => {
    const { result } = renderHook(() => useLayouts());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.layouts[0]?.widgets.map(({ i, type }) => ({ i, type }))).toEqual([
      { i: 'calendar', type: 'calendar' },
      { i: 'calendar-2', type: 'calendar' },
      { i: 'weather', type: 'weather' },
    ]);
  });

  it('preserves explicit instance IDs and canonical types from stored layouts', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        layouts: [
          {
            id: 'bedroom',
            name: 'Bedroom',
            widgets: [
              { i: 'calendar', type: 'calendar', x: 0, y: 0, w: 24, h: 24 },
              { i: 'calendar-2', type: 'calendar', x: 24, y: 0, w: 24, h: 24 },
            ],
          },
        ],
      }),
    });

    const { result } = renderHook(() => useLayouts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.layouts[0]?.widgets.map(({ i, type }) => ({ i, type }))).toEqual([
      { i: 'calendar', type: 'calendar' },
      { i: 'calendar-2', type: 'calendar' },
    ]);
  });
});
