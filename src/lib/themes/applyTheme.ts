/**
 * Turning a theme into CSS, on the client and on the server.
 */
import { THEME_TOKENS, isValidTokenValue, type Theme, type ThemeTokens } from './tokens';
import { appThemes, isAppThemeId } from './appThemes';

export type ResolvedMode = 'light' | 'dark';

export function themeTokens(theme: Theme, mode: ResolvedMode): ThemeTokens {
  return mode === 'dark' ? theme.dark : theme.light;
}

/**
 * Write a token set onto an element.
 *
 * Removes before setting. A theme that omits a token would otherwise inherit
 * whatever the previous theme left behind — switching from a theme that
 * defines `--ring` to one that does not would leave the old ring colour stuck
 * until reload, which looks like a rendering bug rather than a missing value.
 *
 * Values are re-checked here even though they were checked on the way in.
 * This is the last point before the DOM, and the cost is a regex per token.
 */
export function applyThemeVars(root: HTMLElement, tokens: Partial<ThemeTokens>): void {
  for (const token of THEME_TOKENS) {
    const value = tokens[token];
    if (isValidTokenValue(value)) {
      root.style.setProperty(`--${token}`, value);
    } else {
      root.style.removeProperty(`--${token}`);
    }
  }
}

/** Remove every theme token, falling back to the values in globals.css. */
export function clearThemeVars(root: HTMLElement): void {
  for (const token of THEME_TOKENS) root.style.removeProperty(`--${token}`);
}

/**
 * A stylesheet for server rendering, so the first paint is already themed.
 *
 * Built by iterating THEME_TOKENS and emitting only values that pass the
 * triple check — never by serialising the theme object. That matters more here
 * than on the client: `setProperty` goes through the CSSOM, which cannot be
 * escaped out of, but this string lands inside a `<style>` element where a
 * closing tag in a value would end the block and begin markup. There is no CSP
 * in this app to catch that.
 *
 * The shape of this function is the guarantee for external themes: anything
 * not in THEME_TOKENS cannot appear in their output, whatever the input
 * contains. Static app themes are the one intentional exception; their
 * extended widget and weather properties come from this source file rather
 * than from the theme payload, so they can be safely included for first paint.
 */
export function themeCss(theme: Theme): string {
  const block = (tokens: ThemeTokens, trustedAppTokens?: Record<`--${string}`, string>) => {
    const properties = new Map<string, string>();

    for (const token of THEME_TOKENS) {
      if (isValidTokenValue(tokens[token])) properties.set(`--${token}`, tokens[token]);
    }

    // These keys and values are compiled into Prism. Do not replace this with
    // Object.entries(tokens) for gallery data: this CSS string is rendered in
    // a style element, while the client path is protected by the CSSOM.
    for (const [property, value] of Object.entries(trustedAppTokens ?? {})) {
      if (isValidTokenValue(value)) properties.set(property, value);
    }

    return Array.from(properties, ([property, value]) => `${property}:${value}`).join(';');
  };

  const appTheme = isAppThemeId(theme.id) ? appThemes[theme.id] : undefined;

  return `:root{${block(theme.light, appTheme?.light)}}.dark{${block(theme.dark, appTheme?.dark)}}`;
}
