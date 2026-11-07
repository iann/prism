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
  'data-screen-job'?: string;
}

export function BabysitterModeToggle({
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
  'data-screen-job': job,
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
        data-screen-job={job}
        title="Enable Babysitter Mode"
        aria-label="Enable Babysitter Mode"
      >
        <Baby className={showLabel ? 'h-5 w-5' : 'h-4 w-4'} />
        {showLabel && <span>Babysitter mode</span>}
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
