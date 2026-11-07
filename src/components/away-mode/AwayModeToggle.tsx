'use client';

import { useState } from 'react';
import { TreePalm } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { QuickPinModal } from '@/components/auth/QuickPinModal';
import { PERMISSIONS } from '@/types/user';

interface AwayModeToggleProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
  'data-screen-job'?: string;
}

export function AwayModeToggle({
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
  'data-screen-job': job,
}: AwayModeToggleProps) {
  const { isAway, toggle, loading } = useAwayMode(0);
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

  if (isAway || loading) {
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
        title="Enable Away Mode"
        aria-label="Enable Away Mode"
      >
        <TreePalm className={showLabel ? 'h-5 w-5' : 'h-4 w-4'} />
        {showLabel && <span>Away mode</span>}
      </Button>

      <QuickPinModal
        open={showPinModal}
        onOpenChange={setShowPinModal}
        title="Enable Away Mode"
        description="Select a parent to enable away mode"
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}
