// Model definitions and prompt templates for built-in AI summary generation
// Designed for easy extension - just add new entries to get_available_models()

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ============================================================================
// Model Definitions
// ============================================================================

/// Sampling parameters for text generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SamplingParams {
    /// Temperature - controls randomness (0.0 = deterministic, 1.0 = balanced, 2.0 = very creative)
    pub temperature: f32,

    /// Top-K sampling - limits vocabulary to top K tokens (0 = disabled)
    pub top_k: i32,

    /// Top-P (nucleus) sampling - cumulative probability threshold (1.0 = disabled)
    pub top_p: f32,

    /// Stop tokens - generation stops when any of these appear in output
    pub stop_tokens: Vec<String>,
}

/// Definition of a built-in AI model with all metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDef {
    /// Model name in format "family:variant" (e.g., "gemma3:1b")
    /// This is what's stored in database as model field when provider="builtin-ai"
    pub name: String,

    /// Display name for UI (e.g., "Gemma 3 1B (Fast)")
    pub display_name: String,

    /// GGUF filename on disk (e.g., "gemma-3-1b-it-q4_0.gguf")
    pub gguf_file: String,

    /// Template name for prompt formatting (e.g., "gemma3")
    pub template: String,

    /// Download URL (HuggingFace or other source)
    pub download_url: String,

    /// File size in MB
    pub size_mb: u64,

    /// Context window size in tokens (configurable per model!)
    /// This is used for chunking in processor.rs
    pub context_size: u32,

    /// Model layer count (for GPU offloading calculation)
    pub layer_count: u32,

    /// Sampling parameters for this model
    pub sampling: SamplingParams,

    /// Short description for UI
    pub description: String,

    /// Minimum recommended system RAM (GB) for this model
    pub min_ram_gb: u32,
}

/// Get all available built-in AI models
/// Add new models here - the system will automatically detect and manage them
pub fn get_available_models() -> Vec<ModelDef> {
    vec![
        // Gemma 3 1B - Fast tier
        ModelDef {
            name: "gemma3:1b".to_string(),
            display_name: "Gemma 3 1B (Fast)".to_string(),
            gguf_file: "gemma-3-1b-it-Q8_0.gguf".to_string(),
            template: "gemma3".to_string(),
            download_url: "https://meetily.towardsgeneralintelligence.com/models/gemma-3-1b-it-Q8_0.gguf".to_string(),
            size_mb: 1019,
            context_size: 32768, 
            layer_count: 26,     
            sampling: SamplingParams {
                temperature: 1.0,
                top_k: 64,
                top_p: 0.95,
                stop_tokens: vec!["<end_of_turn>".to_string()],
            },
            description: "Fastest Gemma model. Runs on any hardware with ~2GB RAM. Good for quick summaries.".to_string(),
            min_ram_gb: 4,
        },
        ModelDef {
            name: "gemma3:4b".to_string(),
            display_name: "Gemma 3 4B (Balanced)".to_string(),
            gguf_file: "gemma-3-4b-it-Q4_K_M.gguf".to_string(),
            template: "gemma3".to_string(),
            download_url: "https://meetily.towardsgeneralintelligence.com/models/gemma-3-4b-it-Q4_K_M.gguf".to_string(),
            size_mb: 2374,
            context_size: 32768,
            layer_count: 35,
            sampling: SamplingParams {
                temperature: 1.0,
                top_k: 64,
                top_p: 0.95,
                stop_tokens: vec!["<end_of_turn>".to_string()],
            },
            description: "Balanced Gemma model. Great quality/speed trade-off. Requires ~6GB RAM.".to_string(),
            min_ram_gb: 8,
        },
        // Open-source models from HuggingFace — downloaded directly, no API key required
        ModelDef {
            name: "qwen2.5:0.5b".to_string(),
            display_name: "Qwen 2.5 0.5B (Ultra Light)".to_string(),
            gguf_file: "qwen2.5-0.5b-instruct-q8_0.gguf".to_string(),
            template: "qwen2".to_string(),
            download_url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf".to_string(),
            size_mb: 531,
            context_size: 32768,
            layer_count: 24,
            sampling: SamplingParams {
                temperature: 0.7,
                top_k: 40,
                top_p: 0.9,
                stop_tokens: vec!["<|im_end|>".to_string()],
            },
            description: "Smallest open model. Ideal for low-RAM devices and fast CPU inference.".to_string(),
            min_ram_gb: 2,
        },
        ModelDef {
            name: "phi3:mini".to_string(),
            display_name: "Phi-3 Mini (Efficient)".to_string(),
            gguf_file: "Phi-3-mini-4k-instruct-q4.gguf".to_string(),
            template: "phi3".to_string(),
            download_url: "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf".to_string(),
            size_mb: 2390,
            context_size: 4096,
            layer_count: 32,
            sampling: SamplingParams {
                temperature: 0.7,
                top_k: 40,
                top_p: 0.9,
                stop_tokens: vec!["<|end|>".to_string()],
            },
            description: "Microsoft Phi-3 Mini. Strong reasoning for mid-range CPUs. ~4GB RAM.".to_string(),
            min_ram_gb: 6,
        },
        ModelDef {
            name: "llama3.2:1b".to_string(),
            display_name: "Llama 3.2 1B (Compact)".to_string(),
            gguf_file: "Llama-3.2-1B-Instruct-Q4_K_M.gguf".to_string(),
            template: "llama3".to_string(),
            download_url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf".to_string(),
            size_mb: 807,
            context_size: 131072,
            layer_count: 16,
            sampling: SamplingParams {
                temperature: 0.7,
                top_k: 40,
                top_p: 0.9,
                stop_tokens: vec!["<|eot_id|>".to_string()],
            },
            description: "Meta Llama 3.2 1B. Excellent compact model for 8GB RAM systems.".to_string(),
            min_ram_gb: 6,
        },
        ModelDef {
            name: "llama3.2:3b".to_string(),
            display_name: "Llama 3.2 3B (Quality)".to_string(),
            gguf_file: "Llama-3.2-3B-Instruct-Q4_K_M.gguf".to_string(),
            template: "llama3".to_string(),
            download_url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf".to_string(),
            size_mb: 2019,
            context_size: 131072,
            layer_count: 28,
            sampling: SamplingParams {
                temperature: 0.7,
                top_k: 40,
                top_p: 0.9,
                stop_tokens: vec!["<|eot_id|>".to_string()],
            },
            description: "Meta Llama 3.2 3B. Higher quality summaries. Best on 16GB+ RAM.".to_string(),
            min_ram_gb: 12,
        },
    ]
}

/// Models sorted by recommendation priority for the detected system RAM.
pub fn get_recommended_models_for_ram(ram_gb: u64, is_macos: bool) -> Vec<String> {
    let models = get_available_models();
    let mut suitable: Vec<_> = models
        .iter()
        .filter(|m| ram_gb >= m.min_ram_gb as u64)
        .collect();
    suitable.sort_by_key(|m| m.min_ram_gb);
    suitable.reverse();

    if suitable.is_empty() {
        return vec![get_default_model().name];
    }

    // Prefer Gemma on macOS with ample RAM, otherwise pick largest suitable model
    if is_macos && ram_gb > 16 {
        if let Some(gemma) = suitable.iter().find(|m| m.name == "gemma3:4b") {
            let mut result: Vec<String> = suitable.iter().map(|m| m.name.clone()).collect();
            result.retain(|n| n != &gemma.name);
            result.insert(0, gemma.name.clone());
            return result;
        }
    }

    suitable.iter().map(|m| m.name.clone()).collect()
}

/// Get a specific model by name
pub fn get_model_by_name(name: &str) -> Option<ModelDef> {
    get_available_models().into_iter().find(|m| m.name == name)
}

/// Get the default model (first in list)
pub fn get_default_model() -> ModelDef {
    get_available_models()
        .into_iter()
        .next()
        .expect("At least one model must be defined")
}

/// Resolve model name to full file path in the models directory
pub fn get_model_path(app_data_dir: &PathBuf, model_name: &str) -> Result<PathBuf> {
    let model = get_model_by_name(model_name)
        .ok_or_else(|| anyhow!("Unknown model: {}", model_name))?;

    let models_dir = get_models_directory(app_data_dir);
    let model_path = models_dir.join(&model.gguf_file);

    Ok(model_path)
}

/// Get the models directory path for built-in AI
pub fn get_models_directory(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("models").join("summary")
}

// ============================================================================
// Prompt Templates (Model-Specific Formatting)
// ============================================================================

/// Gemma 3 chat template format
pub const GEMMA3_TEMPLATE: &str = "\
<start_of_turn>user
{system_prompt}<end_of_turn>
<start_of_turn>user
{user_prompt}<end_of_turn>
<start_of_turn>model
";

pub const LLAMA3_TEMPLATE: &str = "\
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{system_prompt}<|eot_id|><|start_header_id|>user<|end_header_id|>

{user_prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

";

pub const PHI3_TEMPLATE: &str = "\
<|system|>
{system_prompt}<|end|>
<|user|>
{user_prompt}<|end|>
<|assistant|>
";

pub const QWEN2_TEMPLATE: &str = "\
<|im_start|>system
{system_prompt}
<|im_start|>user
{user_prompt}
<|im_start|>assistant
";

/// Format a prompt using the specified template
///
/// # Arguments
/// * `template_name` - Template identifier (e.g., "gemma3", "chatml", "llama3")
/// * `system_prompt` - System message (instructions for the model)
/// * `user_prompt` - User message (actual task/question)
///
/// # Returns
/// Formatted prompt string ready to send to llama-helper
pub fn format_prompt(
    template_name: &str,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String> {
    let template = match template_name {
        "gemma3" => GEMMA3_TEMPLATE,
        "llama3" => LLAMA3_TEMPLATE,
        "phi3" => PHI3_TEMPLATE,
        "qwen2" => QWEN2_TEMPLATE,
        _ => return Err(anyhow!("Unknown template: {}", template_name)),
    };

    let formatted = template
        .replace("{system_prompt}", system_prompt)
        .replace("{user_prompt}", user_prompt);

    Ok(formatted)
}

// ============================================================================
// Configuration Constants
// ============================================================================

/// Default max tokens for generation (increased for better summary quality)
pub const DEFAULT_MAX_TOKENS: i32 = 4096;

/// Idle timeout for sidecar (seconds) - can be overridden via LLAMA_IDLE_TIMEOUT env var
pub const DEFAULT_IDLE_TIMEOUT_SECS: u64 = 300; // 5 minutes

/// Generation timeout (how long to wait for a response)
pub const GENERATION_TIMEOUT_SECS: u64 = 900; // 15 minutes
