use whisper_rs::{FullParams, SamplingStrategy};

/// STT inference profile — both variants use whisper-rs / whisper.cpp.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SttProfile {
    /// Whisper.cpp: BeamSearch, large models, maximum accuracy on CPU/GPU.
    #[default]
    WhisperCpp,
    /// Fast-Whisper: Greedy decoding, smaller quantized models, lowest latency.
    FastWhisper,
}

impl SttProfile {
    pub fn from_provider(provider: &str) -> Self {
        match provider {
            "fastWhisper" => SttProfile::FastWhisper,
            _ => SttProfile::WhisperCpp,
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            SttProfile::WhisperCpp => "Whisper.cpp",
            SttProfile::FastWhisper => "Fast-Whisper",
        }
    }
}

pub fn is_whisper_rs_provider(provider: &str) -> bool {
    provider == "localWhisper" || provider == "fastWhisper"
}

fn thread_count(profile: SttProfile) -> i32 {
    let hardware = crate::audio::HardwareProfile::detect();
    let cores = hardware.cpu_cores as i32;
    match profile {
        SttProfile::WhisperCpp => cores.clamp(4, 6),
        SttProfile::FastWhisper => 4,
    }
}

/// Build whisper-rs FullParams for the given STT profile and language preference.
pub fn build_full_params(profile: SttProfile, language: Option<&str>) -> FullParams {
    let (language_code, should_translate) = match language {
        Some("auto") | None => (None, false),
        Some("auto-translate") => (None, true),
        Some(lang) => (Some(lang), false),
    };

    let hw = crate::audio::HardwareProfile::detect();
    let adaptive = hw.get_whisper_config();

    let mut params = match profile {
        SttProfile::WhisperCpp => FullParams::new(SamplingStrategy::BeamSearch {
            beam_size: adaptive.beam_size as i32,
            patience: -1.0,
        }),
        SttProfile::FastWhisper => FullParams::new(SamplingStrategy::Greedy { best_of: 1 }),
    };

    params.set_language(language_code);
    params.set_translate(should_translate);
    params.set_no_timestamps(true);
    params.set_token_timestamps(true);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true);
    params.set_n_threads(thread_count(profile));

    match profile {
        SttProfile::WhisperCpp => {
            params.set_temperature(0.1);
            params.set_max_initial_ts(1.0);
            params.set_entropy_thold(2.4);
            params.set_logprob_thold(-1.0);
            params.set_no_speech_thold(0.42);
            params.set_max_len(200);
            params.set_single_segment(false);
        }
        SttProfile::FastWhisper => {
            params.set_temperature(0.4);
            params.set_max_initial_ts(1.0);
            params.set_entropy_thold(2.8);
            params.set_logprob_thold(-1.0);
            params.set_no_speech_thold(0.5);
            params.set_max_len(128);
            params.set_single_segment(true);
        }
    }

    params
}
