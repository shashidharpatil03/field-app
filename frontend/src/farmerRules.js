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

export function checkForm(name, gender, growingCotton, mobile = "") {
  const errors = {};
  const nameMessage = nameError(name, "farmer");
  if (nameMessage) {
    errors.name = nameMessage;
  }

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

  return errors;
}
