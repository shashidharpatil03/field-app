// Rules shared by the register form and the edit form.
// Returns a message if the name is not acceptable, otherwise null.
export function nameError(name, who) {
  const cleanName = name.trim();

  if (cleanName === "") {
    return `Please enter the ${who}'s full name`;
  }
  if (cleanName.length < 3) {
    return "Name is too short (at least 3 letters)";
  }
  if (cleanName.length > 60) {
    return "Name is too long (at most 60 letters)";
  }
  if (!/^[\p{L}\p{M} .'-]+$/u.test(cleanName)) {
    return "Name can only have letters and spaces";
  }
  return null;
}

// The full name is always worked out from first, middle and last name.
export function fullName(first, middle, last) {
  return [first, middle, last]
    .map((part) => (part ?? "").trim().replace(/\s+/g, " "))
    .filter((part) => part !== "")
    .join(" ");
}

// Problems with the three name parts, as { first_name: "...", ... }.
export function nameParts(first, middle, last) {
  const errors = {};
  const rules = [
    ["first_name", "first name", first, true],
    ["middle_name", "middle name", middle, false],
    ["last_name", "last name", last, true],
  ];
  for (const [field, label, raw, required] of rules) {
    const text = (raw ?? "").trim();
    if (text === "") {
      if (required) {
        errors[field] = `Please enter the farmer's ${label}`;
      }
    } else if (required && text.length < 2) {
      errors[field] = `The ${label} is too short (at least 2 letters)`;
    } else if (text.length > 30) {
      errors[field] = `The ${label} is too long (at most 30 letters)`;
    } else if (!/^[\p{L}\p{M} .'-]+$/u.test(text)) {
      errors[field] = `The ${label} can only have letters and spaces`;
    }
  }
  if (
    Object.keys(errors).length === 0 &&
    fullName(first, middle, last).length > 60
  ) {
    errors.last_name = "The full name is too long (at most 60 letters)";
  }
  return errors;
}

export const WATER_REGIMES = [
  "Rainfed",
  "Partially irrigated",
  "Fully irrigated",
];
export const LARGE_ACRES = 50; // above this we ask "is it correct?"
export const MAX_ACRES = 100; // hard limit

// "2.5" -> 2.5, "" -> null, "abc" -> NaN
export function parseAcres(text) {
  const clean = String(text ?? "").trim();
  if (clean === "") {
    return null;
  }
  if (!/^[0-9]+(\.[0-9]+)?$/.test(clean)) {
    return NaN;
  }
  return Number(clean);
}

// Problems with how the number is written (used for drafts and for forms).
export function acresFormatError(text, label) {
  const value = parseAcres(text);
  if (value === null) {
    return null;
  }
  if (Number.isNaN(value)) {
    return `${label} must be a number, like 2 or 2.5`;
  }
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(String(text).trim())) {
    return `${label} can have at most 2 decimal places`;
  }
  if (value > MAX_ACRES) {
    return `${label} cannot be more than ${MAX_ACRES} acres`;
  }
  return null;
}

export function landFormatErrors(totalText, cottonText) {
  const errors = {};
  const total = acresFormatError(totalText, "Total landholding");
  const cotton = acresFormatError(cottonText, "Area under cotton");
  if (total) {
    errors.total_landholding = total;
  }
  if (cotton) {
    errors.area_under_cotton = cotton;
  }
  return errors;
}

// Full check before review / save. growingCotton is "yes", "no" or "".
export function checkLand(totalText, cottonText, growingCotton, water) {
  const errors = landFormatErrors(totalText, cottonText);
  const total = parseAcres(totalText);
  const cotton = parseAcres(cottonText);

  if (!errors.total_landholding) {
    if (total === null) {
      errors.total_landholding = "Please enter the total landholding (acres)";
    } else if (total <= 0) {
      errors.total_landholding = "Total landholding must be more than 0";
    }
  }

  if (growingCotton === "yes" && !errors.area_under_cotton) {
    if (cotton === null) {
      errors.area_under_cotton = "Please enter the area under cotton (acres)";
    } else if (cotton <= 0) {
      errors.area_under_cotton =
        "Area under cotton must be more than 0 if growing cotton";
    }
  }

  if (
    !errors.total_landholding &&
    !errors.area_under_cotton &&
    total !== null &&
    cotton !== null &&
    cotton > total
  ) {
    errors.area_under_cotton =
      "Area under cotton cannot be more than the total landholding";
  }

  if (!WATER_REGIMES.includes(water)) {
    errors.water_regime = "Please choose a water regime";
  }
  return errors;
}

// True if a value over 50 acres needs the "is it correct?" question.
// When editing, pass the saved values: only changed values are asked about.
export function needsLargeConfirm(totalText, cottonText, oldTotal, oldCotton) {
  const total = parseAcres(totalText);
  const cotton = parseAcres(cottonText);
  const bigTotal = total > LARGE_ACRES && total !== oldTotal;
  const bigCotton = cotton > LARGE_ACRES && cotton !== oldCotton;
  return Boolean(bigTotal || bigCotton);
}

// Not growing cotton -> area is 0 and locked. Growing again -> clear the 0.
export function cottonAfterGrowingChange(growingCotton, cottonText) {
  if (growingCotton === "no") {
    return "0";
  }
  if (cottonText === "0") {
    return "";
  }
  return cottonText;
}

export function acresText(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function checkForm(
  parts,
  gender,
  growingCotton,
  mobile = "",
  land = null,
) {
  const errors = nameParts(parts.first, parts.middle, parts.last);

  if (gender === "") {
    errors.gender = "Please choose a gender";
  }

  if (growingCotton === "") {
    errors.growing_cotton = "Please choose Yes or No";
  }

  // Mobile is optional, but if it is filled in it must be exactly 10 digits.
  if (mobile.trim() !== "" && !/^[0-9]{10}$/.test(mobile.trim())) {
    errors.mobile = "Mobile number must be exactly 10 digits";
  }

  if (land) {
    Object.assign(
      errors,
      checkLand(land.total, land.cotton, growingCotton, land.water),
    );
  }

  return errors;
}
