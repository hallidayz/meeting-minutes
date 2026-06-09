-- Native calendar integration feature flag and settings (default off for rollback safety)
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('calendar_integration_enabled', 'false');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('calendar_enabled_ids', '[]');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('calendar_lookahead_hours', '168');
