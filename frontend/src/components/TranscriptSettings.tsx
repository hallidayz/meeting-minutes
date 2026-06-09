import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { ModelManager } from './WhisperModelManager';
import {
    ModelInfo,
    WhisperAPI,
    getDownloadedModelsForTier,
    getRecommendedModelForTier,
    getWhisperModelDisplayName,
} from '../lib/whisper';

export interface TranscriptModelProps {
    provider: 'localWhisper' | 'fastWhisper' | 'deepgram' | 'elevenLabs' | 'groq' | 'openai';
    model: string;
    apiKey?: string | null;
}

export interface TranscriptSettingsProps {
    transcriptModelConfig: TranscriptModelProps;
    setTranscriptModelConfig: (config: TranscriptModelProps) => void;
    onModelSelect?: () => void;
}

export function TranscriptSettings({ transcriptModelConfig, setTranscriptModelConfig, onModelSelect }: TranscriptSettingsProps) {
    const [apiKey, setApiKey] = useState<string | null>(transcriptModelConfig.apiKey || null);
    const [showApiKey, setShowApiKey] = useState<boolean>(false);
    const [isApiKeyLocked, setIsApiKeyLocked] = useState<boolean>(true);
    const [isLockButtonVibrating, setIsLockButtonVibrating] = useState<boolean>(false);
    const [accurateModel, setAccurateModel] = useState<string>(
        transcriptModelConfig.provider === 'localWhisper'
            ? transcriptModelConfig.model
            : getRecommendedModelForTier('accurate')
    );
    const [fastModel, setFastModel] = useState<string>(
        transcriptModelConfig.provider === 'fastWhisper'
            ? transcriptModelConfig.model
            : getRecommendedModelForTier('fast')
    );
    const [whisperModels, setWhisperModels] = useState<ModelInfo[]>([]);

    const isWhisperProvider =
        transcriptModelConfig.provider === 'localWhisper'
        || transcriptModelConfig.provider === 'fastWhisper';
    const activeTier = transcriptModelConfig.provider === 'fastWhisper' ? 'fast' : 'accurate';
    const downloadedModels = useMemo(
        () => getDownloadedModelsForTier(whisperModels, activeTier),
        [whisperModels, activeTier]
    );
    const activeModelName = transcriptModelConfig.provider === 'fastWhisper' ? fastModel : accurateModel;

    useEffect(() => {
        if (transcriptModelConfig.provider === 'localWhisper' || transcriptModelConfig.provider === 'fastWhisper') {
            setApiKey(null);
        }
    }, [transcriptModelConfig.provider]);

    useEffect(() => {
        let unlistenComplete: (() => void) | null = null;

        const refreshModels = async () => {
            try {
                await WhisperAPI.init();
                const list = await WhisperAPI.getAvailableModels();
                setWhisperModels(list);
            } catch (err) {
                console.error('Failed to refresh whisper models:', err);
            }
        };

        refreshModels();

        const setupListener = async () => {
            unlistenComplete = await listen<{ modelName: string }>('model-download-complete', () => {
                refreshModels();
            });
        };
        setupListener();

        return () => {
            if (unlistenComplete) unlistenComplete();
        };
    }, []);

    const fetchApiKey = async (provider: string) => {
        try {
            const data = await invoke('api_get_transcript_api_key', { provider }) as string;
            setApiKey(data || '');
        } catch (err) {
            console.error('Error fetching API key:', err);
            setApiKey(null);
        }
    };

    const modelOptions = {
        localWhisper: [accurateModel],
        fastWhisper: [fastModel],
        deepgram: ['nova-2-phonecall'],
        elevenLabs: ['eleven_multilingual_v2'],
        groq: ['llama-3.3-70b-versatile'],
        openai: ['gpt-4o'],
    };

    const requiresApiKey = transcriptModelConfig.provider === 'deepgram'
        || transcriptModelConfig.provider === 'elevenLabs'
        || transcriptModelConfig.provider === 'openai'
        || transcriptModelConfig.provider === 'groq';

    const handleInputClick = () => {
        if (isApiKeyLocked) {
            setIsLockButtonVibrating(true);
            setTimeout(() => setIsLockButtonVibrating(false), 500);
        }
    };

    const saveWhisperModel = async (modelName: string, provider: 'localWhisper' | 'fastWhisper') => {
        try {
            await invoke('api_save_transcript_config', {
                provider,
                model: modelName,
                apiKey: null,
            });
        } catch (error) {
            console.error('Failed to save transcript model:', error);
        }
    };

    const handleWhisperModelSelect = (modelName: string, tier: 'accurate' | 'fast') => {
        if (tier === 'accurate') {
            setAccurateModel(modelName);
        } else {
            setFastModel(modelName);
        }

        if (activeTier === tier) {
            setTranscriptModelConfig({
                ...transcriptModelConfig,
                model: modelName,
            });
            onModelSelect?.();
        }
    };

    const handleDownloadedModelDropdown = async (modelName: string) => {
        const provider = activeTier === 'fast' ? 'fastWhisper' : 'localWhisper';
        if (activeTier === 'accurate') {
            setAccurateModel(modelName);
        } else {
            setFastModel(modelName);
        }
        setTranscriptModelConfig({
            ...transcriptModelConfig,
            provider,
            model: modelName,
        });
        await saveWhisperModel(modelName, provider);
        onModelSelect?.();
    };

    const handleProviderChange = async (provider: TranscriptModelProps['provider']) => {
        let newModel = modelOptions[provider][0];

        if (provider === 'localWhisper') {
            try {
                newModel = await invoke<string>('whisper_get_recommended_model');
                setAccurateModel(newModel);
            } catch {
                newModel = accurateModel || getRecommendedModelForTier('accurate');
            }
        } else if (provider === 'fastWhisper') {
            try {
                newModel = await invoke<string>('whisper_get_recommended_fast_model');
                setFastModel(newModel);
            } catch {
                newModel = fastModel || getRecommendedModelForTier('fast');
            }
        }

        setTranscriptModelConfig({ ...transcriptModelConfig, provider, model: newModel });

        if (provider !== 'localWhisper' && provider !== 'fastWhisper') {
            fetchApiKey(provider);
        }
    };

    return (
        <div>
            <div>
                <div className="space-y-4 pb-6">
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">
                            Transcript Model
                        </Label>
                        <div className="flex space-x-2 mx-1">
                            <Select
                                value={transcriptModelConfig.provider}
                                onValueChange={(value) => handleProviderChange(value as TranscriptModelProps['provider'])}
                            >
                                <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="localWhisper">Whisper.cpp (Recommended — Max Accuracy)</SelectItem>
                                    <SelectItem value="fastWhisper">Fast-Whisper (Speed Optimized)</SelectItem>
                                </SelectContent>
                            </Select>

                            {requiresApiKey && (
                                <Select
                                    value={transcriptModelConfig.model}
                                    onValueChange={(value) => {
                                        setTranscriptModelConfig({ ...transcriptModelConfig, model: value });
                                    }}
                                >
                                    <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {modelOptions[transcriptModelConfig.provider].map((model) => (
                                            <SelectItem key={model} value={model}>{model}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {isWhisperProvider && (
                                <Select
                                    value={
                                        downloadedModels.some((m) => m.name === activeModelName)
                                            ? activeModelName
                                            : undefined
                                    }
                                    onValueChange={handleDownloadedModelDropdown}
                                    disabled={downloadedModels.length === 0}
                                >
                                    <SelectTrigger className='min-w-[200px] focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                        <SelectValue
                                            placeholder={
                                                downloadedModels.length === 0
                                                    ? 'Download a model below'
                                                    : 'Select downloaded model'
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {downloadedModels.map((model) => (
                                            <SelectItem key={model.name} value={model.name}>
                                                {getWhisperModelDisplayName(model.name)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    {transcriptModelConfig.provider === 'localWhisper' && (
                        <div className="mt-6">
                            <ModelManager
                                selectedModel={accurateModel}
                                onModelSelect={(model) => handleWhisperModelSelect(model, 'accurate')}
                                onModelsChange={setWhisperModels}
                                autoSave={true}
                                modelTier="accurate"
                            />
                        </div>
                    )}

                    {transcriptModelConfig.provider === 'fastWhisper' && (
                        <div className="mt-6">
                            <ModelManager
                                selectedModel={fastModel}
                                onModelSelect={(model) => handleWhisperModelSelect(model, 'fast')}
                                onModelsChange={setWhisperModels}
                                autoSave={true}
                                modelTier="fast"
                            />
                        </div>
                    )}

                    {requiresApiKey && (
                        <div>
                            <Label className="block text-sm font-medium text-gray-700 mb-1">
                                API Key
                            </Label>
                            <div className="relative mx-1">
                                <Input
                                    type={showApiKey ? "text" : "password"}
                                    className={`pr-24 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${isApiKeyLocked ? 'bg-gray-100 cursor-not-allowed' : ''
                                        }`}
                                    value={apiKey || ''}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    disabled={isApiKeyLocked}
                                    onClick={handleInputClick}
                                    placeholder="Enter your API key"
                                />
                                {isApiKeyLocked && (
                                    <div
                                        onClick={handleInputClick}
                                        className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 rounded-md cursor-not-allowed"
                                    />
                                )}
                                <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsApiKeyLocked(!isApiKeyLocked)}
                                        className={`transition-colors duration-200 ${isLockButtonVibrating ? 'animate-vibrate text-red-500' : ''
                                            }`}
                                        title={isApiKeyLocked ? "Unlock to edit" : "Lock to prevent editing"}
                                    >
                                        {isApiKeyLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                    >
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
