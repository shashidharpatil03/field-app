# The audit trail: one row for every change made through the app, saying
# who made it and when (UTC). Details are short and contain no personal data
# beyond the farmer code.
ACTIVITY_LOG_SQL = """
    CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY,
        at TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT ''
    )
"""
