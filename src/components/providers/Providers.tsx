/**
 *
 * Wraps all application providers in a single client component.
 * This is needed because the root layout is a Server Component.
 *
 */

'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from './AuthProvider';
import { FamilyProvider } from './FamilyProvider';
import { AppVersionChecker } from './AppVersionChecker';
import { GlobalInputProvider, useGlobalInput } from '@/lib/hooks/useGlobalInput';
import { TimeFormatProvider } from './TimeFormatProvider';

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
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider defaultTheme="system">
      <AppVersionChecker />
      <FamilyProvider>
        <AuthProvider>
          <TimeFormatProvider>
            <GlobalInputProvider>
              {children}
              <OptionalInputUi />
            </GlobalInputProvider>
          </TimeFormatProvider>
        </AuthProvider>
      </FamilyProvider>
    </ThemeProvider>
  );
}
