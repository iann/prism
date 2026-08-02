/**
 * @jest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';
import { AppVersionChecker } from '../AppVersionChecker';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import {
  APP_VERSION_CHECK_INTERVAL,
  fetchServerAppVersion,
  isNewerAppVersion,
  reloadForAppUpdate,
} from '@/lib/appVersion';

jest.mock('@/lib/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: jest.fn(),
}));

jest.mock('@/lib/appVersion', () => ({
  APP_VERSION_CHECK_INTERVAL: 60 * 1000,
  fetchServerAppVersion: jest.fn(),
  isNewerAppVersion: jest.fn(),
  reloadForAppUpdate: jest.fn(),
}));

const mockFetchServerAppVersion = fetchServerAppVersion as jest.MockedFunction<
  typeof fetchServerAppVersion
>;
const mockIsNewerAppVersion = isNewerAppVersion as jest.MockedFunction<typeof isNewerAppVersion>;
const mockReloadForAppUpdate = reloadForAppUpdate as jest.MockedFunction<typeof reloadForAppUpdate>;
const mockUseVisibilityPolling = useVisibilityPolling as jest.MockedFunction<
  typeof useVisibilityPolling
>;

describe('AppVersionChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchServerAppVersion.mockResolvedValue('1.10.1');
    mockIsNewerAppVersion.mockReturnValue(true);
    mockReloadForAppUpdate.mockResolvedValue();
  });

  it('checks on mount and reloads when the server has a new version', async () => {
    render(<AppVersionChecker />);

    await waitFor(() => expect(mockReloadForAppUpdate).toHaveBeenCalledTimes(1));
    expect(mockFetchServerAppVersion).toHaveBeenCalledTimes(1);
    expect(mockIsNewerAppVersion.mock.calls[0]?.[1]).toBe('1.10.1');
    expect(mockUseVisibilityPolling).toHaveBeenCalledWith(
      expect.any(Function),
      APP_VERSION_CHECK_INTERVAL
    );
  });

  it('does not reload when the server version is unchanged', async () => {
    mockIsNewerAppVersion.mockReturnValue(false);

    render(<AppVersionChecker />);

    await waitFor(() => expect(mockFetchServerAppVersion).toHaveBeenCalledTimes(1));
    expect(mockReloadForAppUpdate).not.toHaveBeenCalled();
  });
});
