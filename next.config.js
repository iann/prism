const { buildSecurityHeaders, buildWindyProxyHeaders } = require('./src/lib/utils/securityHeaders');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const MAX_PRECACHE_FILE_BYTES = 512 * 1024;

// CI supplies the commit SHA through PRISM_BUILD_ID. Local builds and source
// clones (including the HA addon build) fall back to a content hash so a
// package, source, config, or public-asset change still produces a new build
// identity without requiring a manual package.json version bump.
const BUILD_INPUTS = [
  'package.json',
  'package-lock.json',
  'next.config.js',
  'tsconfig.json',
  'tailwind.config.js',
  'postcss.config.js',
  'src',
  'public',
];

function collectBuildFiles(relativePath, files) {
  // next-pwa rewrites these generated files during the build. Including them
  // would make a second identical build get a different build ID.
  if (relativePath === 'public/sw.js' || /^public\/workbox-.*\.js$/.test(relativePath)) {
    return;
  }

  const absolutePath = path.join(__dirname, relativePath);
  if (!fs.existsSync(absolutePath)) return;

  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      collectBuildFiles(path.join(relativePath, entry.name), files);
    }
    return;
  }

  files.push({ absolutePath, relativePath });
}

function getContentBuildId() {
  const files = [];
  for (const input of BUILD_INPUTS) collectBuildFiles(input, files);

  const hash = crypto.createHash('sha256');
  for (const file of files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    hash.update(file.relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(file.absolutePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

const APP_BUILD_ID = process.env.PRISM_BUILD_ID || getContentBuildId();

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  buildExcludes: [/noto-color-emoji/i],
  maximumFileSizeToCacheInBytes: MAX_PRECACHE_FILE_BYTES,
  // No runtime caching of /api responses. The previous NetworkFirst rule on
  // /^https:\/\/.*\/api\/.*/i persisted every authenticated API GET (messages,
  // family, tokens, mapboxToken, audit-logs, …) into Cache Storage on disk,
  // with no cacheableResponse filter and no clearing on logout — on a shared
  // kiosk that data outlived the session. Static assets are still handled by
  // next-pwa's precache; dynamic API data is intentionally never cached.
  runtimeCaching: [],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['undici'],
  generateBuildId: async () => APP_BUILD_ID,


  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.icloud.com' },
      { protocol: 'https', hostname: '*.sharepoint.com' },
      { protocol: 'https', hostname: '*.live.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'openweathermap.org' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@radix-ui/react-dropdown-menu', '@radix-ui/react-dialog', '@radix-ui/react-select'],
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3005'],
    },
  },

  async headers() {
    return [
      {
        source: '/api/weather/windy/:path*',
        headers: buildWindyProxyHeaders(),
      },
      {
        source: '/((?!api/weather/windy(?:/|$)).*)',
        headers: buildSecurityHeaders(),
      },
    ];
  },

  async redirects() {
    return [];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)), 'undici'];
    }
    return config;
  },

  env: {
    NEXT_PUBLIC_APP_NAME: 'Prism',
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
    NEXT_PUBLIC_APP_BUILD_ID: APP_BUILD_ID,
  },
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));
