-- Add notes field to tasks and user email preference
ALTER TABLE tasks ADD COLUMN notes TEXT;

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_email', '');
