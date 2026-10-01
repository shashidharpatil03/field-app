// Rules shared by the register form and the edit form.
export function checkForm(name, gender, growingCotton) {
  const errors = {};
  const cleanName = name.trim();

  if (cleanName === "") {
    errors.name = "Please enter the farmer's full name";
  } else if (cleanName.length < 3) {
    errors.name = "Name is too short (at least 3 letters)";
  } else if (cleanName.length > 60) {
    errors.name = "Name is too long (at most 60 letters)";
  } else if (!/^[\p{L}\p{M} .'-]+$/u.test(cleanName)) {
    errors.name = "Name can only have letters and spaces";
  }

  if (gender === "") {
    errors.gender = "Please choose a gender";
  }

  if (growingCotton === "") {
    errors.growing_cotton = "Please choose Yes or No";
  }

  return errors;
}
