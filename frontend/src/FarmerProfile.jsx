import { useState, useEffect } from "react";
import EditFarmer from "./EditFarmer.jsx";
import ParticipationChange from "./ParticipationChange.jsx";
import { apiFetch } from "./api.js";

function FarmerProfile({ farmerId, onBack }) {
  const [farmer, setFarmer] = useState(null);
  const [changes, setChanges] = useState([]);
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(0);
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
          </span>
        </div>
        <div className="profile-row">
          <span className="label">Participation</span>
          <span className={`badge ${farmer.participation}`}>
            {farmer.participation === "continuing"
              ? "Continuing"
              : "Dropped out"}
          </span>
        </div>
      </div>

      <ParticipationChange
        farmer={farmer}
        onChanged={() => setVersion(version + 1)}
      />

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

      {changes.length > 0 && (
        <div className="card">
          <h3>Change history</h3>
          {changes.map((c) => (
            <p key={c.id} className="change">
              <strong>{c.field}:</strong> {c.old_value} → {c.new_value}
              <br />
              <small>
                {c.changed_on}
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
