# A farmer's name is kept as first, middle and last name. The full name
# ("name") is always worked out from them, never typed in separately.
import unicodedata


def clean(text):
    """Trims and squeezes spaces."""
    return " ".join((text or "").split())


def build_name(first, middle, last):
    return " ".join(part for part in (clean(first), clean(middle), clean(last)) if part)


def split_name(name):
    """Splits an existing full name: first word, last word, the rest in the
    middle. A one-word name becomes just a first name."""
    words = clean(name).split(" ") if clean(name) else []
    if len(words) == 0:
        return "", "", ""
    if len(words) == 1:
        return words[0], "", ""
    return words[0], " ".join(words[1:-1]), words[-1]


def parts_from(first, middle, last, name=""):
    """The three parts from a request. An older request that only has a
    full name is split instead."""
    if clean(first) == "" and clean(last) == "" and clean(middle) == "" and clean(name):
        return split_name(name)
    return clean(first), clean(middle), clean(last)


def _letters_only(text):
    return all(unicodedata.category(ch)[0] in "LM" or ch in " .'-" for ch in text)


def part_errors(first, middle, last, strict=True):
    """Problems with the three parts, as {field: message}. strict=False is
    for drafts, where nothing is required yet."""
    errors = {}
    for field, label, text, required in (
        ("first_name", "first name", first, True),
        ("middle_name", "middle name", middle, False),
        ("last_name", "last name", last, True),
    ):
        if text == "":
            if strict and required:
                errors[field] = f"Please enter the farmer's {label}"
            continue
        if strict and required and len(text) < 2:
            errors[field] = f"The {label} is too short (at least 2 letters)"
        elif len(text) > 30:
            errors[field] = f"The {label} is too long (at most 30 letters)"
        elif not _letters_only(text):
            errors[field] = f"The {label} can only have letters and spaces"
    if not errors and len(build_name(first, middle, last)) > 60:
        errors["last_name"] = "The full name is too long (at most 60 letters)"
    return errors
