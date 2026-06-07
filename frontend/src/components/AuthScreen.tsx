'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { BRAND } from '@/config/branding';

interface AuthScreenProps {
  onAuthenticate: (pin: string) => void;
  isSetup?: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticate, isSetup = false }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    if (isSetup && pin !== confirmPin) return;
    onAuthenticate(pin);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-background">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-200">
        <div className="text-center mb-6">
          <Image src="/brand/logo.png" alt={BRAND.name} width={160} height={64} className="mx-auto rounded mb-3" />
          <h1 className="text-xl font-bold tracking-widest text-brand-primary">{BRAND.name}</h1>
          <p className="text-xs tracking-widest text-brand-accent font-semibold mt-1">{BRAND.taglinePrimary}</p>
          <p className="text-sm text-gray-600 mt-3">
            {isSetup ? 'Create a PIN to encrypt your meetings locally.' : 'Enter your PIN to unlock.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          <div>
            <label htmlFor="app-pin" className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
            <input
              id="app-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              placeholder="Enter your PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>
          {isSetup && (
            <div>
              <label htmlFor="confirm-pin" className="block text-sm font-medium text-gray-700 mb-1">Confirm PIN</label>
              <input
                id="confirm-pin"
                name="confirmPin"
                type="password"
                inputMode="numeric"
                placeholder="Confirm your PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full py-2 rounded-md bg-brand-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
            disabled={pin.length < 4 || (isSetup && pin !== confirmPin)}
          >
            {isSetup ? 'Set PIN & Unlock' : 'Unlock'}
          </button>
        </form>
        <p className="text-xs text-gray-500 text-center mt-4">{BRAND.privacyBadge}</p>
      </div>
    </div>
  );
};
