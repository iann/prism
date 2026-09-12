'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnimationEvent } from 'react';
import confetti from 'canvas-confetti';
import {
  CAMERON_BIRTHDAY_PARTY_CANCEL_EVENT,
  CAMERON_BIRTHDAY_PARTY_EVENT,
  isCameronBirthdayDateKey,
  type RandomSource,
} from '@/lib/cameronBirthday';
import { localDateKey } from '@/lib/hooks/useLocalDateKey';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { BirthdayBalloon } from './BirthdayBalloon';
import { useBirthdayPartyScheduler } from './BirthdayPartyScheduler';
import {
  type BirthdayIntensity,
  type BirthdayRecipe,
  INTENSITY_CEILINGS,
  fireBirthdayRecipe,
  selectBirthdayRecipe,
  selectBirthdayIntensity,
  selectBirthdayRange,
} from './birthdayCelebrationRecipes';
import { selectBirthdayHeroVariant, type BirthdayHeroVariant } from './BirthdayBalloon';

export type BirthdayPartyTriggerDetail = {
  intensity?: Extract<BirthdayIntensity, 'party' | 'supernova'>;
};

/** Phase 3 can call this bridge without coupling the dashboard to the overlay. */
export function triggerCameronBirthdayParty(detail: BirthdayPartyTriggerDetail = {}): boolean {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(CAMERON_BIRTHDAY_PARTY_EVENT, { detail }));
  return true;
}

export function cancelCameronBirthdayParty(): boolean {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new Event(CAMERON_BIRTHDAY_PARTY_CANCEL_EVENT));
  return true;
}

export type BirthdayCelebrationProps = {
  random?: RandomSource;
  onComplete?: () => void;
};

type Scene = {
  id: number;
  intensity: BirthdayIntensity;
  recipe: BirthdayRecipe;
  heroVariant: BirthdayHeroVariant;
  confettiCount: number;
  balloonCount: number;
};

type ScenePhase = 'anticipation' | 'payoff' | 'exit';

const PAYOFF_DELAY = 420;
const EXIT_DELAY = 3_350;
const MAX_SCENE_DURATION = 4_400;

export function BirthdayCelebration({
  random = Math.random,
  onComplete,
}: BirthdayCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<ReturnType<typeof confetti.create> | null>(null);
  const activeRef = useRef(false);
  const sceneRef = useRef<Scene | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startSceneRef = useRef<(requestedIntensity?: BirthdayIntensity) => void>(() => {});
  const randomRef = useRef(random);
  const onCompleteRef = useRef(onComplete);
  const [scene, setScene] = useState<Scene | null>(null);
  const [phase, setPhase] = useState<ScenePhase>('anticipation');
  const prefersReducedMotion = usePrefersReducedMotion();

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }, []);

  const cancelScene = useCallback(() => {
    clearTimers();
    confettiRef.current?.reset();
    activeRef.current = false;
    sceneRef.current = null;
    setScene(null);
    setPhase('anticipation');
  }, [clearTimers]);

  const cancelSceneRef = useRef(cancelScene);
  useEffect(() => {
    cancelSceneRef.current = cancelScene;
  }, [cancelScene]);

  const { dateKey, dateKeyRef, scheduleNextRef, clearScheduleTimer } = useBirthdayPartyScheduler({
    activeRef,
    random,
    reducedMotion: prefersReducedMotion,
    onStart: (intensity) => startSceneRef.current(intensity),
    onCancel: () => cancelSceneRef.current(),
  });
  const cancelParty = useCallback(() => {
    clearScheduleTimer();
    cancelScene();
  }, [cancelScene, clearScheduleTimer]);
  const inactive = prefersReducedMotion || !isCameronBirthdayDateKey(dateKey);

  useEffect(() => {
    randomRef.current = random;
  }, [random]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (inactive) {
      confettiRef.current = null;
      return;
    }
    // resize keeps the dedicated canvas aligned to the viewport, useWorker
    // moves particle work off the main thread.
    const instance = confetti.create(canvasRef.current, {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true,
    });
    confettiRef.current = instance;
    return () => {
      instance.reset();
      confettiRef.current = null;
    };
  }, [inactive]);

  useEffect(() => {
    if (prefersReducedMotion) cancelScene();
  }, [cancelScene, prefersReducedMotion]);

  const finishScene = useCallback(() => {
    if (!activeRef.current) return;
    cancelScene();
    onCompleteRef.current?.();
    scheduleNextRef.current();
  }, [cancelScene, scheduleNextRef]);

  const fireScene = useCallback((nextScene: Scene) => {
    const instance = confettiRef.current;
    if (!instance) return;
    fireBirthdayRecipe(instance, nextScene.recipe, nextScene.confettiCount);
  }, []);

  const startScene = useCallback(
    (requestedIntensity?: BirthdayIntensity) => {
      if (activeRef.current) return;
      const currentDateKey = localDateKey();
      dateKeyRef.current = currentDateKey;
      if (!isCameronBirthdayDateKey(currentDateKey) || document.visibilityState === 'hidden') {
        return;
      }
      if (prefersReducedMotion) return;
      const intensity = requestedIntensity ?? selectBirthdayIntensity(randomRef.current);
      const ceiling = INTENSITY_CEILINGS[intensity];
      const recipe = selectBirthdayRecipe(intensity, randomRef.current);
      const nextScene: Scene = {
        id: Date.now(),
        intensity,
        recipe,
        heroVariant: selectBirthdayHeroVariant(randomRef.current),
        confettiCount: selectBirthdayRange(ceiling.confetti, randomRef.current),
        balloonCount: selectBirthdayRange(ceiling.balloons, randomRef.current),
      };
      activeRef.current = true;
      sceneRef.current = nextScene;
      setPhase('anticipation');
      setScene(nextScene);
      timerRefs.current.push(
        setTimeout(() => {
          if (!sceneRef.current) return;
          setPhase('payoff');
          fireScene(nextScene);
        }, PAYOFF_DELAY)
      );
      timerRefs.current.push(setTimeout(() => setPhase('exit'), EXIT_DELAY));
      timerRefs.current.push(setTimeout(finishScene, MAX_SCENE_DURATION));
    },
    [dateKeyRef, fireScene, finishScene, prefersReducedMotion]
  );

  useEffect(() => {
    startSceneRef.current = startScene;
  }, [startScene]);

  useEffect(() => {
    const handleTrigger = (event: Event) => {
      const detail = (event as CustomEvent<BirthdayPartyTriggerDetail>).detail;
      startScene(detail?.intensity);
    };
    window.addEventListener(CAMERON_BIRTHDAY_PARTY_EVENT, handleTrigger);
    window.addEventListener(CAMERON_BIRTHDAY_PARTY_CANCEL_EVENT, cancelParty);
    return () => {
      window.removeEventListener(CAMERON_BIRTHDAY_PARTY_EVENT, handleTrigger);
      window.removeEventListener(CAMERON_BIRTHDAY_PARTY_CANCEL_EVENT, cancelParty);
    };
  }, [cancelParty, startScene]);

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && phase === 'exit') finishScene();
  };

  if (inactive) return null;

  return (
    <div
      aria-hidden="true"
      className={`birthday-celebration pointer-events-none fixed inset-0 z-[80] overflow-hidden birthday-celebration--${phase}`}
      data-birthday-recipe={scene?.recipe.name}
      onAnimationEnd={handleAnimationEnd}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="birthday-celebration__canvas" />
      {scene && !prefersReducedMotion ? (
        <div key={scene.id} className="birthday-celebration__balloons">
          {Array.from({ length: scene.balloonCount }, (_, index) => (
            <BirthdayBalloon
              key={`${scene.id}-${index}`}
              index={index}
              hero={index === 0}
              heroVariant={scene.heroVariant}
              color={scene.recipe.colors?.[index % scene.recipe.colors.length] ?? '#ff5d8f'}
              random={randomRef.current}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
