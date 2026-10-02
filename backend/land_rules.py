# Rules for the land fields, kept apart from main.py so they are easy to test.
import math

WATER_REGIMES = ["Rainfed", "Partially irrigated", "Fully irrigated"]
LARGE_ACRES = 50  # above this we ask the user to confirm
MAX_ACRES = 100  # hard limit


def has_two_decimals(value):
    return abs(value * 100 - round(value * 100)) < 1e-6


def number_problem(value, label):
    """Returns a message if value is not a sensible acre figure, else None."""
    if not math.isfinite(value):
        return f"{label} must be a number"
    if value < 0:
        return f"{label} cannot be negative"
    if value > MAX_ACRES:
        return f"{label} cannot be more than {MAX_ACRES} acres"
    if not has_two_decimals(value):
        return f"{label} can have at most 2 decimal places"
    return None


def changed(new, old):
    return old is None or abs(new - old) > 1e-9


def check_land(total, cotton, water, growing_cotton, confirmed,
               old_total=None, old_cotton=None):
    """Checks the three land answers for a farmer who is being saved.

    Returns (errors, cotton_area). The cotton area is forced to 0 when the
    farmer is not growing cotton. Values above 50 acres need `confirmed`
    (when editing, only if that value is being changed).
    """
    errors = {}

    if total is None:
        errors["total_landholding"] = "Please enter the total landholding (acres)"
    else:
        problem = number_problem(total, "Total landholding")
        if problem is None and total <= 0:
            problem = "Total landholding must be more than 0"
        if problem:
            errors["total_landholding"] = problem

    if growing_cotton is False:
        cotton = 0.0
    elif growing_cotton is True:
        if cotton is None:
            errors["area_under_cotton"] = "Please enter the area under cotton (acres)"
        else:
            problem = number_problem(cotton, "Area under cotton")
            if problem is None and cotton <= 0:
                problem = "Area under cotton must be more than 0 if growing cotton"
            if problem:
                errors["area_under_cotton"] = problem

    if (
        "total_landholding" not in errors
        and "area_under_cotton" not in errors
        and total is not None
        and cotton is not None
        and cotton > total
    ):
        errors["area_under_cotton"] = (
            "Area under cotton cannot be more than the total landholding"
        )

    if water not in WATER_REGIMES:
        errors["water_regime"] = "Please choose a water regime"

    if not errors:
        large = (total > LARGE_ACRES and changed(total, old_total)) or (
            cotton > LARGE_ACRES and changed(cotton, old_cotton)
        )
        if large and not confirmed:
            errors["confirm_large"] = (
                "This is unusual (more than 50 acres). Please confirm it is correct."
            )

    if total is not None:
        total = round(total, 2) if math.isfinite(total) else total
    if cotton is not None:
        cotton = round(cotton, 2) if math.isfinite(cotton) else cotton
    return errors, cotton


def check_draft_land(total, cotton, water):
    """Drafts may be unfinished, so only impossible values are rejected."""
    errors = {}
    if total is not None:
        problem = number_problem(total, "Total landholding")
        if problem:
            errors["total_landholding"] = problem
    if cotton is not None:
        problem = number_problem(cotton, "Area under cotton")
        if problem:
            errors["area_under_cotton"] = problem
    if water != "" and water not in WATER_REGIMES:
        errors["water_regime"] = "Please choose a water regime"
    return errors


def show_acres(value):
    """12.0 -> '12', 2.5 -> '2.5'; None -> '(not recorded)'."""
    if value is None:
        return "(not recorded)"
    return f"{value:g}"
