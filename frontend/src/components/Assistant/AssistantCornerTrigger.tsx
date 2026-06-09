'use client';

import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAssistant } from '@/contexts/AssistantContext';
import { cn } from '@/lib/utils';

interface AssistantCornerTriggerProps {
  className?: string;
  hint?: string;
}

export function AssistantCornerTrigger({ className, hint }: AssistantCornerTriggerProps) {
  const { openAssistant } = useAssistant();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => openAssistant(hint)}
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-full',
            'bg-brand-primary text-white shadow-md hover:opacity-90 transition-opacity',
            className
          )}
          aria-label="Open AI Guardian assistant"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Ask Guardian</TooltipContent>
    </Tooltip>
  );
}
