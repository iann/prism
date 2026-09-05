/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MediaPlayerPlaybackCard } from '../MediaPlayerPlaybackCard';
import type { MediaPlayerPlaybackData } from '@/lib/hooks/useMediaPlayerPlayback';

const action = jest.fn<Promise<void>, [Record<string, unknown>]>(() => Promise.resolve());
const confirm = jest.fn<Promise<boolean>, [string, string, object]>(() => Promise.resolve(true));
let data: MediaPlayerPlaybackData;
const dismiss = jest.fn();
jest.mock('@/lib/hooks/useMediaPlayerPlayback', () => ({
  useMediaPlayerPlayback: jest.fn(() => ({ data, loading: false, error: null, action })),
}));
jest.mock('@/lib/hooks/useMediaPlayerDismissal', () => ({
  useMediaPlayerDismissal: jest.fn(() => ({ ready: true, dismissed: false, dismiss })),
}));
jest.mock('@/lib/hooks/useConfirmDialog', () => ({
  useConfirmDialog: jest.fn(() => ({ confirm, dialogProps: { open: false } })),
}));
jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'UTC' }),
}));
let currentTime = new Date('2026-09-03T12:00:00Z');
jest.mock('../ClockWidget', () => ({ useCurrentTime: () => currentTime }));
jest.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }));

const makeData = (overrides: Partial<MediaPlayerPlaybackData> = {}): MediaPlayerPlaybackData => ({
  active: true,
  visible: true,
  entityId: 'media_player.tv',
  deviceName: null,
  state: 'playing',
  title: 'Film',
  artist: 'Artist',
  album: 'Album',
  mediaType: 'video',
  appName: 'TV',
  mediaService: null,
  series: 'Series',
  episode: 'S1 E1',
  mediaIdentity: 'media-1',
  artworkUrl: 'https://art',
  position: 30,
  duration: 120,
  positionUpdatedAt: null,
  endTime: '2026-09-03T12:01:30Z',
  volumeLevel: 0.5,
  isVolumeMuted: false,
  remoteAvailable: true,
  supportedControls: [
    'play',
    'pause',
    'play_pause',
    'seek',
    'volume_set',
    'volume_mute',
    'turn_off',
    'stop',
    'previous',
    'next',
  ],
  ...overrides,
});
beforeEach(() => {
  currentTime = new Date('2026-09-03T12:00:00Z');
  data = makeData();
  action.mockClear();
  confirm.mockClear();
  dismiss.mockClear();
});

it('renders nothing while inactive', () => {
  data = makeData({ visible: false, active: false });
  expect(render(<MediaPlayerPlaybackCard />).container.innerHTML).toBe('');
});
it('does not render cached playback when disabled', () => {
  expect(render(<MediaPlayerPlaybackCard enabled={false} />).container.innerHTML).toBe('');
});
it.each(['playing', 'paused', 'buffering'] as const)('renders %s state and metadata', (state) => {
  data = makeData({ state });
  render(<MediaPlayerPlaybackCard />);
  expect(screen.getByText(state)).toBeTruthy();
  expect(screen.getByText('Film')).toBeTruthy();
  expect(screen.getByText('Series · S1 E1')).toBeTruthy();
  expect(screen.getByText('Artist · Album')).toBeTruthy();
  expect(screen.getByText(/Ends in/)).toBeTruthy();
});
it('hides paused media after five minutes of local observation', () => {
  data = makeData({ state: 'paused', positionUpdatedAt: null });
  const view = render(<MediaPlayerPlaybackCard />);
  expect(screen.getByTestId('media-player-playback-card')).toBeTruthy();

  currentTime = new Date('2026-09-03T12:04:59Z');
  view.rerender(<MediaPlayerPlaybackCard />);
  expect(screen.getByTestId('media-player-playback-card')).toBeTruthy();

  currentTime = new Date('2026-09-03T12:05:00Z');
  view.rerender(<MediaPlayerPlaybackCard />);
  expect(view.container.innerHTML).toBe('');
});
it('uses Home Assistant pause time when it is already older than five minutes', () => {
  data = makeData({ state: 'paused', positionUpdatedAt: '2026-09-03T11:54:59Z' });
  expect(render(<MediaPlayerPlaybackCard />).container.innerHTML).toBe('');
});
it('resets the paused timeout when playback resumes', () => {
  data = makeData({ state: 'paused', positionUpdatedAt: null });
  const view = render(<MediaPlayerPlaybackCard />);

  currentTime = new Date('2026-09-03T12:04:59Z');
  data = makeData({ state: 'playing' });
  view.rerender(<MediaPlayerPlaybackCard />);
  expect(screen.getByTestId('media-player-playback-card')).toBeTruthy();

  currentTime = new Date('2026-09-03T12:05:00Z');
  data = makeData({ state: 'paused', positionUpdatedAt: null });
  view.rerender(<MediaPlayerPlaybackCard />);
  expect(screen.getByTestId('media-player-playback-card')).toBeTruthy();
});
it('renders music metadata and artwork fallback', () => {
  data = makeData({
    mediaType: 'music',
    title: null,
    series: null,
    episode: null,
    artworkUrl: null,
  });
  render(<MediaPlayerPlaybackCard />);
  expect(screen.getByText('Artist · Album')).toBeTruthy();
  expect(screen.getByLabelText('Media Player playback')).toBeTruthy();
  expect(screen.getByTestId('media-player-generic-artwork')).toBeTruthy();
});
it('shows a YouTube logo when Home Assistant has no artwork', () => {
  data = makeData({ appName: 'YouTube', mediaService: 'youtube', artworkUrl: null });
  render(<MediaPlayerPlaybackCard />);
  const artwork = screen.getByRole('img', { name: 'YouTube artwork fallback' });
  expect(artwork.getAttribute('data-service')).toBe('youtube');
  expect(screen.getByTestId('media-player-provider-logo').getAttribute('data-logo-src')).toBe(
    '/media-player-artwork/logos/youtube.svg'
  );
});
it('uses the service logo when a normally available artwork URL fails', () => {
  data = makeData({ appName: 'Plex', mediaService: 'plex' });
  render(<MediaPlayerPlaybackCard />);
  fireEvent.error(screen.getByAltText(''));
  const artwork = screen.getByRole('img', { name: 'Plex artwork fallback' });
  expect(artwork.getAttribute('data-service')).toBe('plex');
  expect(screen.getByTestId('media-player-provider-logo').getAttribute('data-logo-src')).toBe(
    '/media-player-artwork/logos/plex.svg'
  );
});
it('can infer a known service from the app name for older API responses', () => {
  data = makeData({ appName: 'Netflix', mediaService: null, artworkUrl: null });
  render(<MediaPlayerPlaybackCard />);
  expect(screen.getByRole('img', { name: 'Netflix artwork fallback' })).toBeTruthy();
});
it('renders the LocalTV+ fallback treatment', () => {
  data = makeData({ appName: 'LocalTV+', mediaService: 'local-tv-plus', artworkUrl: null });
  render(<MediaPlayerPlaybackCard />);
  const artwork = screen.getByRole('img', { name: 'LocalTV+ artwork fallback' });
  expect(artwork.getAttribute('data-service')).toBe('local-tv-plus');
  expect(screen.getByTestId('media-player-provider-logo').getAttribute('data-logo-src')).toBe(
    '/media-player-artwork/logos/local-tv-plus.png'
  );
});
it('renders Apple TV+ as a streaming-service fallback', () => {
  data = makeData({ appName: 'Apple TV+', mediaService: 'apple-tv', artworkUrl: null });
  render(<MediaPlayerPlaybackCard />);
  const artwork = screen.getByRole('img', { name: 'Apple TV+ artwork fallback' });
  expect(artwork.getAttribute('data-service')).toBe('apple-tv');
  expect(screen.getByTestId('media-player-provider-logo').getAttribute('data-logo-src')).toBe(
    '/media-player-artwork/logos/apple-tv.png'
  );
});
it('uses Home Assistant friendly name in the card heading and power action', async () => {
  data = makeData({ deviceName: 'Living Room' });
  render(<MediaPlayerPlaybackCard />);
  expect(screen.getByRole('heading', { name: /Living Room · TV/ })).toBeTruthy();
  expect(screen.getByLabelText('Living Room playback')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Turn off Living Room' }));
  await waitFor(() =>
    expect(confirm).toHaveBeenCalledWith(
      'Turn off Living Room?',
      'This will suspend the Living Room remote and turn off the media player.',
      { confirmLabel: 'Turn off' }
    )
  );
});
it('matches the radar footprint and uses a square card', () => {
  render(<MediaPlayerPlaybackCard />);
  const card = screen.getByLabelText('Media Player playback');
  expect(card.className).toContain('aspect-square');
  expect(card.className).toContain('w-[min(32rem,calc(100vw-2rem))]');
  expect(card.className).toContain('px-8');
  expect(card.className).toContain('pb-8');
  expect(screen.getByAltText('').className).toContain('h-48');
  expect(screen.getByAltText('').className).toContain('w-48');
});
it('provides a radar-sized close button for the current media', () => {
  render(<MediaPlayerPlaybackCard />);
  const closeButton = screen.getByRole('button', { name: 'Close Media Player playback' });
  expect(closeButton.className).toContain('h-12');
  expect(closeButton.className).toContain('w-12');
  expect(closeButton.parentElement?.lastElementChild).toBe(closeButton);
  fireEvent.click(closeButton);
  expect(dismiss).toHaveBeenCalledTimes(1);
});
it('uses a generic power confirmation when no remote is configured', async () => {
  data = makeData({ remoteAvailable: false });
  render(<MediaPlayerPlaybackCard />);
  fireEvent.click(screen.getByRole('button', { name: 'Turn off Media Player' }));
  await waitFor(() =>
    expect(confirm).toHaveBeenCalledWith(
      'Turn off Media Player?',
      'This will turn off the Media Player media player.',
      { confirmLabel: 'Turn off' }
    )
  );
});
it('renders exactly one explicit play/pause control', () => {
  render(<MediaPlayerPlaybackCard />);
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Play or pause' })).toBeNull();
});
it('falls back to play/pause and hides unsupported controls', () => {
  data = makeData({ state: 'buffering', supportedControls: ['play_pause'] });
  render(<MediaPlayerPlaybackCard />);
  expect(screen.getByRole('button', { name: 'Play or pause' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
});
it('estimates the raw API position once for a smooth timeline', () => {
  data = makeData({ position: 30, positionUpdatedAt: '2026-09-03T11:59:50Z' });
  render(<MediaPlayerPlaybackCard />);
  expect((screen.getByLabelText('Playback position') as HTMLInputElement).value).toBe('40');
  expect(screen.getByText(/Ends in 1:20/)).toBeTruthy();
});
it('commits deliberate seeks, including zero, with 48px sizing', async () => {
  data = makeData({ position: 10, supportedControls: ['seek'] });
  render(<MediaPlayerPlaybackCard />);
  const slider = screen.getByLabelText('Playback position');
  expect(slider.className).toContain('h-12');
  fireEvent.change(slider, { target: { value: '0' } });
  fireEvent.mouseUp(slider, { currentTarget: { value: '0' } });
  await waitFor(() => expect(action).toHaveBeenCalledWith({ control: 'seek', seekPosition: 0 }));
});
it('adjusts volume with 48px buttons in 5% increments', async () => {
  render(<MediaPlayerPlaybackCard />);
  const decrease = screen.getByRole('button', { name: 'Decrease volume' });
  const increase = screen.getByRole('button', { name: 'Increase volume' });
  const volumeRow = decrease.parentElement;
  expect(volumeRow?.className).toContain('w-full');
  expect(
    [...(volumeRow?.querySelectorAll('button') ?? [])].map((button) =>
      button.getAttribute('aria-label')
    )
  ).toEqual(['Decrease volume', 'Mute', 'Increase volume']);
  expect(decrease.className).toContain('min-h-12');
  expect(decrease.className).toContain('flex-1');
  expect(increase.className).toContain('min-h-12');
  expect(increase.className).toContain('flex-1');
  fireEvent.click(decrease);
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith({ control: 'volume_set', volumeLevel: 0.45 })
  );
});
it('supports mute and confirmed power', async () => {
  render(<MediaPlayerPlaybackCard />);
  const mute = screen.getByRole('button', { name: 'Mute' });
  expect(mute.className).toContain('bg-secondary');
  expect(mute.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Stop media' }));
  await waitFor(() => expect(action).toHaveBeenCalledWith({ control: 'stop' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith({ control: 'volume_mute', isVolumeMuted: true })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Turn off Media Player' }));
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(action).toHaveBeenCalledWith({ control: 'turn_off' });
});
it('shows refresh status', () => {
  const hook = jest.requireMock('@/lib/hooks/useMediaPlayerPlayback')
    .useMediaPlayerPlayback as jest.Mock;
  hook.mockReturnValueOnce({ data, loading: true, error: null, action });
  render(<MediaPlayerPlaybackCard />);
  expect(screen.getByText('Refreshing…')).toBeTruthy();
});
