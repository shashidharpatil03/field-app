import { useState, useEffect } from "react";

function Facilitators({ selectedFfId, onSelect, onOpenFarmer }) {
  const [ffs, setFfs] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [puName, setPuName] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/ffs/summary")
      .then((response) => response.json())
      .then((data) => {
        setFfs(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedFfId === null) {
      return;
    }
    fetch(`http://localhost:8000/ffs/${selectedFfId}/farmers`)
      .then((response) => response.json())
      .then((data) => setFarmers(data));
  }, [selectedFfId]);

  if (loading) {
    return <p>Loading...</p>;
  }

  const puNames = [...new Set(ffs.map((f) => f.pu_name))];
  const visible = ffs.filter((f) => puName === "all" || f.pu_name === puName);

  if (selectedFfId !== null) {
    const ff = ffs.find((f) => f.id === selectedFfId);

    // Group the flat farmer list by learning group.
    const groups = [];
    for (const farmer of farmers) {
      let group = groups.find((g) => g.lg_code === farmer.lg_code);
      if (!group) {
        group = { lg_code: farmer.lg_code, village: farmer.village, farmers: [] };
        groups.push(group);
      }
      group.farmers.push(farmer);
    }

    return (
      <div>
        <button onClick={() => onSelect(null)}>← All facilitators</button>
        <h2>{ff.name}</h2>
        <p>
          {ff.pu_name} · {ff.lg_count} learning groups · {ff.farmer_count} farmers
        </p>

        {groups.map((g) => (
          <div className="card" key={g.lg_code}>
            <h3>{g.lg_code}</h3>
            <p>
              {g.village} · {g.farmers.length} farmers
            </p>
            <ul className="farmers">
              {g.farmers.map((f) => (
                <li key={f.id}>
                  <button
                    className="farmer-link"
                    onClick={() => onOpenFarmer(f.id)}
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
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1>Facilitators</h1>

      <div className="field">
        <label htmlFor="pu-filter">Producer unit</label>
        <select
          id="pu-filter"
          value={puName}
          onChange={(e) => setPuName(e.target.value)}
        >
          <option value="all">All producer units</option>
          {puNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {visible.map((f) => (
        <button className="ff-card" key={f.id} onClick={() => onSelect(f.id)}>
          <span className="ff-name">{f.name}</span>
          <span className="ff-count">
            {f.farmer_count} <small>farmers</small>
          </span>
          <span className="ff-detail">
            {f.pu_name} · {f.lg_count} learning groups
          </span>
        </button>
      ))}
    </div>
  );
}

export default Facilitators;
