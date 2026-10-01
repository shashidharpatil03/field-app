import { useState, useEffect } from "react";

function FarmerProfile({ farmerId, onBack }) {
  const [farmer, setFarmer] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`http://localhost:8000/farmers/${farmerId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load this farmer");
        }
        return response.json();
      })
      .then((data) => setFarmer(data))
      .catch((err) => setError(err.message));
  }, [farmerId]);

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
          <span className="label">Participation</span>
          <span className={`badge ${farmer.participation}`}>
            {farmer.participation === "continuing" ? "Continuing" : "Dropped out"}
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
    </div>
  );
}

export default FarmerProfile;
