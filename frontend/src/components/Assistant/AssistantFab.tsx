'use client';

import { Sparkles, X } from 'lucide-react';
import { useAssistant } from '@/contexts/AssistantContext';
import { cn } from '@/lib/utils';

export function AssistantFab() {
  const { isOpen, toggleAssistant } = useAssistant();

  return (
    <button
      type="button"
      onClick={toggleAssistant}
      className={cn(
        'fixed bottom-6 right-6 z-[100] flex items-center justify-center',
        'w-14 h-14 rounded-full shadow-lg transition-all',
        'bg-brand-primary text-white hover:opacity-90',
        isOpen && 'ring-2 ring-brand-accent ring-offset-2'
      )}
      aria-label={isOpen ? 'Close AI Guardian assistant' : 'Open AI Guardian assistant'}
    >
      {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
    </button>
  );
}
