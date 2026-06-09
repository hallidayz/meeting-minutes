use crate::database::repositories::{
    meeting::MeetingsRepository, setting::SettingsRepository, transcript::TranscriptsRepository,
};
use crate::state::AppState;
use crate::summary::llm_client::{generate_summary, LLMProvider};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Deserialize)]
pub struct AssistantChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct AssistantChatRequest {
    pub message: String,
    pub history: Vec<AssistantChatMessage>,
    #[serde(rename = "meetingId")]
    pub meeting_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AssistantSource {
    #[serde(rename = "meetingId")]
    pub meeting_id: String,
    pub title: String,
    pub snippet: String,
}

#[derive(Debug, Serialize)]
pub struct AssistantChatResponse {
    pub reply: String,
    pub sources: Vec<AssistantSource>,
}

#[tauri::command]
pub async fn api_assistant_chat<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    request: AssistantChatRequest,
) -> Result<AssistantChatResponse, String> {
    let message = request.message.trim();
    if message.is_empty() {
        return Err("Message cannot be empty".to_string());
    }

    let pool = state.db_manager.pool();

    let model_config = SettingsRepository::get_model_config(pool)
        .await
        .map_err(|e| format!("Failed to load model config: {}", e))?
        .ok_or_else(|| {
            "No summary model configured. Open Settings → Summary to set up a local LLM (Ollama or Built-in AI)."
                .to_string()
        })?;

    let provider = LLMProvider::from_str(&model_config.provider)?;
    let model_name = if model_config.model.trim().is_empty() {
        return Err("No model selected. Configure a model in Settings → Summary.".to_string());
    } else {
        model_config.model
    };

    let api_key = if provider == LLMProvider::Ollama
        || provider == LLMProvider::BuiltInAI
        || provider == LLMProvider::CustomOpenAI
    {
        String::new()
    } else {
        SettingsRepository::get_api_key(pool, &model_config.provider)
            .await
            .map_err(|e| format!("Failed to load API key: {}", e))?
            .filter(|k| !k.trim().is_empty())
            .ok_or_else(|| {
                format!(
                    "API key required for {}. Add it in Settings → Summary.",
                    model_config.provider
                )
            })?
    };

    let ollama_endpoint = if provider == LLMProvider::Ollama {
        model_config.ollama_endpoint
    } else {
        None
    };

    let (
        custom_openai_endpoint,
        custom_openai_api_key,
        custom_openai_max_tokens,
        custom_openai_temperature,
        custom_openai_top_p,
    ) = if provider == LLMProvider::CustomOpenAI {
        match SettingsRepository::get_custom_openai_config(pool).await {
            Ok(Some(config)) => (
                Some(config.endpoint),
                config.api_key,
                config.max_tokens.map(|t| t as u32),
                config.temperature,
                config.top_p,
            ),
            Ok(None) => {
                return Err(
                    "Custom OpenAI is selected but not configured. Check Settings → Summary."
                        .to_string(),
                );
            }
            Err(e) => return Err(format!("Failed to load custom OpenAI config: {}", e)),
        }
    } else {
        (None, None, None, None, None)
    };

    let final_api_key = if provider == LLMProvider::CustomOpenAI {
        custom_openai_api_key.unwrap_or_default()
    } else {
        api_key
    };

    let app_data_dir = if provider == LLMProvider::BuiltInAI {
        Some(
            app.path()
                .app_data_dir()
                .map_err(|e| e.to_string())?,
        )
    } else {
        None
    };

    let search_results = TranscriptsRepository::search_transcripts(pool, message)
        .await
        .unwrap_or_default();

    let mut sources: Vec<AssistantSource> = search_results
        .iter()
        .take(8)
        .map(|r| AssistantSource {
            meeting_id: r.id.clone(),
            title: r.title.clone(),
            snippet: r.match_context.clone(),
        })
        .collect();

    if let Some(ref meeting_id) = request.meeting_id {
        if let Ok(Some(meeting)) = MeetingsRepository::get_meeting(pool, meeting_id).await {
            if !sources.iter().any(|s| s.meeting_id == meeting.id) {
                let snippet = meeting
                    .transcripts
                    .iter()
                    .take(5)
                    .map(|t| t.text.as_str())
                    .collect::<Vec<_>>()
                    .join(" ");
                sources.insert(
                    0,
                    AssistantSource {
                        meeting_id: meeting.id.clone(),
                        title: meeting.title.clone(),
                        snippet: if snippet.len() > 500 {
                            format!("{}…", &snippet[..500])
                        } else {
                            snippet
                        },
                    },
                );
            }
        }
    }

    let recent_meetings = MeetingsRepository::get_meetings(pool)
        .await
        .unwrap_or_default();
    let meeting_list: String = recent_meetings
        .iter()
        .take(12)
        .map(|m| format!("- {} (id: {})", m.title, m.id))
        .collect::<Vec<_>>()
        .join("\n");

    let transcript_context: String = sources
        .iter()
        .take(6)
        .map(|s| {
            format!(
                "Meeting: \"{}\" ({})\nExcerpt: {}",
                s.title, s.meeting_id, s.snippet
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    let history_block = if request.history.is_empty() {
        String::new()
    } else {
        request
            .history
            .iter()
            .rev()
            .take(6)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .map(|m| format!("{}: {}", m.role, m.content))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let system_prompt = "You are AI Guardian, a private on-device meeting assistant. \
        Answer using only the meeting context provided. Be concise and actionable. \
        You can help find information in meetings, suggest follow-ups, draft notes, and explain settings. \
        If context is insufficient, say what is missing. Never claim data leaves the device.";

    let mut user_prompt = String::new();
    if !meeting_list.is_empty() {
        user_prompt.push_str("Recent meetings:\n");
        user_prompt.push_str(&meeting_list);
        user_prompt.push_str("\n\n");
    }
    if !transcript_context.is_empty() {
        user_prompt.push_str("Relevant transcript excerpts:\n");
        user_prompt.push_str(&transcript_context);
        user_prompt.push_str("\n\n");
    }
    if !history_block.is_empty() {
        user_prompt.push_str("Conversation so far:\n");
        user_prompt.push_str(&history_block);
        user_prompt.push_str("\n\n");
    }
    user_prompt.push_str("User: ");
    user_prompt.push_str(message);

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let reply = generate_summary(
        &client,
        &provider,
        &model_name,
        &final_api_key,
        system_prompt,
        &user_prompt,
        ollama_endpoint.as_deref(),
        custom_openai_endpoint.as_deref(),
        custom_openai_max_tokens,
        custom_openai_temperature,
        custom_openai_top_p,
        app_data_dir.as_ref(),
        None,
    )
    .await?;

    Ok(AssistantChatResponse { reply, sources })
}
