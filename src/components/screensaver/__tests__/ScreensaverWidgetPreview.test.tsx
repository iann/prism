/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { renderScreensaverPreview } from '../ScreensaverWidgetPreview';

describe('renderScreensaverPreview', () => {
  it('renders a duplicate instance using its canonical widget type', () => {
    render(
      <>
        {renderScreensaverPreview({
          i: 'calendar-2',
          type: 'calendar',
          x: 0,
          y: 0,
          w: 24,
          h: 24,
        })}
      </>
    );

    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.queryByText('calendar-2')).toBeNull();
  });
});
