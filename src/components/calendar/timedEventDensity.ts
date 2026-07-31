export type TimedEventContentVisibility = {
  showTime: boolean;
  showDetails: boolean;
};

/**
 * Keeps short calendar blocks readable by adding secondary rows only when the
 * event is tall enough to contain them without clipping.
 */
export function getTimedEventContentVisibility(
  durationMinutes: number,
  hourRowHeightPx?: number
): TimedEventContentVisibility {
  if (hourRowHeightPx !== undefined) {
    const usableHeightPx = (durationMinutes / 60) * hourRowHeightPx - 4;
    return {
      showTime: usableHeightPx >= 34,
      showDetails: usableHeightPx >= 49,
    };
  }

  return {
    showTime: durationMinutes >= 60,
    showDetails: durationMinutes >= 90,
  };
}
