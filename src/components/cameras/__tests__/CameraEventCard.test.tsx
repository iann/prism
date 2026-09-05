/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { CameraEventCard } from '../CameraEventCard';
import type { CameraEvent } from '@/lib/hooks/useCameraEvents';

const event = (overrides: Partial<CameraEvent> = {}): CameraEvent => ({
  eventId: 'ring-1',
  cameraId: 'doorbell-1',
  cameraName: 'Front Door',
  kind: 'doorbell',
  occurredAt: '2026-09-05T18:30:00.000Z',
  snapshotCapturedAt: null,
  snapshotUrl: '/api/cameras/doorbell-1/snapshot',
  expiresAt: '2026-09-05T18:31:00.000Z',
  hardExpiresAt: '2026-09-05T18:32:00.000Z',
  episodeStartedAt: '2026-09-05T18:30:00.000Z',
  ...overrides,
});
describe('CameraEventCard', () => {
  it('shows a snapshot fallback and unknown capture time honestly', () => {
    render(<CameraEventCard events={[event()]} onDismiss={jest.fn()} />);
    expect(screen.getByAltText('Front Door snapshot')).toBeTruthy();
    expect(screen.getByText(/Picture time unavailable/)).toBeTruthy();
  });

  it('supports selecting another camera and dismissing the current alert', () => {
    const onSelect = jest.fn();
    const onDismiss = jest.fn();
    render(
      <CameraEventCard
        events={[event(), event({ eventId: 'motion-1', cameraId: 'floodlight-1', cameraName: 'Driveway', kind: 'motion' })]}
        onSelect={onSelect}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /Driveway Motion/i }));
    expect(onSelect).toHaveBeenCalledWith('motion-1');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Front Door camera alert' }));
    expect(onDismiss).toHaveBeenCalledWith('ring-1');
  });

  it('shows connecting and unavailable states without pretending video is live', () => {
    const { rerender } = render(
      <CameraEventCard events={[event()]} video={<video />} videoState="connecting" onDismiss={jest.fn()} />
    );
    expect(screen.getByTestId('camera-event-connecting')).toBeTruthy();
    expect(screen.queryByTestId('camera-event-live')).toBeNull();
    rerender(<CameraEventCard events={[event()]} videoState="unavailable" onDismiss={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByTestId('camera-event-video-unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();
  });
});
