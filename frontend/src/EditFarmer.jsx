import { useState } from "react";
import {
  checkForm,
  parseAcres,
  needsLargeConfirm,
  cottonAfterGrowingChange,
  acresText,
  withSummary,
  fullName,
} from "./farmerRules.js";
import LandFields from "./LandFields.jsx";
import NameFields from "./NameFields.jsx";
import Required from "./Required.jsx";
import { apiFetch } from "./api.js";
import { isNetworkError, queueEdit, updateWaitingForm } from "./offline.js";

const DROP_REASONS = [
  "Moved away",
  "No longer growing cotton",
  "Lost interest",
  "Health or family reasons",
  "Other",
];

function EditFarmer({ farmer, onCancel, onSaved }) {
  // A farmer still to be updated: the facilitator must answer these again.
  const blank = farmer.season_status === "to_update";
  const [first, setFirst] = useState(farmer.first_name ?? "");
  const [middle, setMiddle] = useState(farmer.middle_name ?? "");
  const [last, setLast] = useState(farmer.last_name ?? "");
  const [gender, setGender] = useState(farmer.gender);
  const [growingCotton, setGrowingCotton] = useState(
    blank ? "" : farmer.growing_cotton ? "yes" : "no",
  );
  const [mobile, setMobile] = useState(farmer.mobile ?? "");
  const [total, setTotal] = useState(acresText(farmer.total_landholding));
  const [cotton, setCotton] = useState(
    blank
      ? ""
      : farmer.growing_cotton
        ? acresText(farmer.area_under_cotton)
        : "0",
  );
  const [water, setWater] = useState(farmer.water_regime ?? "");
  const [status, setStatus] = useState(blank ? "" : farmer.participation);
  const [dropReason, setDropReason] = useState("");
  const [asking, setAsking] = useState(false);
  // "form" is the questions; "review" shows the answers before saving.
  const [step, setStep] = useState("form");
  const [largeOk, setLargeOk] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function handleSave(event) {
    event.preventDefault();

    const found = checkForm(
      { first, middle, last },
      gender,
      growingCotton,
      mobile,
      {
        total: total,
        cotton: cotton,
        water: water,
      },
    );
    if (status === "") {
      found.participation = "Please choose the farmer participation";
    }
    if (status === "dropped_out" && status !== farmer.participation) {
      if (dropReason === "") {
        found.participation = "Please choose a reason for dropping";
      }
    }
    setErrors(withSummary(found));
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
    setStep("review");
  }

  async function save(confirmedLarge) {
    setAsking(false);
    setSaving(true);
    const body = {
      first_name: first,
      middle_name: middle,
      last_name: last,
      gender: gender,
      growing_cotton: growingCotton === "yes",
      mobile: mobile,
      total_landholding: parseAcres(total),
      area_under_cotton: parseAcres(cotton),
      water_regime: water,
      confirmed_large: confirmedLarge,
      participation: status,
      drop_reason: status === "dropped_out" ? dropReason : "",
    };

    // A farmer who is still waiting to be registered is not on the server
    // yet: just change the answers waiting on the phone.
    if (farmer.id < 0) {
      updateWaitingForm(farmer.pendingKey, {
        first_name: first,
        middle_name: middle,
        last_name: last,
        gender: gender,
        growing_cotton: body.growing_cotton,
        mobile: mobile,
        total_landholding: body.total_landholding,
        area_under_cotton: body.area_under_cotton,
        water_regime: water,
        confirmed_large: confirmedLarge,
      });
      onSaved();
      return;
    }

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
      setErrors(
        withSummary(typeof data.detail === "object" ? data.detail : {}),
      );
      setStep("form");
    } catch (error) {
      // No signal: keep the change on the phone, it is sent later.
      if (isNetworkError(error) && queueEdit(farmer, body)) {
        onSaved();
        return;
      }
      setErrors({ form: "Could not save. Please try again." });
      setStep("form");
    }
    setSaving(false);
  }

  if (step === "review") {
    const yesNo = (value) => (value ? "Yes" : "No");
    const part = (value) =>
      value === "continuing" ? "Continuing" : "Dropped out";
    const acres = (value) =>
      value === null || value === undefined ? "Not recorded" : `${value} acres`;
    // [label, new answer, what it was before]
    const rows = [
      ["Full name", fullName(first, middle, last), farmer.name],
      ["Gender", gender, farmer.gender],
      [
        "Growing cotton this season?",
        yesNo(growingCotton === "yes"),
        yesNo(farmer.growing_cotton),
      ],
      [
        "Mobile number",
        mobile.trim() || "Not given",
        farmer.mobile || "Not given",
      ],
      [
        "Total landholding",
        acres(parseAcres(total)),
        acres(farmer.total_landholding),
      ],
      [
        "Area under cotton",
        acres(parseAcres(cotton)),
        acres(farmer.area_under_cotton),
      ],
      ["Water regime", water, farmer.water_regime || "Not recorded"],
    ];
    if (farmer.season_status !== "new") {
      rows.push([
        "Farmer Participation",
        part(status),
        part(farmer.participation),
      ]);
    }
    if (status === "dropped_out" && farmer.participation === "continuing") {
      rows.push(["Reason for dropping", dropReason, dropReason]);
    }
    return (
      <div>
        <h2>Review</h2>
        <p>Check the answers, then save.</p>
        <div className="card">
          {rows.map(([label, value, was]) => (
            <div className="profile-row" key={label}>
              <span className="label">{label}</span>
              <span className="value">
                {value}
                {value !== was && <small className="was">Was: {was}</small>}
              </span>
            </div>
          ))}
        </div>
        {errors.form && <p className="error">{errors.form}</p>}
        <button onClick={() => save(largeOk)} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={() => setStep("form")} disabled={saving}>
          Edit answers
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <NameFields
        idPrefix="edit"
        first={first}
        middle={middle}
        last={last}
        errors={errors}
        onChange={(key, value) =>
          ({ first: setFirst, middle: setMiddle, last: setLast })[key](value)
        }
      />

      <div className="field">
        <label htmlFor="edit-gender">
          Gender
          <Required />
        </label>
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
        <label htmlFor="edit-cotton">
          Growing cotton this season?
          <Required />
        </label>
        <select
          id="edit-cotton"
          value={growingCotton}
          onChange={(e) => {
            setGrowingCotton(e.target.value);
            setCotton(cottonAfterGrowingChange(e.target.value, cotton));
          }}
          className={errors.growing_cotton ? "has-error" : ""}
        >
          {blank && <option value="">Choose...</option>}
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

      {farmer.season_status !== "new" && (
        <div className="field">
          <label htmlFor="edit-status">
            Farmer Participation
            <Required />
          </label>
          <select
            id="edit-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setErrors({});
            }}
            className={errors.participation ? "has-error" : ""}
          >
            {blank && <option value="">Choose...</option>}
            <option value="continuing">Continuing</option>
            <option value="dropped_out">Dropped out</option>
          </select>
          {status === "continuing" &&
            farmer.participation === "dropped_out" && (
              <p className="note">
                Bringing the farmer back. Please check the details above, then
                save: this counts as updated for this season.
              </p>
            )}
          {status === "dropped_out" &&
            farmer.participation === "continuing" && (
              <fieldset className="radio-group">
                <legend>Reason for dropping</legend>
                {DROP_REASONS.map((text) => (
                  <label key={text} className="radio">
                    <input
                      type="radio"
                      name="edit-drop-reason"
                      checked={dropReason === text}
                      onChange={() => {
                        setDropReason(text);
                        setErrors({});
                      }}
                    />
                    {text}
                  </label>
                ))}
              </fieldset>
            )}
          {errors.participation && (
            <p className="error">{errors.participation}</p>
          )}
        </div>
      )}

      {errors.confirm_large && <p className="error">{errors.confirm_large}</p>}
      {errors.form && <p className="error">{errors.form}</p>}
      {errors.summary && <p className="error">{errors.summary}</p>}

      {asking ? (
        <div className="warning-box" role="alert">
          <strong>This is unusual. Is it correct?</strong>
          <p>
            Most farmers have less than 50 acres, and you entered{" "}
            {parseAcres(total)} acres of land and {parseAcres(cotton)} acres of
            cotton.
          </p>
          <button
            type="button"
            onClick={() => {
              setLargeOk(true);
              setAsking(false);
              setStep("review");
            }}
          >
            Yes, it is correct
          </button>
          <button type="button" onClick={() => setAsking(false)}>
            No, let me change it
          </button>
        </div>
      ) : (
        <div>
          <button type="submit" disabled={saving}>
            Review
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
