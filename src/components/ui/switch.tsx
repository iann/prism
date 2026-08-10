/**
 *
 * Provides an accessible toggle switch for on/off states.
 * Used for enabling/disabling chores, settings toggles, etc.
 *
 * ACCESSIBILITY:
 * - Full keyboard support (Space/Enter to toggle)
 * - Proper ARIA attributes
 * - Focus visible states
 * - Works with screen readers
 *
 * TOUCH OPTIMIZATION:
 * - Large touch target
 * - Clear visual feedback on interaction
 * - Smooth animations
 *
 * USAGE:
 *   <Switch />
 *   <Switch checked={true} />
 *   <Switch onCheckedChange={(checked) => console.log(checked)} />
 *
 *   // With label
 *   <div className="flex items-center gap-2">
 *     <Switch id="notifications" />
 *     <label htmlFor="notifications">Enable notifications</label>
 *   </div>
 *
 */

'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

/**
 * SWITCH COMPONENT
 * An accessible toggle switch built on Radix UI primitives.
 *
 * STATES:
 * - Unchecked: Track is grey, thumb is on the left
 * - Checked: Track is primary color, thumb is on the right
 *
 * @example Basic usage
 * <Switch />
 *
 * @example Controlled
 * const [enabled, setEnabled] = useState(false);
 * <Switch
 *   checked={enabled}
 *   onCheckedChange={setEnabled}
 * />
 *
 * @example With label (accessible)
 * <div className="flex items-center gap-2">
 *   <Switch id="wifi" />
 *   <label htmlFor="wifi">Enable WiFi</label>
 * </div>
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // A generous transparent target surrounds the familiar 44x24 track.
      'wall-switch peer relative inline-flex h-11 w-14 shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent p-0',
      'before:absolute before:left-1.5 before:top-2.5 before:h-6 before:w-11 before:rounded-full before:bg-input before:transition-colors',
      'data-[state=checked]:before:bg-primary',
      // Focus state
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      // Disabled state
      'disabled:cursor-not-allowed disabled:opacity-50',
      // Touch optimization
      'cursor-pointer touch-action-manipulation',
      className
    )}
    {...props}
    ref={ref}
  >
    {/*
      SWITCH THUMB
      The circular button that slides left/right.
      Radix handles the position based on state.
    */}
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none absolute left-2 top-3 block h-5 w-5',
        // Shape
        'rounded-full',
        // Color
        'bg-background',
        // Shadow
        'shadow-lg',
        'translate-x-0',
        'data-[state=checked]:translate-x-5',
        // Transitions (smooth slide)
        'transition-transform ring-0'
      )}
    />
  </SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
