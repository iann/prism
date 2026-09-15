/**
 * Builds security headers for Next.js config.
 *
 * Iframe embedding is controlled via the ALLOWED_FRAME_ANCESTORS env var:
 *   - Not set:          Only same-origin embedding allowed (X-Frame-Options: SAMEORIGIN)
 *   - Comma-separated:  Specific origins allowed (e.g., "http://homeassistant.local:8123")
 *   - "*":              Any origin can embed (no X-Frame-Options, frame-ancestors *)
 *
 * Example for Home Assistant:
 *   ALLOWED_FRAME_ANCESTORS=http://homeassistant.local:8123
 */
function buildSecurityHeaders() {
  /** @type {{ key: string; value: string }[]} */
  const headers = [];

  // ---------------------------------------------------------------------------
  // Content-Security-Policy
  // Note: Next.js 15 App Router requires 'unsafe-inline' for script/style
  // (hydration and Tailwind). The meaningful protections here are object-src,
  // base-uri, and frame-src.
  // ---------------------------------------------------------------------------

  const allowedAncestors = process.env.ALLOWED_FRAME_ANCESTORS?.trim();
  let frameAncestors;

  if (allowedAncestors === '*') {
    frameAncestors = 'frame-ancestors *';
  } else if (allowedAncestors) {
    const origins = allowedAncestors
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    frameAncestors = `frame-ancestors 'self' ${origins.join(' ')}`;
  } else {
    headers.push({ key: 'X-Frame-Options', value: 'SAMEORIGIN' });
    frameAncestors = "frame-ancestors 'self'";
  }

  const csp = [
    "default-src 'self'",
    // Next.js requires unsafe-inline for hydration; unsafe-eval for dev HMR
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // Tailwind requires unsafe-inline for style attributes
    "style-src 'self' 'unsafe-inline'",
    // Images from configured remote patterns + data URIs + blob URLs
    "img-src 'self' data: blob: https:",
    // Fonts served locally
    "font-src 'self'",
    // API calls: self + external integrations (weather, MS Graph, Google, Open Food Facts)
    "connect-src 'self' https: wss:",
    // Audio for voice input beep feedback
    "media-src 'self' blob:",
    // PWA service worker
    "worker-src 'self' blob:",
    // Windy is used for the conditional dashboard precipitation map.
    // The radar may be served by the local Windy proxy as well as directly
    // from Windy while older cached dashboard markup is still in use.
    "frame-src 'self' https://embed.windy.com",
    // Block all plugin content (Flash, etc.)
    "object-src 'none'",
    // Prevent base tag injection attacks
    "base-uri 'self'",
    frameAncestors,
  ].join('; ');

  headers.push({ key: 'Content-Security-Policy', value: csp });

  // ---------------------------------------------------------------------------
  // Other security headers
  // ---------------------------------------------------------------------------

  headers.push({ key: 'X-Content-Type-Options', value: 'nosniff' });
  headers.push({ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' });

  // HSTS: enforce HTTPS for 1 year (applies when served over TLS via Cloudflare tunnel)
  headers.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  });

  // Restrict unused browser features. Microphone kept for voice input.
  headers.push({
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), payment=(), usb=(), bluetooth=()',
  });

  headers.push({ key: 'X-DNS-Prefetch-Control', value: 'off' });

  return headers;
}

function buildWindyProxyHeaders() {
  const windySources = 'https://*.windy.com https://windy.com';
  const csp = [
    `default-src 'self' ${windySources} data: blob:`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${windySources}`,
    `style-src 'self' 'unsafe-inline' ${windySources}`,
    `img-src 'self' ${windySources} https: data: blob:`,
    `font-src 'self' ${windySources} https: data:`,
    "connect-src 'self' https: wss:",
    `worker-src 'self' ${windySources} blob:`,
    `frame-src 'self' ${windySources}`,
    'base-uri https://embed.windy.com',
    "object-src 'none'",
    "frame-ancestors 'self'",
  ].join('; ');

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ];
}

module.exports = { buildSecurityHeaders, buildWindyProxyHeaders };
