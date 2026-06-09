'use client'

import Sidebar from '@/components/Sidebar'
import { SidebarProvider } from '@/components/Sidebar/SidebarProvider'
import MainContent from '@/components/MainContent'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import { Toaster, toast } from 'sonner'
import 'sonner/dist/styles.css'
import { useState, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RecordingStateProvider } from '@/contexts/RecordingStateContext'
import { OllamaDownloadProvider } from '@/contexts/OllamaDownloadContext'
import { TranscriptProvider } from '@/contexts/TranscriptContext'
import { ConfigProvider } from '@/contexts/ConfigContext'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { OnboardingFlow } from '@/components/onboarding'
import { DownloadProgressToastProvider } from '@/components/shared/DownloadProgressToast'
import { UpdateCheckProvider } from '@/components/UpdateCheckProvider'
import { RecordingPostProcessingProvider } from '@/contexts/RecordingPostProcessingProvider'
import { PinGateProvider } from '@/contexts/PinGateContext'
import { LoadingScreen } from '@/components/LoadingScreen'
import { AssistantProvider } from '@/contexts/AssistantContext'
import { AssistantPanel } from '@/components/Assistant/AssistantPanel'
import { AssistantFab } from '@/components/Assistant/AssistantFab'

const CHUNK_RELOAD_KEY = 'chunk-reload-attempt'

function isChunkLoadError(message: string): boolean {
  return message.includes('ChunkLoadError') || message.includes('Loading chunk')
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [appReady, setAppReady] = useState(false)
  const [startupMessage, setStartupMessage] = useState('Starting AI Guardian…')

  // Recover when Next.js dev server is still compiling chunks on first load
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.message || ''
      if (!isChunkLoadError(message)) return

      const attempts = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0')
      if (attempts >= 3) {
        console.error('[ClientLayout] Chunk load failed after 3 retries')
        return
      }

      console.warn('[ClientLayout] Chunk load failed, retrying…', message)
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1))
      window.location.reload()
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  useEffect(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
  }, [])

  useEffect(() => {
    setStartupMessage('Checking setup status…')

    invoke<{ completed: boolean } | null>('get_onboarding_status')
      .then((status) => {
        const isComplete = status?.completed ?? false
        setOnboardingCompleted(isComplete)

        if (!isComplete) {
          console.log('[ClientLayout] Onboarding not completed, showing onboarding flow')
          setShowOnboarding(true)
        } else {
          console.log('[ClientLayout] Onboarding completed, showing main app')
        }
      })
      .catch((error) => {
        console.error('[ClientLayout] Failed to check onboarding status:', error)
        setShowOnboarding(true)
        setOnboardingCompleted(false)
      })
      .finally(() => setAppReady(true))
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      const handleContextMenu = (e: MouseEvent) => e.preventDefault()
      document.addEventListener('contextmenu', handleContextMenu)
      return () => document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  useEffect(() => {
    const unlisten = listen('request-recording-toggle', () => {
      console.log('[ClientLayout] Received request-recording-toggle from tray')

      if (showOnboarding) {
        toast.error('Please complete setup first', {
          description: 'You need to finish onboarding before you can start recording.',
        })
      } else {
        console.log('[ClientLayout] Forwarding to start-recording-from-sidebar')
        window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'))
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [showOnboarding])

  const handleOnboardingComplete = () => {
    console.log('[ClientLayout] Onboarding completed, reloading app')
    setShowOnboarding(false)
    setOnboardingCompleted(true)
    window.location.reload()
  }

  return (
    <AnalyticsProvider>
      <RecordingStateProvider>
        <TranscriptProvider>
          <ConfigProvider>
            <OllamaDownloadProvider>
              <OnboardingProvider>
                <UpdateCheckProvider>
                  <SidebarProvider>
                    <TooltipProvider>
                      <RecordingPostProcessingProvider>
                        <DownloadProgressToastProvider />

                        {!appReady && <LoadingScreen message={startupMessage} />}

                        {appReady && showOnboarding && (
                          <OnboardingFlow onComplete={handleOnboardingComplete} />
                        )}

                        {appReady && !showOnboarding && (
                          <AssistantProvider>
                            <PinGateProvider>
                              <div className="flex h-screen overflow-hidden">
                                <Sidebar />
                                <MainContent>{children}</MainContent>
                              </div>
                              <AssistantPanel />
                              <AssistantFab />
                            </PinGateProvider>
                          </AssistantProvider>
                        )}
                      </RecordingPostProcessingProvider>
                    </TooltipProvider>
                  </SidebarProvider>
                </UpdateCheckProvider>
              </OnboardingProvider>
            </OllamaDownloadProvider>
          </ConfigProvider>
        </TranscriptProvider>
      </RecordingStateProvider>
      <Toaster position="bottom-center" richColors closeButton />
    </AnalyticsProvider>
  )
}
