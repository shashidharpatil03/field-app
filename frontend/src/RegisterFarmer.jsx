import { useState } from "react";
import {
  checkForm,
  fullName,
  parseAcres,
  landFormatErrors,
  needsLargeConfirm,
  cottonAfterGrowingChange,
  acresText,
  withSummary,
} from "./farmerRules.js";
import LandFields from "./LandFields.jsx";
import NameFields from "./NameFields.jsx";
import { apiFetch } from "./api.js";
import { addPending, isNetworkError, newClientId } from "./offline.js";

// Which answers belong to which screen (steps 0, 1 and 2).
const STEP_KEYS = [
  ["first_name", "middle_name", "last_name"],
  ["gender", "mobile"],
  ["growing_cotton", "total_landholding", "area_under_cotton", "water_regime"],
];
const STEP_TITLES = ["Farmer's name", "About the farmer", "Land and cotton"];

// The first screen that has a wrong answer (3 if none is on a question screen).
function screenOf(found) {
  const wrong = STEP_KEYS.findIndex((keys) => keys.some((key) => found[key]));
  return wrong === -1 ? 3 : wrong;
}

function RegisterFarmer({ lgId, lgCode, draft, onBack, onDone }) {
  const [first, setFirst] = useState(draft ? draft.first_name : "");
  const [middle, setMiddle] = useState(draft ? draft.middle_name : "");
  const [last, setLast] = useState(draft ? draft.last_name : "");
  const name = fullName(first, middle, last);
  const [gender, setGender] = useState(draft ? draft.gender : "");
  const [growingCotton, setGrowingCotton] = useState(
    draft && draft.growing_cotton !== null
      ? draft.growing_cotton
        ? "yes"
        : "no"
      : "",
  );
  const [mobile, setMobile] = useState(draft ? draft.mobile : "");
  const [total, setTotal] = useState(
    draft ? acresText(draft.total_landholding) : "",
  );
  const [cotton, setCotton] = useState(
    draft
      ? draft.growing_cotton === 0
        ? "0"
        : acresText(draft.area_under_cotton)
      : "",
  );
  const [water, setWater] = useState(draft ? draft.water_regime : "");
  // The answer to "is it correct?" only counts for the numbers it was given
  // for, so changing a number asks the question again.
  const [confirmedFor, setConfirmedFor] = useState(
    draft && draft.confirmed_large
      ? `${draft.total_landholding}|${draft.area_under_cotton}`
      : "",
  );
  // A draft made without signal has a number only on this phone (negative).
  const [draftId, setDraftId] = useState(
    draft && draft.id > 0 ? draft.id : null,
  );
  // Set when this form is already kept on the phone: it is then saved there
  // again, and sent from there.
  const waitingKey = draft && draft.pendingKey ? draft.pendingKey : null;
  // This registration's own number, kept for as long as the form is open (or
  // from the draft it continues), so a resend is never taken for a new one.
  const [clientId] = useState(
    () => (draft && draft.client_id) || newClientId(),
  );
  // 0, 1, 2 are the question screens; 3 is the final check.
  const [step, setStep] = useState(0);
  // True when a screen was opened from the final check with "Change".
  const [fromReview, setFromReview] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const landKey = `${parseAcres(total)}|${parseAcres(cotton)}`;
  const isLarge = needsLargeConfirm(total, cotton, null, null);
  const confirmed = confirmedFor === landKey;

  function formData() {
    const totalValue = parseAcres(total);
    const cottonValue = parseAcres(cotton);
    return {
      first_name: first,
      middle_name: middle,
      last_name: last,
      gender: gender,
      growing_cotton: growingCotton === "" ? null : growingCotton === "yes",
      mobile: mobile,
      total_landholding: Number.isNaN(totalValue) ? null : totalValue,
      area_under_cotton: Number.isNaN(cottonValue) ? null : cottonValue,
      water_regime: water,
      confirmed_large: isLarge && confirmed,
      client_id: clientId,
    };
  }

  // No signal: keep the answers on this phone, to be sent from Sync later.
  function keepOnPhone(savedDraftId, submit) {
    const kept = addPending({
      key: waitingKey ?? undefined,
      lgId: lgId,
      lgCode: lgCode,
      draftId: savedDraftId,
      data: formData(),
      submit: submit,
    });
    if (!kept) {
      setErrors({
        form: "No connection, and this phone has no space to keep it. Please free some space and try again.",
      });
      return false;
    }
    onDone(
      "Saved on this phone. It is sent by itself as soon as there is signal.",
    );
    return true;
  }

  // Saves the current answers as a draft. Returns { id } or { errors }.
  async function saveDraft() {
    const url =
      draftId === null
        ? `http://localhost:8000/lgs/${lgId}/drafts`
        : `http://localhost:8000/drafts/${draftId}`;
    const response = await apiFetch(url, {
      method: draftId === null ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData()),
    });
    const data = await response.json();
    if (!response.ok) {
      return { errors: typeof data.detail === "object" ? data.detail : {} };
    }
    setDraftId(data.id);
    return { id: data.id };
  }

  async function handleSaveDraft() {
    if (
      name === "" &&
      gender === "" &&
      growingCotton === "" &&
      mobile.trim() === "" &&
      total.trim() === "" &&
      cotton.trim() === "" &&
      water === ""
    ) {
      setErrors({ form: "Nothing to save yet. Fill in at least one answer." });
      return;
    }
    const formatProblems = landFormatErrors(total, cotton);
    if (Object.keys(formatProblems).length > 0) {
      setErrors(formatProblems);
      return;
    }
    setBusy(true);
    if (keepOnPhone(draftId, false)) {
      return;
    }
    try {
      const result = await saveDraft();
      if (result.errors) {
        setErrors(result.errors);
      } else {
        onDone(
          "Draft saved. You can continue it later from the Drafts button.",
        );
        return;
      }
    } catch (error) {
      if (isNetworkError(error) && keepOnPhone(draftId, false)) {
        return;
      }
      if (!isNetworkError(error)) {
        setErrors({ form: "Something went wrong. Please try again." });
      }
    }
    setBusy(false);
  }

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
      onBack();
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

  async function handleSubmit() {
    setBusy(true);
    let savedId = draftId;
    if (keepOnPhone(draftId, true)) {
      return;
    }
    try {
      const saved = await saveDraft();
      if (saved.errors) {
        setErrors(saved.errors);
        setStep(screenOf(saved.errors));
        setBusy(false);
        return;
      }
      savedId = saved.id;

      const response = await apiFetch(
        `http://localhost:8000/drafts/${saved.id}/submit`,
        { method: "POST" },
      );
      const data = await response.json();

      if (response.ok) {
        onDone(`${name} was registered as ${data.farmer_code}.`);
        return;
      }
      const found = typeof data.detail === "object" ? data.detail : {};
      setErrors(found);
      setStep(screenOf(found));
    } catch (error) {
      if (isNetworkError(error) && keepOnPhone(savedId, true)) {
        return;
      }
      setErrors({
        form: isNetworkError(error)
          ? "Could not save. Please try again."
          : "Something went wrong. Please try again.",
      });
      setStep(3);
    }
    setBusy(false);
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
      <p className="fp-sub">Learning group {lgCode}</p>
    </div>
  );

  const messages = (
    <div>
      {errors.confirm_large && <p className="error">{errors.confirm_large}</p>}
      {errors.form && <p className="error">{errors.form}</p>}
      {errors.summary && <p className="error">{errors.summary}</p>}
    </div>
  );

  // The big buttons on the question screens.
  const stepBar = (
    <div className="fp-bar">
      <div className="fp-bar-inner">
        <div className="fp-bar-row">
          <button className="big-btn gray" onClick={back} disabled={busy}>
            Back
          </button>
          <button className="big-btn green" onClick={next} disabled={busy}>
            Next
          </button>
        </div>
        <button
          className="big-btn amber"
          onClick={handleSaveDraft}
          disabled={busy}
        >
          Save draft
        </button>
      </div>
    </div>
  );

  if (step === 3) {
    const groups = [
      [0, [["Name", name]]],
      [
        1,
        [
          ["Gender", gender],
          ["Mobile number", mobile.trim() || "Not given"],
        ],
      ],
      [
        2,
        [
          ["Growing cotton", growingCotton === "yes" ? "Yes" : "No"],
          ["Total land", `${parseAcres(total)} acres`],
          ["Cotton land", `${parseAcres(cotton)} acres`],
          ["Water regime", water],
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
                disabled={busy}
              >
                ✎ Change
              </button>
            </div>
            {rows.map(([label, value]) => (
              <div className="profile-row" key={label}>
                <span className="label">{label}</span>
                <span className="value">{value}</span>
              </div>
            ))}
          </div>
        ))}
        {messages}

        <div className="fp-bar">
          <div className="fp-bar-inner">
            {isLarge && !confirmed ? (
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
                  onClick={() => setConfirmedFor(landKey)}
                >
                  Yes, it is correct
                </button>
                <button className="big-btn gray" onClick={() => change(2)}>
                  No, let me change it
                </button>
              </div>
            ) : (
              <div className="fp-bar-inner">
                <button
                  className="big-btn green"
                  onClick={handleSubmit}
                  disabled={busy}
                >
                  {busy ? "Saving..." : "Save: add farmer"}
                </button>
                <button className="big-btn gray" onClick={back} disabled={busy}>
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="fp-page">
        {head("Add new farmer")}
        {dots}
        <h3 className="step-title">{STEP_TITLES[0]}</h3>
        <NameFields
          idPrefix="reg"
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
        {head("Add new farmer")}
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
          <label htmlFor="mobile">Mobile number (optional)</label>
          <input
            id="mobile"
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
      {head("Add new farmer")}
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
        idPrefix="reg"
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

export default RegisterFarmer;
