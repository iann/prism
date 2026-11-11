/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { CreateDashboardDialog } from '../LayoutEditorDashboardManager';

describe('CreateDashboardDialog: Start from', () => {
  // The personal fork keeps the grid front page, so the upstream Simple
  // (Today / Calendar) starts are intentionally not offered here.
  it('offers the grid starts only', () => {
    render(<CreateDashboardDialog open onClose={() => {}} onCreate={() => {}} />);
    expect(screen.getByText('Default Template')).toBeTruthy();
    expect(screen.getByText('Copy Current')).toBeTruthy();
    expect(screen.getByText('Blank')).toBeTruthy();
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.queryByText('Calendar')).toBeNull();
  });

  it('creates from the chosen start', () => {
    const onCreate = jest.fn();
    render(<CreateDashboardDialog open onClose={() => {}} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Kitchen Display'), { target: { value: 'Hall' } });
    fireEvent.click(screen.getByText('Copy Current'));
    fireEvent.click(screen.getByText('Create'));
    expect(onCreate).toHaveBeenCalledWith('Hall', 'copy');
  });
});
