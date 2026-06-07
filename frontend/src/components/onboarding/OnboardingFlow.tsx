import React, { useEffect } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  WelcomeStep,
  PermissionsStep,
  DownloadProgressStep,
  SetupOverviewStep,
} from './steps';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { currentStep } = useOnboarding();
  const [isMac, setIsMac] = React.useState(false);

  useEffect(() => {
    const checkPlatform = async () => {
      const isTauri =
        typeof window !== 'undefined' &&
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

      if (!isTauri) {
        setIsMac(navigator.userAgent.includes('Mac'));
        return;
      }

      try {
        const { platform } = await import('@tauri-apps/plugin-os');
        setIsMac(platform() === 'macos');
      } catch (e) {
        console.warn('Failed to detect platform via Tauri plugin, using user agent:', e);
        setIsMac(navigator.userAgent.includes('Mac'));
      }
    };
    checkPlatform();
  }, []);

  // 4-Step Onboarding Flow (System-Recommended Models):
  // Step 1: Welcome - Introduce AI Guardian features
  // Step 2: Setup Overview - Database initialization + show recommended downloads
  // Step 3: Download Progress - Download Whisper.cpp + Gemma (auto-selected based on RAM)
  // Step 4: Permissions - Request mic + system audio (macOS only)

  return (
    <div className="onboarding-flow">
      {currentStep === 1 && <WelcomeStep />}
      {currentStep === 2 && <SetupOverviewStep />}
      {currentStep === 3 && <DownloadProgressStep />}
      {currentStep === 4 && isMac && <PermissionsStep />}
    </div>
  );
}
