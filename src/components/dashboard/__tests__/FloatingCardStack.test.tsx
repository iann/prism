/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { FloatingCardStack } from '../FloatingCardStack';

describe('FloatingCardStack', () => {
  it.each([0, 1, 2, 3, 5])('supports %i arbitrary cards', (count) => {
    const { container } = render(
      <FloatingCardStack bottomOffset={96}>
        {Array.from({ length: count }, (_, index) => (
          <button key={index}>card {index}</button>
        ))}
      </FloatingCardStack>
    );

    if (count === 0) expect(container.firstChild).toBeNull();
    else expect(screen.getAllByRole('button')).toHaveLength(count);
  });

  it('uses bottom-up reverse wrapping and prevents click-through on the wrapper', () => {
    render(
      <FloatingCardStack bottomOffset={96}>
        <button>card</button>
      </FloatingCardStack>
    );
    const stack = screen.getByTestId('floating-card-stack');
    expect(stack.className).toContain('flex-row-reverse');
    expect(stack.className).toContain('flex-wrap-reverse');
    expect(stack.className).toContain('content-start');
    expect(stack.className).toContain('pointer-events-none');
    expect(stack.style.bottom).toContain('96px');
    expect(screen.getByRole('button').parentElement?.className).toContain('pointer-events-auto');
  });
});
