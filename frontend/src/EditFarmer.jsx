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
import { apiFetch } from "./api.js";
import { isNetworkError, queueEdit, updateWaitingForm } from "./offline.js";

// Which answers belong to which screen (steps 0, 1 and 2).
const STEP_KEYS = [
  ["first_name", "middle_name", "last_name"],
  ["gender", "mobile"],
  ["growing_cotton", "total_landholding", "area_under_cotton", "water_regime"],
];
const STEP_TITLES = ["Farmer's name", "About the farmer", "Land and cotton"];

// The update flow: three short screens, then a final check. `mode` is
// "confirm" (still to update: every answer is gone through), "back"
// (bringing a dropped farmer back) or "change" (fixing some answers).
function EditFarmer({ farmer, mode, onCancel, onSaved }) {
  // A farmer still to be updated: the facilitator must answer these again.
  const blank = farmer.season_status === "to_update";
  // The farmer's status after saving: only "change" leaves it as it is.
  const status = mode === "change" ? farmer.participation : "continuing";
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
  // 0, 1, 2 are the question screens; 3 is the final check.
  const [step, setStep] = useState(0);
  // True when a screen was opened from the final check with "Change".
  const [fromReview, setFromReview] = useState(false);
  const [asking, setAsking] = useState(false);
  const [largeOk, setLargeOk] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const title = mode === "change" ? "Change details" : "Review details";

  // Checks only the answers on this screen, then moves on.
  function next() {
    const found = checkForm(
      { first, middle, last },
      gender,
      growingCotton,
      mobile,
      { total: total, cotton: cotton, water: water },
    );
    const mine = {};
    for (const key of STEP_KEYS[step]) {
      if (found[key]) {
        mine[key] = found[key];
      }
    }
    setErrors(withSummary(mine));
    if (Object.keys(mine).length > 0) {
      return;
    }
    setStep(fromReview ? 3 : step + 1);
    setFromReview(false);
  }

  function back() {
    setErrors({});
    if (step === 0) {
      onCancel();
    } else if (fromReview) {
      setStep(3);
      setFromReview(false);
    } else {
      setStep(step - 1);
    }
  }

  function change(index) {
    setErrors({});
    setFromReview(true);
    setStep(index);
  }

  // Large numbers are asked about once, before saving.
  function trySave() {
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
    save(largeOk);
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
      drop_reason: "",
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

    // Save on the phone first: it is instant, and it goes to the server by
    // itself as soon as there is signal. If the phone has no room, the
    // server is asked directly below.
    if (queueEdit(farmer, body)) {
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
      const found = typeof data.detail === "object" ? data.detail : {};
      setErrors(withSummary(found));
      // Go to the first screen that has a wrong answer.
      const wrong = STEP_KEYS.findIndex((keys) =>
        keys.some((key) => found[key]),
      );
      setStep(wrong === -1 ? 3 : wrong);
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

  const dots = (
    <div className="fp-dots">
      <div className="fp-dots-row">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`fp-dot ${i === step ? "on" : ""}`} />
        ))}
      </div>
      <span className="fp-dots-text">Step {step + 1} of 3</span>
    </div>
  );

  const head = (text) => (
    <div>
      <h2 className="step-title">{text}</h2>
      <p className="fp-sub">
        {farmer.name} · {farmer.farmer_code}
      </p>
    </div>
  );

  const messages = (
    <div>
      {errors.confirm_large && <p className="error">{errors.confirm_large}</p>}
      {errors.form && <p className="error">{errors.form}</p>}
      {errors.summary && <p className="error">{errors.summary}</p>}
    </div>
  );

  // The big buttons: Back and Next on the question screens.
  const stepBar = (
    <div className="fp-bar">
      <div className="fp-bar-inner">
        <div className="fp-bar-row">
          <button className="big-btn gray" onClick={back}>
            Back
          </button>
          <button className="big-btn green" onClick={next}>
            Next
          </button>
        </div>
      </div>
    </div>
  );

  if (step === 3) {
    const yesNo = (value) => (value ? "Yes" : "No");
    const acres = (value) =>
      value === null || value === undefined ? "Not recorded" : `${value} acres`;
    const part = (value) =>
      value === "continuing" ? "Continuing" : "Dropped out";
    // [label, new answer, what it was before]
    const groups = [
      [
        0,
        [["Name", fullName(first, middle, last), farmer.name]],
      ],
      [
        1,
        [
          ["Gender", gender, farmer.gender],
          [
            "Mobile number",
            mobile.trim() || "Not given",
            farmer.mobile || "Not given",
          ],
        ],
      ],
      [
        2,
        [
          [
            "Growing cotton",
            yesNo(growingCotton === "yes"),
            yesNo(farmer.growing_cotton),
          ],
          [
            "Total land",
            acres(parseAcres(total)),
            acres(farmer.total_landholding),
          ],
          [
            "Cotton land",
            acres(parseAcres(cotton)),
            acres(farmer.area_under_cotton),
          ],
          ["Water regime", water, farmer.water_regime || "Not recorded"],
        ],
      ],
    ];
    return (
      <div className="fp-page">
        {head("Check your answers")}
        {groups.map(([index, rows]) => (
          <div className="card" key={index}>
            <div className="fp-card-head">
              <span>{STEP_TITLES[index]}</span>
              <button
                className="fp-change"
                onClick={() => change(index)}
                disabled={saving}
              >
                ✎ Change
              </button>
            </div>
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
        ))}
        {status !== farmer.participation && (
          <div className="card">
            <div className="profile-row">
              <span className="label">Farmer Participation</span>
              <span className="value">
                {part(status)}
                <small className="was">Was: {part(farmer.participation)}</small>
              </span>
            </div>
          </div>
        )}
        {messages}

        {asking ? (
          <div className="fp-bar">
            <div className="fp-bar-inner">
              <div className="warning-box" role="alert">
                <strong>This is unusual. Is it correct?</strong>
                <p>
                  Most farmers have less than 50 acres, and you entered{" "}
                  {parseAcres(total)} acres of land and {parseAcres(cotton)}{" "}
                  acres of cotton.
                </p>
              </div>
              <button
                className="big-btn green"
                onClick={() => {
                  setLargeOk(true);
                  save(true);
                }}
              >
                Yes, it is correct
              </button>
              <button
                className="big-btn gray"
                onClick={() => setAsking(false)}
              >
                No, let me change it
              </button>
            </div>
          </div>
        ) : (
          <div className="fp-bar">
            <div className="fp-bar-inner">
              <button
                className="big-btn green"
                onClick={trySave}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : mode === "change"
                    ? "Save changes"
                    : "Save: farmer continues"}
              </button>
              <button
                className="big-btn gray"
                onClick={back}
                disabled={saving}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="fp-page">
        {head(title)}
        {dots}
        <h3 className="step-title">{STEP_TITLES[0]}</h3>
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
        {messages}
        {stepBar}
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="fp-page">
        {head(title)}
        {dots}
        <h3 className="step-title">{STEP_TITLES[1]}</h3>
        <div className="field">
          <label>Gender</label>
          <div className="choice-row">
            {["Female", "Male", "Other"].map((g) => (
              <button
                key={g}
                type="button"
                className={gender === g ? "on" : ""}
                onClick={() => setGender(g)}
              >
                {g}
              </button>
            ))}
          </div>
          {errors.gender && <p className="error">{errors.gender}</p>}
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
        {messages}
        {stepBar}
      </div>
    );
  }

  return (
    <div className="fp-page">
      {head(title)}
      {dots}
      <h3 className="step-title">{STEP_TITLES[2]}</h3>
      <div className="field">
        <label>Growing cotton this season?</label>
        <div className="choice-row">
          {[
            ["yes", "Yes"],
            ["no", "No"],
          ].map(([value, text]) => (
            <button
              key={value}
              type="button"
              className={growingCotton === value ? "on" : ""}
              onClick={() => {
                setGrowingCotton(value);
                setCotton(cottonAfterGrowingChange(value, cotton));
              }}
            >
              {text}
            </button>
          ))}
        </div>
        {errors.growing_cotton && (
          <p className="error">{errors.growing_cotton}</p>
        )}
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
      {messages}
      {stepBar}
    </div>
  );
}

export default EditFarmer;
