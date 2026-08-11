import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import {
  CUSTOM_WIDGET_SHELL_CLASS,
  getEffectiveWidgetTextColor,
  getWidgetStyle,
  hasCustomWidgetShell,
} from '../gridWidgetStyles';

function widget(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return { i: 'calendar', x: 0, y: 0, w: 12, h: 12, ...overrides };
}

describe('grid widget styles', () => {
  describe('getEffectiveWidgetTextColor', () => {
    it('replaces a low-contrast explicit color on a solid custom background', () => {
      expect(
        getEffectiveWidgetTextColor(widget({ backgroundColor: '#F7F3E8', textColor: '#FFFFFF' }))
      ).toBe('#000000');
    });

    it('keeps an explicit color that already meets WCAG AA', () => {
      expect(
        getEffectiveWidgetTextColor(widget({ backgroundColor: '#FFFFFF', textColor: '#1F2937' }))
      ).toBe('#1F2937');
    });

    it('supports shorthand and hashless colors', () => {
      expect(
        getEffectiveWidgetTextColor(widget({ backgroundColor: 'fff', textColor: '#fff' }))
      ).toBe('#000000');
      expect(
        getEffectiveWidgetTextColor(widget({ backgroundColor: '#000', textColor: 'fff' }))
      ).toBe('fff');
    });

    it('defers transparent and frosted surfaces to the active theme', () => {
      expect(
        getEffectiveWidgetTextColor(
          widget({ backgroundColor: 'transparent', textColor: '#FFFFFF' })
        )
      ).toBeUndefined();
      expect(
        getEffectiveWidgetTextColor(widget({ backgroundColor: 'frosted', textColor: '#FFFFFF' }))
      ).toBeUndefined();
    });

    it('defers invisible or translucent backgrounds to the active theme', () => {
      expect(
        getEffectiveWidgetTextColor(
          widget({ backgroundColor: '#FFFFFF', backgroundOpacity: 0, textColor: '#FFFFFF' })
        )
      ).toBeUndefined();
      expect(
        getEffectiveWidgetTextColor(
          widget({ backgroundColor: '#FFFFFF', backgroundOpacity: 0.5, textColor: '#FFFFFF' })
        )
      ).toBeUndefined();
      expect(
        getEffectiveWidgetTextColor(widget({ backgroundColor: '#FFFFFF', backgroundOpacity: 0.5 }))
      ).toBeUndefined();
      expect(
        getEffectiveWidgetTextColor(widget({ backgroundColor: '#FFF8', textColor: '#FFFFFF' }))
      ).toBeUndefined();
    });

    it('ignores text-only overrides so preset cards inherit the theme', () => {
      expect(getEffectiveWidgetTextColor(widget({ textColor: '#FFFFFF' }))).toBeUndefined();
      expect(getWidgetStyle(widget({ textColor: '#FFFFFF' }))).toBeUndefined();
    });
  });

  describe('custom shell chrome', () => {
    it('leaves preset shell chrome to WidgetContainer', () => {
      expect(hasCustomWidgetShell(widget())).toBe(false);
      expect(getWidgetStyle(widget())).toBeUndefined();
    });

    it.each(['#F7F3E8', 'transparent', 'frosted'])(
      'uses the preset radius and one-pixel semantic boundary for %s',
      (backgroundColor) => {
        const style = getWidgetStyle(widget({ backgroundColor }));

        expect(hasCustomWidgetShell(widget({ backgroundColor }))).toBe(true);
        expect(style).toMatchObject({
          borderRadius: '0.75rem',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'hsl(var(--border))',
        });
        expect(CUSTOM_WIDGET_SHELL_CLASS).toContain('shadow-sm');
      }
    );

    it('uses an explicit outline color without changing boundary width', () => {
      expect(getWidgetStyle(widget({ outlineColor: '#abc', outlineOpacity: 0.5 }))).toMatchObject({
        borderRadius: '0.75rem',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(170,187,204,0.5)',
      });
    });

    it('applies the resolved foreground to the outer shell style', () => {
      expect(
        getWidgetStyle(widget({ backgroundColor: '#F7F3E8', textColor: '#fff', textOpacity: 0.8 }))
      ).toMatchObject({ color: 'rgba(0,0,0,0.8)' });
    });
  });
});
