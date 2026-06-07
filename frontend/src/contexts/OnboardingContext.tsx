'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { PermissionStatus, OnboardingPermissions } from '@/types/onboarding';

const DEFAULT_WHISPER_MODEL = 'large-v3-turbo-q5_0';

interface OnboardingStatus {
  version: string;
  completed: boolean;
  current_step: number;
  model_status: {
    parakeet: string;
    summary: string;
  };
  last_updated: string;
}

interface SummaryModelProgressInfo {
  percent: number;
  downloadedMb: number;
  totalMb: number;
  speedMbps: number;
}

interface WhisperProgressInfo {
  percent: number;
  downloadedMb: number;
  totalMb: number;
  speedMbps: number;
}

interface OnboardingContextType {
  currentStep: number;
  whisperDownloaded: boolean;
  whisperProgress: number;
  whisperProgressInfo: WhisperProgressInfo;
  whisperModel: string;
  summaryModelDownloaded: boolean;
  summaryModelProgress: number;
  summaryModelProgressInfo: SummaryModelProgressInfo;
  selectedSummaryModel: string;
  databaseExists: boolean;
  isBackgroundDownloading: boolean;
  // Permissions
  permissions: OnboardingPermissions;
  permissionsSkipped: boolean;
  // Navigation
  goToStep: (step: number) => void;
  goNext: () => void;
  goPrevious: () => void;
  // Setters
  setWhisperDownloaded: (value: boolean) => void;
  setSummaryModelDownloaded: (value: boolean) => void;
  setSelectedSummaryModel: (value: string) => void;
  setDatabaseExists: (value: boolean) => void;
  setPermissionStatus: (permission: keyof OnboardingPermissions, status: PermissionStatus) => void;
  setPermissionsSkipped: (skipped: boolean) => void;
  completeOnboarding: () => Promise<void>;
  startBackgroundDownloads: (includeGemma: boolean) => Promise<void>;
  retryWhisperDownload: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [whisperDownloaded, setWhisperDownloaded] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState(0);
  const [whisperModel, setWhisperModel] = useState<string>(DEFAULT_WHISPER_MODEL);
  const [whisperProgressInfo, setWhisperProgressInfo] = useState<WhisperProgressInfo>({
    percent: 0,
    downloadedMb: 0,
    totalMb: 0,
    speedMbps: 0,
  });
  const [summaryModelDownloaded, setSummaryModelDownloaded] = useState(false);
  const [summaryModelProgress, setSummaryModelProgress] = useState(0);
  const [summaryModelProgressInfo, setSummaryModelProgressInfo] = useState<SummaryModelProgressInfo>({
    percent: 0,
    downloadedMb: 0,
    totalMb: 0,
    speedMbps: 0,
  });
  const [selectedSummaryModel, setSelectedSummaryModel] = useState<string>('gemma3:1b');
  const [databaseExists, setDatabaseExists] = useState(false);
  const [isBackgroundDownloading, setIsBackgroundDownloading] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState<OnboardingPermissions>({
    microphone: 'not_determined',
    systemAudio: 'not_determined',
    screenRecording: 'not_determined',
  });
  const [permissionsSkipped, setPermissionsSkipped] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Load status on mount and initialize database
  useEffect(() => {
    loadOnboardingStatus();
    checkDatabaseStatus();
    initializeDatabaseInBackground();

    // Fetch and set recommended model
    const fetchRecommendation = async () => {
      try {
        const recommendedModel = await invoke<string>('builtin_ai_get_recommended_model');
        setSelectedSummaryModel(recommendedModel);
        console.log('[OnboardingContext] Set recommended model:', recommendedModel);
      } catch (error) {
        console.error('[OnboardingContext] Failed to get recommended model:', error);
        // Keep default gemma3:1b
      }
    };
    fetchRecommendation();
  }, []);

  // Database is initialized during Rust app startup; only run manual legacy import if needed.
  const initializeDatabaseInBackground = async () => {
    try {
      console.log('[OnboardingContext] Checking database status');
      const isFirstLaunch = await invoke<boolean>('check_first_launch');
      setDatabaseExists(!isFirstLaunch);

      if (!isFirstLaunch) {
        console.log('[OnboardingContext] Database already initialized at startup');
        return;
      }

      // Startup already created a fresh DB or imported legacy automatically.
      console.log('[OnboardingContext] First launch database handled at startup');
      setDatabaseExists(true);
    } catch (error) {
      console.error('[OnboardingContext] Database initialization failed:', error);
    }
  };

  const performAutoDetection = async () => {
    // Check Homebrew (macOS only)
    if (typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac')) {
      const homebrewDbPath = '/usr/local/var/ai-guardian/meeting_minutes.db';
      try {
        const homebrewCheck = await invoke<{ exists: boolean; size: number } | null>(
          'check_homebrew_database',
          { path: homebrewDbPath }
        );

        if (homebrewCheck?.exists) {
          console.log('[OnboardingContext] Found Homebrew database, importing');
          await invoke('import_and_initialize_database', { legacyDbPath: homebrewDbPath });
          setDatabaseExists(true);
          return;
        }
      } catch (e) {
        console.log('[OnboardingContext] Homebrew check failed, continuing:', e);
      }
    }

    // Check default legacy database location
    try {
      const legacyPath = await invoke<string | null>('check_default_legacy_database');
      if (legacyPath) {
        console.log('[OnboardingContext] Found legacy database, importing');
        await invoke('import_and_initialize_database', { legacyDbPath: legacyPath });
        setDatabaseExists(true);
        return;
      }
    } catch (e) {
      console.log('[OnboardingContext] Legacy check failed, continuing:', e);
    }

    // No legacy database found - initialize fresh
    console.log('[OnboardingContext] No legacy database found, initializing fresh');
    await invoke('initialize_fresh_database');
    setDatabaseExists(true);
  };

  const isCompletingRef = useRef(false);

  // Auto-save on state change (debounced)
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    // Don't auto-save if completed (to avoid overwriting completion status)
    // Also don't auto-save if we are currently in the process of completing
    if (completed || isCompletingRef.current) return;

    saveTimeoutRef.current = setTimeout(() => {
      saveOnboardingStatus();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [currentStep, whisperDownloaded, summaryModelDownloaded, completed]);

  // Fetch recommended Whisper.cpp model for onboarding download
  useEffect(() => {
    invoke<string>('whisper_get_recommended_model')
      .then((model) => {
        setWhisperModel(model);
        setWhisperProgressInfo((prev) => ({
          ...prev,
          totalMb: model.includes('large-v3-turbo') ? 574 : model.includes('small') ? 280 : 85,
        }));
      })
      .catch(() => setWhisperModel(DEFAULT_WHISPER_MODEL));
  }, []);

  // Listen to Whisper.cpp download progress
  useEffect(() => {
    const unlisten = listen<{ modelName: string; progress: number }>(
      'model-download-progress',
      (event) => {
        const { modelName, progress } = event.payload;
        if (modelName === whisperModel) {
          setWhisperProgress(progress);
          setWhisperProgressInfo((prev) => ({
            ...prev,
            percent: progress,
            downloadedMb: (prev.totalMb * progress) / 100,
          }));
          if (progress >= 100) {
            setWhisperDownloaded(true);
          }
        }
      }
    );

    const unlistenComplete = listen<{ modelName: string }>(
      'model-download-complete',
      (event) => {
        if (event.payload.modelName === whisperModel) {
          setWhisperDownloaded(true);
          setWhisperProgress(100);
        }
      }
    );

    const unlistenError = listen<{ modelName: string; error: string }>(
      'model-download-error',
      (event) => {
        if (event.payload.modelName === whisperModel) {
          console.error('Whisper download error:', event.payload.error);
        }
      }
    );

    return () => {
      unlisten.then(fn => fn());
      unlistenComplete.then(fn => fn());
      unlistenError.then(fn => fn());
    };
  }, [whisperModel]);

  // Listen to summary model (Built-in AI) download progress
  useEffect(() => {
    const unlisten = listen<{
      model: string;
      progress: number;
      downloaded_mb?: number;
      total_mb?: number;
      speed_mbps?: number;
      status: string;
    }>(
      'builtin-ai-download-progress',
      (event) => {
        const { model, progress, downloaded_mb, total_mb, speed_mbps, status } = event.payload;
        // Check if this is the selected summary model (gemma3:1b or gemma3:4b)
        if (model === selectedSummaryModel || model === 'gemma3:1b' || model === 'gemma3:4b') {
          setSummaryModelProgress(progress);
          setSummaryModelProgressInfo({
            percent: progress,
            downloadedMb: downloaded_mb ?? 0,
            totalMb: total_mb ?? 0,
            speedMbps: speed_mbps ?? 0,
          });
          if (status === 'completed' || progress >= 100) {
            setSummaryModelDownloaded(true);
          }
        }
      }
    );

    return () => {
      unlisten.then(fn => fn());
    };
  }, [selectedSummaryModel]);

  const checkDatabaseStatus = async () => {
    try {
      const isFirstLaunch = await invoke<boolean>('check_first_launch');
      setDatabaseExists(!isFirstLaunch);
      console.log('[OnboardingContext] Database exists:', !isFirstLaunch);
    } catch (error) {
      console.error('[OnboardingContext] Failed to check database status:', error);
      setDatabaseExists(false);
    }
  };

  const loadOnboardingStatus = async () => {
    try {
      const status = await invoke<OnboardingStatus | null>('get_onboarding_status');
      if (status) {
        console.log('[OnboardingContext] Loaded saved status:', status);

        // Don't trust saved status - verify actual model status on disk
        const verifiedStatus = await verifyModelStatus(status);

        setCurrentStep(verifiedStatus.currentStep);
        setCompleted(verifiedStatus.completed);
        setWhisperDownloaded(verifiedStatus.whisperDownloaded);
        setSummaryModelDownloaded(verifiedStatus.summaryModelDownloaded);

        console.log('[OnboardingContext] Verified status:', verifiedStatus);

        // Check if any downloads are active to restore isBackgroundDownloading state
        await checkActiveDownloads();
      }
    } catch (error) {
      console.error('[OnboardingContext] Failed to load onboarding status:', error);
    }
  };

  // Verify that models actually exist on disk, not just trust saved JSON
  const verifyModelStatus = async (savedStatus: OnboardingStatus) => {
    let whisperDownloaded = false;
    let summaryModelDownloaded = false;

    try {
      await invoke('whisper_init');
      whisperDownloaded = await invoke<boolean>('whisper_has_available_models');
      console.log('[OnboardingContext] Whisper verified on disk:', whisperDownloaded);
    } catch (error) {
      console.warn('[OnboardingContext] Failed to verify Whisper:', error);
      whisperDownloaded = false;
    }

    // Verify Summary model exists on disk - check if ANY model is available
    // Onboarding always uses builtin-ai (local models)
    try {
      const availableModel = await invoke<string | null>('builtin_ai_get_available_summary_model');
      summaryModelDownloaded = !!availableModel;
      console.log('[OnboardingContext] Summary model verified on disk:', summaryModelDownloaded, 'model:', availableModel);
    } catch (error) {
      console.warn('[OnboardingContext] Failed to verify Summary model:', error);
      summaryModelDownloaded = false;
    }

    // Determine the correct step based on verified status
    // New simplified flow: Step 1: Welcome, Step 2: Setup Overview, Step 3: Download Progress, Step 4: Permissions (macOS)
    let currentStep = savedStatus.current_step;
    let completed = savedStatus.completed;

    // Clamp step to new max (4)
    if (currentStep > 4) {
      currentStep = 3; // Go to download progress step
    }

    // Trust the completed status - don't revert based on model downloads
    // Downloads continue in background; user stays in main app regardless
    return {
      currentStep,
      completed,
      whisperDownloaded,
      summaryModelDownloaded,
    };
  };

  const saveOnboardingStatus = async () => {
    // Safety check: if we are in the process of completing, DO NOT save
    // This prevents a race condition where a download completion event triggers a save
    // that overwrites the "completed" status set by completeOnboarding
    if (isCompletingRef.current) {
      console.log('[OnboardingContext] Skipping saveOnboardingStatus because completion is in progress');
      return;
    }

    try {
      await invoke('save_onboarding_status_cmd', {
        status: {
          version: '1.0',
          completed: completed,
          current_step: currentStep,
          model_status: {
            parakeet: whisperDownloaded ? 'downloaded' : 'not_downloaded',
            summary: summaryModelDownloaded ? 'downloaded' : 'not_downloaded',
          },
          last_updated: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[OnboardingContext] Failed to save onboarding status:', error);
    }
  };

  const completeOnboarding = async () => {
    try {
      // Set completion flag to prevent race conditions with auto-save
      isCompletingRef.current = true;

      // Clear any pending auto-saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = undefined;
      }

      // Onboarding always uses builtin-ai with selected model
      await invoke('complete_onboarding', {
        model: selectedSummaryModel,
      });
      setCompleted(true);
      console.log('[OnboardingContext] Onboarding completed with model:', selectedSummaryModel);

      // Reset the flag so subsequent state updates can be saved
      isCompletingRef.current = false;
    } catch (error) {
      console.error('[OnboardingContext] Failed to complete onboarding:', error);
      isCompletingRef.current = false; // Reset flag on error
      throw error; // Re-throw so PermissionsStep can handle it
    }
  };

  const startBackgroundDownloads = async (includeGemma: boolean) => {
    console.log('[OnboardingContext] Starting background downloads, includeGemma:', includeGemma);
    setIsBackgroundDownloading(true);

    try {
      if (!whisperDownloaded) {
        const modelToDownload = whisperModel || DEFAULT_WHISPER_MODEL;
        console.log('[OnboardingContext] Starting Whisper.cpp download:', modelToDownload);
        invoke('whisper_download_model', { modelName: modelToDownload })
          .catch(err => console.error('[OnboardingContext] Whisper download failed:', err));
      }

      if (includeGemma && !summaryModelDownloaded) {
        setTimeout(() => {
          console.log('[OnboardingContext] Starting summary model download (delayed)');
          invoke('builtin_ai_download_model', { modelName: selectedSummaryModel || 'gemma3:1b' })
            .catch(err => console.error('[OnboardingContext] Summary download failed:', err));
        }, 3000);
      }
    } catch (error) {
      console.error('[OnboardingContext] Failed to start background downloads:', error);
      setIsBackgroundDownloading(false);
      throw error;
    }
  };

  // Check if any models are currently downloading (for re-entry)
  const checkActiveDownloads = async () => {
    try {
      const models = await invoke<any[]>('whisper_get_available_models');
      const isDownloading = models.some(m => m.status && (typeof m.status === 'object' ? 'Downloading' in m.status : m.status === 'Downloading'));
      
      if (isDownloading) {
        console.log('[OnboardingContext] Detected active background downloads on mount');
        setIsBackgroundDownloading(true);
      }
      
      // Also check for Gemma/Built-in AI downloads if possible (though less critical as Parakeet is the main blocker)
      
    } catch (error) {
      console.warn('[OnboardingContext] Failed to check active downloads:', error);
    }
  };

  const retryWhisperDownload = async () => {
    console.log('[OnboardingContext] Retrying Whisper download');
    try {
      await invoke('whisper_download_model', { modelName: whisperModel || DEFAULT_WHISPER_MODEL });
    } catch (error) {
      console.error('[OnboardingContext] Retry failed:', error);
      throw error;
    }
  };

  const setPermissionStatus = useCallback((permission: keyof OnboardingPermissions, status: PermissionStatus) => {
    setPermissions((prev: OnboardingPermissions) => ({
      ...prev,
      [permission]: status,
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(1, Math.min(step, 4)));
  }, []);

  const goNext = useCallback(() => {
    setCurrentStep((prev: number) => {
      const next = prev + 1;
      // Don't go past step 4
      return Math.min(next, 4);
    });
  }, []);

  const goPrevious = useCallback(() => {
    setCurrentStep((prev: number) => {
      const previous = prev - 1;
      // Don't go below step 1
      return Math.max(previous, 1);
    });
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        whisperDownloaded,
        whisperProgress,
        whisperProgressInfo,
        whisperModel,
        summaryModelDownloaded,
        summaryModelProgress,
        summaryModelProgressInfo,
        selectedSummaryModel,
        databaseExists,
        isBackgroundDownloading,
        permissions,
        permissionsSkipped,
        goToStep,
        goNext,
        goPrevious,
        setWhisperDownloaded,
        setSummaryModelDownloaded,
        setSelectedSummaryModel,
        setDatabaseExists,
        setPermissionStatus,
        setPermissionsSkipped,
        completeOnboarding,
        startBackgroundDownloads,
        retryWhisperDownload,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
