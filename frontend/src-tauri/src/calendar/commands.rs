use crate::calendar::platform;
use crate::calendar::settings::{load_settings, require_enabled, save_settings};
use crate::calendar::types::{CalendarEvent, CalendarInfo, CalendarPermissionStatus, CalendarSettings};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn calendar_get_integration_enabled(state: State<'_, AppState>) -> Result<bool, String> {
    crate::calendar::settings::is_integration_enabled(state.db_manager.pool())
        .await
}

#[tauri::command]
pub async fn calendar_set_integration_enabled(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    let mut settings = load_settings(state.db_manager.pool()).await?;
    settings.integration_enabled = enabled;
    save_settings(state.db_manager.pool(), &settings).await
}

#[tauri::command]
pub async fn calendar_get_permission_status(
    state: State<'_, AppState>,
) -> Result<CalendarPermissionStatus, String> {
    require_enabled(state.db_manager.pool())
        .await
        .map_err(|e| e.to_command_error())?;
    Ok(platform::permission_status())
}

#[tauri::command]
pub async fn calendar_request_permission(
    state: State<'_, AppState>,
) -> Result<CalendarPermissionStatus, String> {
    require_enabled(state.db_manager.pool())
        .await
        .map_err(|e| e.to_command_error())?;
    platform::request_permission()
        .await
        .map_err(|e| e.to_command_error())
}

#[tauri::command]
pub async fn calendar_list_calendars(
    state: State<'_, AppState>,
) -> Result<Vec<CalendarInfo>, String> {
    require_enabled(state.db_manager.pool())
        .await
        .map_err(|e| e.to_command_error())?;
    platform::list_calendars()
        .map_err(|e| e.to_command_error())
}

#[tauri::command]
pub async fn calendar_get_upcoming_events(
    state: State<'_, AppState>,
) -> Result<Vec<CalendarEvent>, String> {
    require_enabled(state.db_manager.pool())
        .await
        .map_err(|e| e.to_command_error())?;
    let settings = load_settings(state.db_manager.pool()).await?;
    platform::upcoming_events(&settings.enabled_calendar_ids, settings.lookahead_hours)
        .map_err(|e| e.to_command_error())
}

#[tauri::command]
pub async fn calendar_get_calendar_settings(
    state: State<'_, AppState>,
) -> Result<CalendarSettings, String> {
    load_settings(state.db_manager.pool()).await
}

#[tauri::command]
pub async fn calendar_set_calendar_settings(
    state: State<'_, AppState>,
    settings: CalendarSettings,
) -> Result<(), String> {
    save_settings(state.db_manager.pool(), &settings).await
}

#[tauri::command]
pub async fn calendar_open_system_calendar_settings(
    state: State<'_, AppState>,
) -> Result<(), String> {
    require_enabled(state.db_manager.pool())
        .await
        .map_err(|e| e.to_command_error())?;
    platform::open_system_calendar_settings()
        .map_err(|e| e.to_command_error())
}
