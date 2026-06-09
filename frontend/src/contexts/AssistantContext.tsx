'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ meetingId: string; title: string; snippet: string }>;
}

interface AssistantContextValue {
  isOpen: boolean;
  messages: AssistantMessage[];
  isLoading: boolean;
  error: string | null;
  openAssistant: (hint?: string) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  sendMessage: (text: string) => Promise<void>;
  clearConversation: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

function newId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getMeetingIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  if (!window.location.pathname.includes('/meeting-details')) return null;
  return new URLSearchParams(window.location.search).get('id');
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingHint, setPendingHint] = useState<string | null>(null);

  const openAssistant = useCallback((hint?: string) => {
    setIsOpen(true);
    if (hint?.trim()) {
      setPendingHint(hint.trim());
    }
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
    setPendingHint(null);
  }, []);

  const toggleAssistant = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: AssistantMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const history = [...messages, userMessage].slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await invoke<{
          reply: string;
          sources: Array<{ meetingId: string; title: string; snippet: string }>;
        }>('api_assistant_chat', {
          request: {
            message: trimmed,
            history,
            meetingId: getMeetingIdFromUrl(),
          },
        });

        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: response.reply,
            sources: response.sources,
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  React.useEffect(() => {
    if (!isOpen || !pendingHint || isLoading) return;
    const hint = pendingHint;
    setPendingHint(null);
    void sendMessage(hint);
  }, [isOpen, pendingHint, isLoading, sendMessage]);

  const value = useMemo(
    () => ({
      isOpen,
      messages,
      isLoading,
      error,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      sendMessage,
      clearConversation,
    }),
    [
      isOpen,
      messages,
      isLoading,
      error,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      sendMessage,
      clearConversation,
    ]
  );

  return (
    <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    throw new Error('useAssistant must be used within AssistantProvider');
  }
  return ctx;
}
