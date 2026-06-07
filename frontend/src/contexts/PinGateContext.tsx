'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AuthScreen } from '@/components/AuthScreen';

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
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    invoke<{ enabled: boolean; unlocked: boolean }>('crypto_get_status')
      .then((status) => {
        setEnabled(status.enabled);
        setNeedsSetup(!status.enabled);
        setUnlocked(status.unlocked);
      })
      .catch(() => setNeedsSetup(true))
      .finally(() => setLoading(false));
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
    return <div className="min-h-screen bg-brand-background" />;
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
