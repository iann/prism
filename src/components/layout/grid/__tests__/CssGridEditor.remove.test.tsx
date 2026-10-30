/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { DASHBOARD_THEME } from '../gridEditorTypes';
import { CssGridEditor } from '../CssGridEditor';

const CALENDAR: WidgetConfig = { i: 'calendar', type: 'calendar', x: 0, y: 0, w: 12, h: 12 };

function renderEditor({
  selectedWidget = 'calendar',
  onRemoveWidget = jest.fn(),
  onSelectWidget = jest.fn(),
}: {
  selectedWidget?: string | null;
  onRemoveWidget?: (id: string) => void;
  onSelectWidget?: (id: string | null) => void;
} = {}) {
  render(
    <CssGridEditor
      layout={[CALENDAR]}
      onLayoutChange={jest.fn()}
      renderWidget={() => <div>Calendar</div>}
      cellSize={20}
      margin={4}
      containerPadding={8}
      cols={48}
      totalRows={24}
      totalCols={48}
      selectedWidget={selectedWidget}
      onSelectWidget={onSelectWidget}
      onRemoveWidget={onRemoveWidget}
      theme={DASHBOARD_THEME}
    />
  );
  return { onRemoveWidget, onSelectWidget };
}

describe('removing a widget from the board', () => {
  it('offers a Remove button on the selected widget and reports it', () => {
    const { onRemoveWidget } = renderEditor();

    const remove = screen.getByRole('button', { name: /remove calendar from the board/i });
    fireEvent.click(remove);

    expect(onRemoveWidget).toHaveBeenCalledWith('calendar');
  });

  it('shows no Remove button when nothing is selected', () => {
    renderEditor({ selectedWidget: null });

    expect(screen.queryByRole('button', { name: /remove .* from the board/i })).toBeNull();
  });

  it('removes the selected widget on Delete or Backspace', () => {
    const { onRemoveWidget } = renderEditor();

    fireEvent.keyDown(window, { key: 'Delete' });
    fireEvent.keyDown(window, { key: 'Backspace' });

    expect(onRemoveWidget).toHaveBeenNthCalledWith(1, 'calendar');
    expect(onRemoveWidget).toHaveBeenNthCalledWith(2, 'calendar');
  });

  it('leaves Backspace to a field that is being typed into', () => {
    const { onRemoveWidget } = renderEditor();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(onRemoveWidget).not.toHaveBeenCalled();
    input.remove();
  });

  it('ignores Delete while nothing is selected', () => {
    const { onRemoveWidget } = renderEditor({ selectedWidget: null });

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(onRemoveWidget).not.toHaveBeenCalled();
  });
});
