/** @jest-environment jsdom */

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { DisplaysSection } from '../DisplaysSection';

jest.mock('@/lib/hooks/useLayouts', () => ({
  useLayouts: (() => {
    const layouts = [
      { id: 'false', name: 'False', slug: null, isDefault: false, widgets: [], screensaverWidgets: null, orientation: 'landscape', fontScale: null, floatingCardSettings: { appleTvPlayback: { enabled: false } } },
      { id: 'true', name: 'True', slug: null, isDefault: false, widgets: [], screensaverWidgets: null, orientation: 'landscape', fontScale: null, floatingCardSettings: { appleTvPlayback: { enabled: true } } },
      { id: 'missing', name: 'Missing', slug: null, isDefault: false, widgets: [], screensaverWidgets: null, orientation: 'landscape', fontScale: null },
    ];
    return () => ({
    loading: false,
    layouts,
  });
  })(),
}));

describe('DisplaysSection media-player setting', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('keeps the checkbox unchecked and disabled while status is loading', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<DisplaysSection />);
    const checkbox = screen.getByLabelText('Show media-player playback card on False') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
  });

  it('keeps the checkbox unavailable when Home Assistant is unconfigured', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ configured: false }) });
    render(<DisplaysSection />);
    await waitFor(() => expect((screen.getByLabelText('Show media-player playback card on False') as HTMLInputElement).disabled).toBe(true));
    expect((screen.getByLabelText('Show media-player playback card on False') as HTMLInputElement).checked).toBe(false);
  });

  it('keeps the checkbox unavailable when status is unavailable', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<DisplaysSection />);
    await waitFor(() => expect((screen.getByLabelText('Show media-player playback card on False') as HTMLInputElement).disabled).toBe(true));
    expect((screen.getByLabelText('Show media-player playback card on False') as HTMLInputElement).checked).toBe(false);
  });

  it('preserves explicit layout values and enables missing values when configured', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ configured: true }) });
    render(<DisplaysSection />);
    await waitFor(() => expect((screen.getByLabelText('Show media-player playback card on Missing') as HTMLInputElement).disabled).toBe(false));
    expect((screen.getByLabelText('Show media-player playback card on False') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Show media-player playback card on True') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Show media-player playback card on Missing') as HTMLInputElement).checked).toBe(true);
  });
});
