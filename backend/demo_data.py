# Made-up values for the demo farmers. Nothing here is real data.
from datetime import date, timedelta

WATER_CHOICES = ["Rainfed", "Partially irrigated", "Fully irrigated"]
WATER_WEIGHTS = [50, 30, 20]


def season_start(today):
    """The cotton season starts on 1 May every year."""
    this_year = date(today.year, 5, 1)
    if today >= this_year:
        return this_year
    return date(today.year - 1, 5, 1)


def demo_land(rng, growing_cotton):
    """Returns (total_landholding, area_under_cotton, water_regime)."""
    total = rng.randint(3, 48) / 4  # 0.75 to 12 acres, in quarter acres
    if growing_cotton:
        share = rng.uniform(0.4, 1.0)
        cotton = max(0.25, round(total * share * 4) / 4)
        cotton = min(cotton, total)
    else:
        cotton = 0.0
    water = rng.choices(WATER_CHOICES, weights=WATER_WEIGHTS)[0]
    return total, cotton, water


def demo_registered_on(rng, today):
    """A made-up registration date: most farmers joined in earlier years,
    some last season and some in the current season."""
    start = season_start(today)
    pick = rng.random()
    if pick < 0.15:  # this season
        first, last = start, today
    elif pick < 0.30:  # earlier in the previous season
        first, last = start - timedelta(days=120), start - timedelta(days=1)
    else:  # one to three years ago
        first = today - timedelta(days=3 * 365)
        last = start - timedelta(days=121)
    days = (last - first).days
    return (first + timedelta(days=rng.randint(0, max(days, 0)))).isoformat()


def add_demo_history(connection, rng, today):
    """Made-up change history, so the dashboard has something to count.

    Farmers who already have any history are left alone, so running this
    twice (or on a database with real test edits) does no harm.
    """
    rows = connection.execute(
        """
        SELECT id, participation, registered_on, total_landholding, water_regime
        FROM farmers
        WHERE id NOT IN (SELECT farmer_id FROM farmer_change_log)
        ORDER BY id
        """
    ).fetchall()
    other_water = {
        "Rainfed": "Partially irrigated",
        "Partially irrigated": "Rainfed",
        "Fully irrigated": "Partially irrigated",
    }
    reasons = ["Moved away", "Not interested", "Health reasons", "Crop failure"]

    for farmer_id, participation, registered_on, total, water in rows:
        joined = date.fromisoformat(registered_on)
        days_since = max((today - joined).days, 1)

        if participation == "dropped_out":
            when = joined + timedelta(days=rng.randint(1, days_since))
            connection.execute(
                "INSERT INTO farmer_change_log (farmer_id, field, old_value, "
                "new_value, changed_on, reason) VALUES (?, ?, ?, ?, ?, ?)",
                (farmer_id, "Participation", "Continuing", "Dropped out",
                 when.isoformat(), rng.choice(reasons)),
            )
        elif rng.random() < 0.2:
            when = joined + timedelta(days=rng.randint(1, days_since))
            if rng.random() < 0.5 and water in other_water:
                entry = ("Water regime", other_water[water], water)
            else:
                entry = ("Total landholding (acres)", f"{total + 0.5:g}", f"{total:g}")
            connection.execute(
                "INSERT INTO farmer_change_log (farmer_id, field, old_value, "
                "new_value, changed_on, reason) VALUES (?, ?, ?, ?, ?, ?)",
                (farmer_id, entry[0], entry[1], entry[2], when.isoformat(), ""),
            )
