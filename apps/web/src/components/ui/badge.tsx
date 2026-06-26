import * as React from 'react';
import { cn, getStatusColor } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: string;
  variant?: 'default' | 'outline';
}

export function Badge({ className, status, variant = 'default', children, ...props }: BadgeProps) {
  const statusClass = status ? getStatusColor(status) : '';
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variant === 'outline' ? 'border border-current bg-transparent' : '',
        statusClass,
        className
      )}
      {...props}
    >
      {children ?? status}
    </span>
  );
}
