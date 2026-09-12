import { useState, type CSSProperties } from 'react';
import type { RandomSource } from '@/lib/cameronBirthday';

export const BIRTHDAY_HERO_VARIANTS = ['smiling', 'crowned', 'striped', 'gold'] as const;
export type BirthdayHeroVariant = (typeof BIRTHDAY_HERO_VARIANTS)[number];

export function selectBirthdayHeroVariant(random: RandomSource = Math.random): BirthdayHeroVariant {
  const index = Math.min(
    Math.floor(Math.max(random(), 0) * BIRTHDAY_HERO_VARIANTS.length),
    BIRTHDAY_HERO_VARIANTS.length - 1
  );
  return BIRTHDAY_HERO_VARIANTS[index] ?? 'smiling';
}

export type BalloonStyle = CSSProperties & {
  '--birthday-balloon-x': string;
  '--birthday-balloon-delay': string;
  '--birthday-balloon-duration': string;
  '--birthday-balloon-scale': string;
  '--birthday-balloon-color': string;
};

type BirthdayBalloonProps = {
  index: number;
  hero: boolean;
  heroVariant?: BirthdayHeroVariant;
  color: string;
  random: () => number;
};

export function BirthdayBalloon({
  index,
  hero,
  heroVariant = 'smiling',
  color,
  random,
}: BirthdayBalloonProps) {
  const [style] = useState<BalloonStyle>(() => ({
    '--birthday-balloon-x': `${18 + Math.floor(random() * 64)}%`,
    '--birthday-balloon-delay': `${index * 90}ms`,
    '--birthday-balloon-duration': `${2800 + Math.floor(random() * 650)}ms`,
    '--birthday-balloon-scale': hero ? '1.22' : `${0.76 + random() * 0.2}`,
    '--birthday-balloon-color': color,
  }));

  return (
    <svg
      aria-hidden="true"
      className={
        hero
          ? `birthday-balloon birthday-balloon--hero birthday-balloon--hero-${heroVariant}`
          : 'birthday-balloon'
      }
      data-birthday-hero-variant={hero ? heroVariant : undefined}
      focusable="false"
      style={style}
      viewBox="0 0 48 72"
    >
      <path className="birthday-balloon__string" d="M24 49 C19 57 29 61 24 72" />
      <path
        className="birthday-balloon__body"
        d="M24 4 C12 4 6 12 7 24 C8 35 17 43 24 49 C31 43 40 35 41 24 C42 12 36 4 24 4Z"
      />
      <path className="birthday-balloon__knot" d="M20 47 L24 53 L28 47Z" />
      {hero ? <path className="birthday-balloon__highlight" d="M16 13 C12 18 13 24 15 27" /> : null}
      {hero && heroVariant === 'smiling' ? (
        <g className="birthday-balloon__smile">
          <circle cx="18" cy="28" r="1.4" />
          <circle cx="30" cy="28" r="1.4" />
          <path d="M18 33 C21 37 27 37 30 33" />
        </g>
      ) : null}
      {hero && heroVariant === 'crowned' ? (
        <path className="birthday-balloon__crown" d="M11 10 L14 2 L24 8 L34 2 L37 10Z" />
      ) : null}
      {hero && heroVariant === 'striped' ? (
        <path
          className="birthday-balloon__stripe"
          d="M10 18 C18 22 30 22 39 18 M9 29 C18 33 30 33 39 29"
        />
      ) : null}
    </svg>
  );
}
