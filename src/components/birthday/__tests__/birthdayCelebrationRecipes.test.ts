import {
  BIG_BIRTHDAY_MOMENT,
  BIRTHDAY_SWIRL,
  CONFETTI_CANNONS,
  RAINBOW_LIFT_OFF,
  STAR_SURPRISE,
  fireBirthdayRecipe,
  selectBirthdayRecipe,
} from '../birthdayCelebrationRecipes';

describe('birthday recipe selection', () => {
  it('selects one named recipe from each non-supernova candidate set', () => {
    expect(selectBirthdayRecipe('sprinkle', () => 0)).toBeDefined();
    expect(selectBirthdayRecipe('sprinkle', () => 0).name).toBe('Balloon Parade');
    expect(selectBirthdayRecipe('sprinkle', () => 0.99).name).toBe('Star Surprise');
    expect(selectBirthdayRecipe('party', () => 0).name).toBe('Confetti Cannons');
    expect(selectBirthdayRecipe('party', () => 0.5).name).toBe(BIRTHDAY_SWIRL.name);
    expect(selectBirthdayRecipe('party', () => 0.99).name).toBe(RAINBOW_LIFT_OFF.name);
  });

  it('always uses Big Birthday Moment for Supernova', () => {
    expect(selectBirthdayRecipe('supernova', () => 0)).toBe(BIG_BIRTHDAY_MOMENT);
    expect(selectBirthdayRecipe('supernova', () => 0.99)).toBe(BIG_BIRTHDAY_MOMENT);
  });

  it('keeps Rainbow Lift-Off colors in deliberate rainbow order', () => {
    expect(RAINBOW_LIFT_OFF.colors).toEqual([
      '#ff595e',
      '#ffca3a',
      '#8ac926',
      '#1982c4',
      '#6a4c93',
      '#f15bb5',
    ]);
  });
});

describe('birthday confetti launches', () => {
  it('splits Confetti Cannons into equal inward edge bursts without changing the ceiling', () => {
    const instance = jest.fn(() => Promise.resolve());

    fireBirthdayRecipe(instance as never, CONFETTI_CANNONS, 31);

    expect(instance).toHaveBeenCalledTimes(2);
    const calls = instance.mock.calls as unknown as Array<
      [{ angle: number; origin: { x: number }; particleCount: number }]
    >;
    expect(calls.map(([options]) => options.particleCount)).toEqual([16, 15]);
    expect(calls.map(([options]) => options.origin.x)).toEqual([0, 1]);
    expect(calls.map(([options]) => options.angle)).toEqual([45, 135]);
    expect(calls.reduce((total, [{ particleCount }]) => total + particleCount, 0)).toBe(31);
  });
});
