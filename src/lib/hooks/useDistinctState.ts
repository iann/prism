import { useCallback, useState } from 'react';
import { useLatestRef } from './useLatestRef';

/**
 * State whose setter skips a write — and the re-render that comes with it —
 * when the new value is the one already committed. Polling endpoints return
 * the same payload most of the time, and this is what keeps that free.
 */
export function useDistinctState<T>(initialValue: T) {
  const [value, setValueState] = useState(initialValue);
  const valueRef = useLatestRef(value);

  const setValue = useCallback((next: T) => {
    if (Object.is(valueRef.current, next)) return;
    valueRef.current = next;
    setValueState(next);
  }, [valueRef]);

  return [value, setValue] as const;
}
