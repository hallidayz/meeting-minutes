use super::models::{CreateTaskRequest, PromoteActionItemsRequest, Task, TaskWithMeeting, UpdateTaskRequest};
use super::repository::TasksRepository;
use crate::database::repositories::app_settings::AppSettingsRepository;
use crate::notifications::commands::NotificationManagerState;
use crate::notifications::types::{Notification, NotificationPriority, NotificationType};
use crate::state::AppState;
use tauri::{State, Wry};

#[tauri::command]
pub async fn list_tasks(state: State<'_, AppState>) -> Result<Vec<TaskWithMeeting>, String> {
    TasksRepository::list(state.db_manager.pool())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_task(
    state: State<'_, AppState>,
    request: CreateTaskRequest,
) -> Result<Task, String> {
    TasksRepository::create(
        state.db_manager.pool(),
        &request.title,
        request.due_date.as_deref(),
        request.priority.as_deref().unwrap_or("medium"),
        request.status.as_deref().unwrap_or("todo"),
        request.meeting_id.as_deref(),
        request.notes.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task(
    state: State<'_, AppState>,
    request: UpdateTaskRequest,
) -> Result<bool, String> {
    TasksRepository::update(
        state.db_manager.pool(),
        &request.id,
        request.title.as_deref(),
        request.due_date.as_ref().map(|d| Some(d.as_str())),
        request.priority.as_deref(),
        request.status.as_deref(),
        request.meeting_id.as_ref().map(|m| Some(m.as_str())),
        request.notes.as_ref().map(|n| Some(n.as_str())),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_task(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    TasksRepository::delete(state.db_manager.pool(), &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn promote_action_items(
    state: State<'_, AppState>,
    request: PromoteActionItemsRequest,
) -> Result<Vec<Task>, String> {
    TasksRepository::promote_action_items(
        state.db_manager.pool(),
        &request.meeting_id,
        &request.items,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_user_email(state: State<'_, AppState>) -> Result<Option<String>, String> {
    AppSettingsRepository::get(state.db_manager.pool(), "user_email")
        .await
        .map_err(|e| e.to_string())
        .map(|v| v.filter(|s| !s.trim().is_empty()))
}

#[tauri::command]
pub async fn set_user_email(state: State<'_, AppState>, email: String) -> Result<(), String> {
    AppSettingsRepository::set(state.db_manager.pool(), "user_email", email.trim())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn notify_task(
    state: State<'_, AppState>,
    manager_state: State<'_, NotificationManagerState<Wry>>,
    task_id: String,
) -> Result<(), String> {
    let task = TasksRepository::get_by_id(state.db_manager.pool(), &task_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Task not found".to_string())?;

    let mut body = format!("Status: {}", task.status);
    if let Some(due) = &task.due_date {
        body.push_str(&format!("\nDue: {}", due));
    }
    if let Some(meeting) = &task.meeting_name {
        body.push_str(&format!("\nMeeting: {}", meeting));
    }
    if let Some(notes) = &task.notes {
        if !notes.trim().is_empty() {
            body.push_str(&format!("\nNotes: {}", notes));
        }
    }

    let notification = Notification::new(
        format!("Task: {}", task.title),
        body,
        NotificationType::TaskReminder,
    )
    .with_priority(NotificationPriority::Normal);

    let manager_lock = manager_state.read().await;
    if let Some(manager) = manager_lock.as_ref() {
        manager
            .show_notification(notification)
            .await
            .map_err(|e| format!("Failed to show notification: {}", e))
    } else {
        Err("Notification manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn email_task(
    state: State<'_, AppState>,
    task_id: String,
    recipient: Option<String>,
) -> Result<(), String> {
    let task = TasksRepository::get_by_id(state.db_manager.pool(), &task_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Task not found".to_string())?;

    let to = if let Some(r) = recipient.filter(|s| !s.trim().is_empty()) {
        r
    } else {
        AppSettingsRepository::get(state.db_manager.pool(), "user_email")
            .await
            .map_err(|e| e.to_string())?
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| {
                "Set your email in Settings → General → Profile Email to use your OS mail app."
                    .to_string()
            })?
    };

    let subject = format!("AI Guardian Task: {}", task.title);
    let mut body = String::new();
    body.push_str(&format!("Task: {}\n", task.title));
    body.push_str(&format!("Status: {}\n", task.status));
    body.push_str(&format!("Priority: {}\n", task.priority));
    if let Some(due) = &task.due_date {
        body.push_str(&format!("Due Date: {}\n", due));
    }
    if let Some(meeting) = &task.meeting_name {
        body.push_str(&format!("Meeting: {}\n", meeting));
    }
    if let Some(date) = &task.meeting_date {
        body.push_str(&format!("Meeting Date: {}\n", date));
    }
    if let Some(notes) = &task.notes {
        if !notes.trim().is_empty() {
            body.push_str(&format!("\nNotes:\n{}\n", notes));
        }
    }

    let mailto = format!(
        "mailto:{}?subject={}&body={}",
        encode_mailto_component(&to),
        encode_mailto_component(&subject),
        encode_mailto_component(&body)
    );

    open_url_in_os(&mailto)
}

fn open_url_in_os(url: &str) -> Result<(), String> {
    use std::process::Command;

    let result = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", "start", url]).output()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(url).output()
    } else {
        Command::new("xdg-open").arg(url).output()
    };

    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to open URL: {}", e)),
    }
}

fn encode_mailto_component(value: &str) -> String {
    value
        .chars()
        .map(|c| match c {
            ' ' => "%20".to_string(),
            '\n' => "%0A".to_string(),
            '&' => "%26".to_string(),
            '?' => "%3F".to_string(),
            '#' => "%23".to_string(),
            '%' => "%25".to_string(),
            '+' => "%2B".to_string(),
            _ if c.is_ascii() => c.to_string(),
            _ => c.to_string(),
        })
        .collect()
}
