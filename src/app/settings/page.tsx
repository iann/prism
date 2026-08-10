/**
 *
 * The settings page for configuring Prism.
 *
 * SECTIONS:
 * - Family Members: Add, edit, remove family members
 * - Display: Theme, layout preferences
 * - Integrations: Connect external calendars, services
 * - Security: PIN management, session settings
 * - About: Version info, help links
 *
 */

import { Suspense } from 'react';
import { SettingsPinGate } from './SettingsPinGate';
import { PageLoader } from '@/components/ui/spinner';


/**
 * PAGE METADATA
 */
export const metadata = {
  title: 'Settings',
  description: 'Configure your Prism family dashboard.',
};


/**
 * SETTINGS PAGE COMPONENT
 */
export default function SettingsPage() {
  return (
    <div className="wall-display min-h-screen bg-background">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsPinGate />
      </Suspense>
    </div>
  );
}


/**
 * SETTINGS SKELETON
 */
function SettingsSkeleton() {
  return (
    <div className="wall-state-screen">
      <div className="wall-state-card">
        <PageLoader label="Opening settings…" size="lg" className="py-4" />
      </div>
    </div>
  );
}
