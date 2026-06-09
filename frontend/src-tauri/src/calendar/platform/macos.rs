use crate::calendar::types::{CalendarError, CalendarEvent, CalendarInfo, CalendarPermissionStatus};
use block::ConcreteBlock;
use objc::rc::autoreleasepool;
use objc::runtime::Object;
use objc::{class, msg_send, sel, sel_impl};
use std::ffi::CStr;
use std::sync::mpsc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const EK_ENTITY_TYPE_EVENT: i64 = 0;
const APPLE_REFERENCE_DATE_UNIX: f64 = 978_307_200.0;

fn nsstring_to_string(obj: *mut Object) -> Option<String> {
    if obj.is_null() {
        return None;
    }
    unsafe {
        let utf8: *const i8 = msg_send![obj, UTF8String];
        if utf8.is_null() {
            return None;
        }
        Some(CStr::from_ptr(utf8).to_string_lossy().into_owned())
    }
}

fn unix_ms_to_ns_interval(ms: i64) -> f64 {
    let secs = ms as f64 / 1000.0;
    secs - APPLE_REFERENCE_DATE_UNIX
}

fn ns_interval_to_unix_ms(interval: f64) -> i64 {
    ((interval + APPLE_REFERENCE_DATE_UNIX) * 1000.0) as i64
}

fn auth_status_to_permission(status: i64) -> CalendarPermissionStatus {
    match status {
        0 => CalendarPermissionStatus::NotDetermined,
        1 => CalendarPermissionStatus::Restricted,
        2 => CalendarPermissionStatus::Denied,
        3 | 4 => CalendarPermissionStatus::Granted,
        _ => CalendarPermissionStatus::NotDetermined,
    }
}

fn extract_meeting_url(location: Option<&str>, notes: Option<&str>) -> Option<String> {
    let patterns = ["https://", "http://", "zoom.us", "teams.microsoft.com", "meet.google.com"];
    for text in [location, notes].into_iter().flatten() {
        for token in text.split_whitespace() {
            if patterns.iter().any(|p| token.contains(p)) {
                return Some(token.trim_matches(|c: char| c == '<' || c == '>' || c == '"').to_string());
            }
        }
    }
    None
}

pub fn permission_status() -> CalendarPermissionStatus {
    autoreleasepool(|| unsafe {
        let store_class = class!(EKEventStore);
        let status: i64 = msg_send![store_class, authorizationStatusForEntityType: EK_ENTITY_TYPE_EVENT];
        auth_status_to_permission(status)
    })
}

pub async fn request_permission() -> Result<CalendarPermissionStatus, CalendarError> {
    let current = permission_status();
    if current == CalendarPermissionStatus::Granted {
        return Ok(current);
    }
    if current == CalendarPermissionStatus::Denied || current == CalendarPermissionStatus::Restricted {
        return Err(CalendarError::PermissionDenied);
    }

    let (tx, rx) = mpsc::channel();
    autoreleasepool(|| unsafe {
        let store_class = class!(EKEventStore);
        let store: *mut Object = msg_send![store_class, new];
        let tx_ptr = Box::into_raw(Box::new(tx));
        let block = ConcreteBlock::new(move |granted: bool, _error: *mut Object| {
            let status = if granted {
                CalendarPermissionStatus::Granted
            } else {
                CalendarPermissionStatus::Denied
            };
            let tx = Box::from_raw(tx_ptr);
            let _ = tx.send(status);
        });
        let block = block.copy();
        let _: () = msg_send![store, requestAccessToEntityType: EK_ENTITY_TYPE_EVENT completion: &*block];
        std::mem::forget(block);
    });

    rx.recv_timeout(Duration::from_secs(30))
        .map_err(|_| CalendarError::Internal("Calendar permission request timed out".to_string()))
        .and_then(|status| {
            if status == CalendarPermissionStatus::Granted {
                Ok(status)
            } else {
                Err(CalendarError::PermissionDenied)
            }
        })
}

pub fn list_calendars() -> Result<Vec<CalendarInfo>, CalendarError> {
    if permission_status() != CalendarPermissionStatus::Granted {
        return Err(CalendarError::PermissionDenied);
    }

    autoreleasepool(|| unsafe {
        let store_class = class!(EKEventStore);
        let store: *mut Object = msg_send![store_class, new];
        let calendars: *mut Object =
            msg_send![store, calendarsForEntityType: EK_ENTITY_TYPE_EVENT];
        let count: usize = msg_send![calendars, count];

        let mut result = Vec::new();
        for i in 0..count {
            let cal: *mut Object = msg_send![calendars, objectAtIndex: i];
            let cal_id: *mut Object = msg_send![cal, calendarIdentifier];
            let title: *mut Object = msg_send![cal, title];
            let source_obj: *mut Object = msg_send![cal, source];
            let source_title: *mut Object = if source_obj.is_null() {
                std::ptr::null_mut()
            } else {
                msg_send![source_obj, title]
            };

            let id = nsstring_to_string(cal_id).unwrap_or_else(|| format!("calendar-{}", i));
            let title = nsstring_to_string(title).unwrap_or_else(|| "Untitled Calendar".to_string());
            let source = nsstring_to_string(source_title);

            result.push(CalendarInfo { id, title, source });
        }
        Ok(result)
    })
}

pub fn upcoming_events(
    enabled_calendar_ids: &[String],
    lookahead_hours: u64,
) -> Result<Vec<CalendarEvent>, CalendarError> {
    if permission_status() != CalendarPermissionStatus::Granted {
        return Err(CalendarError::PermissionDenied);
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| CalendarError::Internal(e.to_string()))?
        .as_millis() as i64;
    let end_ms = now_ms + (lookahead_hours as i64) * 3_600_000;

    autoreleasepool(|| unsafe {
        let store_class = class!(EKEventStore);
        let store: *mut Object = msg_send![store_class, new];

        let ns_date_class = class!(NSDate);
        let start_date: *mut Object =
            msg_send![ns_date_class, dateWithTimeIntervalSinceReferenceDate: unix_ms_to_ns_interval(now_ms)];
        let end_date: *mut Object =
            msg_send![ns_date_class, dateWithTimeIntervalSinceReferenceDate: unix_ms_to_ns_interval(end_ms)];

        let all_calendars: *mut Object =
            msg_send![store, calendarsForEntityType: EK_ENTITY_TYPE_EVENT];
        let cal_count: usize = msg_send![all_calendars, count];

        let mutable_array_class = class!(NSMutableArray);
        let selected_calendars: *mut Object = msg_send![mutable_array_class, arrayWithCapacity: cal_count];

        for i in 0..cal_count {
            let cal: *mut Object = msg_send![all_calendars, objectAtIndex: i];
            let cal_id: *mut Object = msg_send![cal, calendarIdentifier];
            let id = nsstring_to_string(cal_id).unwrap_or_default();
            if enabled_calendar_ids.is_empty() || enabled_calendar_ids.iter().any(|c| c == &id) {
                let _: () = msg_send![selected_calendars, addObject: cal];
            }
        }

        let predicate: *mut Object = msg_send![
            store,
            predicateForEventsWithStartDate: start_date
            endDate: end_date
            calendars: selected_calendars
        ];

        let events: *mut Object = msg_send![store, eventsMatchingPredicate: predicate];
        let event_count: usize = msg_send![events, count];
        let mut result = Vec::new();

        for i in 0..event_count {
            let event: *mut Object = msg_send![events, objectAtIndex: i];
            let event_id: *mut Object = msg_send![event, eventIdentifier];
            let title_obj: *mut Object = msg_send![event, title];
            let start: *mut Object = msg_send![event, startDate];
            let end: *mut Object = msg_send![event, endDate];
            let calendar: *mut Object = msg_send![event, calendar];
            let calendar_id: *mut Object = msg_send![calendar, calendarIdentifier];
            let location_obj: *mut Object = msg_send![event, location];
            let notes_obj: *mut Object = msg_send![event, notes];

            let start_interval: f64 = msg_send![start, timeIntervalSinceReferenceDate];
            let end_interval: f64 = msg_send![end, timeIntervalSinceReferenceDate];

            let title = nsstring_to_string(title_obj).unwrap_or_else(|| "(No title)".to_string());
            let location = nsstring_to_string(location_obj);
            let notes = nsstring_to_string(notes_obj);
            let meeting_url = extract_meeting_url(location.as_deref(), notes.as_deref());

            result.push(CalendarEvent {
                id: nsstring_to_string(event_id).unwrap_or_else(|| format!("event-{}", i)),
                calendar_id: nsstring_to_string(calendar_id).unwrap_or_default(),
                title,
                start: ns_interval_to_unix_ms(start_interval),
                end: ns_interval_to_unix_ms(end_interval),
                location,
                meeting_url,
            });
        }

        result.sort_by_key(|e| e.start);
        Ok(result)
    })
}

pub fn open_system_calendar_settings() -> Result<(), CalendarError> {
    use std::process::Command;
    Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars")
        .spawn()
        .map_err(|e| CalendarError::Internal(e.to_string()))?;
    Ok(())
}
