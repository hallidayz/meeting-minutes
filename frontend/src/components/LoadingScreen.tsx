'use client';

interface LoadingScreenProps {
  message: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-brand-background">
      <div className="flex flex-1 items-center justify-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-brand-primary/25 border-t-brand-primary"
          aria-hidden
        />
      </div>
      <div className="w-full border-t border-brand-primary/15 bg-white/70 px-6 py-4 backdrop-blur-sm">
        <p className="text-center text-sm font-medium text-brand-primary">{message}</p>
      </div>
    </div>
  );
}
