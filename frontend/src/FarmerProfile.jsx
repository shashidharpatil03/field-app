import { useState, useEffect } from "react";
import EditFarmer from "./EditFarmer.jsx";
import DropFarmer from "./DropFarmer.jsx";
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

function acres(value) {
  return value === null || value === undefined ? "Not recorded" : `${value} acres`;
}

// One details screen for every farmer. Only the note and the big buttons at
// the bottom change, depending on the farmer's status.
function FarmerProfile({ farmerId, onBack, onDeleted, locked = false }) {
  const [farmer, setFarmer] = useState(null);
  const [changes, setChanges] = useState([]);
  const [version] = useState(0);
  const [error, setError] = useState("");
  // "details", "edit", "drop" or "delete"
  const [view, setView] = useState("details");

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

  // Which kind of farmer this is decides the note and the buttons.
  const kind =
    farmer.season_status === "new"
      ? "new"
      : farmer.season_status === "to_update"
        ? "to_update"
        : farmer.season_status === "dropped" ||
            farmer.participation === "dropped_out"
          ? "dropped"
          : "continued";
  // Still to update: every answer is gone through. Dropped: brought back
  // the same way. Others: just change what is wrong.
  const editMode =
    kind === "to_update" ? "confirm" : kind === "dropped" ? "back" : "change";

  if (view === "edit") {
    return (
      <EditFarmer
        farmer={farmer}
        mode={editMode}
        onCancel={() => setView("details")}
        onSaved={onBack}
      />
    );
  }
  if (view === "drop") {
    return (
      <DropFarmer
        farmer={farmer}
        onCancel={() => setView("details")}
        onSaved={onBack}
      />
    );
  }
  if (view === "delete") {
    return (
      <DeleteFarmer
        farmer={farmer}
        onCancel={() => setView("details")}
        onDeleted={onDeleted}
      />
    );
  }

  let note = null;
  if (locked) {
    note = [
      "red",
      "This learning group was dropped. Its farmers cannot be changed or continued. Bring the group back first.",
    ];
  } else if (kind === "to_update") {
    note = [
      "warn",
      "Last year's answers are shown. Next, go through every answer with the farmer.",
    ];
  } else if (kind === "continued") {
    note = ["", "Already updated for this season."];
  } else if (kind === "new") {
    note = [
      "",
      "Added this season. A new farmer cannot drop out; if added by mistake, delete.",
    ];
  } else {
    note = ["gray", "Dropped out. You can bring the farmer back."];
  }

  const buttons = [];
  if (locked) {
    buttons.push(
      <button key="b" className="big-btn gray" onClick={onBack}>
        Back to list
      </button>,
    );
  } else if (kind === "to_update") {
    buttons.push(
      <button key="r" className="big-btn blue" onClick={() => setView("edit")}>
        Review and confirm details
      </button>,
      <button
        key="d"
        className="big-btn outline-red"
        onClick={() => setView("drop")}
      >
        ✖ Dropped out
      </button>,
    );
  } else if (kind === "continued") {
    buttons.push(
      <div key="row" className="fp-bar-row">
        <button className="big-btn amber" onClick={() => setView("edit")}>
          Change details
        </button>
        <button
          className="big-btn outline-red"
          onClick={() => setView("drop")}
        >
          ✖ Dropped out
        </button>
      </div>,
    );
  } else if (kind === "new") {
    buttons.push(
      <button key="c" className="big-btn amber" onClick={() => setView("edit")}>
        Change details
      </button>,
      <button
        key="x"
        className="big-btn outline-red"
        onClick={() => setView("delete")}
      >
        🗑 Delete farmer
      </button>,
    );
  } else {
    buttons.push(
      <button key="b" className="big-btn green" onClick={() => setView("edit")}>
        ↩ Bring back and review details
      </button>,
    );
  }

  return (
    <div className="fp-page">
      <button onClick={onBack}>← Back</button>

      <h1 className="fp-name">{farmer.name}</h1>
      <p className="fp-sub">
        {farmer.farmer_code} · {farmer.lg_code}
      </p>
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

      <p className={`fp-note ${note[0]}`}>{note[1]}</p>

      <div className="card">
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
        <div className="profile-row">
          <span className="label">Total land</span>
          <span className="value">{acres(farmer.total_landholding)}</span>
        </div>
        <div className="profile-row">
          <span className="label">Cotton land</span>
          <span className="value">{acres(farmer.area_under_cotton)}</span>
        </div>
        <div className="profile-row">
          <span className="label">Water regime</span>
          <span className="value">{farmer.water_regime || "Not recorded"}</span>
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

      <div className="fp-bar">
        <div className="fp-bar-inner">{buttons}</div>
      </div>
    </div>
  );
}

export default FarmerProfile;
