use crate::calendar::types::{CalendarError, CalendarEvent, CalendarInfo, CalendarPermissionStatus};

pub fn permission_status() -> CalendarPermissionStatus {
    CalendarPermissionStatus::UnsupportedPlatform
}

pub async fn request_permission() -> Result<CalendarPermissionStatus, CalendarError> {
    Err(CalendarError::UnsupportedPlatform)
}

pub fn list_calendars() -> Result<Vec<CalendarInfo>, CalendarError> {
    Err(CalendarError::UnsupportedPlatform)
}

pub fn upcoming_events(
    _enabled_calendar_ids: &[String],
    _lookahead_hours: u64,
) -> Result<Vec<CalendarEvent>, CalendarError> {
    Err(CalendarError::UnsupportedPlatform)
}

pub fn open_system_calendar_settings() -> Result<(), CalendarError> {
    Err(CalendarError::UnsupportedPlatform)
}
