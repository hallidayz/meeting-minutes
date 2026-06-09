// audio/transcription/engine.rs
//
// TranscriptionEngine enum and model initialization/validation logic.

use super::provider::TranscriptionProvider;
use log::{info, warn};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime};

// ============================================================================
// TRANSCRIPTION ENGINE ENUM
// ============================================================================

// Transcription engine abstraction to support multiple providers
pub enum TranscriptionEngine {
    Whisper(Arc<crate::whisper_engine::WhisperEngine>),  // Direct access (backward compat)
    Parakeet(Arc<crate::parakeet_engine::ParakeetEngine>), // Direct access (backward compat)
    Provider(Arc<dyn TranscriptionProvider>),  // Trait-based (preferred for new code)
}

impl TranscriptionEngine {
    /// Check if the engine has a model loaded
    pub async fn is_model_loaded(&self) -> bool {
        match self {
            Self::Whisper(engine) => engine.is_model_loaded().await,
            Self::Parakeet(engine) => engine.is_model_loaded().await,
            Self::Provider(provider) => provider.is_model_loaded().await,
        }
    }

    /// Get the current model name
    pub async fn get_current_model(&self) -> Option<String> {
        match self {
            Self::Whisper(engine) => engine.get_current_model().await,
            Self::Parakeet(engine) => engine.get_current_model().await,
            Self::Provider(provider) => provider.get_current_model().await,
        }
    }

    /// Get the provider name for logging
    pub fn provider_name(&self) -> &str {
        match self {
            Self::Whisper(_) => "Whisper (direct)",
            Self::Parakeet(_) => "Parakeet (direct)",
            Self::Provider(provider) => provider.provider_name(),
        }
    }
}

// ============================================================================
// MODEL VALIDATION AND INITIALIZATION
// ============================================================================

fn default_transcript_config() -> crate::api::api::TranscriptConfig {
    crate::api::api::TranscriptConfig {
        provider: crate::whisper_engine::DEFAULT_TRANSCRIPT_PROVIDER.to_string(),
        model: crate::whisper_engine::recommended_whisper_model().to_string(),
        api_key: None,
    }
}

/// Prefer the configured model when downloaded; otherwise use the best available fallback.
fn resolve_whisper_model_to_load(
    models: &[crate::whisper_engine::ModelInfo],
    configured_model: &str,
) -> Result<String, String> {
    use crate::whisper_engine::ModelStatus;

    let available: Vec<_> = models
        .iter()
        .filter(|m| matches!(m.status, ModelStatus::Available))
        .collect();

    if available.is_empty() {
        return Err(
            "No Whisper models are downloaded. Please download a model from Settings before recording."
                .to_string(),
        );
    }

    if let Some(preferred) = models.iter().find(|m| m.name == configured_model) {
        match preferred.status {
            ModelStatus::Available => return Ok(configured_model.to_string()),
            ModelStatus::Downloading { progress } => {
                return Err(format!(
                    "Model '{}' is still downloading ({}%). Please wait for it to finish.",
                    configured_model, progress
                ));
            }
            ModelStatus::Missing => {
                warn!(
                    "Configured model '{}' is not downloaded; falling back to '{}'",
                    configured_model, available[0].name
                );
            }
            ModelStatus::Error(ref err) => {
                warn!(
                    "Configured model '{}' has error ({}); falling back to '{}'",
                    configured_model, err, available[0].name
                );
            }
            ModelStatus::Corrupted { .. } => {
                warn!(
                    "Configured model '{}' is corrupted; falling back to '{}'",
                    configured_model, available[0].name
                );
            }
        }
    } else {
        warn!(
            "Configured model '{}' is not supported; falling back to '{}'",
            configured_model, available[0].name
        );
    }

    Ok(available[0].name.clone())
}

fn configured_model_is_available(
    models: &[crate::whisper_engine::ModelInfo],
    configured_model: &str,
) -> bool {
    models.iter().any(|m| {
        m.name == configured_model && matches!(m.status, crate::whisper_engine::ModelStatus::Available)
    })
}

/// Validate that transcription models (Whisper or Parakeet) are ready before starting recording
pub async fn validate_transcription_model_ready<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    // Check transcript configuration to determine which engine to validate
    let config = match crate::api::api::api_get_transcript_config(
        app.clone(),
        app.clone().state(),
        None,
    )
    .await
    {
        Ok(Some(config)) => {
            info!(
                "📝 Found transcript config - provider: {}, model: {}",
                config.provider, config.model
            );
            config
        }
        Ok(None) => {
            info!("📝 No transcript config found, defaulting to Whisper.cpp");
            default_transcript_config()
        }
        Err(e) => {
            warn!("⚠️ Failed to get transcript config: {}, defaulting to Whisper.cpp", e);
            default_transcript_config()
        }
    };

    // Validate based on provider
    match config.provider.as_str() {
        "localWhisper" | "fastWhisper" => {
            info!("🔍 Validating Whisper model (provider: {})...", config.provider);
            // Ensure whisper engine is initialized first
            if let Err(init_error) = crate::whisper_engine::commands::whisper_init().await {
                warn!("❌ Failed to initialize Whisper engine: {}", init_error);
                return Err(format!(
                    "Failed to initialize speech recognition: {}",
                    init_error
                ));
            }

            // Call the whisper validation command with config support
            match crate::whisper_engine::commands::whisper_validate_model_ready_with_config(app).await {
                Ok(model_name) => {
                    info!("✅ Whisper model validation successful: {} is ready", model_name);
                    Ok(())
                }
                Err(e) => {
                    warn!("❌ Whisper model validation failed: {}", e);
                    Err(e)
                }
            }
        }
        "parakeet" => {
            info!("🔍 Validating Parakeet model...");
            // Ensure parakeet engine is initialized first
            if let Err(init_error) = crate::parakeet_engine::commands::parakeet_init().await {
                warn!("❌ Failed to initialize Parakeet engine: {}", init_error);
                return Err(format!(
                    "Failed to initialize Parakeet speech recognition: {}",
                    init_error
                ));
            }

            // Use the validation command that includes auto-discovery and loading
            // This matches the Whisper behavior for consistency
            match crate::parakeet_engine::commands::parakeet_validate_model_ready_with_config(app).await {
                Ok(model_name) => {
                    info!("✅ Parakeet model validation successful: {} is ready", model_name);
                    Ok(())
                }
                Err(e) => {
                    warn!("❌ Parakeet model validation failed: {}", e);
                    Err(e)
                }
            }
        }
        other => {
            warn!("❌ Unsupported transcription provider for local recording: {}", other);
            Err(format!(
                "Provider '{}' is not supported for local transcription. Please select 'localWhisper' or 'fastWhisper'.",
                other
            ))
        }
    }
}

/// Get or initialize the appropriate transcription engine based on provider configuration
pub async fn get_or_init_transcription_engine<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<TranscriptionEngine, String> {
    // Get provider configuration from API
    let config = match crate::api::api::api_get_transcript_config(
        app.clone(),
        app.clone().state(),
        None,
    )
    .await
    {
        Ok(Some(config)) => {
            info!(
                "📝 Transcript config - provider: {}, model: {}",
                config.provider, config.model
            );
            config
        }
        Ok(None) => {
            info!("📝 No transcript config found, defaulting to Whisper.cpp");
            default_transcript_config()
        }
        Err(e) => {
            warn!("⚠️ Failed to get transcript config: {}, defaulting to Whisper.cpp", e);
            default_transcript_config()
        }
    };

    // Initialize the appropriate engine based on provider
    match config.provider.as_str() {
        "parakeet" => {
            info!("🦜 Initializing Parakeet transcription engine");

            // Get Parakeet engine
            let engine = {
                let guard = crate::parakeet_engine::commands::PARAKEET_ENGINE
                    .lock()
                    .unwrap();
                guard.as_ref().cloned()
            };

            match engine {
                Some(engine) => {
                    // Check if model is loaded
                    if engine.is_model_loaded().await {
                        let model_name = engine.get_current_model().await
                            .unwrap_or_else(|| "unknown".to_string());
                        info!("✅ Parakeet model '{}' already loaded", model_name);
                        Ok(TranscriptionEngine::Parakeet(engine))
                    } else {
                        Err("Parakeet engine initialized but no model loaded. This should not happen after validation.".to_string())
                    }
                }
                None => {
                    Err("Parakeet engine not initialized. This should not happen after validation.".to_string())
                }
            }
        }
        provider if crate::whisper_engine::is_whisper_rs_provider(provider) => {
            info!("🎤 Initializing Whisper transcription engine (provider: {})", provider);
            let whisper_engine = get_or_init_whisper(app).await?;
            Ok(TranscriptionEngine::Whisper(whisper_engine))
        }
        _ => {
            info!("🎤 Initializing Whisper transcription engine (default)");
            let whisper_engine = get_or_init_whisper(app).await?;
            Ok(TranscriptionEngine::Whisper(whisper_engine))
        }
    }
}

/// Get or initialize transcription engine using API configuration
/// Returns Whisper engine if provider is localWhisper, otherwise returns error for non-Whisper providers
pub async fn get_or_init_whisper<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Arc<crate::whisper_engine::WhisperEngine>, String> {
    // Check if engine already exists and has a model loaded
    let existing_engine = {
        let engine_guard = crate::whisper_engine::commands::WHISPER_ENGINE
            .lock()
            .unwrap();
        engine_guard.as_ref().cloned()
    };

    if let Some(engine) = existing_engine {
        // Check if a model is already loaded
        if engine.is_model_loaded().await {
            let current_model = engine
                .get_current_model()
                .await
                .unwrap_or_else(|| "unknown".to_string());

            // NEW: Check if loaded model matches saved config
            let configured_model = match crate::api::api::api_get_transcript_config(
                app.clone(),
                app.clone().state(),
                None,
            )
            .await
            {
                Ok(Some(config)) => {
                    info!(
                        "📝 Saved transcript config - provider: {}, model: {}",
                        config.provider, config.model
                    );
                    if crate::whisper_engine::is_whisper_rs_provider(&config.provider)
                        && !config.model.is_empty()
                    {
                        Some(config.model)
                    } else {
                        None
                    }
                }
                Ok(None) => {
                    info!("📝 No transcript config found in database");
                    None
                }
                Err(e) => {
                    warn!("⚠️ Failed to get transcript config: {}", e);
                    None
                }
            };

            // If loaded model matches config, reuse it
            if let Some(ref expected_model) = configured_model {
                if current_model == *expected_model {
                    if let Ok(Some(config)) = crate::api::api::api_get_transcript_config(
                        app.clone(),
                        app.clone().state(),
                        None,
                    )
                    .await
                    {
                        engine
                            .set_stt_profile(crate::whisper_engine::SttProfile::from_provider(
                                &config.provider,
                            ))
                            .await;
                    }
                    info!(
                        "✅ Loaded model '{}' matches saved config, reusing",
                        current_model
                    );
                    return Ok(engine);
                } else {
                    let models = engine
                        .discover_models()
                        .await
                        .map_err(|e| format!("Failed to discover models: {}", e))?;

                    if configured_model_is_available(&models, expected_model) {
                        info!(
                            "🔄 Loaded model '{}' doesn't match saved config '{}', reloading configured model...",
                            current_model, expected_model
                        );
                        engine.unload_model().await;
                        info!("📉 Unloaded model '{}'", current_model);
                    } else {
                        warn!(
                            "Configured model '{}' is not downloaded; keeping loaded model '{}'",
                            expected_model, current_model
                        );
                        return Ok(engine);
                    }
                }
            } else {
                // No specific config saved, accept currently loaded model
                info!(
                    "✅ No specific model configured, using currently loaded model: '{}'",
                    current_model
                );
                return Ok(engine);
            }
        } else {
            info!("🔄 Whisper engine exists but no model loaded, will load model from config");
        }
    }

    // Initialize new engine if needed
    info!("Initializing Whisper engine");

    // First ensure the engine is initialized
    if let Err(e) = crate::whisper_engine::commands::whisper_init().await {
        return Err(format!("Failed to initialize Whisper engine: {}", e));
    }

    // Get the engine reference
    let engine = {
        let engine_guard = crate::whisper_engine::commands::WHISPER_ENGINE
            .lock()
            .unwrap();
        engine_guard
            .as_ref()
            .cloned()
            .ok_or("Failed to get initialized engine")?
    };

    // Get model configuration from API
    let model_to_load =
        match crate::api::api::api_get_transcript_config(app.clone(), app.clone().state(), None)
            .await
        {
            Ok(Some(config)) => {
                info!(
                    "Got transcript config from API - provider: {}, model: {}",
                    config.provider, config.model
                );
                if crate::whisper_engine::is_whisper_rs_provider(&config.provider) {
                    engine
                        .set_stt_profile(crate::whisper_engine::SttProfile::from_provider(
                            &config.provider,
                        ))
                        .await;
                    info!("Using model from API config: {}", config.model);
                    config.model
                } else {
                    return Err(format!(
                        "Cannot initialize Whisper engine: Config uses '{}' provider. This is a bug in the transcription task initialization.",
                        config.provider
                    ));
                }
            }
            Ok(None) => {
                let model = crate::whisper_engine::recommended_whisper_model().to_string();
                info!("No transcript config found in API, falling back to '{}'", model);
                model
            }
            Err(e) => {
                let model = crate::whisper_engine::recommended_whisper_model().to_string();
                warn!(
                    "Failed to get transcript config from API: {}, falling back to '{}'",
                    e, model
                );
                model
            }
        };

    info!("Selected model to load: {}", model_to_load);

    // Discover available models to check if the desired model is downloaded
    let models = engine
        .discover_models()
        .await
        .map_err(|e| format!("Failed to discover models: {}", e))?;

    info!("Discovered {} models", models.len());
    for model in &models {
        info!(
            "Model: {} - Status: {:?} - Path: {}",
            model.name,
            model.status,
            model.path.display()
        );
    }

    let resolved_model = resolve_whisper_model_to_load(&models, &model_to_load)?;
    if resolved_model != model_to_load {
        warn!(
            "Using fallback Whisper model '{}' (configured: '{}')",
            resolved_model, model_to_load
        );
    }

    info!("Loading Whisper model: {}", resolved_model);
    engine
        .load_model(&resolved_model)
        .await
        .map_err(|e| format!("Failed to load model '{}': {}", resolved_model, e))?;
    info!("✅ Model '{}' loaded successfully", resolved_model);

    // Ensure STT profile matches saved provider
    if let Ok(Some(config)) =
        crate::api::api::api_get_transcript_config(app.clone(), app.clone().state(), None).await
    {
        engine
            .set_stt_profile(crate::whisper_engine::SttProfile::from_provider(
                &config.provider,
            ))
            .await;
    }

    Ok(engine)
}
