/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { UseNWSAlertsResult, NWSAlert } from '@/hooks/useNWSAlerts';

// ---------------------------------------------------------------------------
// Mocks — declared before component import
// ---------------------------------------------------------------------------

// Stub WindyMap — it renders an iframe pointing to an external service;
// testing its URL construction is out of scope for modal behaviour tests.
jest.mock('../WindyMap', () => ({
  WindyMap: () => <div data-testid="windy-map" />,
}));

// Stub useNWSAlerts so we control its return value per-test
const mockUseNWSAlerts = jest.fn<UseNWSAlertsResult, []>();
jest.mock('@/hooks/useNWSAlerts', () => ({
  useNWSAlerts: (...args: unknown[]) => mockUseNWSAlerts(...(args as [])),
  DEFAULT_SEVERITY_FILTER: [
    'Severe Thunderstorm Warning',
    'Tornado Warning',
    'Tornado Watch',
    'Severe Thunderstorm Watch',
  ],
}));

// ---------------------------------------------------------------------------
// Component import (after mocks)
// ---------------------------------------------------------------------------

import { WeatherAlertModal } from '../WeatherAlertModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAlert(overrides: Partial<NWSAlert> = {}): NWSAlert {
  return {
    id: 'urn:oid:test-1',
    event: 'Tornado Warning',
    headline: 'Tornado Warning until 4:00 PM',
    description: 'A tornado has been spotted in your area.',
    effective: '2024-06-01T12:00:00Z',
    expires: '2024-06-01T16:00:00Z',
    ...overrides,
  };
}

function noAlerts(): UseNWSAlertsResult {
  return { alerts: [], hasSevereAlert: false, error: null, loading: false };
}

function withAlerts(alerts: NWSAlert[]): UseNWSAlertsResult {
  return { alerts, hasSevereAlert: alerts.length > 0, error: null, loading: false };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WeatherAlertModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when there are no severe alerts', () => {
    mockUseNWSAlerts.mockReturnValue(noAlerts());
    render(<WeatherAlertModal />);
    expect(screen.queryByTestId('weather-alert-modal')).toBeNull();
  });

  it('renders when hasSevereAlert is true', () => {
    mockUseNWSAlerts.mockReturnValue(withAlerts([makeAlert()]));
    render(<WeatherAlertModal />);
    expect(screen.getByTestId('weather-alert-modal')).not.toBeNull();
  });

  it('displays the event name and headline', () => {
    const alert = makeAlert({
      event: 'Severe Thunderstorm Warning',
      headline: 'Severe thunderstorm moving northeast at 45 mph.',
    });
    mockUseNWSAlerts.mockReturnValue(withAlerts([alert]));
    render(<WeatherAlertModal />);

    expect(screen.getByText('Severe Thunderstorm Warning')).not.toBeNull();
    expect(screen.getByText('Severe thunderstorm moving northeast at 45 mph.')).not.toBeNull();
  });

  it('shows additional alerts count when more than one alert is active', () => {
    mockUseNWSAlerts.mockReturnValue(
      withAlerts([
        makeAlert({ id: '1' }),
        makeAlert({ id: '2', event: 'Tornado Watch' }),
        makeAlert({ id: '3', event: 'Severe Thunderstorm Watch' }),
      ])
    );
    render(<WeatherAlertModal />);
    expect(screen.getByText('+2 additional alerts active')).not.toBeNull();
  });

  it('does not show additional count when only one alert is active', () => {
    mockUseNWSAlerts.mockReturnValue(withAlerts([makeAlert()]));
    render(<WeatherAlertModal />);
    expect(screen.queryByText(/additional alert/)).toBeNull();
  });

  it('hides the modal when the dismiss button is clicked', () => {
    mockUseNWSAlerts.mockReturnValue(withAlerts([makeAlert()]));
    render(<WeatherAlertModal />);

    expect(screen.getByTestId('weather-alert-modal')).not.toBeNull();
    fireEvent.click(screen.getByTestId('dismiss-button'));
    expect(screen.queryByTestId('weather-alert-modal')).toBeNull();
  });

  it('renders the Windy map component', () => {
    mockUseNWSAlerts.mockReturnValue(withAlerts([makeAlert()]));
    render(<WeatherAlertModal />);
    expect(screen.getByTestId('windy-map')).not.toBeNull();
  });

  it('re-appears when a new alert ID arrives after dismissal', () => {
    const alertA = makeAlert({ id: 'alert-A' });
    const alertB = makeAlert({ id: 'alert-B', event: 'Severe Thunderstorm Warning' });

    mockUseNWSAlerts.mockReturnValue(withAlerts([alertA]));
    const { rerender } = render(<WeatherAlertModal />);

    // Dismiss the first alert
    fireEvent.click(screen.getByTestId('dismiss-button'));
    expect(screen.queryByTestId('weather-alert-modal')).toBeNull();

    // A new alert arrives with a different ID
    mockUseNWSAlerts.mockReturnValue(withAlerts([alertB]));
    rerender(<WeatherAlertModal />);

    expect(screen.getByTestId('weather-alert-modal')).not.toBeNull();
    expect(screen.getByText('Severe Thunderstorm Warning')).not.toBeNull();
  });

  it('stays hidden when the same dismissed alert ID is still active', () => {
    const alert = makeAlert({ id: 'same-id' });
    mockUseNWSAlerts.mockReturnValue(withAlerts([alert]));
    const { rerender } = render(<WeatherAlertModal />);

    fireEvent.click(screen.getByTestId('dismiss-button'));
    expect(screen.queryByTestId('weather-alert-modal')).toBeNull();

    // Same alert still active — should stay dismissed
    rerender(<WeatherAlertModal />);
    expect(screen.queryByTestId('weather-alert-modal')).toBeNull();
  });

  it('auto-hides when all alerts clear', () => {
    mockUseNWSAlerts.mockReturnValue(withAlerts([makeAlert()]));
    const { rerender } = render(<WeatherAlertModal />);
    expect(screen.getByTestId('weather-alert-modal')).not.toBeNull();

    mockUseNWSAlerts.mockReturnValue(noAlerts());
    rerender(<WeatherAlertModal />);
    expect(screen.queryByTestId('weather-alert-modal')).toBeNull();
  });
});
