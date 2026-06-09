use crate::calendar::platform;
use crate::calendar::settings::{is_integration_enabled, load_settings};
use crate::notifications::commands::NotificationManagerState;
use crate::notifications::manager::NotificationManager;
use crate::state::AppState;
use log::{error, info};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, Wry};
use tokio::sync::{Mutex, RwLockReadGuard};

type FiredReminders = Arc<Mutex<HashSet<String>>>;

fn reminder_key(event_id: &str, minutes: u64) -> String {
    format!("{}:{}", event_id, minutes)
}

pub fn spawn_calendar_reminder_scheduler(app: AppHandle<Wry>) {
    let fired: FiredReminders = Arc::new(Mutex::new(HashSet::new()));
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            if let Err(e) = poll_reminders(&app, fired.clone()).await {
                error!("[calendar-scheduler] {}", e);
            }
        }
    });
    info!("Calendar reminder scheduler spawned");
}

async fn poll_reminders(app: &AppHandle<Wry>, fired: FiredReminders) -> Result<(), String> {
    let state = app
        .try_state::<AppState>()
        .ok_or_else(|| "AppState not available".to_string())?;
    let pool = state.db_manager.pool();

    if !is_integration_enabled(pool)
        .await
        .map_err(|e| e.to_string())?
    {
        return Ok(());
    }

    let notif_state = app
        .try_state::<NotificationManagerState<Wry>>()
        .ok_or_else(|| "NotificationManagerState not available".to_string())?;
    let manager_lock: RwLockReadGuard<'_, Option<NotificationManager<Wry>>> =
        notif_state.read().await;
    let manager: &NotificationManager<Wry> = match manager_lock.as_ref() {
        Some(m) => m,
        None => return Ok(()),
    };

    let settings = load_settings(pool).await?;
    let events = platform::upcoming_events(&settings.enabled_calendar_ids, 1)
        .map_err(|e| e.to_command_error())?;

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    let notif_settings = manager.get_settings().await;
    let reminder_minutes = &notif_settings.notification_preferences.meeting_reminder_minutes;

    for event in events {
        let minutes_until = ((event.start - now_ms) as f64 / 60_000.0).round() as i64;
        if minutes_until < 0 {
            continue;
        }
        let minutes_until = minutes_until as u64;
        if !reminder_minutes.contains(&minutes_until) {
            continue;
        }
        let key = reminder_key(&event.id, minutes_until);
        let mut fired_set = fired.lock().await;
        if fired_set.contains(&key) {
            continue;
        }
        fired_set.insert(key);
        drop(fired_set);

        if let Err(e) = manager
            .show_meeting_reminder(minutes_until, Some(event.title.clone()))
            .await
        {
            error!(
                "[calendar-scheduler] Failed to show reminder for {}: {}",
                event.id, e
            );
        }
    }

    Ok(())
}
