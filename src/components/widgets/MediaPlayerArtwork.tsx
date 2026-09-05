/* eslint-disable @next/next/no-img-element */

import { Album } from 'lucide-react';
import {
  identifyMediaPlayerService,
  type MediaPlayerService,
} from '@/lib/integrations/homeAssistantMediaPlayer';

type ArtworkBrand = {
  name: string;
  logoSrc: string;
  className: string;
};

// These are local copies of provider logo assets so the fallback still works
// when Home Assistant cannot provide artwork or the network is unavailable.
const ARTWORK_BRANDS: Partial<Record<MediaPlayerService, ArtworkBrand>> = {
  youtube: {
    name: 'YouTube',
    logoSrc: '/media-player-artwork/logos/youtube.svg',
    className: 'bg-[#ff0000] text-white',
  },
  'youtube-music': {
    name: 'YouTube Music',
    logoSrc: '/media-player-artwork/logos/youtube-music.svg',
    className: 'bg-[#ff0000] text-white',
  },
  netflix: {
    name: 'Netflix',
    logoSrc: '/media-player-artwork/logos/netflix.svg',
    className: 'bg-[#141414] text-white',
  },
  hulu: {
    name: 'Hulu',
    logoSrc: '/media-player-artwork/logos/hulu.png',
    className: 'bg-[#1ce783] text-[#051f12]',
  },
  'disney-plus': {
    name: 'Disney+',
    logoSrc: '/media-player-artwork/logos/disney-plus.png',
    className: 'bg-[#062b70] text-white',
  },
  'prime-video': {
    name: 'Prime Video',
    logoSrc: '/media-player-artwork/logos/prime-video.png',
    className: 'bg-[#00a8e1] text-white',
  },
  max: {
    name: 'Max',
    logoSrc: '/media-player-artwork/logos/max.svg',
    className: 'bg-black text-white',
  },
  'paramount-plus': {
    name: 'Paramount+',
    logoSrc: '/media-player-artwork/logos/paramount-plus.svg',
    className: 'bg-[#0064ff] text-white',
  },
  peacock: {
    name: 'Peacock',
    logoSrc: '/media-player-artwork/logos/peacock.png',
    className: 'bg-[#111111] text-white',
  },
  'apple-tv': {
    name: 'Apple TV+',
    logoSrc: '/media-player-artwork/logos/apple-tv.png',
    className: 'bg-[#111111] text-white',
  },
  plex: {
    name: 'Plex',
    logoSrc: '/media-player-artwork/logos/plex.svg',
    className: 'bg-[#282a2d] text-[#e5a00d]',
  },
  'local-tv-plus': {
    name: 'LocalTV+',
    logoSrc: '/media-player-artwork/logos/local-tv-plus.png',
    className: 'bg-[#f7ecd8] text-[#4b301b]',
  },
  spotify: {
    name: 'Spotify',
    logoSrc: '/media-player-artwork/logos/spotify.svg',
    className: 'bg-[#101b14] text-[#1ed760]',
  },
  'amazon-music': {
    name: 'Amazon Music',
    logoSrc: '/media-player-artwork/logos/amazon-music.svg',
    className: 'bg-[#25d1da] text-white',
  },
  pandora: {
    name: 'Pandora',
    logoSrc: '/media-player-artwork/logos/pandora.svg',
    className: 'bg-[#224099] text-white',
  },
  soundcloud: {
    name: 'SoundCloud',
    logoSrc: '/media-player-artwork/logos/soundcloud.svg',
    className: 'bg-[#ff5500] text-white',
  },
  tidal: {
    name: 'Tidal',
    logoSrc: '/media-player-artwork/logos/tidal.svg',
    className: 'bg-black text-white',
  },
  deezer: {
    name: 'Deezer',
    logoSrc: '/media-player-artwork/logos/deezer.svg',
    className: 'bg-[#111111] text-white',
  },
  siriusxm: {
    name: 'SiriusXM',
    logoSrc: '/media-player-artwork/logos/siriusxm.png',
    className: 'bg-[#1a2260] text-white',
  },
  twitch: {
    name: 'Twitch',
    logoSrc: '/media-player-artwork/logos/twitch.svg',
    className: 'bg-[#9146ff] text-white',
  },
  roku: {
    name: 'Roku',
    logoSrc: '/media-player-artwork/logos/roku.svg',
    className: 'bg-[#662d91] text-white',
  },
  tubi: {
    name: 'Tubi',
    logoSrc: '/media-player-artwork/logos/tubi.svg',
    className: 'bg-[#7408ff] text-white',
  },
  crunchyroll: {
    name: 'Crunchyroll',
    logoSrc: '/media-player-artwork/logos/crunchyroll.svg',
    className: 'bg-[#f47521] text-[#111111]',
  },
  'pluto-tv': {
    name: 'Pluto TV',
    logoSrc: '/media-player-artwork/logos/pluto-tv.png',
    className: 'bg-[#202052] text-white',
  },
  'discovery-plus': {
    name: 'Discovery+',
    logoSrc: '/media-player-artwork/logos/discovery-plus.png',
    className: 'bg-[#071d49] text-white',
  },
  'espn-plus': {
    name: 'ESPN+',
    logoSrc: '/media-player-artwork/logos/espn-plus.png',
    className: 'bg-[#111111] text-white',
  },
  sling: {
    name: 'Sling',
    logoSrc: '/media-player-artwork/logos/sling.svg',
    className: 'bg-[#f58220] text-white',
  },
  fubo: {
    name: 'Fubo',
    logoSrc: '/media-player-artwork/logos/fubo.svg',
    className: 'bg-[#152d80] text-white',
  },
  shudder: {
    name: 'Shudder',
    logoSrc: '/media-player-artwork/logos/shudder.png',
    className: 'bg-[#111111] text-[#f4f4f4]',
  },
  britbox: {
    name: 'BritBox',
    logoSrc: '/media-player-artwork/logos/britbox.svg',
    className: 'bg-[#0b2f87] text-white',
  },
};

function BrandLogo({ brand }: { brand: ArtworkBrand }) {
  return (
    <img
      src={brand.logoSrc}
      alt=""
      className="max-h-40 max-w-40 object-contain"
      data-testid="media-player-provider-logo"
      data-logo-src={brand.logoSrc}
    />
  );
}

export function MediaPlayerArtwork({
  service,
  appName,
}: {
  service?: MediaPlayerService | null;
  appName?: string | null;
}) {
  const resolvedService = service ?? identifyMediaPlayerService(appName);
  const brand = resolvedService ? ARTWORK_BRANDS[resolvedService] : undefined;

  if (!brand) {
    return (
      <div
        className="flex h-48 w-48 shrink-0 items-center justify-center rounded-xl bg-muted"
        data-testid="media-player-generic-artwork"
        role="img"
        aria-label="Media artwork unavailable"
      >
        <Album className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={`flex h-48 w-48 shrink-0 items-center justify-center rounded-xl ${brand.className}`}
      data-service={resolvedService}
      data-testid="media-player-service-artwork"
      role="img"
      aria-label={`${brand.name} artwork fallback`}
    >
      <BrandLogo brand={brand} />
    </div>
  );
}
