import { useState } from "react";

const REASONS = [
  "Moved away",
  "No longer growing cotton",
  "Lost interest",
  "Health or family reasons",
  "Other",
];

function ParticipationChange({ farmer, onChanged }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const dropping = farmer.participation === "continuing";

  function close() {
    setOpen(false);
    setReason("");
    setNote("");
    setErrors({});
  }

  async function handleConfirm() {
    if (dropping && reason === "") {
      setErrors({ reason: "Please choose a reason" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `http://localhost:8000/farmers/${farmer.id}/participation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participation: dropping ? "dropped_out" : "continuing",
            reason: reason,
            note: note,
          }),
        }
      );
      const data = await response.json();

      if (response.ok) {
        close();
        onChanged();
        setSaving(false);
        return;
      }
      setErrors(typeof data.detail === "object" ? data.detail : {});
    } catch {
      setErrors({ form: "Could not reach the server. Please try again." });
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}>
        {dropping ? "Mark as dropped out" : "Bring back to programme"}
      </button>
    );
  }

  return (
    <div className="card">
      <h3>{dropping ? "Mark as dropped out" : "Bring back to programme"}</h3>

      {dropping && (
        <div className="field">
          <label htmlFor="drop-reason">Reason</label>
          <select
            id="drop-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={errors.reason ? "has-error" : ""}
          >
            <option value="">Choose...</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {errors.reason && <p className="error">{errors.reason}</p>}
        </div>
      )}

      <div className="field">
        <label htmlFor="participation-note">Note (optional)</label>
        <input
          id="participation-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={errors.note ? "has-error" : ""}
        />
        {errors.note && <p className="error">{errors.note}</p>}
      </div>

      {errors.form && <p className="error">{errors.form}</p>}

      <button onClick={handleConfirm} disabled={saving}>
        {saving ? "Saving..." : "Confirm"}
      </button>
      <button onClick={close} disabled={saving}>
        Cancel
      </button>
    </div>
  );
}

export default ParticipationChange;
