use crate::calendar::types::CalendarSettings;
use crate::database::repositories::app_settings::AppSettingsRepository;
use sqlx::SqlitePool;

const KEY_ENABLED: &str = "calendar_integration_enabled";
const KEY_CALENDAR_IDS: &str = "calendar_enabled_ids";
const KEY_LOOKAHEAD: &str = "calendar_lookahead_hours";

pub async fn is_integration_enabled(pool: &SqlitePool) -> Result<bool, String> {
    AppSettingsRepository::get_bool(pool, KEY_ENABLED)
        .await
        .map_err(|e| format!("Failed to read calendar integration flag: {}", e))
}

pub async fn load_settings(pool: &SqlitePool) -> Result<CalendarSettings, String> {
    let integration_enabled = is_integration_enabled(pool).await?;
    let enabled_calendar_ids = AppSettingsRepository::get(pool, KEY_CALENDAR_IDS)
        .await
        .map_err(|e| format!("Failed to read enabled calendar ids: {}", e))?
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default();
    let lookahead_hours = AppSettingsRepository::get(pool, KEY_LOOKAHEAD)
        .await
        .map_err(|e| format!("Failed to read calendar lookahead: {}", e))?
        .and_then(|v| v.parse().ok())
        .unwrap_or(168);

    Ok(CalendarSettings {
        integration_enabled,
        enabled_calendar_ids,
        lookahead_hours,
    })
}

pub async fn save_settings(pool: &SqlitePool, settings: &CalendarSettings) -> Result<(), String> {
    AppSettingsRepository::set_bool(pool, KEY_ENABLED, settings.integration_enabled)
        .await
        .map_err(|e| format!("Failed to save calendar integration flag: {}", e))?;
    let ids_json = serde_json::to_string(&settings.enabled_calendar_ids)
        .map_err(|e| format!("Failed to serialize calendar ids: {}", e))?;
    AppSettingsRepository::set(pool, KEY_CALENDAR_IDS, &ids_json)
        .await
        .map_err(|e| format!("Failed to save enabled calendar ids: {}", e))?;
    AppSettingsRepository::set(
        pool,
        KEY_LOOKAHEAD,
        &settings.lookahead_hours.to_string(),
    )
    .await
    .map_err(|e| format!("Failed to save calendar lookahead: {}", e))?;
    Ok(())
}

pub async fn require_enabled(pool: &SqlitePool) -> Result<(), crate::calendar::types::CalendarError> {
    if is_integration_enabled(pool)
        .await
        .map_err(|e| crate::calendar::types::CalendarError::Internal(e))?
    {
        Ok(())
    } else {
        Err(crate::calendar::types::CalendarError::IntegrationDisabled)
    }
}
