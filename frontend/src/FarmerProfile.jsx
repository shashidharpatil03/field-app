import { useState, useEffect } from "react";
import EditFarmer from "./EditFarmer.jsx";
import DeleteFarmer from "./DeleteFarmer.jsx";
import { apiFetch } from "./api.js";

// Where this farmer stands in this season's update of last season's data.
function SeasonStatus({ status, busy, error, onConfirm }) {
  const labels = {
    new: "Newly added this season",
    continued: "Continued this season",
    dropped: "Dropped out this season",
    to_update: "Still to update this season",
  };
  if (!labels[status]) {
    return null;
  }
  return (
    <div className="card">
      <div className="profile-row">
        <span className="label">This season</span>
        <span
          className={`badge ${status === "to_update" ? "neutral" : status === "dropped" ? "dropped_out" : "continuing"}`}
        >
          {labels[status]}
        </span>
      </div>
      {status === "to_update" && (
        <div>
          <p>
            Check the details with the farmer. If everything is still right,
            confirm. If something changed, use Edit details instead.
          </p>
          <button onClick={onConfirm} disabled={busy}>
            {busy ? "Confirming..." : "Confirm details for this season"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}

const statusText = {
  new: "Newly added",
  continued: "Continued",
  to_update: "Still to update",
  dropped: "Dropped out",
};
const statusBadge = {
  new: "continuing",
  continued: "continuing",
  to_update: "todo",
  dropped: "dropped_out",
};

function FarmerProfile({ farmerId, onBack, onDeleted }) {
  const [farmer, setFarmer] = useState(null);
  const [changes, setChanges] = useState([]);
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    apiFetch(`http://localhost:8000/farmers/${farmerId}/changes`)
      .then((response) => response.json())
      .then((data) => setChanges(data));

    apiFetch(`http://localhost:8000/farmers/${farmerId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load this farmer");
        }
        return response.json();
      })
      .then((data) => setFarmer(data))
      .catch((err) => setError(err.message));
  }, [farmerId, version]);

  async function confirmDetails() {
    setConfirming(true);
    setConfirmError("");
    try {
      const response = await apiFetch(
        `http://localhost:8000/farmers/${farmerId}/confirm`,
        { method: "POST" },
      );
      if (response.ok) {
        setVersion(version + 1);
      } else {
        const data = await response.json();
        setConfirmError(
          data.detail && data.detail.form
            ? data.detail.form
            : "Could not confirm. Please try again.",
        );
      }
    } catch {
      setConfirmError("Could not reach the server. Please try again.");
    }
    setConfirming(false);
  }

  if (error) {
    return (
      <div>
        <button onClick={onBack}>← Back</button>
        <p className="message">{error}</p>
      </div>
    );
  }

  if (farmer === null) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <button onClick={onBack}>← Back</button>

      <h1>{farmer.farmer_code}</h1>
      <h2>{farmer.name}</h2>

      <SeasonStatus
        status={farmer.season_status}
        busy={confirming}
        error={confirmError}
        onConfirm={confirmDetails}
      />

      {editing ? (
        <div className="card">
          <EditFarmer
            farmer={farmer}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              setVersion(version + 1);
            }}
          />
        </div>
      ) : (
        <button onClick={() => setEditing(true)}>Edit details</button>
      )}

      <div className="card">
        <div className="profile-row">
          <span className="label">Gender</span>
          <span className="value">{farmer.gender}</span>
        </div>
        <div className="profile-row">
          <span className="label">Growing cotton</span>
          <span className="value">{farmer.growing_cotton ? "Yes" : "No"}</span>
        </div>
        <div className="profile-row">
          <span className="label">Mobile number</span>
          <span className="value">{farmer.mobile ?? "Not given"}</span>
        </div>
        <div className="profile-row">
          <span className="label">Total landholding</span>
          <span className="value">
            {farmer.total_landholding === null
              ? "Not recorded"
              : `${farmer.total_landholding} acres`}
          </span>
        </div>
        <div className="profile-row">
          <span className="label">Area under cotton</span>
          <span className="value">
            {farmer.area_under_cotton === null
              ? "Not recorded"
              : `${farmer.area_under_cotton} acres`}
          </span>
        </div>
        <div className="profile-row">
          <span className="label">Water regime</span>
          <span className="value">{farmer.water_regime ?? "Not recorded"}</span>
        </div>
        <div className="profile-row">
          <span className="label">Registered on</span>
          <span className="value">
            {farmer.registered_on ?? "Not recorded"}
            {farmer.registered_by_name && ` · by ${farmer.registered_by_name}`}
          </span>
        </div>
        <div className="profile-row">
          <span className="label">Farmer continuity</span>
          <span
            className={`badge ${statusBadge[farmer.season_status] ?? (farmer.participation === "dropped_out" ? "dropped_out" : "continuing")}`}
          >
            {statusText[farmer.season_status] ??
              (farmer.participation === "dropped_out"
                ? "Dropped out"
                : "Continuing")}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="profile-row">
          <span className="label">Learning group</span>
          <span className="value">{farmer.lg_code}</span>
        </div>
        <div className="profile-row">
          <span className="label">Village</span>
          <span className="value">{farmer.village}</span>
        </div>
        <div className="profile-row">
          <span className="label">Producer unit</span>
          <span className="value">{farmer.pu_name}</span>
        </div>
        <div className="profile-row">
          <span className="label">Facilitator</span>
          <span className="value">{farmer.ff_name ?? "Nobody yet"}</span>
        </div>
      </div>

      {farmer.season_status === "new" && (
        <DeleteFarmer farmer={farmer} onDeleted={onDeleted} />
      )}

      {changes.length > 0 && (
        <div className="card">
          <h3>Change history</h3>
          {changes.map((c) => (
            <p key={c.id} className="change">
              {c.field === "Confirmed" ? (
                <strong>{c.new_value}</strong>
              ) : (
                <span>
                  <strong>{c.field}:</strong> {c.old_value} → {c.new_value}
                </span>
              )}
              <br />
              <small>
                {c.changed_on}
                {c.changed_by_name && ` · by ${c.changed_by_name}`}
                {c.reason && ` · ${c.reason}`}
              </small>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default FarmerProfile;
