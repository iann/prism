/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { BIRTHDAY_PARTY_EVENT } from '@/lib/birthdayCelebration';

jest.mock('@/lib/hooks/useLocalDateKey', () => ({
  useLocalDateKey: () => '2026-09-12',
}));

import { PartyModeButton } from '@/components/birthday';

const birthday = {
  name: 'Emma',
  birthDate: '2014-09-12',
  eventType: 'birthday' as const,
  partyModeEnabled: true,
  userId: 'emma',
};

const anniversary = {
  name: 'Alex & Jordan',
  birthDate: '2010-09-12',
  eventType: 'anniversary' as const,
  partyModeEnabled: true,
  userId: 'alex',
};

describe('universal party mode button', () => {
  it('appears for a family birthday or anniversary', () => {
    const { rerender } = render(<PartyModeButton celebrations={[birthday]} />);
    expect(screen.queryByRole('button', { name: 'Start family celebration' })).not.toBeNull();

    rerender(<PartyModeButton celebrations={[anniversary]} />);
    expect(screen.queryByRole('button', { name: 'Start family celebration' })).not.toBeNull();
  });

  it('stays hidden for an unrelated date and triggers the universal event', () => {
    render(<PartyModeButton celebrations={[{ ...birthday, birthDate: '2014-09-13' }]} />);
    expect(screen.queryByRole('button', { name: 'Start family celebration' })).toBeNull();

    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    render(<PartyModeButton celebrations={[birthday]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start family celebration' }));
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: BIRTHDAY_PARTY_EVENT, detail: { intensity: 'supernova' } })
    );
  });

  it('stays hidden for an unmarked event', () => {
    render(<PartyModeButton celebrations={[{ ...birthday, partyModeEnabled: false }]} />);
    expect(screen.queryByRole('button', { name: 'Start family celebration' })).toBeNull();
  });
});
