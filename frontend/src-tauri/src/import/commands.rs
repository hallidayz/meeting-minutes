use crate::crypto::service::decrypt;
use crate::database::repositories::app_settings::AppSettingsRepository;
use crate::state::AppState;
use crate::tasks::repository::TasksRepository;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Deserialize, Clone)]
pub struct AiNotesSession {
    #[serde(alias = "sessionTitle")]
    pub session_title: String,
    pub date: Option<String>,
    pub notes: Option<String>,
    pub duration: Option<f64>,
    pub transcript: Option<Vec<AiNotesTranscriptChunk>>,
    pub summary: Option<String>,
    #[serde(alias = "todoItems")]
    pub todo_items: Option<Vec<AiNotesTodoItem>>,
    pub timestamp: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AiNotesTranscriptChunk {
    pub speaker: String,
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct AiNotesTodoItem {
    pub text: String,
    pub completed: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct AiNotesTask {
    pub title: String,
    #[serde(alias = "dueDate")]
    pub due_date: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    #[serde(alias = "sessionName")]
    pub session_name: Option<String>,
    pub timestamp: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AiNotesEncryptedSession {
    pub encrypted_payload: String,
    pub storage_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum AiNotesSessionEntry {
    Session(AiNotesSession),
    Encrypted(AiNotesEncryptedSession),
}

#[derive(Debug, Deserialize)]
pub struct AiNotesBundle {
    pub version: Option<u32>,
    pub sessions: Vec<AiNotesSessionEntry>,
    pub tasks: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ImportBundleRequest {
    pub bundle_json: String,
    pub pin: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ImportBundleResult {
    pub meetings_imported: usize,
    pub tasks_imported: usize,
}

fn maybe_decrypt(value: &str, pin: Option<&str>) -> Result<String, String> {
    if value.starts_with("W") || value.len() > 40 {
        if let Some(p) = pin {
            if let Ok(decrypted) = decrypt(value, p) {
                return Ok(decrypted);
            }
        }
    }
    Ok(value.to_string())
}

async fn import_session(
    pool: &SqlitePool,
    session: &AiNotesSession,
    pin: Option<&str>,
) -> Result<String, String> {
    let meeting_id = format!("imported-{}", Uuid::new_v4());
    let now = Utc::now();
    let title = maybe_decrypt(&session.session_title, pin)?;

    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at, folder_path) VALUES (?, ?, ?, ?, NULL)",
    )
    .bind(&meeting_id)
    .bind(&title)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(chunks) = &session.transcript {
        for chunk in chunks {
            let text = maybe_decrypt(&chunk.text, pin)?;
            let transcript_id = format!("transcript-{}", Uuid::new_v4());
            let speaker_label = format!("{}: {}", chunk.speaker, text);
            sqlx::query(
                "INSERT INTO transcripts (id, meeting_id, transcript, timestamp, speaker) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(&transcript_id)
            .bind(&meeting_id)
            .bind(&speaker_label)
            .bind(session.date.as_deref().unwrap_or(""))
            .bind(&chunk.speaker)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    if let Some(summary) = &session.summary {
        let summary_text = maybe_decrypt(summary, pin)?;
        sqlx::query(
            "INSERT OR REPLACE INTO summary_processes (meeting_id, status, created_at, updated_at, result, chunk_count, processing_time)
             VALUES (?, 'completed', ?, ?, ?, 1, 0.0)",
        )
        .bind(&meeting_id)
        .bind(now)
        .bind(now)
        .bind(serde_json::json!({ "markdown": summary_text }).to_string())
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    if let Some(items) = &session.todo_items {
        let texts: Vec<String> = items
            .iter()
            .filter(|i| !i.completed.unwrap_or(false))
            .map(|i| i.text.clone())
            .collect();
        if !texts.is_empty() {
            TasksRepository::promote_action_items(pool, &meeting_id, &texts)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(meeting_id)
}

#[tauri::command]
pub async fn import_ai_notes_bundle(
    state: State<'_, AppState>,
    request: ImportBundleRequest,
) -> Result<ImportBundleResult, String> {
    let bundle: AiNotesBundle =
        serde_json::from_str(&request.bundle_json).map_err(|e| format!("Invalid bundle: {}", e))?;
    let pool = state.db_manager.pool();
    let pin = request.pin.as_deref();

    let mut meetings_imported = 0;
    for entry in &bundle.sessions {
        let session = match entry {
            AiNotesSessionEntry::Session(s) => s.clone(),
            AiNotesSessionEntry::Encrypted(e) => {
                let pin = pin.ok_or_else(|| "PIN required for encrypted ai-notes export".to_string())?;
                let decrypted = decrypt(&e.encrypted_payload, pin)?;
                serde_json::from_str(&decrypted).map_err(|err| format!("Invalid session payload: {}", err))?
            }
        };
        import_session(pool, &session, pin).await?;
        meetings_imported += 1;
    }

    let mut tasks_imported = 0;
    if let Some(tasks_value) = &bundle.tasks {
        if let Ok(tasks) = serde_json::from_value::<Vec<AiNotesTask>>(tasks_value.clone()) {
            for task in tasks {
                let title = maybe_decrypt(&task.title, pin)?;
                TasksRepository::create(
                    pool,
                    &title,
                    task.due_date.as_deref(),
                    task.priority.as_deref().unwrap_or("medium"),
                    task.status.as_deref().unwrap_or("todo"),
                    None,
                )
                .await
                .map_err(|e| e.to_string())?;
                tasks_imported += 1;
            }
        }
    }

    Ok(ImportBundleResult {
        meetings_imported,
        tasks_imported,
    })
}

#[tauri::command]
pub async fn get_industry_setting(state: State<'_, AppState>) -> Result<String, String> {
    AppSettingsRepository::get(state.db_manager.pool(), "industry")
        .await
        .map_err(|e| e.to_string())
        .map(|v| v.unwrap_or_else(|| "General".to_string()))
}

#[tauri::command]
pub async fn set_industry_setting(
    state: State<'_, AppState>,
    industry: String,
) -> Result<(), String> {
    AppSettingsRepository::set(state.db_manager.pool(), "industry", &industry)
        .await
        .map_err(|e| e.to_string())
}
