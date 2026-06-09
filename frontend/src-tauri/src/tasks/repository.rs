use super::models::{Task, TaskWithMeeting};
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

pub struct TasksRepository;

impl TasksRepository {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<TaskWithMeeting>, sqlx::Error> {
        sqlx::query_as::<_, TaskWithMeeting>(
            "SELECT t.id, t.title, t.due_date, t.priority, t.status, t.meeting_id, t.created_at, t.notes,
                    m.title AS meeting_name, m.created_at AS meeting_date
             FROM tasks t
             LEFT JOIN meetings m ON t.meeting_id = m.id
             ORDER BY t.created_at DESC",
        )
        .fetch_all(pool)
        .await
    }

    pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Option<TaskWithMeeting>, sqlx::Error> {
        sqlx::query_as::<_, TaskWithMeeting>(
            "SELECT t.id, t.title, t.due_date, t.priority, t.status, t.meeting_id, t.created_at, t.notes,
                    m.title AS meeting_name, m.created_at AS meeting_date
             FROM tasks t
             LEFT JOIN meetings m ON t.meeting_id = m.id
             WHERE t.id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        title: &str,
        due_date: Option<&str>,
        priority: &str,
        status: &str,
        meeting_id: Option<&str>,
        notes: Option<&str>,
    ) -> Result<Task, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO tasks (id, title, due_date, priority, status, meeting_id, created_at, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(title)
        .bind(due_date)
        .bind(priority)
        .bind(status)
        .bind(meeting_id)
        .bind(&created_at)
        .bind(notes)
        .execute(pool)
        .await?;

        Ok(Task {
            id,
            title: title.to_string(),
            due_date: due_date.map(|s| s.to_string()),
            priority: priority.to_string(),
            status: status.to_string(),
            meeting_id: meeting_id.map(|s| s.to_string()),
            created_at,
            notes: notes.map(|s| s.to_string()),
        })
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        title: Option<&str>,
        due_date: Option<Option<&str>>,
        priority: Option<&str>,
        status: Option<&str>,
        meeting_id: Option<Option<&str>>,
        notes: Option<Option<&str>>,
    ) -> Result<bool, sqlx::Error> {
        let existing = sqlx::query_as::<_, Task>(
            "SELECT id, title, due_date, priority, status, meeting_id, created_at, notes FROM tasks WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        let Some(task) = existing else {
            return Ok(false);
        };

        let new_title = title.unwrap_or(&task.title);
        let new_due = match due_date {
            Some(Some(d)) => Some(d),
            Some(None) => None,
            None => task.due_date.as_deref(),
        };
        let new_priority = priority.unwrap_or(&task.priority);
        let new_status = status.unwrap_or(&task.status);
        let new_meeting = match meeting_id {
            Some(Some(m)) => Some(m),
            Some(None) => None,
            None => task.meeting_id.as_deref(),
        };
        let new_notes = match notes {
            Some(Some(n)) => Some(n),
            Some(None) => None,
            None => task.notes.as_deref(),
        };

        sqlx::query(
            "UPDATE tasks SET title = ?, due_date = ?, priority = ?, status = ?, meeting_id = ?, notes = ? WHERE id = ?",
        )
        .bind(new_title)
        .bind(new_due)
        .bind(new_priority)
        .bind(new_status)
        .bind(new_meeting)
        .bind(new_notes)
        .bind(id)
        .execute(pool)
        .await?;

        Ok(true)
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn promote_action_items(
        pool: &SqlitePool,
        meeting_id: &str,
        items: &[String],
    ) -> Result<Vec<Task>, sqlx::Error> {
        let mut created = Vec::new();
        for item in items {
            if item.trim().is_empty() {
                continue;
            }
            let task = Self::create(
                pool,
                item.trim(),
                None,
                "medium",
                "todo",
                Some(meeting_id),
                None,
            )
            .await?;
            let created_at = Utc::now().to_rfc3339();
            sqlx::query(
                "INSERT INTO task_promotions (meeting_id, action_item_text, task_id, created_at) VALUES (?, ?, ?, ?)",
            )
            .bind(meeting_id)
            .bind(item.trim())
            .bind(&task.id)
            .bind(&created_at)
            .execute(pool)
            .await?;
            created.push(task);
        }
        Ok(created)
    }
}
