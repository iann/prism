/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeAssistantAppleTvProviderCard } from '../HomeAssistantAppleTvProviderCard';

type ProviderCardShellMockProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
  primaryAction?: React.ReactNode;
};
jest.mock('../../shared/ProviderCardShell', () => ({
  ProviderCardShell: ({ children, primaryAction, ...props }: ProviderCardShellMockProps) => (
    <section {...props}>
      {primaryAction}
      {children}
    </section>
  ),
}));
jest.mock('@/components/ui/use-toast', () => ({ toast: jest.fn() }));

describe('HomeAssistantAppleTvProviderCard', () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ configured: false, hasToken: false }),
      }) as jest.Mock;
  });

  it('loads status without rendering a stored token and preserves values during discovery', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        configured: true,
        hasToken: true,
        baseUrl: 'http://ha.local:8123',
        mediaPlayerEntityId: 'media_player.tv',
        remoteEntityId: 'remote.tv',
      }),
    });
    render(<HomeAssistantAppleTvProviderCard />);
    await waitFor(() => expect(screen.getByDisplayValue('http://ha.local:8123')).toBeTruthy());
    expect((screen.getByLabelText('Access token') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText('Access token'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discover' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/integrations/home-assistant/discover',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          baseUrl: 'http://ha.local:8123',
          accessToken: 'new-secret',
          mediaPlayerEntityId: 'media_player.tv',
          remoteEntityId: 'remote.tv',
        }),
      })
    );
  });

  it('shows discovered media players and remotes as separate selectable candidates', async () => {
    render(<HomeAssistantAppleTvProviderCard />);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Discover' }) as HTMLButtonElement).disabled).toBe(
        false
      )
    );
    fireEvent.change(screen.getByLabelText('Home Assistant URL'), {
      target: { value: 'http://ha.local:8123' },
    });
    fireEvent.change(screen.getByLabelText('Access token'), { target: { value: 'secret' } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            entity_id: 'media_player.tv',
            friendly_name: 'Living Room TV',
            state: 'playing',
            app_name: 'Apple TV',
          },
          {
            entity_id: 'remote.tv',
            friendly_name: 'Living Room Remote',
            state: 'on',
            app_name: null,
          },
        ],
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Discover' }));
    await waitFor(() => expect(screen.getByText('Living Room TV')).toBeTruthy());
    expect(screen.getByText('Living Room Remote')).toBeTruthy();
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/integrations/home-assistant/discover',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"baseUrl":"http://ha.local:8123"'),
      })
    );
    expect(
      (screen.getByText('Living Room TV').closest('button') as HTMLButtonElement).className
    ).toContain('min-h-11');
  });

  it('rejects unsafe discovery URLs before making a request', async () => {
    render(<HomeAssistantAppleTvProviderCard />);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Discover' }) as HTMLButtonElement).disabled).toBe(
        false
      )
    );
    fireEvent.change(screen.getByLabelText('Home Assistant URL'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.change(screen.getByLabelText('Access token'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discover' }));
    expect((await screen.findByRole('status')).textContent).toContain(
      'including http:// or https://'
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('clears stale form values when status fields are missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        configured: true,
        hasToken: true,
        baseUrl: null,
        mediaPlayerEntityId: null,
        remoteEntityId: null,
      }),
    });
    render(<HomeAssistantAppleTvProviderCard />);
    await waitFor(() =>
      expect((screen.getByLabelText('Home Assistant URL') as HTMLInputElement).value).toBe('')
    );
    expect((screen.getByLabelText('Media player entity') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Remote entity') as HTMLInputElement).value).toBe('');
  });
});
