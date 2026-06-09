use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CalendarPermissionStatus {
    Granted,
    Denied,
    NotDetermined,
    Restricted,
    UnsupportedPlatform,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarInfo {
    pub id: String,
    pub title: String,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub calendar_id: String,
    pub title: String,
    pub start: i64,
    pub end: i64,
    pub location: Option<String>,
    pub meeting_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarSettings {
    pub integration_enabled: bool,
    pub enabled_calendar_ids: Vec<String>,
    pub lookahead_hours: u64,
}

impl Default for CalendarSettings {
    fn default() -> Self {
        Self {
            integration_enabled: false,
            enabled_calendar_ids: Vec::new(),
            lookahead_hours: 168,
        }
    }
}

#[derive(Debug, Clone)]
pub enum CalendarError {
    IntegrationDisabled,
    PermissionDenied,
    UnsupportedPlatform,
    ServiceUnavailable(String),
    Internal(String),
}

impl CalendarError {
    pub fn to_command_error(self) -> String {
        match self {
            Self::IntegrationDisabled => "Calendar integration is disabled".to_string(),
            Self::PermissionDenied => "Calendar permission denied".to_string(),
            Self::UnsupportedPlatform => "Calendar integration is not supported on this platform".to_string(),
            Self::ServiceUnavailable(msg) => format!("Calendar service unavailable: {}", msg),
            Self::Internal(msg) => format!("Calendar error: {}", msg),
        }
    }
}
