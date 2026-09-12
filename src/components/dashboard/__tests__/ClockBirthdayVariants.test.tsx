/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { CAMERON_BIRTHDAY_GREETING, CAMERON_BIRTHDAY_PARTY_EVENT } from '@/lib/cameronBirthday';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'UTC' }),
}));

import { ClockCard } from '../MobileCards';
import { ClockTile } from '../TileCards';
import { ClockGreeting } from '@/components/widgets/ClockGreeting';
import { CameronBirthdayPartyButton } from '@/components/birthday';

describe('mobile clock birthday variants', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-12T09:30:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the exact greeting in both compact clock layouts', () => {
    render(
      <>
        <ClockCard />
        <ClockTile />
      </>
    );

    expect(screen.getAllByText(CAMERON_BIRTHDAY_GREETING)).toHaveLength(2);
    expect(CAMERON_BIRTHDAY_GREETING).toBe('🎉 Happy Birthday Cameron 🎉');
    expect(screen.getAllByText(CAMERON_BIRTHDAY_GREETING)[0]?.className).toContain('break-words');
  });

  it('renders one fixed emoji-only Party button outside the clock layouts', () => {
    render(
      <>
        <ClockGreeting date={new Date('2026-09-12T09:30:00Z')} />
        <ClockCard />
        <ClockTile />
        <CameronBirthdayPartyButton />
      </>
    );

    const buttons = screen.getAllByRole('button', { name: 'Start birthday celebration' });
    expect(buttons).toHaveLength(1);
    const button = buttons[0]!;
    expect(button.tagName).toBe('BUTTON');
    expect((button as HTMLElement).style.minHeight).toBe('56px');
    expect((button as HTMLElement).style.minWidth).toBe('56px');
    expect(button.className).toContain('fixed');
    expect(button.className).toContain('bottom-4');
    expect(button.className).toContain('left-4');
    expect(button.className).toContain('rounded-full');
    expect(button.getAttribute('data-auto-hide-keep')).toBe('true');
    expect(button.textContent).toBe('🎉');
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    fireEvent.click(button);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CAMERON_BIRTHDAY_PARTY_EVENT,
        detail: { intensity: 'supernova' },
      })
    );
  });
});
