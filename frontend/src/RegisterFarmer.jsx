import { useState } from "react";
import { checkForm } from "./farmerRules.js";
import { apiFetch } from "./api.js";
import { addPending, isNetworkError } from "./offline.js";

function RegisterFarmer({ lgId, lgCode, draft, onBack, onDone }) {
  const [name, setName] = useState(draft ? draft.name : "");
  const [gender, setGender] = useState(draft ? draft.gender : "");
  const [growingCotton, setGrowingCotton] = useState(
    draft && draft.growing_cotton !== null
      ? draft.growing_cotton
        ? "yes"
        : "no"
      : ""
  );
  const [mobile, setMobile] = useState(draft ? draft.mobile : "");
  const [draftId, setDraftId] = useState(draft ? draft.id : null);
  const [step, setStep] = useState("form");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function formData() {
    return {
      name: name,
      gender: gender,
      growing_cotton: growingCotton === "" ? null : growingCotton === "yes",
      mobile: mobile,
    };
  }

  // No signal: keep the answers on this phone, to be sent from Sync later.
  function keepOnPhone(savedDraftId, submit) {
    const kept = addPending({
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
      "No connection, so this is saved on this phone. Open Sync when you have signal to send it."
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
      name.trim() === "" &&
      gender === "" &&
      growingCotton === "" &&
      mobile.trim() === ""
    ) {
      setErrors({ form: "Nothing to save yet. Fill in at least one answer." });
      return;
    }
    setBusy(true);
    try {
      const result = await saveDraft();
      if (result.errors) {
        setErrors(result.errors);
      } else {
        onDone("Draft saved. You can continue it later from the Drafts button.");
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
    const found = checkForm(name, gender, growingCotton, mobile);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setStep("review");
    }
  }

  async function handleSubmit() {
    setBusy(true);
    let savedId = draftId;
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
        { method: "POST" }
      );
      const data = await response.json();

      if (response.ok) {
        onDone(`${name.trim()} was registered as ${data.farmer_code}.`);
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
            <span className="value">{name.trim()}</span>
          </div>
          <div className="profile-row">
            <span className="label">Gender</span>
            <span className="value">{gender}</span>
          </div>
          <div className="profile-row">
            <span className="label">Growing cotton</span>
            <span className="value">{growingCotton === "yes" ? "Yes" : "No"}</span>
          </div>
          <div className="profile-row">
            <span className="label">Mobile number</span>
            <span className="value">{mobile.trim() || "Not given"}</span>
          </div>
        </div>

        {errors.form && <p className="error">{errors.form}</p>}

        <button onClick={handleSubmit} disabled={busy}>
          {busy ? "Submitting..." : "Submit"}
        </button>
        <button onClick={() => setStep("form")} disabled={busy}>
          Edit answers
        </button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h1>Register farmer</h1>
      <p>Learning group {lgCode}</p>

      <form onSubmit={handleReview} noValidate>
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

        {errors.form && <p className="error">{errors.form}</p>}

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
