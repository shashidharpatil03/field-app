import { useState } from "react";

function checkForm(name, gender, growingCotton) {
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

function RegisterFarmer({ lgId, lgCode, onBack, onDone }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [growingCotton, setGrowingCotton] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const found = checkForm(name, gender, growingCotton);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `http://localhost:8000/lgs/${lgId}/farmers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            gender: gender,
            growing_cotton: growingCotton === "yes",
          }),
        }
      );
      const data = await response.json();

      if (response.ok) {
        onDone(`${name.trim()} was registered in ${lgCode}.`);
      } else if (typeof data.detail === "object") {
        setErrors(data.detail);
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
    } catch {
      setErrors({ form: "Could not reach the server. Please try again." });
    }
    setSaving(false);
  }

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h1>Register farmer</h1>
      <p>Learning group {lgCode}</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errors.name ? "has-error" : ""}
          />
          {errors.name && <p className="error">{errors.name}</p>}
        </div>

        <div className="field">
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={errors.gender ? "has-error" : ""}
          >
            <option value="">Choose...</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
          {errors.gender && <p className="error">{errors.gender}</p>}
        </div>

        <div className="field">
          <label htmlFor="cotton">Growing cotton this season?</label>
          <select
            id="cotton"
            value={growingCotton}
            onChange={(e) => setGrowingCotton(e.target.value)}
            className={errors.growing_cotton ? "has-error" : ""}
          >
            <option value="">Choose...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          {errors.growing_cotton && (
            <p className="error">{errors.growing_cotton}</p>
          )}
        </div>

        {errors.form && <p className="error">{errors.form}</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Register farmer"}
        </button>
      </form>
    </div>
  );
}

export default RegisterFarmer;
