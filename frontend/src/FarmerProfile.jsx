import { useState, useEffect } from "react";
import EditFarmer from "./EditFarmer.jsx";
import DeleteFarmer from "./DeleteFarmer.jsx";
import { apiFetch } from "./api.js";
import { formatDate } from "./dates.js";

const statusText = {
  new: "Newly added",
  continued: "Continued",
  to_update: "Still to update",
  dropped: "Dropped out",
};
const statusBadge = {
  new: "continuing",
  continued: "blue",
  to_update: "todo",
  dropped: "dropped_out",
};

function FarmerProfile({ farmerId, onBack, onDeleted, locked = false }) {
  const [farmer, setFarmer] = useState(null);
  const [changes, setChanges] = useState([]);
  const [version] = useState(0);
  const [error, setError] = useState("");

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

      <p>
        <span
          className={`badge ${statusBadge[farmer.season_status] ?? (farmer.participation === "dropped_out" ? "dropped_out" : "continuing")}`}
        >
          {statusText[farmer.season_status] ??
            (farmer.participation === "dropped_out"
              ? "Dropped out"
              : "Continuing")}
        </span>
      </p>

      {farmer.pending && (
        <p className="note">
          This farmer has changes waiting to be sent. They go by themselves when
          there is signal.
        </p>
      )}

      {locked ? (
        <div className="card">
          <p className="note">
            This learning group was dropped. Its farmers cannot be changed or
            continued. Bring the group back first.
          </p>
          <div className="profile-row">
            <span className="label">Gender</span>
            <span className="value">{farmer.gender}</span>
          </div>
          <div className="profile-row">
            <span className="label">Mobile number</span>
            <span className="value">{farmer.mobile || "(none)"}</span>
          </div>
          <div className="profile-row">
            <span className="label">Growing cotton</span>
            <span className="value">{farmer.growing_cotton ? "Yes" : "No"}</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <EditFarmer farmer={farmer} onCancel={onBack} onSaved={onBack} />
        </div>
      )}

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
        <div className="profile-row">
          <span className="label">Registered on</span>
          <span className="value">
            {farmer.registered_on
              ? formatDate(farmer.registered_on)
              : "Not recorded"}
            {farmer.registered_by_name && ` · by ${farmer.registered_by_name}`}
          </span>
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
                {formatDate(c.changed_on)}
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
