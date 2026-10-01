import { useState, useEffect } from "react";
import FarmerProfile from "./FarmerProfile.jsx";
import RegisterFarmer from "./RegisterFarmer.jsx";

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
  const [profileId, setProfileId] = useState(null);
  const [registerLg, setRegisterLg] = useState(null);

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
    if (farmersFor === lgId) {
      setFarmersFor(null);
      return;
    }
    fetch(`http://localhost:8000/lgs/${lgId}/farmers`)
      .then((response) => response.json())
      .then((data) => {
        setFarmers(data);
        setFarmersFor(lgId);
      });
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
        <FarmerProfile farmerId={profileId} onBack={() => setProfileId(null)} />
      </div>
    );
  }

  if (registerLg !== null) {
    return (
      <div className="page">
        <RegisterFarmer
          lgId={registerLg.id}
          lgCode={registerLg.lg_code}
          onBack={() => setRegisterLg(null)}
          onDone={(text) => {
            setRegisterLg(null);
            setFarmersFor(null);
            setMessage(text);
            loadLgs();
          }}
        />
      </div>
    );
  }

  return (
    <div className="page">
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

          {/* NEW: farmers button and list */}
          <button onClick={() => toggleFarmers(lg.id)}>
            {farmersFor === lg.id ? "Hide farmers" : "View farmers"}
          </button>

          {farmersFor === lg.id && (
            <ul className="farmers">
              {farmers.map((f) => (
                <li key={f.id}>
                  <button
                    className="farmer-link"
                    onClick={() => setProfileId(f.id)}
                  >
                    <strong>{f.farmer_code}</strong> · {f.name}
                    <br />
                    <small>
                      {f.gender} ·{" "}
                      {f.growing_cotton ? "Growing cotton" : "Not growing cotton"}
                    </small>
                  </button>
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