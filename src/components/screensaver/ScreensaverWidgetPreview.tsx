import { isLightColor } from '@/lib/utils/color';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

function getTextClass(widget: WidgetConfig, fallback: string) {
  if (!widget.backgroundColor) return fallback;
  return isLightColor(widget.backgroundColor) ? 'text-black' : 'text-white';
}

export function renderScreensaverPreview(widget: WidgetConfig) {
  const textClass = getTextClass(widget, 'text-white');
  // Add a subtle background to make previews visible in the dark editor
  const bgClass = widget.backgroundColor ? '' : 'bg-white/10';

  switch (widget.i) {
    case 'clock':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-4xl font-light tabular-nums">12:00 <span className="text-lg">PM</span></div>
          <div className="text-sm mt-1">Saturday, February 1</div>
        </div>
      );
    case 'weather':
      return (
        <div className={`flex h-full items-center justify-end rounded-lg p-3 ${textClass} ${bgClass}`}>
          <div className="text-2xl font-light">72°F</div>
          <div className="text-sm ml-2">Sunny</div>
        </div>
      );
    case 'messages':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-[12px] uppercase tracking-wider mb-1">Family Messages</div>
          <p className="text-sm">Sample message text...</p>
          <p className="text-xs mt-0.5">&mdash; Family</p>
        </div>
      );
    case 'calendar':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-[12px] uppercase tracking-wider mb-1">Upcoming</div>
          <p className="text-sm">Doctor appt @ 2pm</p>
          <p className="text-xs mt-0.5">Tomorrow</p>
        </div>
      );
    case 'birthdays':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-[12px] uppercase tracking-wider mb-1">Birthdays</div>
          <p className="text-sm">Mom in 3 days</p>
        </div>
      );
    case 'tasks':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-[12px] uppercase tracking-wider mb-1">Tasks</div>
          <p className="text-sm">Buy groceries</p>
          <p className="text-xs mt-0.5">3 more tasks</p>
        </div>
      );
    case 'chores':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-[12px] uppercase tracking-wider mb-1">Chores</div>
          <p className="text-sm">Vacuum living room</p>
          <p className="text-xs mt-0.5">Due today</p>
        </div>
      );
    case 'shopping':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-[12px] uppercase tracking-wider mb-1">Shopping</div>
          <p className="text-sm">Milk, Eggs, Bread</p>
          <p className="text-xs mt-0.5">5 items</p>
        </div>
      );
    case 'meals':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-[12px] uppercase tracking-wider mb-1">Tonight&apos;s Dinner</div>
          <p className="text-sm">Pasta Primavera</p>
        </div>
      );
    case 'photos':
      return (
        <div className={`flex h-full flex-col justify-end rounded-lg p-3 text-right ${textClass} ${bgClass}`}>
          <div className="text-[12px] uppercase tracking-wider mb-1">Photos</div>
          <p className="text-sm">Family slideshow</p>
        </div>
      );
    default:
      return <div className={`rounded-lg p-3 text-sm text-white ${bgClass}`}>{widget.i}</div>;
  }
}
