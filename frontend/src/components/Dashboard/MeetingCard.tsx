'use client';

import { Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MeetingCardProps {
  id: string;
  title: string;
  createdAt?: string;
  variant?: 'upcoming' | 'today' | 'default';
  onClick: () => void;
}

export function MeetingCard({
  title,
  createdAt,
  variant = 'default',
  onClick,
}: MeetingCardProps) {
  const dateLabel = createdAt
    ? format(new Date(createdAt), 'd MMM yyyy h:mm a')
    : 'No date';

  const iconColor =
    variant === 'today'
      ? 'bg-brand-accent/25 text-brand-primary'
      : 'bg-brand-primary/10 text-brand-primary';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-brand-primary/20 transition-all text-left group"
    >
      <div
        className={cn(
          'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
          iconColor
        )}
      >
        <Calendar className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{dateLabel}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground/60 group-hover:text-brand-primary transition-colors shrink-0" />
    </button>
  );
}
