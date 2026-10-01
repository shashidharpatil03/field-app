import { useState, useEffect } from "react";
import { apiFetch } from "./api.js";

function BulkMove() {
  const [lgs, setLgs] = useState([]);
  const [ffs, setFfs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [puId, setPuId] = useState(null);
  const [village, setVillage] = useState("all");
  const [fromFf, setFromFf] = useState("all");
  const [selected, setSelected] = useState([]);
  const [newFfId, setNewFfId] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function loadLgs() {
    return apiFetch("http://localhost:8000/lgs")
      .then((response) => response.json())
      .then((data) => setLgs(data));
  }

  useEffect(() => {
    Promise.all([
      loadLgs(),
      apiFetch("http://localhost:8000/ffs")
        .then((response) => response.json())
        .then((data) => setFfs(data)),
    ]).then(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  // Producer units that exist, taken from the groups.
  const pus = [];
  for (const lg of lgs) {
    if (!pus.some((p) => p.id === lg.pu_id)) {
      pus.push({ id: lg.pu_id, name: lg.pu_name });
    }
  }
  const activePuId = puId ?? (pus.length > 0 ? pus[0].id : null);

  const lgsInPu = lgs.filter((lg) => lg.pu_id === activePuId);
  const villages = [...new Set(lgsInPu.map((lg) => lg.village))];
  const ffsInPu = ffs.filter((f) => f.pu_id === activePuId);

  const visible = lgsInPu.filter(
    (lg) =>
      (village === "all" || lg.village === village) &&
      (fromFf === "all" || String(lg.ff_id) === fromFf)
  );
  const allVisibleSelected =
    visible.length > 0 && visible.every((lg) => selected.includes(lg.id));

  function changePu(value) {
    setPuId(Number(value));
    setVillage("all");
    setFromFf("all");
    setSelected([]);
    setNewFfId("");
  }

  function toggleOne(lgId) {
    if (selected.includes(lgId)) {
      setSelected(selected.filter((id) => id !== lgId));
    } else {
      setSelected([...selected, lgId]);
    }
  }

  function toggleAllVisible() {
    const visibleIds = visible.map((lg) => lg.id);
    if (allVisibleSelected) {
      setSelected(selected.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelected([...new Set([...selected, ...visibleIds])]);
    }
  }

  const newFf = ffsInPu.find((f) => String(f.id) === newFfId);
  const chosen = lgsInPu.filter((lg) => selected.includes(lg.id));
  const toMove = chosen.filter((lg) => String(lg.ff_id) !== newFfId);
  const farmersMoving = toMove.reduce((sum, lg) => sum + lg.farmer_count, 0);
  const alreadyThere = chosen.length - toMove.length;

  async function handleConfirm() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("http://localhost:8000/lgs/bulk-reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lg_ids: selected,
          new_ff_id: Number(newFfId),
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setMessage(
          `${data.moved} learning group${data.moved === 1 ? "" : "s"} moved to ${newFf.name}.`
        );
        setSelected([]);
        setNewFfId("");
        await loadLgs();
      } else {
        setError(typeof data.detail === "string" ? data.detail : "Could not move");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <h2>Move groups</h2>
      <p>Choose learning groups and give them to another facilitator.</p>

      {message && <p className="message">{message}</p>}

      <div className="field">
        <label htmlFor="move-pu">Producer unit</label>
        <select
          id="move-pu"
          value={activePuId ?? ""}
          onChange={(e) => changePu(e.target.value)}
        >
          {pus.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="move-village">Village</label>
        <select
          id="move-village"
          value={village}
          onChange={(e) => setVillage(e.target.value)}
        >
          <option value="all">All villages</option>
          {villages.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="move-from">Current facilitator</label>
        <select
          id="move-from"
          value={fromFf}
          onChange={(e) => setFromFf(e.target.value)}
        >
          <option value="all">Anyone</option>
          {ffsInPu.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={toggleAllVisible}
        />
        Select all shown ({visible.length})
      </label>

      {visible.map((lg) => (
        <label className="card pick-card" key={lg.id}>
          <input
            type="checkbox"
            checked={selected.includes(lg.id)}
            onChange={() => toggleOne(lg.id)}
          />
          <span>
            <strong>{lg.lg_code}</strong>
            <br />
            {lg.village} · {lg.farmer_count} farmers
            <br />
            <small>Facilitator: {lg.ff_name ?? "Nobody yet"}</small>
          </span>
        </label>
      ))}

      {visible.length === 0 && <p>No learning groups match these filters.</p>}

      {selected.length > 0 && (
        <div className="card">
          <h3>Move {selected.length} selected</h3>

          <div className="field">
            <label htmlFor="move-to">New facilitator</label>
            <select
              id="move-to"
              value={newFfId}
              onChange={(e) => setNewFfId(e.target.value)}
            >
              <option value="">Choose a facilitator...</option>
              {ffsInPu.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {newFf && toMove.length > 0 && (
            <p>
              {toMove.length} learning group{toMove.length === 1 ? "" : "s"} (
              {farmersMoving} farmers) will move to <strong>{newFf.name}</strong>.
              {alreadyThere > 0 && ` ${alreadyThere} already with them (unchanged).`}
            </p>
          )}
          {newFf && toMove.length === 0 && (
            <p>All selected groups are already with {newFf.name}.</p>
          )}

          {error && <p className="error">{error}</p>}

          <button onClick={handleConfirm} disabled={busy || !newFf || toMove.length === 0}>
            {busy ? "Moving..." : "Confirm move"}
          </button>
          <button onClick={() => setSelected([])} disabled={busy}>
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}

export default BulkMove;
