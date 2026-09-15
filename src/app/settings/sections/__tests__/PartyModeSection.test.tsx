/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useBirthdays } from '@/lib/hooks/useBirthdays';
import { PartyModeSection } from '../PartyModeSection';

jest.mock('@/lib/hooks/useBirthdays');
jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

const refresh = jest.fn().mockResolvedValue(undefined);
const mockFetch = jest.fn();

const birthday = {
  id: 'birthday-sample-person',
  name: 'Sample Person',
  birthDate: '2014-02-15',
  eventType: 'birthday' as const,
  partyModeEnabled: false,
  age: 12,
  daysUntil: 361,
  nextBirthday: '2027-02-15',
};

const milestone = {
  id: 'milestone-school',
  name: 'School milestone',
  birthDate: '2020-02-15',
  eventType: 'milestone' as const,
  partyModeEnabled: false,
  age: null,
  daysUntil: 361,
  nextBirthday: '2027-02-15',
};

describe('PartyModeSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBirthdays as jest.Mock).mockReturnValue({
      birthdays: [birthday, milestone],
      loading: false,
      error: null,
      refresh,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mockFetch,
    });
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockFetch.mockReset();
    delete (globalThis as Record<string, unknown>).fetch;
  });

  it('lets the household opt an event into party mode', async () => {
    render(<PartyModeSection />);

    const toggle = screen.getByRole('switch', { name: 'Enable party mode for Sample Person' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/birthdays/birthday-sample-person',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ partyModeEnabled: true }),
        })
      )
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps milestones visible but not toggleable', () => {
    render(<PartyModeSection />);

    expect(
      screen
        .getByRole('switch', { name: 'Enable party mode for School milestone' })
        .hasAttribute('disabled')
    ).toBe(true);
  });
});
