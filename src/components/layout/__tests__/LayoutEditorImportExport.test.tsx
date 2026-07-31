/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { LayoutEditorImportDialog } from '../LayoutEditorImportExport';

function exportData(overrides: Record<string, unknown> = {}) {
  return {
    type: 'prism-layout',
    version: 3,
    mode: 'dashboard',
    widgets: [{ i: 'calendar', type: 'calendar', x: 0, y: 0, w: 24, h: 24 }],
    ...overrides,
  };
}

function renderImport(onApply = jest.fn()) {
  const onClose = jest.fn();
  render(
    <LayoutEditorImportDialog open onClose={onClose} editingScreensaver={false} onApply={onApply} />
  );
  return { onApply, onClose };
}

function submit(data: unknown) {
  fireEvent.change(screen.getByPlaceholderText('Paste exported layout JSON here...'), {
    target: { value: JSON.stringify(data) },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
}

describe('LayoutEditorImportDialog duplicate widget instances', () => {
  it('preserves canonical types for multiple instances on import', () => {
    const { onApply, onClose } = renderImport();
    submit(
      exportData({
        widgets: [
          { i: 'calendar', type: 'calendar', x: 0, y: 0, w: 24, h: 24 },
          { i: 'calendar-2', type: 'calendar', x: 24, y: 0, w: 24, h: 24 },
        ],
      })
    );

    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ i: 'calendar', type: 'calendar', visible: true }),
      expect.objectContaining({ i: 'calendar-2', type: 'calendar', visible: true }),
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('infers the type from the instance ID for legacy exports', () => {
    const { onApply } = renderImport();
    submit(
      exportData({
        version: 1,
        widgets: [{ i: 'calendar', x: 0, y: 0, w: 24, h: 24 }],
      })
    );

    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ i: 'calendar', type: 'calendar', visible: true }),
    ]);
  });

  it('rejects duplicate instance IDs before applying an import', () => {
    const { onApply, onClose } = renderImport();
    submit(
      exportData({
        widgets: [
          { i: 'calendar', type: 'calendar', x: 0, y: 0, w: 24, h: 24 },
          { i: 'calendar', type: 'calendar', x: 24, y: 0, w: 24, h: 24 },
        ],
      })
    );

    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Invalid layout format. Expected a Prism layout export.')).toBeTruthy();
  });
});
