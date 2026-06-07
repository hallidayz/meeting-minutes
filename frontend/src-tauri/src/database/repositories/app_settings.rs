use sqlx::SqlitePool;

pub struct AppSettingsRepository;

impl AppSettingsRepository {
    pub async fn get(
        pool: &SqlitePool,
        key: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT value FROM app_settings WHERE key = ?")
                .bind(key)
                .fetch_optional(pool)
                .await?;
        Ok(row.map(|r| r.0))
    }

    pub async fn set(pool: &SqlitePool, key: &str, value: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO app_settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key)
        .bind(value)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn get_bool(pool: &SqlitePool, key: &str) -> Result<bool, sqlx::Error> {
        Ok(Self::get(pool, key)
            .await?
            .map(|v| v == "true")
            .unwrap_or(false))
    }

    pub async fn set_bool(pool: &SqlitePool, key: &str, value: bool) -> Result<(), sqlx::Error> {
        Self::set(pool, key, if value { "true" } else { "false" }).await
    }
}
