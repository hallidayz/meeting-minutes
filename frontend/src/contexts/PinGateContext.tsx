'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AuthScreen } from '@/components/AuthScreen';
import { LoadingScreen } from '@/components/LoadingScreen';

interface PinGateContextValue {
  isUnlocked: boolean;
  lock: () => Promise<void>;
}

const PinGateContext = createContext<PinGateContextValue>({
  isUnlocked: false,
  lock: async () => {},
});

export function PinGateProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing local database…');
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let disposed = false;

    const loadStatus = async () => {
      try {
        const status = await invoke<{ enabled: boolean; unlocked: boolean }>('crypto_get_status');
        if (disposed) return;
        setEnabled(status.enabled);
        setNeedsSetup(!status.enabled);
        setUnlocked(status.unlocked);
        setLoading(false);
      } catch {
        if (disposed) return;
        // Database/AppState may not be ready yet; wait for initialization.
        setLoading(true);
      }
    };

    loadStatus();

    const unlistenPromise = listen('database-initialized', () => {
      setLoadingMessage('Loading encryption settings…');
      loadStatus();
    });

    return () => {
      disposed = true;
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleAuthenticate = async (pin: string) => {
    if (needsSetup) {
      await invoke('crypto_setup_encryption', { request: { pin } });
      setEnabled(true);
      setNeedsSetup(false);
    } else {
      await invoke('crypto_unlock', { request: { pin } });
    }
    setUnlocked(true);
  };

  const lock = async () => {
    await invoke('crypto_lock');
    setUnlocked(false);
  };

  if (loading) {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (enabled && !unlocked) {
    return <AuthScreen onAuthenticate={handleAuthenticate} isSetup={needsSetup} />;
  }

  if (!enabled && !unlocked) {
    return <AuthScreen onAuthenticate={handleAuthenticate} isSetup />;
  }

  return (
    <PinGateContext.Provider value={{ isUnlocked: unlocked, lock }}>
      {children}
    </PinGateContext.Provider>
  );
}

export const usePinGate = () => useContext(PinGateContext);
