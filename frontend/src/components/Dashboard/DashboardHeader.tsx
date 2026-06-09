'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/branding';
import { useAssistant } from '@/contexts/AssistantContext';

export function DashboardHeader() {
  const { openAssistant } = useAssistant();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div>
        <h1 className="text-lg font-semibold text-brand-primary">{BRAND.shortName}</h1>
        <p className="text-xs text-muted-foreground">Your private on-device meeting assistant</p>
      </div>

      <Button
        onClick={() => openAssistant()}
        className="rounded-full px-5 h-11 bg-brand-primary hover:opacity-90 text-white shadow-sm shrink-0"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Ask Guardian
      </Button>
    </header>
  );
}
