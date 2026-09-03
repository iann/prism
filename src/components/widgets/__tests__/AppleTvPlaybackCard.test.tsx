/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppleTvPlaybackCard } from '../AppleTvPlaybackCard';
import type { AppleTvPlaybackData } from '@/lib/hooks/useAppleTvPlayback';

const action = jest.fn<Promise<void>, [Record<string, unknown>]>(() => Promise.resolve());
const confirm = jest.fn<Promise<boolean>, [string, string, object]>(() => Promise.resolve(true));
let data: AppleTvPlaybackData;
jest.mock('@/lib/hooks/useAppleTvPlayback', () => ({
  useAppleTvPlayback: jest.fn(() => ({ data, loading: false, error: null, action })),
}));
jest.mock('@/lib/hooks/useConfirmDialog', () => ({
  useConfirmDialog: jest.fn(() => ({ confirm, dialogProps: { open: false } })),
}));
jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'UTC' }),
}));
jest.mock('../ClockWidget', () => ({ useCurrentTime: () => new Date('2026-09-03T12:00:00Z') }));
jest.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }));

const makeData = (overrides: Partial<AppleTvPlaybackData> = {}): AppleTvPlaybackData => ({
  active: true,
  visible: true,
  deviceName: null,
  state: 'playing',
  title: 'Film',
  artist: 'Artist',
  album: 'Album',
  mediaType: 'video',
  appName: 'TV',
  series: 'Series',
  episode: 'S1 E1',
  artworkUrl: 'https://art',
  position: 30,
  duration: 120,
  positionUpdatedAt: null,
  endTime: '2026-09-03T12:01:30Z',
  volumeLevel: 0.5,
  isVolumeMuted: false,
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
  data = makeData();
  action.mockClear();
  confirm.mockClear();
});

it('renders nothing while inactive', () => {
  data = makeData({ visible: false, active: false });
  expect(render(<AppleTvPlaybackCard />).container.innerHTML).toBe('');
});
it('does not render cached playback when disabled', () => {
  expect(render(<AppleTvPlaybackCard enabled={false} />).container.innerHTML).toBe('');
});
it.each(['playing', 'paused', 'buffering'] as const)('renders %s state and metadata', (state) => {
  data = makeData({ state });
  render(<AppleTvPlaybackCard />);
  expect(screen.getByText(state)).toBeTruthy();
  expect(screen.getByText('Film')).toBeTruthy();
  expect(screen.getByText('Series · S1 E1')).toBeTruthy();
  expect(screen.getByText('Artist · Album')).toBeTruthy();
  expect(screen.getByText(/Ends in/)).toBeTruthy();
});
it('renders music metadata and artwork fallback', () => {
  data = makeData({
    mediaType: 'music',
    title: null,
    series: null,
    episode: null,
    artworkUrl: null,
  });
  render(<AppleTvPlaybackCard />);
  expect(screen.getByText('Artist · Album')).toBeTruthy();
  expect(screen.getByLabelText('Apple TV playback')).toBeTruthy();
});
it('uses Home Assistant friendly name in the card heading and power action', async () => {
  data = makeData({ deviceName: 'Living Room' });
  render(<AppleTvPlaybackCard />);
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
  render(<AppleTvPlaybackCard />);
  const card = screen.getByLabelText('Apple TV playback');
  expect(card.className).toContain('aspect-square');
  expect(card.className).toContain('w-[min(32rem,calc(100vw-2rem))]');
  expect(card.className).toContain('px-8');
  expect(card.className).toContain('pb-8');
  expect(screen.getByAltText('').className).toContain('h-48');
  expect(screen.getByAltText('').className).toContain('w-48');
});
it('renders exactly one explicit play/pause control', () => {
  render(<AppleTvPlaybackCard />);
  expect(screen.getAllByRole('button', { name: /pause|play/i })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Play or pause' })).toBeNull();
});
it('falls back to play/pause and hides unsupported controls', () => {
  data = makeData({ state: 'buffering', supportedControls: ['play_pause'] });
  render(<AppleTvPlaybackCard />);
  expect(screen.getByRole('button', { name: 'Play or pause' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
});
it('estimates the raw API position once for a smooth timeline', () => {
  data = makeData({ position: 30, positionUpdatedAt: '2026-09-03T11:59:50Z' });
  render(<AppleTvPlaybackCard />);
  expect((screen.getByLabelText('Playback position') as HTMLInputElement).value).toBe('40');
  expect(screen.getByText(/Ends in 1:20/)).toBeTruthy();
});
it('commits deliberate seeks, including zero, with 48px sizing', async () => {
  data = makeData({ position: 10, supportedControls: ['seek'] });
  render(<AppleTvPlaybackCard />);
  const slider = screen.getByLabelText('Playback position');
  expect(slider.className).toContain('h-12');
  fireEvent.change(slider, { target: { value: '0' } });
  fireEvent.mouseUp(slider, { currentTarget: { value: '0' } });
  await waitFor(() => expect(action).toHaveBeenCalledWith({ control: 'seek', seekPosition: 0 }));
});
it('adjusts volume with 48px buttons in 5% increments', async () => {
  render(<AppleTvPlaybackCard />);
  const decrease = screen.getByRole('button', { name: 'Decrease volume' });
  const increase = screen.getByRole('button', { name: 'Increase volume' });
  const volumeRow = decrease.parentElement;
  expect(volumeRow?.className).toContain('w-full');
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
  render(<AppleTvPlaybackCard />);
  fireEvent.click(screen.getByRole('button', { name: 'Stop media' }));
  await waitFor(() => expect(action).toHaveBeenCalledWith({ control: 'stop' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith({ control: 'volume_mute', isVolumeMuted: true })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Turn off Apple TV' }));
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(action).toHaveBeenCalledWith({ control: 'turn_off' });
});
it('shows refresh status', () => {
  const hook = jest.requireMock('@/lib/hooks/useAppleTvPlayback').useAppleTvPlayback as jest.Mock;
  hook.mockReturnValueOnce({ data, loading: true, error: null, action });
  render(<AppleTvPlaybackCard />);
  expect(screen.getByText('Refreshing…')).toBeTruthy();
});
