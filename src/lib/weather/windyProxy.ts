const WINDY_BASE_HREF = 'https://embed.windy.com/';
const HIDE_CURRENT_LOCATION_STYLE = `
<style id="prism-hide-windy-current-location">
  .leaflet-marker-icon.mylocation,
  .leaflet-marker-shadow.mylocation {
    display: none !important;
  }
  #logo-wrapper {
    display: none !important;
  }
</style>`;

/** Add a Windy base URL and hide only its current-location marker. */
export function rewriteWindyEmbedHtml(html: string): string {
  const injection = `<base href="${WINDY_BASE_HREF}">${HIDE_CURRENT_LOCATION_STYLE}`;
  return html.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
}
