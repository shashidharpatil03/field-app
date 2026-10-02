import { useState } from "react";
import {
  checkForm,
  parseAcres,
  needsLargeConfirm,
  cottonAfterGrowingChange,
  acresText,
} from "./farmerRules.js";
import LandFields from "./LandFields.jsx";
import { apiFetch } from "./api.js";

function EditFarmer({ farmer, onCancel, onSaved }) {
  const [name, setName] = useState(farmer.name);
  const [gender, setGender] = useState(farmer.gender);
  const [growingCotton, setGrowingCotton] = useState(
    farmer.growing_cotton ? "yes" : "no",
  );
  const [mobile, setMobile] = useState(farmer.mobile ?? "");
  const [total, setTotal] = useState(acresText(farmer.total_landholding));
  const [cotton, setCotton] = useState(
    farmer.growing_cotton ? acresText(farmer.area_under_cotton) : "0",
  );
  const [water, setWater] = useState(farmer.water_regime ?? "");
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function handleSave(event) {
    event.preventDefault();

    const found = checkForm(name, gender, growingCotton, mobile, {
      total: total,
      cotton: cotton,
      water: water,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    // Only numbers that are being changed to more than 50 are questioned.
    if (
      needsLargeConfirm(
        total,
        cotton,
        farmer.total_landholding,
        farmer.area_under_cotton,
      )
    ) {
      setAsking(true);
      return;
    }
    save(false);
  }

  async function save(confirmedLarge) {
    setAsking(false);
    setSaving(true);
    try {
      const response = await apiFetch(
        `http://localhost:8000/farmers/${farmer.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            gender: gender,
            growing_cotton: growingCotton === "yes",
            mobile: mobile,
            total_landholding: parseAcres(total),
            area_under_cotton: parseAcres(cotton),
            water_regime: water,
            confirmed_large: confirmedLarge,
            reason: reason,
          }),
        },
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
          onChange={(e) => {
            setGrowingCotton(e.target.value);
            setCotton(cottonAfterGrowingChange(e.target.value, cotton));
          }}
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
        <label htmlFor="edit-mobile">Mobile number (optional)</label>
        <input
          id="edit-mobile"
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className={errors.mobile ? "has-error" : ""}
        />
        {errors.mobile && <p className="error">{errors.mobile}</p>}
      </div>

      <LandFields
        idPrefix="edit"
        total={total}
        setTotal={setTotal}
        cotton={cotton}
        setCotton={setCotton}
        growingCotton={growingCotton}
        water={water}
        setWater={setWater}
        errors={errors}
      />

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

      {errors.confirm_large && <p className="error">{errors.confirm_large}</p>}
      {errors.form && <p className="error">{errors.form}</p>}

      {asking ? (
        <div className="warning-box" role="alert">
          <strong>This is unusual. Is it correct?</strong>
          <p>
            Most farmers have less than 50 acres, and you entered{" "}
            {parseAcres(total)} acres of land and {parseAcres(cotton)} acres of
            cotton.
          </p>
          <button type="button" onClick={() => save(true)}>
            Yes, it is correct
          </button>
          <button type="button" onClick={() => setAsking(false)}>
            No, let me change it
          </button>
        </div>
      ) : (
        <div>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}

export default EditFarmer;
