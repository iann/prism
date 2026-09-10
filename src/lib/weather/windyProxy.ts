const WINDY_BASE_HREF = 'https://embed.windy.com/';
const WINDY_OVERRIDES_STYLE = `
<style id="prism-windy-overrides">
  .leaflet-marker-icon.mylocation,
  .leaflet-marker-shadow.mylocation {
    display: none !important;
  }
  /* Windy's marker=true mode opens a forecast picker. Keep its geographic
     anchor, but turn the geographic picker marker into a passive home dot
     for Prism's radar. #picker-dot is Windy's separate fixed map cursor and
     must remain invisible so it cannot produce a second, offset ripple. */
  .leaflet-marker-icon.picker {
    position: absolute !important;
    width: 10px !important;
    height: 10px !important;
    margin: -5px !important;
    opacity: 1 !important;
    border: 2px solid rgba(24, 34, 48, 0.9) !important;
    border-radius: 50% !important;
    background: #f6c85f !important;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8),
      0 1px 4px rgba(0, 0, 0, 0.65) !important;
    pointer-events: none !important;
  }
  #map-container #picker-dot {
    opacity: 0 !important;
  }
  .leaflet-marker-icon.picker::before,
  .leaflet-marker-icon.picker::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 10px;
    margin: -5px;
    box-sizing: border-box;
    content: '';
    border: 1px solid rgba(246, 200, 95, 0.75);
    border-radius: 50%;
    pointer-events: none;
    transform-origin: 50% 50%;
    animation: prism-windy-home-ripple 2.4s ease-out infinite;
  }
  /* Keep Prism's home pulse running when Windy's low-graphics rules disable
     animations elsewhere in the embed. */
  #map-container .leaflet-marker-icon.picker::before,
  #map-container .leaflet-marker-icon.picker::after {
    animation: prism-windy-home-ripple 2.4s ease-out infinite !important;
    -webkit-animation: prism-windy-home-ripple 2.4s ease-out infinite !important;
  }
  #map-container .leaflet-marker-icon.picker::after {
    animation-delay: -1.2s !important;
    -webkit-animation-delay: -1.2s !important;
  }
  .leaflet-marker-icon.picker .picker-lines,
  .leaflet-marker-icon.picker .picker-content {
    display: none !important;
  }
  @keyframes prism-windy-home-ripple {
    0% {
      opacity: 0.8;
      transform: scale(0.65);
    }
    70%,
    100% {
      opacity: 0;
      transform: scale(2.8);
    }
  }
  #logo-wrapper {
    display: none !important;
  }
  /* Prism supplies its own close affordance, so remove Windy's redundant
     overlay selector, legend, and zoom controls from the small radar card. */
  #mobile-ovr-select,
  #legend-mobile,
  .metric-legend,
  #embed-zoom {
    display: none !important;
  }
  #plugin-radar .speed-switch {
    display: none !important;
  }
</style>`;

/** Add a Windy base URL and hide dashboard-unwanted Windy UI. */
export function rewriteWindyEmbedHtml(html: string): string {
  const injection = `<base href="${WINDY_BASE_HREF}">${WINDY_OVERRIDES_STYLE}`;
  return html.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
}
