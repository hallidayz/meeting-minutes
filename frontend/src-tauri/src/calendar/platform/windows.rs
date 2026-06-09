use crate::calendar::types::{CalendarError, CalendarEvent, CalendarInfo, CalendarPermissionStatus};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn permission_status() -> CalendarPermissionStatus {
    CalendarPermissionStatus::NotDetermined
}

pub async fn request_permission() -> Result<CalendarPermissionStatus, CalendarError> {
    match try_list_calendars().await {
        Ok(_) => Ok(CalendarPermissionStatus::Granted),
        Err(CalendarError::PermissionDenied) => Err(CalendarError::PermissionDenied),
        Err(e) => Err(e),
    }
}

async fn try_list_calendars() -> Result<Vec<CalendarInfo>, CalendarError> {
    use windows::ApplicationModel::Appointments::{
        AppointmentStoreAccessType, AppointmentStoreCalendarType,
    };
    use windows::Foundation::DateTime;
    use windows_future::Future;

    let store = windows::ApplicationModel::Appointments::AppointmentManager::GetForUser()
        .map_err(|e| CalendarError::ServiceUnavailable(format!("AppointmentManager: {:?}", e)))?
        .RequestStoreAsync(AppointmentStoreAccessType::AllCalendarsReadOnly)
        .map_err(|e| CalendarError::ServiceUnavailable(format!("RequestStoreAsync: {:?}", e)))?
        .await
        .map_err(|e| CalendarError::ServiceUnavailable(format!("Store access: {:?}", e)))?;

    let options = windows::ApplicationModel::Appointments::FindAppointmentCalendarsOptions::new()
        .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?;
    let _ = options.SetIncludeHidden(false);

    let calendars = store
        .FindAppointmentCalendarsAsync(&options)
        .map_err(|e| CalendarError::ServiceUnavailable(format!("FindAppointmentCalendarsAsync: {:?}", e)))?
        .await
        .map_err(|e| CalendarError::ServiceUnavailable(format!("Calendars: {:?}", e)))?;

    let mut result = Vec::new();
    let count = calendars
        .Size()
        .map_err(|e| CalendarError::Internal(format!("{:?}", e)))? as usize;
    for i in 0..count {
        let cal = calendars
            .GetAt(i as u32)
            .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?;
        let id = cal
            .LocalId()
            .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?
            .to_string();
        let title = cal
            .DisplayName()
            .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?
            .to_string();
        let cal_type = cal
            .CalendarType()
            .unwrap_or(AppointmentStoreCalendarType::Other);
        let source = Some(format!("{:?}", cal_type));
        result.push(CalendarInfo { id, title, source });
    }
    Ok(result)
}

pub fn list_calendars() -> Result<Vec<CalendarInfo>, CalendarError> {
    tauri::async_runtime::block_on(try_list_calendars())
}

pub fn upcoming_events(
    enabled_calendar_ids: &[String],
    lookahead_hours: u64,
) -> Result<Vec<CalendarEvent>, CalendarError> {
    tauri::async_runtime::block_on(async {
        use windows::ApplicationModel::Appointments::AppointmentStoreAccessType;
        use windows::Foundation::DateTime;
        use windows_future::Future;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| CalendarError::Internal(e.to_string()))?;
        let end = now + std::time::Duration::from_secs(lookahead_hours * 3600);

        let to_datetime = |dur: std::time::Duration| -> Result<DateTime, CalendarError> {
            let unix_secs = dur.as_secs() as i64;
            let win_ticks = (unix_secs + 11_644_473_600) * 10_000_000;
            DateTime::from_unix_epoch(win_ticks)
                .map_err(|e| CalendarError::Internal(format!("{:?}", e)))
        };

        let start_dt = to_datetime(now)?;
        let end_dt = to_datetime(end)?;
        let span = (end_dt.UniversalTime - start_dt.UniversalTime) as f64 / 10_000_000.0;

        let store = windows::ApplicationModel::Appointments::AppointmentManager::GetForUser()
            .map_err(|e| CalendarError::ServiceUnavailable(format!("{:?}", e)))?
            .RequestStoreAsync(AppointmentStoreAccessType::AllCalendarsReadOnly)
            .map_err(|e| CalendarError::ServiceUnavailable(format!("{:?}", e)))?
            .await
            .map_err(|e| CalendarError::ServiceUnavailable(format!("{:?}", e)))?;

        let options =
            windows::ApplicationModel::Appointments::FindAppointmentsOptions::new()
                .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?;

        let appointments = store
            .FindAppointmentsAsync(&start_dt, span, &options)
            .map_err(|e| CalendarError::ServiceUnavailable(format!("{:?}", e)))?
            .await
            .map_err(|e| CalendarError::ServiceUnavailable(format!("{:?}", e)))?;

        let mut events = Vec::new();
        let count = appointments
            .Size()
            .map_err(|e| CalendarError::Internal(format!("{:?}", e)))? as usize;
        for i in 0..count {
            let appt = appointments
                .GetAt(i as u32)
                .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?;
            let id = appt
                .LocalId()
                .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?
                .to_string();
            let calendar_id = appt
                .AppointmentCalendarId()
                .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?
                .to_string();
            if !enabled_calendar_ids.is_empty()
                && !enabled_calendar_ids.iter().any(|c| c == &calendar_id)
            {
                continue;
            }
            let title = appt
                .Subject()
                .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?
                .to_string();
            let start_dt = appt
                .StartTime()
                .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?;
            let duration = appt
                .Duration()
                .map_err(|e| CalendarError::Internal(format!("{:?}", e)))?;
            let start_ms = ((start_dt.UniversalTime / 10_000_000) - 11_644_473_600) * 1000;
            let end_ms = start_ms + (duration.as_secs_f64() * 1000.0) as i64;
            let location = appt
                .Location()
                .ok()
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty());
            let details = appt
                .Details()
                .ok()
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty());
            let meeting_url = [location.as_deref(), details.as_deref()]
                .into_iter()
                .flatten()
                .find(|t| t.contains("http"))
                .map(|s| s.to_string());

            events.push(CalendarEvent {
                id,
                calendar_id,
                title,
                start: start_ms,
                end: end_ms,
                location,
                meeting_url,
            });
        }
        events.sort_by_key(|e| e.start);
        Ok(events)
    })
}

pub fn open_system_calendar_settings() -> Result<(), CalendarError> {
    use std::process::Command;
    Command::new("cmd")
        .args(["/C", "start", "ms-settings:privacy-calendar"])
        .spawn()
        .map_err(|e| CalendarError::Internal(e.to_string()))?;
    Ok(())
}
