import { getTimedEventContentVisibility } from '../timedEventDensity';

describe('getTimedEventContentVisibility', () => {
  it.each([
    [30, false, false],
    [45, false, false],
    [60, true, false],
    [90, true, true],
  ])(
    'uses the expected content rows for a %d-minute event',
    (durationMinutes, showTime, showDetails) => {
      expect(getTimedEventContentVisibility(durationMinutes)).toEqual({
        showTime,
        showDetails,
      });
    }
  );

  it.each([
    [60, false, false],
    [120, true, false],
    [180, true, true],
  ])(
    'accounts for rendered pixels in a 20px/hour row for a %d-minute event',
    (durationMinutes, showTime, showDetails) => {
      expect(getTimedEventContentVisibility(durationMinutes, 20)).toEqual({
        showTime,
        showDetails,
      });
    }
  );
});
