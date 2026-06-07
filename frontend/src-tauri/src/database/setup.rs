use log::info;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use super::manager::DatabaseManager;
use crate::state::AppState;

#[cfg(target_os = "macos")]
const HOMEBREW_LEGACY_DB: &str = "/usr/local/var/ai-guardian/meeting_minutes.db";

/// Detect a legacy Meetily/Homebrew database before creating a fresh sqlite file.
async fn detect_legacy_database(app: &AppHandle) -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let homebrew = PathBuf::from(HOMEBREW_LEGACY_DB);
        if homebrew.is_file() {
            if let Ok(meta) = std::fs::metadata(&homebrew) {
                if meta.len() > 0 {
                    info!("Found Homebrew legacy database at {}", HOMEBREW_LEGACY_DB);
                    return Some(HOMEBREW_LEGACY_DB.to_string());
                }
            }
        }
    }

    let app_data_dir = app.path().app_data_dir().ok()?;
    let legacy_db = app_data_dir.join("meeting_minutes.db");
    if legacy_db.is_file() {
        info!("Found legacy database at {}", legacy_db.display());
        return Some(legacy_db.to_string_lossy().to_string());
    }

    None
}

/// Initialize database on app startup and register AppState for all Tauri commands.
pub async fn initialize_database_on_startup(app: &AppHandle) -> Result<(), String> {
    let is_first_launch = DatabaseManager::is_first_launch(app)
        .await
        .map_err(|e| format!("Failed to check first launch status: {}", e))?;

    let db_manager = if is_first_launch {
        if let Some(legacy_path) = detect_legacy_database(app).await {
            info!("Importing legacy database from {}", legacy_path);
            DatabaseManager::import_legacy_database(app, &legacy_path)
                .await
                .map_err(|e| format!("Failed to import legacy database: {}", e))?
        } else {
            info!("Creating fresh database on first launch");
            DatabaseManager::new_from_app_handle(app)
                .await
                .map_err(|e| format!("Failed to initialize database manager: {}", e))?
        }
    } else {
        DatabaseManager::new_from_app_handle(app)
            .await
            .map_err(|e| format!("Failed to initialize database manager: {}", e))?
    };

    app.manage(AppState { db_manager });
    info!("Database initialized successfully");

    if is_first_launch {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            app_handle
                .emit("first-launch-detected", ())
                .expect("Failed to emit first-launch-detected event");
            info!("Emitted first-launch-detected after delay");
        });
    }

    app.emit("database-initialized", ())
        .map_err(|e| format!("Failed to emit database-initialized event: {}", e))?;

    Ok(())
}
