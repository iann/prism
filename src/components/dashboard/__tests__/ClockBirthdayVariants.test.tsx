/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { CAMERON_BIRTHDAY_GREETING, CAMERON_BIRTHDAY_PARTY_EVENT } from '@/lib/cameronBirthday';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'UTC' }),
}));

import { ClockCard } from '../MobileCards';
import { ClockTile } from '../TileCards';
import { ClockGreeting } from '@/components/widgets/ClockGreeting';

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
    expect(CAMERON_BIRTHDAY_GREETING).toBe('Happy Birthday Cameron!!!');
    expect(screen.getAllByText(CAMERON_BIRTHDAY_GREETING)[0]?.className).toContain('break-words');
  });

  it('renders one real Party button per birthday greeting with the exact accessible name', () => {
    render(
      <>
        <ClockGreeting date={new Date('2026-09-12T09:30:00Z')} />
        <ClockCard />
        <ClockTile />
      </>
    );

    const buttons = screen.getAllByRole('button', { name: 'Start birthday celebration' });
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => {
      expect(button.tagName).toBe('BUTTON');
      expect((button as HTMLElement).style.minHeight).toBe('48px');
      expect((button as HTMLElement).style.minWidth).toBe('48px');
      expect(button.getAttribute('data-auto-hide-keep')).toBe('true');
    });
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    fireEvent.click(buttons[0]!);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CAMERON_BIRTHDAY_PARTY_EVENT,
        detail: { intensity: 'supernova' },
      })
    );
  });
});
