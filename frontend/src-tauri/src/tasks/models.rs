use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub due_date: Option<String>,
    pub priority: String,
    pub status: String,
    pub meeting_id: Option<String>,
    pub created_at: String,
    pub notes: Option<String>,
}

/// Task enriched with linked meeting metadata for the tasks page UI.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaskWithMeeting {
    pub id: String,
    pub title: String,
    pub due_date: Option<String>,
    pub priority: String,
    pub status: String,
    pub meeting_id: Option<String>,
    pub created_at: String,
    pub notes: Option<String>,
    pub meeting_name: Option<String>,
    pub meeting_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub due_date: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub meeting_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub id: String,
    pub title: Option<String>,
    pub due_date: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub meeting_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PromoteActionItemsRequest {
    pub meeting_id: String,
    pub items: Vec<String>,
}
