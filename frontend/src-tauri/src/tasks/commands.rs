use super::models::{CreateTaskRequest, PromoteActionItemsRequest, Task, UpdateTaskRequest};
use super::repository::TasksRepository;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
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
