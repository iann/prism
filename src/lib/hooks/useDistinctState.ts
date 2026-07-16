import { useCallback, useRef, useState } from 'react';

export function useDistinctState<T>(initialValue: T) {
  const [value, setValueState] = useState(initialValue);
  const valueRef = useRef(value);
  valueRef.current = value;

  const setValue = useCallback((next: T) => {
    if (Object.is(valueRef.current, next)) return;
    valueRef.current = next;
    setValueState(next);
  }, []);

  return [value, setValue] as const;
}
