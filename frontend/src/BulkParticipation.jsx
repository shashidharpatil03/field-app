import { useState } from "react";
import { apiFetch } from "./api.js";

const REASONS = [
  "Moved away",
  "No longer growing cotton",
  "Lost interest",
  "Health or family reasons",
  "Other",
];

function BulkParticipation({ farmers, onDone }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const continuingCount = farmers.filter((f) => f.participation === "continuing").length;
  const droppedCount = farmers.length - continuingCount;

  if (continuingCount > 0 && droppedCount > 0) {
    return (
      <p className="message">
        You selected both continuing and dropped out farmers. Select only one kind
        at a time.
      </p>
    );
  }

  const dropping = continuingCount > 0;

  async function handleConfirm() {
    if (dropping && reason === "") {
      setErrors({ reason: "Please choose a reason" });
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(
        "http://localhost:8000/farmers/bulk-participation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmer_ids: farmers.map((f) => f.id),
            participation: dropping ? "dropped_out" : "continuing",
            reason: reason,
            note: note,
          }),
        }
      );
      const data = await response.json();

      if (response.ok) {
        onDone(
          dropping
            ? `${data.changed} farmers marked as dropped out.`
            : `${data.changed} farmers brought back to the programme.`
        );
        return;
      }
      setErrors(typeof data.detail === "object" ? data.detail : {});
    } catch {
      setErrors({ form: "Could not reach the server. Please try again." });
    }
    setSaving(false);
  }

  return (
    <div className="card">
      <h3>
        {dropping
          ? `Mark ${farmers.length} as dropped out`
          : `Bring back ${farmers.length} to the programme`}
      </h3>

      {dropping && (
        <div className="field">
          <label htmlFor="bulk-reason">Reason (applies to all selected)</label>
          <select
            id="bulk-reason"
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
        <label htmlFor="bulk-note">Note (optional)</label>
        <input
          id="bulk-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={errors.note ? "has-error" : ""}
        />
        {errors.note && <p className="error">{errors.note}</p>}
      </div>

      {errors.form && <p className="error">{errors.form}</p>}

      <button onClick={handleConfirm} disabled={saving}>
        {saving ? "Saving..." : `Confirm for ${farmers.length} farmers`}
      </button>
    </div>
  );
}

export default BulkParticipation;
