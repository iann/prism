/** @jest-environment jsdom */

import { render } from '@testing-library/react';
import { BirthdayBalloon } from '../BirthdayBalloon';

describe('BirthdayBalloon', () => {
  it('applies the hero class with a separating space', () => {
    const { container } = render(
      <BirthdayBalloon index={0} hero color="#ff5d8f" random={() => 0.5} />
    );

    expect(
      container.querySelector('svg.birthday-balloon')?.classList.contains('birthday-balloon')
    ).toBe(true);
    expect(
      container
        .querySelector('svg.birthday-balloon--hero')
        ?.classList.contains('birthday-balloon--hero')
    ).toBe(true);
  });

  it('keeps randomized style values stable for the mounted balloon', () => {
    const random = jest
      .fn()
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.3);
    const props = { index: 1, hero: false, color: '#4cc9f0', random };
    const { container, rerender } = render(<BirthdayBalloon {...props} />);
    const balloon = container.querySelector('svg');
    const initialStyle = balloon?.getAttribute('style');

    rerender(<BirthdayBalloon {...props} />);

    expect(random).toHaveBeenCalledTimes(3);
    expect(balloon?.getAttribute('style')).toBe(initialStyle);
  });

  it('keeps the selected hero variant stable across re-renders', () => {
    const random = jest.fn(() => 0.9);
    const props = {
      index: 0,
      hero: true,
      heroVariant: 'crowned' as const,
      color: '#ffd166',
      random,
    };
    const { container, rerender } = render(<BirthdayBalloon {...props} />);
    const balloon = container.querySelector('svg');

    rerender(<BirthdayBalloon {...props} />);

    expect(balloon?.getAttribute('data-birthday-hero-variant')).toBe('crowned');
    expect(container.querySelector('.birthday-balloon__crown')).not.toBeNull();
    expect(random).toHaveBeenCalledTimes(2);
  });
});
