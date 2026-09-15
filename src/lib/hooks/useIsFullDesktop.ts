'use client';

import { useEffect, useState } from 'react';

const DESKTOP_BREAKPOINT = 1024;

/**
 * Returns true only for the full dashboard layout: a wide viewport whose
 * primary input is not a coarse touch pointer.
 */
export function useIsFullDesktop(): boolean {
  const [isFullDesktop, setIsFullDesktop] = useState(false);

  useEffect(() => {
    const touchQuery = window.matchMedia('(pointer: coarse)');

    const update = () => {
      setIsFullDesktop(window.innerWidth >= DESKTOP_BREAKPOINT && !touchQuery.matches);
    };

    update();
    window.addEventListener('resize', update);
    touchQuery.addEventListener('change', update);

    return () => {
      window.removeEventListener('resize', update);
      touchQuery.removeEventListener('change', update);
    };
  }, []);

  return isFullDesktop;
}
