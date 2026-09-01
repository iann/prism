const WINDY_BASE_HREF = 'https://embed.windy.com/';
const WINDY_OVERRIDES_STYLE = `
<style id="prism-windy-overrides">
  .leaflet-marker-icon.mylocation,
  .leaflet-marker-shadow.mylocation {
    display: none !important;
  }
  #logo-wrapper {
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
