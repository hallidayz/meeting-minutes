import React, { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import Image from 'next/image';
import AnalyticsConsentSwitch from "./AnalyticsConsentSwitch";
import { UpdateDialog } from "./UpdateDialog";
import { updateService, UpdateInfo } from '@/services/updateService';
import { Button } from './ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND } from '@/config/branding';


export function About() {
    const [currentVersion, setCurrentVersion] = useState<string>('0.2.0');
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);

    useEffect(() => {
        getVersion().then(setCurrentVersion).catch(console.error);
    }, []);

    const handleContactClick = async () => {
        try {
            await invoke('open_external_url', { url: BRAND.repoUrl });
        } catch (error) {
            console.error('Failed to open link:', error);
        }
    };

    const handleCheckForUpdates = async () => {
        setIsChecking(true);
        try {
            const info = await updateService.checkForUpdates(true);
            setUpdateInfo(info);
            if (info.available) {
                setShowUpdateDialog(true);
            } else {
                toast.success('You are running the latest version');
            }
        } catch (error: any) {
            console.error('Failed to check for updates:', error);
            toast.error('Failed to check for updates: ' + (error.message || 'Unknown error'));
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="p-4 space-y-4 h-[80vh] overflow-y-auto">
            <div className="text-center">
                <div className="mb-3">
                    <Image
                        src="/brand/logo.png"
                        alt={BRAND.name}
                        width={120}
                        height={48}
                        className="mx-auto rounded"
                    />
                </div>
                <h1 className="text-lg font-bold tracking-widest text-brand-primary">{BRAND.name}</h1>
                <p className="text-xs tracking-widest text-brand-accent font-semibold">{BRAND.taglinePrimary}</p>
                <p className="text-xs tracking-widest text-gray-500">{BRAND.taglineSecondary}</p>
                <span className="text-sm text-gray-500"> v{currentVersion}</span>
                <p className="text-medium text-gray-600 mt-2">{BRAND.privacyBadge}</p>
                <div className="mt-3">
                    <Button
                        onClick={handleCheckForUpdates}
                        disabled={isChecking}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                    >
                        {isChecking ? (
                            <>
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-3 w-3 mr-2" />
                                Check for Updates
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-base font-semibold text-gray-800">What makes {BRAND.shortName} different</h2>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded p-3">
                        <h3 className="font-bold text-sm text-gray-900 mb-1">Encrypted at rest</h3>
                        <p className="text-xs text-gray-600">PIN-protected AES-GCM encryption keeps transcripts and summaries private on your device.</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                        <h3 className="font-bold text-sm text-gray-900 mb-1">Live transcription</h3>
                        <p className="text-xs text-gray-600">GPU-accelerated Whisper and Parakeet engines transcribe meetings in real time.</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                        <h3 className="font-bold text-sm text-gray-900 mb-1">Industry-aware AI</h3>
                        <p className="text-xs text-gray-600">Medical, legal, therapy, business, and education summary templates.</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                        <h3 className="font-bold text-sm text-gray-900 mb-1">Task management</h3>
                        <p className="text-xs text-gray-600">Promote action items from summaries into a standalone task list.</p>
                    </div>
                </div>
            </div>

            <div className="text-center space-y-2">
                <button
                    onClick={handleContactClick}
                    className="inline-flex items-center px-4 py-2 bg-brand-primary hover:opacity-90 text-white text-sm font-medium rounded"
                >
                    View on GitHub
                </button>
            </div>

            <div className="pt-2 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">Forked from AI Guardian (MIT). Built as {BRAND.name}.</p>
            </div>
            <AnalyticsConsentSwitch />

            <UpdateDialog
                open={showUpdateDialog}
                onOpenChange={setShowUpdateDialog}
                updateInfo={updateInfo}
            />
        </div>
    )
}
