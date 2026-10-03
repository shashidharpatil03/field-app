# Every row added to the change log gets the time it was added, so the
# "Sent" screen can say when an update happened. Stored in UTC.
CHANGE_TIME_TRIGGER_SQL = """
    CREATE TRIGGER IF NOT EXISTS change_log_time
    AFTER INSERT ON farmer_change_log
    WHEN NEW.changed_at IS NULL
    BEGIN
        UPDATE farmer_change_log
        SET changed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = NEW.id;
    END
"""
