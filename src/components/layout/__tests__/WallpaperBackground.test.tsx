/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';
import { WallpaperBackground } from '../WallpaperBackground';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';

jest.mock('@/lib/hooks/usePhotos', () => ({ usePhotos: jest.fn() }));
jest.mock('@/lib/hooks/usePerformanceMode', () => ({ usePerformanceMode: jest.fn() }));
jest.mock('@/lib/hooks/useScreenOrientation', () => ({
  useScreenOrientation: () => 'landscape',
}));

const mockUsePhotos = usePhotos as jest.MockedFunction<typeof usePhotos>;
const mockUsePerformanceMode = usePerformanceMode as jest.MockedFunction<typeof usePerformanceMode>;

describe('WallpaperBackground', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUsePhotos.mockReset();
    mockUsePhotos.mockReturnValue({
      photos: [],
      loading: false,
      error: null,
      total: 0,
      refresh: jest.fn(),
      loadMore: jest.fn(),
      toggleFavorite: jest.fn(),
      updateUsage: jest.fn(),
    });
  });

  it('waits for performance detection before fetching photos', () => {
    mockUsePerformanceMode.mockReturnValue({ enabled: false, ready: false, setEnabled: jest.fn() });
    render(<WallpaperBackground />);

    expect(mockUsePhotos).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('loads one wallpaper in performance mode', () => {
    mockUsePerformanceMode.mockReturnValue({ enabled: true, ready: true, setEnabled: jest.fn() });
    render(<WallpaperBackground />);

    expect(mockUsePhotos).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      limit: 1,
    }));
  });

  it('uses a bounded wallpaper pool outside performance mode', () => {
    mockUsePerformanceMode.mockReturnValue({ enabled: false, ready: true, setEnabled: jest.fn() });
    render(<WallpaperBackground />);

    expect(mockUsePhotos).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      limit: 10,
    }));
  });
});
