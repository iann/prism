'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  BIRTHDAY_MAX_SCENE_DELAY_MS,
  BIRTHDAY_MIN_SCENE_DELAY_MS,
  BIRTHDAY_WELCOME_DELAY_MS,
  hasFamilyCelebrationOnDate,
  selectBirthdaySceneDelay,
  type BirthdayCelebrationRecord,
  type RandomSource,
} from '@/lib/birthdayCelebration';
import { localDateKey, useLocalDateKey } from '@/lib/hooks/useLocalDateKey';

type BirthdayPartySchedulerProps = {
  celebrations: readonly BirthdayCelebrationRecord[];
  activeRef: React.MutableRefObject<boolean>;
  random: RandomSource;
  reducedMotion: boolean;
  onStart: (intensity?: 'party' | 'supernova') => void;
  onCancel: () => void;
};

export function useBirthdayPartyScheduler({
  celebrations,
  activeRef,
  random,
  reducedMotion,
  onStart,
  onCancel,
}: BirthdayPartySchedulerProps) {
  const dateKey = useLocalDateKey();
  const dateKeyRef = useRef(dateKey);
  const celebrationsRef = useRef(celebrations);
  const randomRef = useRef(random);
  const reducedMotionRef = useRef(reducedMotion);
  const onStartRef = useRef(onStart);
  const onCancelRef = useRef(onCancel);
  const scheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    celebrationsRef.current = celebrations;
    randomRef.current = random;
    reducedMotionRef.current = reducedMotion;
    onStartRef.current = onStart;
    onCancelRef.current = onCancel;
  }, [celebrations, onCancel, onStart, random, reducedMotion]);

  const isEligible = useCallback((key: string) => {
    return hasFamilyCelebrationOnDate(celebrationsRef.current, key);
  }, []);

  const clearScheduleTimer = useCallback(() => {
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
    scheduleTimerRef.current = null;
  }, []);

  const startIfEligible = useCallback(
    (intensity?: 'party' | 'supernova') => {
      // Recheck the clock immediately before starting delayed work so a scene
      // never leaks into the next local calendar day.
      const currentKey = localDateKey();
      dateKeyRef.current = currentKey;
      if (
        reducedMotionRef.current ||
        !isEligible(currentKey) ||
        document.visibilityState === 'hidden' ||
        activeRef.current
      ) {
        return;
      }
      onStartRef.current(intensity);
    },
    [activeRef, isEligible]
  );

  const scheduleNext = useCallback(() => {
    clearScheduleTimer();
    if (
      reducedMotionRef.current ||
      !isEligible(dateKeyRef.current) ||
      document.visibilityState === 'hidden' ||
      activeRef.current
    ) {
      return;
    }

    const delay = selectBirthdaySceneDelay(randomRef.current);
    const boundedDelay = Math.min(
      Math.max(delay, BIRTHDAY_MIN_SCENE_DELAY_MS),
      BIRTHDAY_MAX_SCENE_DELAY_MS
    );
    scheduleTimerRef.current = setTimeout(() => {
      scheduleTimerRef.current = null;
      startIfEligible();
    }, boundedDelay);
  }, [activeRef, clearScheduleTimer, isEligible, startIfEligible]);

  useEffect(() => {
    scheduleNextRef.current = scheduleNext;
  }, [scheduleNext]);

  useEffect(() => {
    dateKeyRef.current = dateKey;
    clearScheduleTimer();
    onCancelRef.current();
    if (!reducedMotion && isEligible(dateKey) && document.visibilityState !== 'hidden') {
      scheduleTimerRef.current = setTimeout(() => {
        scheduleTimerRef.current = null;
        startIfEligible('supernova');
      }, BIRTHDAY_WELCOME_DELAY_MS);
    }
  }, [clearScheduleTimer, dateKey, isEligible, reducedMotion, startIfEligible, celebrations]);

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
      if (!reducedMotionRef.current && isEligible(currentKey)) {
        scheduleNextRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearScheduleTimer, isEligible]);

  useEffect(
    () => () => {
      clearScheduleTimer();
      onCancelRef.current();
    },
    [clearScheduleTimer]
  );

  return { dateKey, dateKeyRef, scheduleNextRef, clearScheduleTimer };
}
