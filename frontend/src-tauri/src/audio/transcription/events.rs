use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

/// Structured payload for the `transcription-error` frontend event.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionErrorEvent {
    pub error: String,
    pub user_message: String,
    pub actionable: bool,
}

impl TranscriptionErrorEvent {
    pub fn new(error: impl Into<String>, user_message: impl Into<String>, actionable: bool) -> Self {
        Self {
            error: error.into(),
            user_message: user_message.into(),
            actionable,
        }
    }

    pub fn emit<R: Runtime>(&self, app: &AppHandle<R>) {
        if let Err(e) = app.emit("transcription-error", self) {
            log::error!("Failed to emit transcription-error: {}", e);
        }
    }
}
