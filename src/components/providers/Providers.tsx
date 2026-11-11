/**
 *
 * Wraps all application providers in a single client component.
 * This is needed because the root layout is a Server Component.
 *
 */

'use client';

// First: in the frame of a phone editing a screen, storage is swapped before anything reads it (#1153).
import '@/lib/displays/remoteEdit';
import { trackLastPointer } from '@/lib/input/lastPointer';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider } from './ThemeProvider';
import type { DefaultMode } from '@/lib/looks';
import { LocaleProvider } from './LocaleProvider';
import { AuthProvider } from './AuthProvider';
import { FamilyProvider } from './FamilyProvider';
import { AppVersionChecker } from './AppVersionChecker';
import { GlobalInputProvider, useGlobalInput } from '@/lib/hooks/useGlobalInput';
import { TimeFormatProvider } from './TimeFormatProvider';
import type { Theme } from '@/lib/themes/tokens';
import { DisplayHeartbeat } from '@/components/displays/DisplayHeartbeat';

// simple-keyboard accesses browser globals at module load — must be client-only
const VirtualKeyboard = dynamic(
  () => import('@/components/input/VirtualKeyboard').then(m => m.VirtualKeyboard),
  { ssr: false },
);
const KeyboardToggleButton = dynamic(
  () => import('@/components/input/KeyboardToggleButton').then(m => m.KeyboardToggleButton),
  { ssr: false },
);

interface ProvidersProps {
  children: React.ReactNode;
  initialPalette?: Theme;
  initialPaletteIsExplicit?: boolean;
}

function OptionalInputUi() {
  const { keyboardVisible, isInputFocused, isMobile, virtualKeyboardEnabled } = useGlobalInput();

  if (!virtualKeyboardEnabled) return null;

  return (
    <>
      {keyboardVisible && <VirtualKeyboard />}
      {!keyboardVisible && isInputFocused && !isMobile && <KeyboardToggleButton />}
    </>
  );
}

/**
 * PROVIDERS COMPONENT
 * Wraps the application with all necessary providers.
 * AuthProvider must be inside ThemeProvider since QuickPinModal uses styled components.
 */
// Where taps land, from app start, so a sheet can open on that side (#908).
trackLastPointer();

export function Providers({
  children,
  initialPalette,
  initialPaletteIsExplicit = false,
}: ProvidersProps) {
  // No defaultTheme override here. It was 'light' to mask the flash before the
  // stored preference loaded, which also meant a stored 'system' setting was
  // ignored on first render. The blocking script in the root layout now sets
  // the class before paint, so the mask is no longer needed. The household
  // default (Night look) applies only where a display never chose.
  return (
    <ThemeProvider
      defaultTheme="system"
      initialPalette={initialPalette}
      initialPaletteIsExplicit={initialPaletteIsExplicit}
    >
      <AppVersionChecker />
      <LocaleProvider>
        <FamilyProvider>
          <AuthProvider>
            <TimeFormatProvider>
              <GlobalInputProvider>
                {children}
                <OptionalInputUi />
                <DisplayHeartbeat />
              </GlobalInputProvider>
            </TimeFormatProvider>
          </AuthProvider>
        </FamilyProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
