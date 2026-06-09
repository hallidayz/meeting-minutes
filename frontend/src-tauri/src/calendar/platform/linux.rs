use crate::calendar::types::{CalendarError, CalendarEvent, CalendarInfo, CalendarPermissionStatus};
const EDS_BUS: &str = "org.gnome.evolution.dataserver.Sources5";

pub fn permission_status() -> CalendarPermissionStatus {
    if eds_available() {
        CalendarPermissionStatus::Granted
    } else {
        CalendarPermissionStatus::NotDetermined
    }
}

pub async fn request_permission() -> Result<CalendarPermissionStatus, CalendarError> {
    if eds_available() {
        Ok(CalendarPermissionStatus::Granted)
    } else {
        Err(CalendarError::ServiceUnavailable(
            "Evolution Data Server is not running. Sync calendars in GNOME Calendar first.".to_string(),
        ))
    }
}

fn eds_available() -> bool {
    tauri::async_runtime::block_on(async {
        let connection = match zbus::Connection::session().await {
            Ok(c) => c,
            Err(_) => return false,
        };
        connection
            .call_method(
                Some("org.freedesktop.DBus"),
                "/org/freedesktop/DBus",
                Some("org.freedesktop.DBus"),
                "NameHasOwner",
                &(EDS_BUS),
            )
            .await
            .map(|r| r.body().deserialize::<bool>().unwrap_or(false))
            .unwrap_or(false)
    })
}

pub fn list_calendars() -> Result<Vec<CalendarInfo>, CalendarError> {
    if !eds_available() {
        return Err(CalendarError::ServiceUnavailable(
            "Evolution Data Server is not available".to_string(),
        ));
    }
    // Calendar enumeration via EDS requires per-source D-Bus paths; return guidance until wired.
    Err(CalendarError::ServiceUnavailable(
        "Linux calendar list requires GNOME Evolution Data Server calendar sources. Enable calendar sync in GNOME Calendar, then restart AI Guardian.".to_string(),
    ))
}

pub fn upcoming_events(
    _enabled_calendar_ids: &[String],
    _lookahead_hours: u64,
) -> Result<Vec<CalendarEvent>, CalendarError> {
    if !eds_available() {
        return Err(CalendarError::ServiceUnavailable(
            "Evolution Data Server is not available".to_string(),
        ));
    }
    Err(CalendarError::ServiceUnavailable(
        "Linux calendar events require GNOME Evolution Data Server. Sync calendars in GNOME Calendar.".to_string(),
    ))
}

pub fn open_system_calendar_settings() -> Result<(), CalendarError> {
    use std::process::Command;
    Command::new("xdg-open")
        .arg("gnome-calendar:")
        .spawn()
        .map_err(|e| CalendarError::Internal(e.to_string()))?;
    Ok(())
}
