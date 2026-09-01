import { rewriteWindyEmbedHtml } from '@/lib/weather/windyProxy';

describe('rewriteWindyEmbedHtml', () => {
  it('keeps Windy assets resolvable and hides only the current-location marker', () => {
    const html = rewriteWindyEmbedHtml('<html><head><title>Windy</title></head><body /></html>');

    expect(html).toContain('<base href="https://embed.windy.com/">');
    expect(html).toContain('id="prism-hide-windy-current-location"');
    expect(html).toContain('.leaflet-marker-icon.mylocation');
    expect(html).toContain('Windy</title>');
  });
});
