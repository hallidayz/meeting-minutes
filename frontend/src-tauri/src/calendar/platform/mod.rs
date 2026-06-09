#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;
#[cfg(target_os = "linux")]
pub mod linux;
mod stub;

use crate::calendar::types::{CalendarError, CalendarEvent, CalendarInfo, CalendarPermissionStatus};

#[cfg(target_os = "macos")]
use macos as imp;
#[cfg(target_os = "windows")]
use windows as imp;
#[cfg(target_os = "linux")]
use linux as imp;
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
use stub as imp;

pub fn permission_status() -> CalendarPermissionStatus {
    imp::permission_status()
}

pub async fn request_permission() -> Result<CalendarPermissionStatus, CalendarError> {
    imp::request_permission().await
}

pub fn list_calendars() -> Result<Vec<CalendarInfo>, CalendarError> {
    imp::list_calendars()
}

pub fn upcoming_events(
    enabled_calendar_ids: &[String],
    lookahead_hours: u64,
) -> Result<Vec<CalendarEvent>, CalendarError> {
    imp::upcoming_events(enabled_calendar_ids, lookahead_hours)
}

pub fn open_system_calendar_settings() -> Result<(), CalendarError> {
    imp::open_system_calendar_settings()
}
