'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS,
  CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS,
  CAMERON_BIRTHDAY_WELCOME_DELAY_MS,
  isCameronBirthdayDateKey,
  selectCameronBirthdaySceneDelay,
  type RandomSource,
} from '@/lib/cameronBirthday';
import { localDateKey, useLocalDateKey } from '@/lib/hooks/useLocalDateKey';

type BirthdayPartySchedulerProps = {
  activeRef: React.MutableRefObject<boolean>;
  random: RandomSource;
  reducedMotion: boolean;
  onStart: (intensity?: 'party' | 'supernova') => void;
  onCancel: () => void;
};

export function useBirthdayPartyScheduler({
  activeRef,
  random,
  reducedMotion,
  onStart,
  onCancel,
}: BirthdayPartySchedulerProps) {
  const dateKey = useLocalDateKey();
  const dateKeyRef = useRef(dateKey);
  const randomRef = useRef(random);
  const reducedMotionRef = useRef(reducedMotion);
  const onStartRef = useRef(onStart);
  const onCancelRef = useRef(onCancel);
  const scheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    randomRef.current = random;
    reducedMotionRef.current = reducedMotion;
    onStartRef.current = onStart;
    onCancelRef.current = onCancel;
  }, [onCancel, onStart, random, reducedMotion]);

  const clearScheduleTimer = useCallback(() => {
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
    scheduleTimerRef.current = null;
  }, []);

  const startIfEligible = useCallback(
    (intensity?: 'party' | 'supernova') => {
      // The hook's date key can be stale while a long timeout is pending. The
      // timeout must consult the browser-local clock immediately before it
      // starts anything, rather than trusting the value captured at mount.
      const currentKey = localDateKey();
      dateKeyRef.current = currentKey;
      if (
        reducedMotionRef.current ||
        !isCameronBirthdayDateKey(currentKey) ||
        document.visibilityState === 'hidden' ||
        activeRef.current
      ) {
        return;
      }
      onStartRef.current(intensity);
    },
    [activeRef]
  );

  const scheduleNext = useCallback(() => {
    clearScheduleTimer();
    if (
      reducedMotionRef.current ||
      !isCameronBirthdayDateKey(dateKeyRef.current) ||
      document.visibilityState === 'hidden' ||
      activeRef.current
    ) {
      return;
    }

    const delay = selectCameronBirthdaySceneDelay(randomRef.current);
    const boundedDelay = Math.min(
      Math.max(delay, CAMERON_BIRTHDAY_MIN_SCENE_DELAY_MS),
      CAMERON_BIRTHDAY_MAX_SCENE_DELAY_MS
    );
    scheduleTimerRef.current = setTimeout(() => {
      scheduleTimerRef.current = null;
      startIfEligible();
    }, boundedDelay);
  }, [activeRef, clearScheduleTimer, startIfEligible]);

  useEffect(() => {
    scheduleNextRef.current = scheduleNext;
  }, [scheduleNext]);

  useEffect(() => {
    dateKeyRef.current = dateKey;
    clearScheduleTimer();
    onCancelRef.current();
    if (
      !reducedMotion &&
      isCameronBirthdayDateKey(dateKey) &&
      document.visibilityState !== 'hidden'
    ) {
      scheduleTimerRef.current = setTimeout(() => {
        scheduleTimerRef.current = null;
        startIfEligible('supernova');
      }, CAMERON_BIRTHDAY_WELCOME_DELAY_MS);
    }
  }, [clearScheduleTimer, dateKey, reducedMotion, startIfEligible]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearScheduleTimer();
        onCancelRef.current();
        return;
      }

      const currentKey = localDateKey();
      dateKeyRef.current = currentKey;
      clearScheduleTimer();
      onCancelRef.current();
      if (!reducedMotionRef.current && isCameronBirthdayDateKey(currentKey)) {
        scheduleNextRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearScheduleTimer]);

  useEffect(
    () => () => {
      clearScheduleTimer();
      onCancelRef.current();
    },
    [clearScheduleTimer]
  );

  return { dateKey, dateKeyRef, scheduleNextRef, clearScheduleTimer };
}
