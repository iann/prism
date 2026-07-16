'use client';

import { useState } from 'react';
import { Baby } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBabysitterMode } from '@/lib/hooks/useBabysitterMode';
import { QuickPinModal } from '@/components/auth/QuickPinModal';
import { PERMISSIONS } from '@/types/user';

interface BabysitterModeToggleProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function BabysitterModeToggle({
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
}: BabysitterModeToggleProps) {
  const { isActive, toggle, loading } = useBabysitterMode(0);
  const [showPinModal, setShowPinModal] = useState(false);

  const handleClick = () => {
    setShowPinModal(true);
  };

  const handleAuthenticated = async (user: { role: 'parent' | 'child' | 'guest' }) => {
    if (!PERMISSIONS[user.role].canToggleAwayMode) {
      return;
    }
    await toggle(true);
  };

  if (isActive || loading) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
        title="Enable Babysitter Mode"
        aria-label="Enable Babysitter Mode"
      >
        <Baby className="h-4 w-4" />
        {showLabel && <span className="ml-2">Babysitter Mode</span>}
      </Button>

      <QuickPinModal
        open={showPinModal}
        onOpenChange={setShowPinModal}
        title="Enable Babysitter Mode"
        description="Select a parent to enable babysitter mode"
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}
