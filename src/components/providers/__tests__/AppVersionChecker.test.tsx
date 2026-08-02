/**
 * @jest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';
import { AppVersionChecker } from '../AppVersionChecker';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import {
  APP_VERSION_CHECK_INTERVAL,
  fetchServerBuildId,
  isDifferentBuild,
  reloadForAppUpdate,
} from '@/lib/appVersion';

jest.mock('@/lib/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: jest.fn(),
}));

jest.mock('@/lib/appVersion', () => ({
  APP_VERSION_CHECK_INTERVAL: 60 * 1000,
  fetchServerBuildId: jest.fn(),
  isDifferentBuild: jest.fn(),
  reloadForAppUpdate: jest.fn(),
}));

const mockFetchServerBuildId = fetchServerBuildId as jest.MockedFunction<typeof fetchServerBuildId>;
const mockIsDifferentBuild = isDifferentBuild as jest.MockedFunction<typeof isDifferentBuild>;
const mockReloadForAppUpdate = reloadForAppUpdate as jest.MockedFunction<typeof reloadForAppUpdate>;
const mockUseVisibilityPolling = useVisibilityPolling as jest.MockedFunction<
  typeof useVisibilityPolling
>;

describe('AppVersionChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchServerBuildId.mockResolvedValue('build-b');
    mockIsDifferentBuild.mockReturnValue(true);
    mockReloadForAppUpdate.mockResolvedValue();
  });

  it('checks on mount and reloads when the server has a different build', async () => {
    render(<AppVersionChecker />);

    await waitFor(() => expect(mockReloadForAppUpdate).toHaveBeenCalledTimes(1));
    expect(mockFetchServerBuildId).toHaveBeenCalledTimes(1);
    expect(mockIsDifferentBuild.mock.calls[0]?.[1]).toBe('build-b');
    expect(mockUseVisibilityPolling).toHaveBeenCalledWith(
      expect.any(Function),
      APP_VERSION_CHECK_INTERVAL
    );
  });

  it('does not reload when the server build is unchanged', async () => {
    mockIsDifferentBuild.mockReturnValue(false);

    render(<AppVersionChecker />);

    await waitFor(() => expect(mockFetchServerBuildId).toHaveBeenCalledTimes(1));
    expect(mockReloadForAppUpdate).not.toHaveBeenCalled();
  });
});
