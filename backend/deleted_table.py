# Archive of farmers deleted because they were added by mistake.
# Kept so a deletion can be audited; deleted farmers never show in the app.
DELETED_FARMERS_SQL = """
    CREATE TABLE IF NOT EXISTS deleted_farmers (
        id INTEGER PRIMARY KEY,
        farmer_id INTEGER NOT NULL,
        lg_id INTEGER NOT NULL,
        farmer_number INTEGER NOT NULL,
        farmer_code TEXT NOT NULL,
        name TEXT NOT NULL,
        gender TEXT NOT NULL,
        growing_cotton INTEGER NOT NULL,
        mobile TEXT,
        total_landholding REAL,
        area_under_cotton REAL,
        water_regime TEXT,
        registered_on TEXT,
        deleted_on TEXT NOT NULL,
        deleted_by TEXT NOT NULL,
        reason TEXT NOT NULL
    )
"""
