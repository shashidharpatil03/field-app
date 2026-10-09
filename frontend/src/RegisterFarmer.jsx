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
import Required from "./Required.jsx";
import LandFields from "./LandFields.jsx";
import NameFields from "./NameFields.jsx";
import { apiFetch } from "./api.js";
import { addPending, isNetworkError, newClientId } from "./offline.js";

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
  const [step, setStep] = useState("form");
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
      "Saved on this phone. It will be sent by itself when there is signal.",
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
    if (waitingKey !== null && keepOnPhone(draftId, false)) {
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

  function handleReview(event) {
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
    setErrors(withSummary(found));
    if (Object.keys(found).length === 0) {
      setStep("review");
    }
  }

  async function handleSubmit() {
    setBusy(true);
    let savedId = draftId;
    if (waitingKey !== null && keepOnPhone(draftId, true)) {
      return;
    }
    try {
      const saved = await saveDraft();
      if (saved.errors) {
        setErrors(saved.errors);
        setStep("form");
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
      setErrors(typeof data.detail === "object" ? data.detail : {});
      setStep("form");
    } catch (error) {
      if (isNetworkError(error) && keepOnPhone(savedId, true)) {
        return;
      }
      setErrors({
        form: isNetworkError(error)
          ? "Could not save. Please try again."
          : "Something went wrong. Please try again.",
      });
      setStep("form");
    }
    setBusy(false);
  }

  if (step === "review") {
    return (
      <div>
        <h1>Review</h1>
        <p>Check the answers for {lgCode}, then submit.</p>

        <div className="card">
          <div className="profile-row">
            <span className="label">Full name</span>
            <span className="value">{name}</span>
          </div>
          <div className="profile-row">
            <span className="label">Gender</span>
            <span className="value">{gender}</span>
          </div>
          <div className="profile-row">
            <span className="label">Growing cotton</span>
            <span className="value">
              {growingCotton === "yes" ? "Yes" : "No"}
            </span>
          </div>
          <div className="profile-row">
            <span className="label">Mobile number</span>
            <span className="value">{mobile.trim() || "Not given"}</span>
          </div>
          <div className="profile-row">
            <span className="label">Total landholding</span>
            <span className="value">{parseAcres(total)} acres</span>
          </div>
          <div className="profile-row">
            <span className="label">Area under cotton</span>
            <span className="value">{parseAcres(cotton)} acres</span>
          </div>
          <div className="profile-row">
            <span className="label">Water regime</span>
            <span className="value">{water}</span>
          </div>
        </div>

        {isLarge && !confirmed && (
          <div className="warning-box" role="alert">
            <strong>This is unusual. Is it correct?</strong>
            <p>
              Most farmers have less than 50 acres, and you entered{" "}
              {parseAcres(total)} acres of land and {parseAcres(cotton)} acres
              of cotton.
            </p>
            <button onClick={() => setConfirmedFor(landKey)}>
              Yes, it is correct
            </button>
            <button onClick={() => setStep("form")}>No, edit answers</button>
          </div>
        )}

        {errors.form && <p className="error">{errors.form}</p>}

        {(!isLarge || confirmed) && (
          <div>
            <button onClick={handleSubmit} disabled={busy}>
              {busy ? "Submitting..." : "Submit"}
            </button>
            <button onClick={() => setStep("form")} disabled={busy}>
              Edit answers
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h1>Register farmer</h1>
      <p>Learning group {lgCode}</p>

      <form onSubmit={handleReview} noValidate>
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

        <div className="field">
          <label htmlFor="gender">
            Gender
            <Required />
          </label>
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
          <label htmlFor="cotton">
            Growing cotton this season?
            <Required />
          </label>
          <select
            id="cotton"
            value={growingCotton}
            onChange={(e) => {
              setGrowingCotton(e.target.value);
              setCotton(cottonAfterGrowingChange(e.target.value, cotton));
            }}
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

        {errors.confirm_large && (
          <p className="error">{errors.confirm_large}</p>
        )}
        {errors.form && <p className="error">{errors.form}</p>}
        {errors.summary && <p className="error">{errors.summary}</p>}

        <button type="submit" disabled={busy}>
          Review
        </button>
        <button type="button" onClick={handleSaveDraft} disabled={busy}>
          Save draft
        </button>
      </form>
    </div>
  );
}

export default RegisterFarmer;
