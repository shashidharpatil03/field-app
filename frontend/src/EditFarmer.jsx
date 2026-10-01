import { useState } from "react";
import { checkForm } from "./farmerRules.js";

function EditFarmer({ farmer, onCancel, onSaved }) {
  const [name, setName] = useState(farmer.name);
  const [gender, setGender] = useState(farmer.gender);
  const [growingCotton, setGrowingCotton] = useState(
    farmer.growing_cotton ? "yes" : "no"
  );
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleSave(event) {
    event.preventDefault();

    const found = checkForm(name, gender, growingCotton);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `http://localhost:8000/farmers/${farmer.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            gender: gender,
            growing_cotton: growingCotton === "yes",
            reason: reason,
          }),
        }
      );
      const data = await response.json();

      if (response.ok) {
        onSaved();
        return;
      }
      setErrors(typeof data.detail === "object" ? data.detail : {});
    } catch {
      setErrors({ form: "Could not reach the server. Please try again." });
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <div className="field">
        <label htmlFor="edit-name">Full name</label>
        <input
          id="edit-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={errors.name ? "has-error" : ""}
        />
        {errors.name && <p className="error">{errors.name}</p>}
      </div>

      <div className="field">
        <label htmlFor="edit-gender">Gender</label>
        <select
          id="edit-gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className={errors.gender ? "has-error" : ""}
        >
          <option value="Female">Female</option>
          <option value="Male">Male</option>
          <option value="Other">Other</option>
        </select>
        {errors.gender && <p className="error">{errors.gender}</p>}
      </div>

      <div className="field">
        <label htmlFor="edit-cotton">Growing cotton this season?</label>
        <select
          id="edit-cotton"
          value={growingCotton}
          onChange={(e) => setGrowingCotton(e.target.value)}
          className={errors.growing_cotton ? "has-error" : ""}
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
        {errors.growing_cotton && (
          <p className="error">{errors.growing_cotton}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="edit-reason">Reason for change (optional)</label>
        <input
          id="edit-reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={errors.reason ? "has-error" : ""}
        />
        {errors.reason && <p className="error">{errors.reason}</p>}
      </div>

      {errors.form && <p className="error">{errors.form}</p>}

      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save changes"}
      </button>
      <button type="button" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </form>
  );
}

export default EditFarmer;
