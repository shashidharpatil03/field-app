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
function DeleteFarmer({ farmer, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function close() {
    setOpen(false);
    setReason("");
    setNote("");
    setErrors({});
  }

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

  if (!open) {
    return (
      <div className="card danger-card">
        <h3>Added by mistake?</h3>
        <p>
          This farmer was registered this season, so you can delete them. They
          will disappear from all lists and counts.
        </p>
        <button className="danger" onClick={() => setOpen(true)}>
          Delete this farmer
        </button>
      </div>
    );
  }

  return (
    <div className="warning-box danger-box">
      <h3>Delete {farmer.farmer_code}?</h3>
      <p>
        {farmer.name} will be removed from all lists and counts. This cannot be
        undone from the app.
      </p>

      <fieldset className="radio-group">
        <legend>Reason</legend>
        {REASONS.map((text) => (
          <label key={text} className="radio">
            <input
              type="radio"
              name="delete-reason"
              checked={reason === text}
              onChange={() => setReason(text)}
            />
            {text}
          </label>
        ))}
      </fieldset>
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

      <button className="danger solid" onClick={handleDelete} disabled={saving}>
        {saving ? "Deleting..." : "Delete farmer"}
      </button>
      <button onClick={close} disabled={saving}>
        Keep farmer
      </button>
    </div>
  );
}

export default DeleteFarmer;
