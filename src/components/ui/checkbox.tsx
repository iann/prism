/**
 *
 * Provides an accessible checkbox component for binary choices.
 * Used for task completion, chore tracking, shopping list items, etc.
 *
 * ACCESSIBILITY:
 * - Full keyboard support (Space to toggle)
 * - Proper ARIA attributes
 * - Focus visible states
 * - Works with screen readers
 *
 * TOUCH OPTIMIZATION:
 * - 28x28px visual size inside a true 44x44px target
 * - Clear visual feedback on interaction
 *
 * USAGE:
 *   <Checkbox />
 *   <Checkbox checked={true} />
 *   <Checkbox onCheckedChange={(checked) => console.log(checked)} />
 *
 *   // With label
 *   <div className="flex items-center gap-2">
 *     <Checkbox id="task1" />
 *     <label htmlFor="task1">Complete the task</label>
 *   </div>
 *
 */

'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';


/**
 * CHECKBOX COMPONENT
 * An accessible checkbox built on Radix UI primitives.
 *
 * RADIX UI:
 * Radix provides unstyled, accessible primitives.
 * We add our styles while keeping all the accessibility features.
 *
 * STATES:
 * - Unchecked: Empty box
 * - Checked: Box with checkmark
 * - Indeterminate: Box with dash (for "select all" scenarios)
 *
 * @example Basic usage
 * <Checkbox />
 *
 * @example Controlled
 * const [checked, setChecked] = useState(false);
 * <Checkbox
 *   checked={checked}
 *   onCheckedChange={setChecked}
 * />
 *
 * @example With label (accessible)
 * <div className="flex items-center gap-2">
 *   <Checkbox id="terms" />
 *   <label htmlFor="terms">Accept terms</label>
 * </div>
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'wall-checkbox group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
      // Focus state
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      // Disabled state
      'disabled:cursor-not-allowed disabled:opacity-50',
      'touch-action-manipulation',
      className
    )}
    {...props}
  >
    <span
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-lg border-2 border-primary',
        'transition-colors duration-150',
        'group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground',
        'group-data-[state=indeterminate]:bg-primary group-data-[state=indeterminate]:text-primary-foreground'
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-5 w-5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </span>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
