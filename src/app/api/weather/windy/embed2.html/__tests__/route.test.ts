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
    expect(html).toContain('#map-container #picker-dot');
    expect(html).toContain('opacity: 0 !important');
    expect(html).toContain('top: 50%;');
    expect(html).toContain('left: 50%;');
    expect(html).toContain('margin: -5px;');
    expect(html).toContain('box-sizing: border-box;');
    expect(html).toContain('transform-origin: 50% 50%');
    expect(html).toContain('.leaflet-marker-icon.picker');
    expect(html).toContain('.leaflet-marker-icon.picker::before');
    expect(html).toContain('.leaflet-marker-icon.picker::after');
    expect(html).not.toContain('#map-container #picker-dot::before');
    expect(html).not.toContain('#map-container #picker-dot::after');
    expect(html).toContain('.picker-lines');
    expect(html).toContain('.picker-content');
    expect(html).toContain('prism-windy-home-ripple');
    expect(html).toContain('#map-container .leaflet-marker-icon.picker::before');
    expect(html).toContain('animation: prism-windy-home-ripple');
    expect(html).toContain('!important');
    expect(html).toContain('#f6c85f');
    expect(html).toContain('#plugin-radar .speed-switch');
    expect(html).toContain('Windy</title>');
  });
});
