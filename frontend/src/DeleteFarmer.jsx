import { useState } from "react";
import { apiFetch } from "./api.js";
import { isNetworkError, queueDelete, removePending } from "./offline.js";

const REASONS = [
  "Added by mistake",
  "Duplicate of another farmer",
  "Left the programme",
  "Other",
];

// Shown only for farmers registered this season. Deleting removes the
// farmer from every list and count. Farmers from earlier seasons are
// marked as dropped out instead, so last year's records stay complete.
function DeleteFarmer({ farmer, onCancel, onDeleted }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleDelete() {
    if (reason === "") {
      setErrors({ reason: "Please choose a reason" });
      return;
    }
    setSaving(true);
    // Still waiting to be registered: it never reached the server, so just
    // throw the waiting form away.
    if (farmer.id < 0) {
      removePending(farmer.pendingKey);
      onDeleted(`${farmer.name} was deleted.`);
      return;
    }
    // Save on the phone first: it is instant, and it goes to the server by
    // itself as soon as there is signal.
    if (queueDelete(farmer, { reason: reason, note: note })) {
      onDeleted(`${farmer.farmer_code} was deleted.`);
      return;
    }
    try {
      const response = await apiFetch(
        `http://localhost:8000/farmers/${farmer.id}/delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason, note: note }),
        },
      );
      const data = await response.json();
      if (response.ok) {
        onDeleted(`${farmer.farmer_code} was deleted.`);
        return;
      }
      setErrors(typeof data.detail === "object" ? data.detail : {});
    } catch (error) {
      // No signal: the delete waits on the phone and is sent later.
      if (
        isNetworkError(error) &&
        queueDelete(farmer, { reason: reason, note: note })
      ) {
        onDeleted(`${farmer.farmer_code} was deleted.`);
        return;
      }
      setErrors({ form: "Could not delete. Please try again." });
    }
    setSaving(false);
  }

  return (
    <div className="fp-page">
      <h2 className="step-title">Delete {farmer.farmer_code}?</h2>
      <p className="fp-sub">
        {farmer.name} will be removed from all lists and counts. This cannot be
        undone from the app.
      </p>

      {REASONS.map((text) => (
        <label
          key={text}
          className={`reason-card ${reason === text ? "on" : ""}`}
        >
          <input
            type="radio"
            name="delete-reason"
            checked={reason === text}
            onChange={() => {
              setReason(text);
              setErrors({});
            }}
          />
          {text}
        </label>
      ))}
      {errors.reason && <p className="error">{errors.reason}</p>}

      <div className="field">
        <label htmlFor="delete-note">Note (optional)</label>
        <input
          id="delete-note"
          type="text"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
        />
        {errors.note && <p className="error">{errors.note}</p>}
      </div>

      {errors.form && <p className="error">{errors.form}</p>}

      <div className="fp-bar">
        <div className="fp-bar-inner">
          <button
            className="big-btn red"
            onClick={handleDelete}
            disabled={saving}
          >
            {saving ? "Deleting..." : "Delete farmer"}
          </button>
          <button className="big-btn gray" onClick={onCancel} disabled={saving}>
            Keep farmer
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteFarmer;
