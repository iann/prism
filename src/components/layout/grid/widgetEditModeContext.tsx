'use client';

import * as React from 'react';

/**
 * Whether a widget is currently in the layout editor's resize mode. Defaults to
 * false so widgets rendered outside the editor (live dashboards, the screensaver
 * preview, the magnify overlay) don't show editor-only hints.
 */
const WidgetResizeModeContext = React.createContext(false);

export const WidgetResizeModeProvider = WidgetResizeModeContext.Provider;

export function useWidgetResizeMode(): boolean {
  return React.useContext(WidgetResizeModeContext);
}
