import { rewriteWindyEmbedHtml } from '@/lib/weather/windyProxy';

describe('rewriteWindyEmbedHtml', () => {
  it('keeps Windy assets resolvable and hides Prism-unwanted Windy controls', () => {
    const html = rewriteWindyEmbedHtml('<html><head><title>Windy</title></head><body /></html>');

    expect(html).toContain('<base href="https://embed.windy.com/">');
    expect(html).toContain('id="prism-windy-overrides"');
    expect(html).toContain('#mobile-ovr-select');
    expect(html).toContain('#legend-mobile');
    expect(html).toContain('.metric-legend');
    expect(html).toContain('#embed-zoom');
    expect(html).toContain('.leaflet-marker-icon.mylocation');
    expect(html).toContain('#plugin-radar .speed-switch');
    expect(html).toContain('Windy</title>');
  });
});
