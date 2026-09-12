import type confetti from 'canvas-confetti';
import type { RandomSource } from '@/lib/cameronBirthday';
import { selectWeighted } from '@/lib/cameronBirthday';

export type BirthdayIntensity = 'sprinkle' | 'party' | 'supernova';

export type BirthdayRecipe = confetti.Options & { name: string };

export const BALLOON_PARADE: BirthdayRecipe = {
  name: 'Balloon Parade',
  colors: ['#ff5d8f', '#ffca3a', '#4cc9f0', '#80ed99', '#9b5de5'],
  shapes: ['circle', 'star'],
  angle: 90,
  spread: 70,
  startVelocity: 27,
  decay: 0.91,
  gravity: 0.75,
  drift: 0,
  ticks: 150,
  scalar: 0.78,
  origin: { x: 0.5, y: 0.72 },
};

export const CONFETTI_CANNONS: BirthdayRecipe = {
  name: 'Confetti Cannons',
  colors: ['#ff595e', '#ffca3a', '#1982c4', '#6a4c93', '#8ac926', '#f15bb5'],
  shapes: ['square', 'circle'],
  angle: 90,
  spread: 52,
  startVelocity: 44,
  decay: 0.9,
  gravity: 1.02,
  drift: 0,
  ticks: 165,
  scalar: 0.9,
  origin: { x: 0.5, y: 0.78 },
};

export const STAR_SURPRISE: BirthdayRecipe = {
  name: 'Star Surprise',
  colors: ['#ffd166', '#fff1a8', '#fcbf49', '#f77f00', '#ef476f'],
  shapes: ['star'],
  angle: 90,
  spread: 105,
  startVelocity: 34,
  decay: 0.92,
  gravity: 0.82,
  drift: 0,
  ticks: 155,
  scalar: 0.72,
  origin: { x: 0.5, y: 0.6 },
};

export const RAINBOW_LIFT_OFF: BirthdayRecipe = {
  name: 'Rainbow Lift-Off',
  colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#f15bb5'],
  shapes: ['square', 'circle', 'star'],
  angle: 90,
  spread: 145,
  startVelocity: 48,
  decay: 0.89,
  gravity: 0.95,
  drift: 0,
  ticks: 175,
  scalar: 0.85,
  origin: { x: 0.5, y: 0.85 },
};

export const BIRTHDAY_SWIRL: BirthdayRecipe = {
  name: 'Birthday Swirl',
  colors: ['#00bbf9', '#00f5d4', '#fee440', '#f15bb5'],
  shapes: ['circle', 'circle', 'star'],
  angle: 90,
  spread: 360,
  startVelocity: 19,
  decay: 0.93,
  gravity: 0.68,
  drift: 0,
  ticks: 180,
  scalar: 0.68,
  origin: { x: 0.5, y: 0.5 },
};

export const BIG_BIRTHDAY_MOMENT: BirthdayRecipe = {
  name: 'Big Birthday Moment',
  colors: ['#ff006e', '#fb5607', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0'],
  shapes: ['star', 'circle', 'square'],
  angle: 90,
  spread: 165,
  startVelocity: 53,
  decay: 0.88,
  gravity: 1.05,
  drift: 0,
  ticks: 185,
  scalar: 1,
  origin: { x: 0.5, y: 0.82 },
};

export const AUTOMATIC_INTENSITIES = [
  { value: 'sprinkle' as const, weight: 55 },
  { value: 'party' as const, weight: 35 },
  { value: 'supernova' as const, weight: 10 },
];

export const INTENSITY_CEILINGS: Record<
  BirthdayIntensity,
  {
    confetti: readonly [number, number];
    balloons: readonly [number, number];
  }
> = {
  sprinkle: { confetti: [18, 24], balloons: [1, 2] },
  party: { confetti: [30, 42], balloons: [3, 4] },
  supernova: { confetti: [50, 60], balloons: [5, 5] },
};

export function selectBirthdayIntensity(random: RandomSource = Math.random): BirthdayIntensity {
  return selectWeighted(AUTOMATIC_INTENSITIES, random) ?? 'sprinkle';
}

/** Select one coherent named recipe for the whole scene. */
export function selectBirthdayRecipe(
  intensity: BirthdayIntensity,
  random: RandomSource = Math.random
): BirthdayRecipe {
  if (intensity === 'supernova') return BIG_BIRTHDAY_MOMENT;
  const recipes = recipesForIntensity(intensity);
  const index = Math.min(Math.floor(Math.max(random(), 0) * recipes.length), recipes.length - 1);
  return recipes[index] ?? BALLOON_PARADE;
}

export function selectBirthdayRange(
  range: readonly [number, number],
  random: RandomSource = Math.random
): number {
  const [minimum, maximum] = range;
  return minimum + Math.floor(Math.min(Math.max(random(), 0), 0.999999) * (maximum - minimum + 1));
}

export function recipesForIntensity(intensity: BirthdayIntensity): readonly BirthdayRecipe[] {
  if (intensity === 'sprinkle') return [BALLOON_PARADE, STAR_SURPRISE];
  if (intensity === 'party') return [CONFETTI_CANNONS, BIRTHDAY_SWIRL, RAINBOW_LIFT_OFF];
  return [BIG_BIRTHDAY_MOMENT];
}

/** Fire the selected recipe while keeping the scene's particle ceiling intact. */
export function fireBirthdayRecipe(
  instance: ReturnType<typeof confetti.create>,
  recipe: BirthdayRecipe,
  particleCount: number
): void {
  const launches =
    recipe.name === CONFETTI_CANNONS.name
      ? [
          {
            ...recipe,
            particleCount: Math.ceil(particleCount / 2),
            origin: { x: 0, y: recipe.origin?.y ?? 0.78 },
            angle: 45,
          },
          {
            ...recipe,
            particleCount: Math.floor(particleCount / 2),
            origin: { x: 1, y: recipe.origin?.y ?? 0.78 },
            angle: 135,
          },
        ]
      : [{ ...recipe, particleCount }];

  launches.forEach(({ name: _name, ...options }) => {
    void instance({ ...options, disableForReducedMotion: true, zIndex: 80 });
  });
}
