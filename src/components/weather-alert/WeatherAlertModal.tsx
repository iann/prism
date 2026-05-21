'use client';

/**
 * Severe weather alert modal.
 *
 * Anchored to the bottom third of the screen. Slides up when the NWS API
 * reports an active severe weather alert for the configured zone. Dismisses
 * when the user taps the dismiss button; re-appears if a new alert ID arrives.
 * Disappears automatically once no severe alerts remain.
 *
 * Center coordinates for the Windy map are read from:
 *   NEXT_PUBLIC_NWS_RADAR_LAT / NEXT_PUBLIC_NWS_RADAR_LON
 * If unset, the map defaults to the Washington DC area (38.9°N, 77.0°W).
 * Set these to the centre of your NWS zone.
 *
 * The Windy overlay layer can be changed via NEXT_PUBLIC_WINDY_OVERLAY
 * (radar | thunder | lightning | wind). Defaults to "radar".
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useNWSAlerts } from '@/hooks/useNWSAlerts';
import { WindyMap } from './WindyMap';

const MAP_CENTER: [number, number] = [
  Number(process.env.NEXT_PUBLIC_NWS_RADAR_LAT ?? '38.9'),
  Number(process.env.NEXT_PUBLIC_NWS_RADAR_LON ?? '-77.0'),
];

export function WeatherAlertModal() {
  const { alerts, hasSevereAlert } = useNWSAlerts();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);

  const primaryAlert = alerts[0];

  useEffect(() => {
    if (hasSevereAlert && primaryAlert && !dismissedIds.has(primaryAlert.id)) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [hasSevereAlert, primaryAlert, dismissedIds]);

  // When the modal is open, make the page scrollable so content above the
  // modal isn't permanently obscured — the user can scroll up to see it.
  useEffect(() => {
    if (visible) {
      document.body.classList.add('weather-alert-open');
    } else {
      document.body.classList.remove('weather-alert-open');
    }
    return () => document.body.classList.remove('weather-alert-open');
  }, [visible]);

  function dismiss() {
    if (primaryAlert) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(primaryAlert.id);
        return next;
      });
    }
    setVisible(false);
  }

  if (!visible || !primaryAlert) return null;

  const additionalCount = alerts.length - 1;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={`Severe weather alert: ${primaryAlert.event}`}
      className="fixed bottom-0 left-0 right-0 h-1/2 z-[10000] flex animate-slide-up-from-bottom shadow-2xl"
      data-testid="weather-alert-modal"
    >
      {/* Left: Windy live weather map */}
      <div className="w-3/4 h-full shrink-0">
        <WindyMap center={MAP_CENTER} />
      </div>

      {/* Right: alert details */}
      <div className="w-1/4 h-full flex flex-col justify-between p-4 bg-gray-950/95 backdrop-blur-sm text-white border-l border-red-500/30">
        <div className="flex items-start gap-3 min-h-0 overflow-hidden">
          <AlertTriangle
            className="text-red-500 mt-0.5 shrink-0 animate-pulse"
            size={22}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-red-400 font-bold text-lg leading-tight truncate">
              {primaryAlert.event}
            </p>
            <p className="text-gray-200 text-sm mt-1 line-clamp-4">
              {primaryAlert.headline}
            </p>
            {additionalCount > 0 && (
              <p className="text-amber-400 text-sm mt-2 font-medium">
                +{additionalCount} additional alert{additionalCount > 1 ? 's' : ''} active
              </p>
            )}
          </div>
        </div>

        <button
          onClick={dismiss}
          className="self-end flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
          aria-label="Dismiss weather alert"
          data-testid="dismiss-button"
        >
          <X size={15} aria-hidden="true" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
