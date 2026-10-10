import { useState } from "react";
import { withSummary } from "./farmerRules.js";
import { apiFetch } from "./api.js";
import { isNetworkError, queueEdit } from "./offline.js";

const DROP_REASONS = [
  "Moved away",
  "No longer growing cotton",
  "Lost interest",
  "Health or family reasons",
  "Other",
];

// Marks a farmer as dropped out. The farmer's saved answers are sent as
// they are, with the reason.
function DropFarmer({ farmer, onCancel, onSaved }) {
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (reason === "") {
      setErrors({ participation: "Please choose a reason for dropping" });
      return;
    }
    setSaving(true);
    const body = {
      first_name: farmer.first_name ?? "",
      middle_name: farmer.middle_name ?? "",
      last_name: farmer.last_name ?? "",
      gender: farmer.gender,
      growing_cotton: Boolean(farmer.growing_cotton),
      mobile: farmer.mobile ?? "",
      total_landholding: farmer.total_landholding,
      area_under_cotton: farmer.area_under_cotton,
      water_regime: farmer.water_regime ?? "",
      confirmed_large: true,
      participation: "dropped_out",
      drop_reason: reason,
    };
    try {
      const response = await apiFetch(
        `http://localhost:8000/farmers/${farmer.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (response.ok) {
        onSaved();
        return;
      }
      const detail =
        typeof data.detail === "object" && data.detail !== null
          ? data.detail
          : { form: "Could not save. Please try again." };
      setErrors(withSummary(detail));
    } catch (error) {
      // No signal: keep the change on the phone, it is sent later.
      if (isNetworkError(error) && queueEdit(farmer, body)) {
        onSaved();
        return;
      }
      setErrors({ form: "Could not save. Please try again." });
    }
    setSaving(false);
  }

  return (
    <div className="fp-page">
      <h2 className="step-title">Dropped out</h2>
      <p className="fp-sub">
        {farmer.name} · {farmer.farmer_code}
      </p>
      <h3 className="step-title">Why did the farmer drop out?</h3>

      {DROP_REASONS.map((text) => (
        <label
          key={text}
          className={`reason-card ${reason === text ? "on" : ""}`}
        >
          <input
            type="radio"
            name="drop-reason"
            checked={reason === text}
            onChange={() => {
              setReason(text);
              setErrors({});
            }}
          />
          {text}
        </label>
      ))}

      {errors.participation && <p className="error">{errors.participation}</p>}
      {errors.form && <p className="error">{errors.form}</p>}
      {errors.summary && <p className="error">{errors.summary}</p>}

      <div className="fp-bar">
        <div className="fp-bar-inner">
          <button className="big-btn red" onClick={confirm} disabled={saving}>
            {saving ? "Saving..." : "Confirm: dropped out"}
          </button>
          <button className="big-btn gray" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default DropFarmer;
