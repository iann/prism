import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export function preserveEqual<T>(current: T, next: T): T {
  if (Object.is(current, next)) return current;

  try {
    return JSON.stringify(current) === JSON.stringify(next) ? current : next;
  } catch {
    return next;
  }
}

export function replaceDistinct<T>(
  current: MutableRefObject<T>,
  setValue: Dispatch<SetStateAction<T>>,
  next: T,
) {
  const value = preserveEqual(current.current, next);
  if (value === current.current) return false;
  current.current = value;
  setValue(value);
  return true;
}
