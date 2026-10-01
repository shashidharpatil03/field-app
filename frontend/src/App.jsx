import { useState, useEffect } from "react";
import FarmerProfile from "./FarmerProfile.jsx";
import RegisterFarmer from "./RegisterFarmer.jsx";
import Facilitators from "./Facilitators.jsx";
import BulkMove from "./BulkMove.jsx";
import BulkParticipation from "./BulkParticipation.jsx";

function App() {
  const [lgs, setLgs] = useState([]);
  const [ffs, setFfs] = useState([]);
  const [movingId, setMovingId] = useState(null);
  const [newFfId, setNewFfId] = useState("");
  const [message, setMessage] = useState("");
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);
  const [farmersFor, setFarmersFor] = useState(null); // NEW
  const [farmers, setFarmers] = useState([]); // NEW
  const [showDropped, setShowDropped] = useState(false);
  const [view, setView] = useState("lgs");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedFfId, setSelectedFfId] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [registerLg, setRegisterLg] = useState(null);
  const [registerDraft, setRegisterDraft] = useState(null);
  const [draftsFor, setDraftsFor] = useState(null);
  const [drafts, setDrafts] = useState([]);

  function loadLgs() {
    fetch("http://localhost:8000/lgs")
      .then((response) => response.json())
      .then((data) => setLgs(data));
  }

  useEffect(() => {
    loadLgs();
    fetch("http://localhost:8000/ffs")
      .then((response) => response.json())
      .then((data) => setFfs(data));
  }, []);

  function startMove(lgId) {
    setMovingId(lgId);
    setNewFfId("");
    setMessage("");
  }

  function toggleHistory(lgId) {
    if (historyFor === lgId) {
      setHistoryFor(null);
      return;
    }
    fetch(`http://localhost:8000/lgs/${lgId}/assignments`)
      .then((response) => response.json())
      .then((data) => {
        setHistory(data);
        setHistoryFor(lgId);
      });
  }

  // NEW
  function toggleFarmers(lgId) {
    stopSelecting();
    if (farmersFor === lgId) {
      setFarmersFor(null);
      return;
    }
    fetch(`http://localhost:8000/lgs/${lgId}/farmers?include_dropped=${showDropped}`)
      .then((response) => response.json())
      .then((data) => {
        setFarmers(data);
        setFarmersFor(lgId);
      });
  }

  function changeShowDropped(lgId, checked) {
    setShowDropped(checked);
    fetch(`http://localhost:8000/lgs/${lgId}/farmers?include_dropped=${checked}`)
      .then((response) => response.json())
      .then((data) => setFarmers(data));
  }

  function toggleDrafts(lgId) {
    if (draftsFor === lgId) {
      setDraftsFor(null);
      return;
    }
    fetch(`http://localhost:8000/lgs/${lgId}/drafts`)
      .then((response) => response.json())
      .then((data) => {
        setDrafts(data);
        setDraftsFor(lgId);
      });
  }

  async function deleteDraft(lgId, draftId) {
    await fetch(`http://localhost:8000/drafts/${draftId}`, { method: "DELETE" });
    const response = await fetch(`http://localhost:8000/lgs/${lgId}/drafts`);
    setDrafts(await response.json());
    loadLgs();
  }

  function backFromProfile() {
    setProfileId(null);
    if (farmersFor !== null) {
      fetch(
        `http://localhost:8000/lgs/${farmersFor}/farmers?include_dropped=${showDropped}`
      )
        .then((response) => response.json())
        .then((data) => setFarmers(data));
    }
    loadLgs();
  }

  function startSelecting() {
    setSelecting(true);
    setSelectedIds([]);
  }

  function stopSelecting() {
    setSelecting(false);
    setSelectedIds([]);
  }

  function togglePicked(farmerId) {
    if (selectedIds.includes(farmerId)) {
      setSelectedIds(selectedIds.filter((id) => id !== farmerId));
    } else {
      setSelectedIds([...selectedIds, farmerId]);
    }
  }

  function selectAllContinuing() {
    setSelectedIds(
      farmers.filter((f) => f.participation === "continuing").map((f) => f.id)
    );
  }

  function bulkDone(text) {
    stopSelecting();
    setMessage(text);
    loadLgs();
    fetch(
      `http://localhost:8000/lgs/${farmersFor}/farmers?include_dropped=${showDropped}`
    )
      .then((response) => response.json())
      .then((data) => setFarmers(data));
    window.scrollTo({ top: 0 });
  }

  function closeRegister() {
    setRegisterLg(null);
    setRegisterDraft(null);
  }

  async function confirmMove(lg) {
    const response = await fetch(
      `http://localhost:8000/lgs/${lg.id}/reassign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_ff_id: Number(newFfId) }),
      }
    );
    const data = await response.json();

    if (response.ok) {
      const newFf = ffs.find((f) => f.id === Number(newFfId));
      setMessage(`${lg.lg_code} now belongs to ${newFf.name}.`);
      setMovingId(null);
      setHistoryFor(null);
      loadLgs();
    } else {
      setMessage(data.detail);
    }
  }

  if (profileId !== null) {
    return (
      <div className="page">
        <FarmerProfile farmerId={profileId} onBack={backFromProfile} />
      </div>
    );
  }

  if (registerLg !== null) {
    return (
      <div className="page">
        <RegisterFarmer
          lgId={registerLg.id}
          lgCode={registerLg.lg_code}
          draft={registerDraft}
          onBack={closeRegister}
          onDone={(text) => {
            closeRegister();
            setFarmersFor(null);
            setDraftsFor(null);
            setMessage(text);
            loadLgs();
          }}
        />
      </div>
    );
  }

  const tabs = (
    <div className="tabs">
      <button
        className={view === "lgs" ? "tab active" : "tab"}
        onClick={() => setView("lgs")}
      >
        Learning groups
      </button>
      <button
        className={view === "ffs" ? "tab active" : "tab"}
        onClick={() => setView("ffs")}
      >
        Facilitators
      </button>
      <button
        className={view === "move" ? "tab active" : "tab"}
        onClick={() => setView("move")}
      >
        Move groups
      </button>
    </div>
  );

  if (view === "move") {
    return (
      <div className="page">
        {tabs}
        <BulkMove />
      </div>
    );
  }

  if (view === "ffs") {
    return (
      <div className="page">
        {tabs}
        <Facilitators
          selectedFfId={selectedFfId}
          onSelect={setSelectedFfId}
          onOpenFarmer={setProfileId}
        />
      </div>
    );
  }

  return (
    <div className="page">
      {tabs}
      <h1>Learning groups</h1>
      {message && <p className="message">{message}</p>}

      {lgs.map((lg) => (
        <div className="card" key={lg.id}>
          <h3>{lg.lg_code}</h3>
          <p>{lg.village} · {lg.farmer_count} farmers</p>
          <p>Facilitator: {lg.ff_name ?? "Nobody yet"}</p>

          {movingId === lg.id ? (
            <div>
              <select
                value={newFfId}
                onChange={(e) => setNewFfId(e.target.value)}
              >
                <option value="">Choose a facilitator...</option>
                {ffs
                  .filter((f) => f.pu_id === lg.pu_id && f.name !== lg.ff_name)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
              <button onClick={() => confirmMove(lg)} disabled={newFfId === ""}>
                Confirm move
              </button>
              <button onClick={() => setMovingId(null)}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => startMove(lg.id)}>Move to another FF</button>
          )}

          <button onClick={() => toggleHistory(lg.id)}>
            {historyFor === lg.id ? "Hide history" : "History"}
          </button>

          {historyFor === lg.id && (
            <div className="history">
              {history.map((h) => (
                <p key={h.id}>
                  <strong>{h.ff_name}</strong>
                  <br />
                  {h.start_date} to {h.end_date ?? "now"}
                </p>
              ))}
            </div>
          )}

          <button onClick={() => setRegisterLg(lg)}>Register farmer</button>

          {lg.draft_count > 0 && (
            <button onClick={() => toggleDrafts(lg.id)}>
              {draftsFor === lg.id ? "Hide drafts" : `Drafts (${lg.draft_count})`}
            </button>
          )}

          {draftsFor === lg.id && (
            <ul className="drafts">
              {drafts.map((d) => (
                <li key={d.id}>
                  <strong>{d.name || "Unnamed farmer"}</strong>
                  <br />
                  <small>Saved {d.updated_at.replace("T", " ")}</small>
                  <br />
                  <button
                    onClick={() => {
                      setRegisterDraft(d);
                      setRegisterLg(lg);
                    }}
                  >
                    Continue
                  </button>
                  <button onClick={() => deleteDraft(lg.id, d.id)}>Delete</button>
                </li>
              ))}
            </ul>
          )}

          {/* NEW: farmers button and list */}
          <button onClick={() => toggleFarmers(lg.id)}>
            {farmersFor === lg.id ? "Hide farmers" : "View farmers"}
          </button>

          {farmersFor === lg.id && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={showDropped}
                onChange={(e) => changeShowDropped(lg.id, e.target.checked)}
              />
              Show dropped out farmers
            </label>
          )}

          {farmersFor === lg.id && !selecting && (
            <button onClick={startSelecting}>Select several farmers</button>
          )}

          {farmersFor === lg.id && selecting && (
            <div>
              <button onClick={selectAllContinuing}>Select all continuing</button>
              <button onClick={() => setSelectedIds([])}>Clear</button>
              <button onClick={stopSelecting}>Cancel</button>
              <p>{selectedIds.length} selected</p>

              {selectedIds.length > 0 && (
                <BulkParticipation
                  farmers={farmers.filter((f) => selectedIds.includes(f.id))}
                  onDone={bulkDone}
                />
              )}
            </div>
          )}

          {farmersFor === lg.id && (
            <ul className="farmers">
              {farmers.map((f) => (
                <li key={f.id}>
                  {selecting ? (
                    <label className="pick-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(f.id)}
                        onChange={() => togglePicked(f.id)}
                      />
                      <span>
                        <strong>{f.farmer_code}</strong> · {f.name}
                        {f.participation === "dropped_out" && (
                          <span className="badge dropped_out"> Dropped out</span>
                        )}
                      </span>
                    </label>
                  ) : (
                    <button
                      className="farmer-link"
                      onClick={() => setProfileId(f.id)}
                    >
                      <strong>{f.farmer_code}</strong> · {f.name}
                      {f.participation === "dropped_out" && (
                        <span className="badge dropped_out"> Dropped out</span>
                      )}
                      <br />
                      <small>
                        {f.gender} ·{" "}
                        {f.growing_cotton ? "Growing cotton" : "Not growing cotton"}
                      </small>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default App;