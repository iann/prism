'use client';

import Link from 'next/link';
import { Home, MoreVertical } from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface OverflowItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface SubpageHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  overflow?: OverflowItem[];
}

export function SubpageHeader({ icon, title, badge, actions, overflow }: SubpageHeaderProps) {
  const isMobile = useIsMobile();

  return (
    <header className="wall-subpage-header safe-area-top flex-shrink-0 border-b border-border bg-card px-4 dark:bg-card/85 dark:backdrop-blur-sm">
      <div
        className={cn(
          'wall-subpage-header-inner flex items-center justify-between',
          isMobile ? 'h-14' : 'h-16'
        )}
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="wall-home-button hidden md:inline-flex"
          >
            <Link href="/" aria-label="Back to dashboard">
              <Home className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {!isMobile && icon}
            <h1 className={cn('wall-subpage-title font-bold', isMobile ? 'text-lg' : 'text-xl')}>
              {title}
            </h1>
            {badge}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {overflow && overflow.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More options">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map((item, i) => {
                  const IconComp = item.icon;
                  if (item.separator && i > 0) {
                    return (
                      <div key={i}>
                        <DropdownMenuSeparator />
                        {item.checked !== undefined ? (
                          <DropdownMenuCheckboxItem
                            checked={item.checked}
                            onCheckedChange={() => item.onClick()}
                            disabled={item.disabled}
                          >
                            {IconComp && <IconComp className="mr-2 h-4 w-4" />}
                            {item.label}
                          </DropdownMenuCheckboxItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={item.onClick}
                            disabled={item.disabled}
                            className={
                              item.destructive
                                ? 'text-destructive focus:text-destructive'
                                : undefined
                            }
                          >
                            {IconComp && <IconComp className="mr-2 h-4 w-4" />}
                            {item.label}
                          </DropdownMenuItem>
                        )}
                      </div>
                    );
                  }
                  if (item.checked !== undefined) {
                    return (
                      <DropdownMenuCheckboxItem
                        key={i}
                        checked={item.checked}
                        onCheckedChange={() => item.onClick()}
                        disabled={item.disabled}
                      >
                        {IconComp && <IconComp className="mr-2 h-4 w-4" />}
                        {item.label}
                      </DropdownMenuCheckboxItem>
                    );
                  }
                  return (
                    <DropdownMenuItem
                      key={i}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={
                        item.destructive ? 'text-destructive focus:text-destructive' : undefined
                      }
                    >
                      {IconComp && <IconComp className="mr-2 h-4 w-4" />}
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
