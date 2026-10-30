/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';
import { WallpaperBackground } from '../WallpaperBackground';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { usePerformanceLevel } from '@/lib/hooks/usePerformanceMode';

jest.mock('@/lib/hooks/usePhotos', () => ({ usePhotos: jest.fn() }));
jest.mock('@/lib/hooks/usePerformanceMode', () => ({ usePerformanceLevel: jest.fn() }));
jest.mock('@/lib/hooks/useStoredValue', () => ({
  ...jest.requireActual('@/lib/hooks/useStoredValue'),
  useHydrated: () => true,
}));
jest.mock('@/lib/hooks/useScreenOrientation', () => ({
  useScreenOrientation: () => 'landscape',
}));

const mockUsePhotos = usePhotos as jest.MockedFunction<typeof usePhotos>;
const mockUsePerformanceLevel = usePerformanceLevel as jest.MockedFunction<typeof usePerformanceLevel>;

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

  it('loads one wallpaper at the minimal level', () => {
    mockUsePerformanceLevel.mockReturnValue('minimal');
    render(<WallpaperBackground />);

    expect(mockUsePhotos).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      limit: 1,
    }));
  });

  it('uses a bounded wallpaper pool outside minimal', () => {
    mockUsePerformanceLevel.mockReturnValue('full');
    render(<WallpaperBackground />);

    expect(mockUsePhotos).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      limit: 40,
    }));
  });

  it('keeps the slideshow pool at reduced, where photos still rotate', () => {
    mockUsePerformanceLevel.mockReturnValue('reduced');
    render(<WallpaperBackground />);

    expect(mockUsePhotos).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      limit: 40,
    }));
  });
});
