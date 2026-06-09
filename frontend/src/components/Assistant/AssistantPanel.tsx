'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Trash2, X, Sparkles } from 'lucide-react';
import { useAssistant } from '@/contexts/AssistantContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'What did we discuss in my latest meeting?',
  'Find action items across my meetings',
  'Summarize meetings from this week',
];

export function AssistantPanel() {
  const router = useRouter();
  const {
    isOpen,
    messages,
    isLoading,
    error,
    closeAssistant,
    sendMessage,
    clearConversation,
  } = useAssistant();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  };

  return (
    <div
      className={cn(
        'fixed bottom-24 right-6 z-[99] flex flex-col',
        'w-[min(420px,calc(100vw-3rem))] h-[min(560px,calc(100vh-8rem))]',
        'rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-brand-primary text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <div>
            <p className="text-sm font-semibold">AI Guardian</p>
            <p className="text-[11px] opacity-80">Local assistant · private on-device</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearConversation}
            className="p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={closeAssistant}
            className="p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Close assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask about your meetings, transcripts, tasks, or get help using the app. Answers use
              your configured local LLM and stay on this device.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="text-left text-xs px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'text-sm rounded-2xl px-3 py-2 max-w-[92%]',
              msg.role === 'user'
                ? 'ml-auto bg-brand-primary text-white'
                : 'mr-auto bg-muted text-foreground'
            )}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                <p className="text-[10px] uppercase tracking-wide opacity-70">Sources</p>
                {msg.sources.slice(0, 3).map((source) => (
                  <button
                    key={`${msg.id}-${source.meetingId}`}
                    type="button"
                    onClick={() =>
                      router.push(`/meeting-details?id=${source.meetingId}`)
                    }
                    className="block text-left text-xs hover:underline opacity-90"
                  >
                    {source.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="text-sm text-muted-foreground animate-pulse">Thinking…</div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border/60 bg-muted/30">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about meetings, transcripts, or the app…"
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-brand-primary hover:opacity-90 text-white px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
